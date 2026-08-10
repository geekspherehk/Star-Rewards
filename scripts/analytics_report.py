#!/usr/bin/env python3
"""
Star Rewards — growth / usage analytics report (SELECT-only, safe).

Reads DB credentials from api/.env.php and reports the KPIs the
'usage-first' strategy tracks:
  - registered users / families / family members
  - Weekly Active Families (WAF) and Weekly Active Users (WAU)
  - 30-day active families / users
  - event volume by type (all-time + last 7 days)
  - D1 / D7 retention from first-event cohorts
  - invite / share funnel (create_invite -> join_family, view/share poster)

Usage:
  python3 scripts/analytics_report.py            # full report
  python3 scripts/analytics_report.py --days 30  # wider retention window

Requires: pymysql
"""
import re
import sys
from datetime import datetime, timedelta

try:
    import pymysql
except ImportError:
    sys.exit("pymysql is required: pip install pymysql")


def load_config():
    src = open("api/.env.php", encoding="utf-8").read()
    def g(key):
        m = re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(key), src)
        return m.group(1) if m else None
    return {
        "host": g("DB_HOST"),
        "port": int(g("DB_PORT") or 3306),
        "user": g("DB_USER"),
        "password": g("DB_PASS"),
        "db": g("DB_NAME"),
    }


def q(cur, sql, args=None):
    cur.execute(sql, args or ())
    return cur.fetchall()


def main():
    days = 7
    if "--days" in sys.argv:
        i = sys.argv.index("--days")
        days = int(sys.argv[i + 1])
    cfg = load_config()
    conn = pymysql.connect(
        host=cfg["host"], port=cfg["port"], user=cfg["user"],
        password=cfg["password"], database=cfg["db"],
        connect_timeout=20, charset="utf8mb4",
    )
    cur = conn.cursor()
    now = datetime.now()
    since = now - timedelta(days=days)

    print("=" * 56)
    print(" Star Rewards — Growth / Usage Report")
    print(" Generated:", now.strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 56)

    # --- totals ---
    users = q(cur, "SELECT COUNT(*) FROM users")[0][0]
    families = q(cur, "SELECT COUNT(*) FROM families")[0][0]
    members = q(cur, "SELECT COUNT(*) FROM family_members")[0][0]
    profiles = q(cur, "SELECT COUNT(*) FROM profiles")[0][0]
    print("\n[Base totals]")
    print(f"  users={users}  families={families}  family_members={members}  child_profiles={profiles}")

    # --- active (analytics_events) ---
    def active(metric_col, window):
        sql = (f"SELECT COUNT(DISTINCT {metric_col}) FROM analytics_events "
               f"WHERE created_at >= %s")
        return q(cur, sql, (now - timedelta(days=window),))[0][0]

    fam_7 = active("family_id", 7)
    usr_7 = active("user_id", 7)
    fam_30 = active("family_id", 30)
    usr_30 = active("user_id", 30)
    print("\n[Active by analytics_events]")
    print(f"  WAF (families active <=7d) = {fam_7}")
    print(f"  WAU (users active   <=7d) = {usr_7}")
    print(f"  30d active families        = {fam_30}")
    print(f"  30d active users           = {usr_30}")

    # --- event volume by type ---
    print("\n[Event volume by type]")
    rows = q(cur,
             "SELECT event, COUNT(*) AS c, "
             "SUM(created_at >= %s) AS last7 "
             "FROM analytics_events GROUP BY event ORDER BY c DESC",
             (since,))
    if not rows:
        print("  (no events recorded yet)")
    for ev, c, l7 in rows:
        print(f"  {ev:<16} total={c:<6} last_{days}d={l7}")

    # --- retention from first-event cohorts ---
    print(f"\n[D1 / D7 retention (first-event cohort, window <= {days}d)]")
    first = q(cur,
              "SELECT user_id, DATE(MIN(created_at)) AS d "
              "FROM analytics_events GROUP BY user_id")
    if not first:
        print("  (no user events to compute retention)")
    else:
        d1_ok = d7_ok = 0
        for uid, d0 in first:
            if (now - datetime.combine(d0, datetime.min.time())).days > days:
                continue
            has = q(cur,
                    "SELECT COUNT(*) FROM analytics_events "
                    "WHERE user_id=%s AND DATE(created_at)=%s",
                    (uid, d0 + timedelta(days=1)))[0][0]
            has7 = q(cur,
                      "SELECT COUNT(*) FROM analytics_events "
                      "WHERE user_id=%s AND DATE(created_at)=%s",
                      (uid, d0 + timedelta(days=7)))[0][0]
            d1_ok += 1 if has else 0
            d7_ok += 1 if has7 else 0
        n = len(first)
        print(f"  cohort users (first event within {days}d) = {n}")
        print(f"  D1 retained = {d1_ok} ({d1_ok*100//n if n else 0}%)")
        print(f"  D7 retained = {d7_ok} ({d7_ok*100//n if n else 0}%)")

    # --- invite / share funnel ---
    print("\n[Invite / share funnel]")
    funnel = q(cur,
                "SELECT event, COUNT(*) FROM analytics_events "
                "WHERE event IN ('create_invite','join_family','view_poster','share_poster') "
                "GROUP BY event")
    fmap = {e: c for e, c in funnel}
    print(f"  create_invite = {fmap.get('create_invite',0)}")
    print(f"  join_family   = {fmap.get('join_family',0)}")
    print(f"  view_poster   = {fmap.get('view_poster',0)}")
    print(f"  share_poster  = {fmap.get('share_poster',0)}")

    conn.close()
    print("\n" + "=" * 56)


if __name__ == "__main__":
    main()
