#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""迁移前快照备份：导出生产库 users 表结构 + 全量数据到本地 JSON。只读，不写库。"""
import os, re, sys, json, datetime
import pymysql

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(REPO, 'api', '.env.php')

def parse_env(path):
    txt = open(path, encoding='utf-8').read()
    def get(key):
        m = re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(key), txt)
        return m.group(1) if m else None
    return {k: get(k) for k in ('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS')}

cfg = parse_env(ENV)
conn = pymysql.connect(host=cfg['DB_HOST'], port=int(cfg['DB_PORT'] or 3306),
                       user=cfg['DB_USER'], password=cfg['DB_PASS'],
                       database=cfg['DB_NAME'], charset='utf8mb4', connect_timeout=20)
cur = conn.cursor()

# 已存在列则快照里带上（幂等快照）
cur.execute("SHOW COLUMNS FROM users")
cols = [r[0] for r in cur.fetchall()]
cur.execute("SELECT * FROM users")
rows = cur.fetchall()

cur.execute("SHOW CREATE TABLE users")
ddl = cur.fetchone()[1]

snap = {
    'taken_at': datetime.datetime.now().isoformat(),
    'table': 'users',
    'row_count': len(rows),
    'columns': cols,
    'ddl': ddl,
    'rows': [dict(zip(cols, [str(v) if v is not None else None for v in r])) for r in rows],
}
out = os.path.join(REPO, 'database', 'backup_users_before_password_reset.json')
with open(out, 'w', encoding='utf-8') as f:
    json.dump(snap, f, ensure_ascii=False, indent=1)
print(f"✔ 快照完成：{len(rows)} 行 → {out}")
print("列：", ', '.join(cols))
conn.close()
