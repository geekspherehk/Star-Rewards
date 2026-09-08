#!/usr/bin/env python3
"""清理测试账号（生产库）。默认 dry-run 仅列出；--confirm 才真正删除。
仅匹配 %@example.com（全是测试账号，无真实用户）。
按外键链从叶子表→profiles→families→users 顺序删除，避免孤儿/约束冲突。
"""
import sys, re, pymysql

env_src = open('api/.env.php').read()
g = lambda k: re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(k), env_src).group(1)
DB = {k: g(k) for k in ['DB_HOST','DB_PORT','DB_NAME','DB_USER','DB_PASS']}
PATTERN = '%@example.com'

# 叶子表 → 其可能含的关联列（只删与测试账号/其家庭相关的行）
LEAF = {
    'analytics_events': ['user_id'],
    'user_configs':     ['user_id'],
    'behaviors':        ['user_id','profile_id'],
    'gifts':            ['user_id','profile_id'],
    'redeemed_gifts':   ['user_id','profile_id'],
    'wishes':           ['user_id','profile_id','family_id'],
    'checkins':         ['profile_id','family_id'],
    'monthly_focus':    ['user_id','profile_id','family_id'],
    'growth_indicators':['user_id','profile_id','family_id'],
    'user_badges':      ['user_id','profile_id','family_id'],
    'child_voice':      ['profile_id','family_id'],
    'milestones':       ['profile_id','family_id'],
    'growth_notes':     ['profile_id','family_id'],
    'family_members':   ['user_id','family_id'],
}

def main():
    confirm = '--confirm' in sys.argv
    conn = pymysql.connect(host=DB['DB_HOST'], port=int(DB['DB_PORT']),
                           user=DB['DB_USER'], password=DB['DB_PASS'],
                           database=DB['DB_NAME'], charset='utf8mb4')
    cur = conn.cursor()
    cur.execute("SELECT id,email,created_at FROM users WHERE email LIKE %s ORDER BY id", (PATTERN,))
    users = cur.fetchall()
    print(f"匹配账号 (LIKE '{PATTERN}'): {len(users)} 个")
    if not users:
        print('无匹配，退出'); conn.close(); return
    for uid, email, created in users:
        print(f"  - id={uid}  {email}  ({created})")
    uid_list = [u[0] for u in users]
    ph = ','.join(['%s']*len(uid_list))
    cur.execute(f"SELECT id,user_id,family_id FROM profiles WHERE user_id IN ({ph})", uid_list)
    profs = cur.fetchall()
    pid_list = [p[0] for p in profs]
    fid_list = list({p[2] for p in profs if p[2]})
    print(f"\n关联 profiles: {len(pid_list)} 个 | 关联 families: {len(fid_list)} 个")

    print("\n[计数] 各表将删行数:")
    totals = {}
    for tbl, cols in LEAF.items():
        conds = []
        params = []
        if 'user_id' in cols: conds.append(f"user_id IN ({ph})"); params += uid_list
        if 'profile_id' in cols and pid_list: conds.append(f"profile_id IN ({','.join(['%s']*len(pid_list))})"); params += pid_list
        if 'family_id' in cols and fid_list: conds.append(f"family_id IN ({','.join(['%s']*len(fid_list))})"); params += fid_list
        if not conds: continue
        cur.execute(f"SELECT COUNT(*) FROM `{tbl}` WHERE {' OR '.join(conds)}", params)
        c = cur.fetchone()[0]
        if c: totals[tbl] = c
    for t, c in totals.items():
        print(f"  {t}: {c}")

    if not confirm:
        print("\n[dry-run 完成，未删除。加 --confirm 执行]")
        conn.close(); return

    print("\n[CONFIRM] 删除中...")
    for tbl, cols in LEAF.items():
        conds, params = [], []
        if 'user_id' in cols: conds.append(f"user_id IN ({ph})"); params += uid_list
        if 'profile_id' in cols and pid_list: conds.append(f"profile_id IN ({','.join(['%s']*len(pid_list))})"); params += pid_list
        if 'family_id' in cols and fid_list: conds.append(f"family_id IN ({','.join(['%s']*len(fid_list))})"); params += fid_list
        if not conds: continue
        cur.execute(f"DELETE FROM `{tbl}` WHERE {' OR '.join(conds)}", params)
        print(f"  {tbl}: -{cur.rowcount}")
    cur.execute(f"DELETE FROM profiles WHERE user_id IN ({ph})", uid_list)
    print(f"  profiles: -{cur.rowcount}")
    if fid_list:
        fph = ','.join(['%s']*len(fid_list))
        cur.execute(f"DELETE FROM families WHERE id IN ({fph})", fid_list)
        print(f"  families: -{cur.rowcount}")
    cur.execute(f"DELETE FROM users WHERE id IN ({ph})", uid_list)
    print(f"  users: -{cur.rowcount}")
    conn.commit()
    print("[CONFIRM] 完成")
    conn.close()

if __name__ == '__main__':
    main()
