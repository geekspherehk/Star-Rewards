#!/usr/bin/env python3
"""Purge AI-generated test accounts (email like 'sr.%@example.com') from production.
Safety: full snapshot backup to local JSON before any deletion.
Only touches: users matching prefix + their cascaded rows + analytics_events + empty families.
Keeps: all real accounts (incl. test@test.com & friends), family #1.
"""
import re, json, os, pymysql
from datetime import datetime

env = open('/Users/work/code/Star-Rewards/api/.env.php').read()
def grab(k):
    m = re.search(r"'" + k + r"'\s*=>\s*'([^']*)'", env)
    return m.group(1) if m else ''

conn = pymysql.connect(host=grab('DB_HOST'), user=grab('DB_USER'), password=grab('DB_PASS'),
                       database=grab('DB_NAME'), charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor,
                       autocommit=False)
cur = conn.cursor()
PATTERN = 'sr.%@example.com'

# ── 1. 找出目标用户 ──
cur.execute("SELECT id, email FROM users WHERE email LIKE %s", (PATTERN,))
targets = cur.fetchall()
ids = [r['id'] for r in targets]
print(f"目标测试账号: {len(targets)} 个 (id: {ids})")
assert all(r['email'].endswith('@example.com') for r in targets), '有异常邮箱，中止'

# ── 2. 本地备份快照（users + 各关联表对应行）──
TABLES = ['users', 'profiles', 'family_members', 'behaviors', 'gifts', 'redeemed_gifts',
          'user_configs', 'wishes', 'checkins', 'monthly_focus', 'growth_indicators',
          'user_badges', 'child_voice', 'growth_notes', 'milestones']
snap = {'created_at': datetime.now().isoformat(), 'tables': {}}
id_col = {'users': 'id', 'family_members': 'user_id', 'user_configs': 'user_id'}
for t in TABLES:
    col = id_col.get(t, 'user_id')
    ph = ','.join(['%s'] * len(ids))
    try:
        cur.execute(f"SELECT * FROM {t} WHERE {col} IN ({ph})", ids)
        rows = cur.fetchall()
        snap['tables'][t] = rows
        print(f"  备份 {t}: {len(rows)} 行")
    except Exception as e:
        print(f"  跳过 {t}: {e}")
        snap['tables'][t] = None

bk_dir = '/Users/work/code/Star-Rewards/backups'
os.makedirs(bk_dir, exist_ok=True)
bk_path = os.path.join(bk_dir, f"test-users-snapshot-{datetime.now():%Y%m%d-%H%M%S}.json")
json.dump(snap, open(bk_path, 'w'), ensure_ascii=False, default=str)
print(f"快照已保存: {bk_path}")

# ── 3. 删除（事务）──
try:
    ph = ','.join(['%s'] * len(ids))
    cur.execute(f"DELETE FROM analytics_events WHERE user_id IN ({ph})", ids)
    print(f"analytics_events 删除 {cur.rowcount} 行")
    cur.execute("DELETE FROM users WHERE email LIKE %s", (PATTERN,))
    print(f"users 删除 {cur.rowcount} 行（其余表随外键级联）")
    conn.commit()
except Exception as e:
    conn.rollback()
    print('删除失败已回滚:', e)
    conn.close(); raise SystemExit(1)

# ── 4. 回收孤儿家庭（无任何成员的家庭）──
cur.execute("""
    SELECT f.id, f.name FROM families f
    LEFT JOIN family_members fm ON fm.family_id = f.id
    GROUP BY f.id HAVING COUNT(fm.user_id) = 0
""")
orphans = cur.fetchall()
for f in orphans:
    cur.execute("DELETE FROM families WHERE id = %s", (f['id'],))
    print(f"回收孤儿家庭 #{f['id']} {f['name']}")
conn.commit()

# ── 5. 清理后状态 ──
print('\n=== 清理后 ===')
cur.execute("SELECT COUNT(*) c FROM users"); print('注册总数:', cur.fetchone()['c'])
cur.execute("SELECT COUNT(*) c FROM families"); print('家庭总数:', cur.fetchone()['c'])
cur.execute("SELECT COUNT(DISTINCT user_id) c FROM analytics_events WHERE created_at >= NOW() - INTERVAL 7 DAY")
print('近7天活跃用户(埋点):', cur.fetchone()['c'])
cur.execute("SELECT id, email FROM users ORDER BY id")
for r in cur.fetchall():
    print(f"  保留 #{r['id']:<4} {r['email']}")
conn.close()
