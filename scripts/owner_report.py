#!/usr/bin/env python3
"""Read-only query: recent registrations + 7-day active users (for owner report)."""
import re, pymysql, sys

env = open('/Users/work/code/Star-Rewards/api/.env.php').read()
def grab(k):
    m = re.search(r"'" + k + r"'\s*=>\s*'([^']*)'", env)
    if not m:
        m = re.search(r"define\('" + k + r"'.*?'([^']*)'", env)
    return m.group(1) if m else ''

conn = pymysql.connect(host=grab('DB_HOST'), user=grab('DB_USER'),
                       password=grab('DB_PASS'), database=grab('DB_NAME'),
                       charset='utf8mb4', cursorclass=pymysql.cursors.DictCursor)
cur = conn.cursor()

print('=== 注册总数 / 本周新增 ===')
cur.execute("SELECT COUNT(*) c FROM users")
total = cur.fetchone()['c']
cur.execute("SELECT COUNT(*) c FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY")
week_new = cur.fetchone()['c']
cur.execute("SELECT COUNT(*) c FROM users WHERE created_at >= NOW() - INTERVAL 30 DAY")
mon_new = cur.fetchone()['c']
print(f"总数 {total} | 近7天新增 {week_new} | 近30天新增 {mon_new}")

print('\n=== 最近注册（最新 10） ===')
cur.execute("SELECT id, email, DATE_FORMAT(created_at, '%m-%d %H:%i') t FROM users ORDER BY created_at DESC LIMIT 10")
for r in cur.fetchall():
    print(f"  #{r['id']:<4} {r['email']:<40} {r['t']}")

print('\n=== 近 7 天活跃用户（有任意埋点事件） ===')
cur.execute("""
    SELECT u.id, u.email, COUNT(*) events, MAX(e.created_at) last_at,
           DATE_FORMAT(MAX(e.created_at), '%%m-%%d %%H:%%i') last_t
    FROM analytics_events e JOIN users u ON u.id = e.user_id
    WHERE e.created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY u.id, u.email ORDER BY last_at DESC
""")
rows = cur.fetchall()
print(f"共 {len(rows)} 人")
for r in rows:
    print(f"  #{r['id']:<4} {r['email']:<40} 事件{r['events']:<4} 最后活跃 {r['last_t']}")

print('\n=== 近 7 天活跃家庭 ===')
cur.execute("""
    SELECT f.name, f.invite_code, COUNT(DISTINCT e.user_id) users, MAX(e.created_at) last_at
    FROM analytics_events e
    JOIN families f ON f.id = e.family_id
    WHERE e.created_at >= NOW() - INTERVAL 7 DAY AND e.family_id IS NOT NULL
    GROUP BY f.id ORDER BY last_at DESC LIMIT 8
""")
for r in cur.fetchall():
    print(f"  {str(r['name'])[:20]:<22} 成员活跃 {r['users']}  最后 {r['last_at']}")

conn.close()
