#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
演示/验证辅助：把某个临时账号下的愿望 created_at 往前挪，好让首页「近 7 天点阵」
出现「漏卡」状态（点阵把目标建立之前的日子算作 before，不算漏卡，所以当天建的
愿望看不到琥珀漏卡点）。

安全阀：只允许操作邮箱前缀为 sr.shotdot. / sr.btnprobe. / sr.demo. 的账号。

用法:
  python3 scripts/dev_backdate_wish.py <email> <days_ago>
"""
import os
import re
import sys
from datetime import date, timedelta

import pymysql

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(REPO, 'api', '.env.php')
ALLOW = ('sr.shotdot.', 'sr.btnprobe.', 'sr.demo.', 'sr.checkin.')


def parse_env(path):
    txt = open(path, encoding='utf-8').read()

    def get(key):
        m = re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(key), txt)
        return m.group(1) if m else None
    return {'host': get('DB_HOST'), 'port': int(get('DB_PORT') or 3306),
            'db': get('DB_NAME'), 'user': get('DB_USER'), 'pass': get('DB_PASS')}


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    email, days = sys.argv[1].strip().lower(), int(sys.argv[2])
    if not email.startswith(ALLOW):
        print('✘ 安全阀：只允许操作临时演示账号（%s 前缀）' % ' / '.join(ALLOW))
        sys.exit(1)

    cfg = parse_env(ENV)
    conn = pymysql.connect(host=cfg['host'], port=cfg['port'], user=cfg['user'],
                           password=cfg['pass'], database=cfg['db'], charset='utf8mb4')
    cur = conn.cursor()
    cur.execute('SELECT id FROM users WHERE email = %s', (email,))
    row = cur.fetchone()
    if not row:
        print('✘ 找不到用户', email)
        sys.exit(1)
    uid = row[0]
    target = (date.today() - timedelta(days=days)).strftime('%Y-%m-%d 09:00:00')
    cur.execute('UPDATE wishes SET created_at = %s WHERE user_id = %s AND status = %s',
                (target, uid, 'active'))
    conn.commit()
    print('✔ 已把 user_id=%s 的 active 愿望 created_at 改为 %s（影响 %d 行）' % (uid, target, cur.rowcount))
    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
