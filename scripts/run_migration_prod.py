#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
一次性生产库迁移执行器（仅用于本次 v2 上线）。
- 从 api/.env.php 解析数据库凭据（不写死、不打印密码）
- 运行 database/v2_migration.sql（增量、幂等）
- 打印迁移前后的表清单作为审计
"""
import os
import re
import sys
import pymysql

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(REPO, 'api', '.env.php')
SQL = os.path.join(REPO, 'database', 'v2_migration.sql')


def parse_env(path):
    txt = open(path, encoding='utf-8').read()
    def get(key):
        m = re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(key), txt)
        return m.group(1) if m else None
    return {
        'host': get('DB_HOST'), 'port': int(get('DB_PORT') or 3306),
        'db': get('DB_NAME'), 'user': get('DB_USER'), 'pass': get('DB_PASS'),
    }


def show_tables(conn):
    cur = conn.cursor()
    cur.execute('SHOW TABLES')
    return sorted(r[0] for r in cur.fetchall())


def main():
    if not (os.path.exists(ENV) and os.path.exists(SQL)):
        print('✘ 缺少 .env.php 或 v2_migration.sql'); sys.exit(1)
    cfg = parse_env(ENV)
    print(f"连接生产库 {cfg['host']}:{cfg['port']} / {cfg['db']} ...")
    conn = pymysql.connect(host=cfg['host'], port=cfg['port'], user=cfg['user'],
                           password=cfg['pass'], database=cfg['db'],
                           charset='utf8mb4', connect_timeout=20)
    print('✔ 已连接')
    print('BEFORE tables:', show_tables(conn))

    raw = open(SQL, encoding='utf-8').read()
    parts = [p.strip() for p in raw.split(';')]
    cur = conn.cursor()
    ok = 0
    total = 0
    for i, part in enumerate(parts, 1):
        # 逐行去掉整行注释（-- 开头），再拼回语句
        lines = [l for l in part.splitlines() if not l.strip().startswith('--')]
        st_clean = '\n'.join(lines).strip()
        if not st_clean:
            continue
        total += 1
        try:
            cur.execute(st_clean)
            ok += 1
            print(f"  [{i}] ✔ {st_clean.splitlines()[0][:60]}")
        except Exception as e:
            print(f"  [{i}] ✘ 跳过: {e}")
    conn.commit()
    print(f"迁移语句执行: {ok}/{total} 成功")
    print('AFTER  tables:', show_tables(conn))
    conn.close()
    print('✔ 迁移完成')


if __name__ == '__main__':
    main()
