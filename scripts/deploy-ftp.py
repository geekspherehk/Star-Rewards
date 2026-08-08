#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Star-Rewards FTP 部署工具
用法:
  python3 scripts/deploy-ftp.py <file1> [file2 ...]      # 上传指定文件（相对仓库根目录）
  python3 scripts/deploy-ftp.py --all-changed            # 上传相对 origin 分支最近未部署的改动文件（危险，谨慎用）
凭据读取: scripts/.ftp-creds.json（已 gitignore，参考 .ftp-creds.example.json）
"""
import ftplib
import json
import os
import sys

CREDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.ftp-creds.json')
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_creds():
    if not os.path.exists(CREDS_FILE):
        print("✘ 缺少凭据文件 scripts/.ftp-creds.json（参考 .ftp-creds.example.json）")
        sys.exit(1)
    with open(CREDS_FILE) as f:
        return json.load(f)


def connect(creds):
    ftp_class = ftplib.FTP_TLS if creds.get('use_tls', True) else ftplib.FTP
    ftp = ftp_class()
    host = creds['host'].replace('ftp://', '').replace('ftps://', '').rstrip('/')
    ftp.connect(host, int(creds.get('port', 21)), timeout=30)
    ftp.login(creds['user'], creds['password'])
    if isinstance(ftp, ftplib.FTP_TLS):
        ftp.prot_p()  # 显式 TLS 数据连接
    ftp.set_pasv(True)
    print(f"✔ 已连接 {host}:{creds.get('port', 21)}")
    return ftp


def ensure_dir(ftp, remote_dir):
    parts = [p for p in remote_dir.split('/') if p]
    cur = ''
    for p in parts:
        cur += '/' + p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass  # 已存在


def upload(ftp, remote_root, local_file):
    rel = os.path.relpath(local_file, REPO_ROOT)
    remote_path = (remote_root + '/' + rel.replace(os.sep, '/')) if remote_root else rel.replace(os.sep, '/')
    ensure_dir(ftp, os.path.dirname(remote_path))
    with open(local_file, 'rb') as f:
        ftp.storbinary(f'STOR {remote_path}', f)
    size = os.path.getsize(local_file)
    print(f"✔ 已上传 {rel} ({size} bytes) -> {remote_path}")


def main():
    creds = load_creds()
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    targets = sys.argv[1:]
    if '--all-changed' in targets:
        # 上传相对 origin 未提交的改动（仅 tracked 修改，不含未跟踪文件）
        import subprocess
        out = subprocess.check_output(
            ['git', 'diff', '--name-only', 'HEAD'], cwd=REPO_ROOT, text=True).strip()
        targets = [l for l in out.splitlines() if l]
        if not targets:
            print("没有未提交的改动")
            sys.exit(0)
        print("将上传:", targets)

    ftp = connect(creds)
    remote_root = creds['remote_root'].strip('/')
    ok = 0
    for t in targets:
        local = t if os.path.isabs(t) else os.path.join(REPO_ROOT, t)
        if not os.path.exists(local):
            print(f"✘ 本地文件不存在: {t}")
            continue
        try:
            upload(ftp, remote_root, local)
            ok += 1
        except Exception as e:
            print(f"✘ 上传失败 {t}: {e}")
    ftp.quit()
    print(f"\n完成：成功 {ok}/{len(targets)}")


if __name__ == '__main__':
    main()
