#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Star-Rewards FTP 部署工具（推送前自动做本地检查，保护线上用户）

用法:
  python3 scripts/deploy-ftp.py <file1> [file2 ...]   # 上传指定文件（相对仓库根目录）
  python3 scripts/deploy-ftp.py --all-changed         # 上传相对 HEAD 未提交的改动文件（谨慎）
  python3 scripts/deploy-ftp.py --skip-check <files>  # 跳过本地检查直接上传（不推荐，需人工确认）
  python3 scripts/deploy-ftp.py --check-only <files>  # 只跑本地检查，不上传

流程（默认强制）:
  1. 本地检查（preflight）: .js → node --check；.php → php-parser 语法解析；.html → div 标签平衡
     —— 任何一项失败即中止，绝不推送，避免影响线上用户
  2. FTP 上传（FTPS，被动模式）
  3. --verify: 用 site_url（凭据里配置）curl 线上文件，对比字节数是否与本地一致

凭据读取: scripts/.ftp-creds.json（已 gitignore，参考 .ftp-creds.example.json）
"""
import ftplib
import json
import os
import shutil
import subprocess
import sys
import urllib.request

CREDS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.ftp-creds.json')
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# php-parser 所在的 managed node workspace（本地无 php CLI 时用它验证 PHP 语法）
PHP_PARSER_NODE_PATH = os.path.expanduser(
    '~/.workbuddy/binaries/node/workspace/node_modules')
PHP_CHECK_SCRIPT = """
const fs=require('fs');const parser=require('php-parser');
try{new parser.Engine({parser:{php7:true,suppressErrors:false}}).parseCode(fs.readFileSync(process.argv[1],'utf8'));}
catch(e){console.error(e.message);process.exit(1);}
"""


def load_creds():
    if not os.path.exists(CREDS_FILE):
        print("✘ 缺少凭据文件 scripts/.ftp-creds.json（参考 .ftp-creds.example.json）")
        sys.exit(1)
    with open(CREDS_FILE) as f:
        return json.load(f)


def node_bin():
    n = shutil.which('node')
    if n:
        return n
    fallback = os.path.expanduser('~/.workbuddy/binaries/node/versions/22.22.2/bin/node')
    return fallback if os.path.exists(fallback) else None


def preflight(targets):
    """推送前本地检查：JS/PHP/HTML。返回问题列表，空 = 通过。"""
    node = node_bin()
    issues = []
    for t in targets:
        local = t if os.path.isabs(t) else os.path.join(REPO_ROOT, t)
        if not os.path.exists(local):
            issues.append(f"{t}: 本地文件不存在")
            continue
        if local.endswith('.js'):
            if not node:
                issues.append(f"{t}: 找不到 node，无法做 JS 语法检查")
            else:
                r = subprocess.run([node, '--check', local], capture_output=True, text=True)
                if r.returncode != 0:
                    issues.append(f"{t}: JS 语法错误\n  {r.stderr.strip()[:500]}")
        elif local.endswith('.php'):
            if not node or not os.path.isdir(PHP_PARSER_NODE_PATH):
                issues.append(f"{t}: 找不到 php-parser，无法做 PHP 语法检查（推送 PHP 必须检查）")
            else:
                env = dict(os.environ, NODE_PATH=PHP_PARSER_NODE_PATH)
                r = subprocess.run([node, '-e', PHP_CHECK_SCRIPT, local],
                                   capture_output=True, text=True, env=env)
                if r.returncode != 0:
                    issues.append(f"{t}: PHP 语法错误\n  {r.stderr.strip()[:500]}")
        elif local.endswith('.html'):
            src = open(local, encoding='utf-8').read()
            if src.count('<div') != src.count('</div>'):
                issues.append(f"{t}: HTML div 标签不平衡 "
                              f"(<div> {src.count('<div')} / </div> {src.count('</div')})")
    return issues


def verify_live(targets):
    """上传后用 site_url curl 线上文件，比对字节数。返回 (ok_count, total)。"""
    creds = load_creds()
    base = creds.get('site_url', '').rstrip('/')
    if not base:
        print("⚠ 凭据未配置 site_url，跳过线上验证（建议配置）")
        return None
    ok = 0
    for t in targets:
        local = t if os.path.isabs(t) else os.path.join(REPO_ROOT, t)
        if not os.path.exists(local):
            continue
        rel = os.path.relpath(local, REPO_ROOT).replace(os.sep, '/')
        try:
            with urllib.request.urlopen(base + '/' + rel, timeout=20) as r:
                data = r.read()
            local_size = os.path.getsize(local)
            mark = '✔' if len(data) == local_size else '✘'
            if len(data) == local_size:
                ok += 1
            print(f"{mark} 线上 {rel}: {len(data)} bytes（本地 {local_size} bytes）")
        except Exception as e:
            print(f"✘ 线上验证失败 {rel}: {e}")
    return ok


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
    for p in [x for x in remote_dir.split('/') if x]:
        cur = '/' + p
        try:
            ftp.mkd(cur)
        except ftplib.error_perm:
            pass  # 已存在


def resolve_remote_root(ftp, remote_root):
    """解析站点根目录。
    注意：本服务器（Hostinger）FTP 登录即落在 web 根（pwd=/public_html 但即站点根），
    NLST 在此服务器返回的是家目录（不可信）→ 只用 cwd 探测；探测失败则回退到登录目录（空）。"""
    if remote_root:
        try:
            ftp.cwd(remote_root)
            print(f"✔ remote_root 使用 '{remote_root}'")
            return remote_root
        except ftplib.error_perm:
            print(f"⚠ 远程无 '{remote_root}' 目录 → 回退使用登录目录（FTP 登录目录即站点根）")
    return ''


def upload(ftp, remote_root, local_file):
    rel = os.path.relpath(local_file, REPO_ROOT)
    remote_path = (remote_root + '/' + rel.replace(os.sep, '/')) if remote_root else rel.replace(os.sep, '/')
    ensure_dir(ftp, os.path.dirname(remote_path))
    try:
        ftp.cwd('/')  # 相对路径上传时确保落在 FTP 根
    except ftplib.error_perm:
        pass
    with open(local_file, 'rb') as f:
        ftp.storbinary(f'STOR {remote_path}', f)
    print(f"✔ 已上传 {rel} ({os.path.getsize(local_file)} bytes) -> {remote_path}")


def main():
    creds = load_creds()
    args = [a for a in sys.argv[1:] if a]

    skip_check = '--skip-check' in args
    check_only = '--check-only' in args
    do_verify = '--verify' in args
    args = [a for a in args if a not in ('--skip-check', '--check-only', '--verify')]

    targets = args
    if '--all-changed' in targets:
        targets = [x for x in targets if x != '--all-changed']
        out = subprocess.check_output(
            ['git', 'diff', '--name-only', 'HEAD'], cwd=REPO_ROOT, text=True).strip()
        targets += [l for l in out.splitlines() if l]
    if not targets:
        print(__doc__)
        sys.exit(1)

    print(f"待部署文件: {targets}\n")

    # 1) 本地检查（默认强制）
    if skip_check:
        print("⚠⚠ 已跳过本地检查（--skip-check）——风险自负！\n")
    else:
        print("== 1/3 本地检查 ==")
        issues = preflight(targets)
        if issues:
            print("✘ 本地检查未通过，中止推送（保护线上用户）:")
            for i in issues:
                print("  -", i)
            sys.exit(1)
        print("✔ 本地检查全部通过（JS/PHP/HTML）\n")
        if check_only:
            print("== --check-only，未推送 ==")
            sys.exit(0)

    # 2) FTP 上传
    print("== 2/3 FTP 上传 ==")
    ftp = connect(creds)
    remote_root = resolve_remote_root(ftp, creds['remote_root'].strip('/'))
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
    print(f"\n完成：上传成功 {ok}/{len(targets)}")

    # 3) 线上验证（可选）
    if do_verify and ok:
        print("\n== 3/3 线上验证 ==")
        verify_live([t for t in targets if os.path.exists(
            t if os.path.isabs(t) else os.path.join(REPO_ROOT, t))])


if __name__ == '__main__':
    main()
