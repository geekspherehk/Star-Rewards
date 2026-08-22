#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按用户批准的映射，为生产库 27 条真实行为补填 dimension。
- 执行前打印快照（回滚用：UPDATE behaviors SET dimension=NULL WHERE id IN ...）
- 幂等：仅更新指定 id；测试/导入数据不动
"""
import os, re, json, pymysql
REPO = '/Users/work/code/Star-Rewards'
txt = open(os.path.join(REPO, 'api', '.env.php'), encoding='utf-8').read()
def g(k):
    m = re.search(r"'%s'\s*=>\s*'([^']*)'" % re.escape(k), txt)
    return m.group(1) if m else None
cfg = {'host': g('DB_HOST'), 'port': int(g('DB_PORT') or 3306), 'db': g('DB_NAME'),
       'user': g('DB_USER'), 'pass': g('DB_PASS')}
conn = pymysql.connect(host=cfg['host'], port=cfg['port'], user=cfg['user'],
                       password=cfg['pass'], database=cfg['db'], charset='utf8mb4', connect_timeout=20)
cur = conn.cursor()

MAP = {
    'self_drive': [48, 47, 29, 25, 24, 23, 21, 22, 16, 11, 4, 3],
    'health':     [31, 30, 26, 20, 28, 27, 12, 1, 13],
    'empathy':    [32, 19, 18, 17, 15, 14],
}
all_ids = [i for v in MAP.values() for i in v]

# 1) 快照（回滚记录）
cur.execute('SELECT id, family_id, profile_id, description, points, dimension FROM behaviors WHERE id IN (%s)' %
            ','.join(['%s'] * len(all_ids)), all_ids)
snap = cur.fetchall()
with open('/tmp/behaviors_dim_backfill_snapshot.json', 'w', encoding='utf-8') as f:
    json.dump([list(r) for r in snap], f, ensure_ascii=False, default=str)
print('✔ 快照已保存 /tmp/behaviors_dim_backfill_snapshot.json')
print('  回滚命令: UPDATE behaviors SET dimension=NULL WHERE id IN (%s)' % ','.join(map(str, all_ids)))

# 2) UPDATE
cases = ' '.join(f'WHEN {i} THEN \'{d}\'' for d, ids in MAP.items() for i in ids)
sql = ('UPDATE behaviors SET dimension = CASE id %s END WHERE id IN (%s)' %
       (cases, ','.join(['%s'] * len(all_ids))))
cur.execute(sql, all_ids)
conn.commit()
print(f'✔ 已更新 {cur.rowcount} 条 behaviors.dimension')

# 3) 验证
cur.execute('SELECT dimension, COUNT(*) FROM behaviors GROUP BY dimension')
print('AFTER by dim:', sorted(cur.fetchall(), key=lambda r: -(r[1] or 0)))
conn.close()
