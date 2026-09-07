#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""注册演示账号并灌入真实数据（8 大素养愿望 + 多日打卡），供营销素材截图用。"""
import json, time, urllib.request

BASE = 'https://stellar.gaocaihk.com/api/index.php'
EMAIL = 'sr.demo.showcase@example.com'
PASS = 'DemoShowcase2026!'

def api(action, payload=None, token=None):
    data = json.dumps(payload or {}).encode()
    req = urllib.request.Request(f'{BASE}?action={action}', data=data,
                                 headers={'Content-Type': 'application/json',
                                          **({'Authorization': 'Bearer ' + token} if token else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read())

def main():
    # 1) 注册（已存在则直接登录）
    try:
        r = api('register', {'email': EMAIL, 'password': PASS})
    except Exception:
        r = api('login', {'email': EMAIL, 'password': PASS})
    token = r['token']
    print('token ok, user_id =', r.get('user_id'))

    # 2) 建孩子档案（family owner 注册时自动建了一个默认家庭）
    try:
        r['profiles'] and None
    except Exception:
        pass
    profiles = r.get('profiles') or []
    if not profiles:
        p = api('addProfile', {'name': '小星', 'avatar': '🌟', 'color': '#6C5CE7'}, token)
        profiles = [p.get('profile') or p]
    pid = profiles[0].get('id') if isinstance(profiles[0], dict) else profiles[0]
    print('profile_id =', pid)
    prof = {'profile_id': pid}

    # 3) 8 大素养各建一个愿望
    cats = ['self_drive', 'money', 'empathy', 'relationship', 'planning', 'resilience', 'health', 'aesthetics']
    titles = {
        'self_drive': '自己整理书包', 'money': '每周记账一次', 'empathy': '帮妈妈做一件家务',
        'relationship': '主动和朋友分享玩具', 'planning': '完成周末计划表', 'resilience': '遇到难题先试三次',
        'health': '每天户外运动半小时', 'aesthetics': '画一幅自己的画',
    }
    wish_ids = []
    for c in cats:
        try:
            w = api('add_wish', {**prof, 'title': titles[c], 'category': c, 'wish_type': 'experience'}, token)
            wid = (w.get('wish') or w).get('id') if isinstance(w, dict) else None
            if wid: wish_ids.append(wid)
        except Exception as e:
            print('add_wish fail', c, e)
    print('wishes:', len(wish_ids))

    # 4) 今天+前 6 天交错打卡（今日 + 补卡）
    import datetime
    today = datetime.date.today()
    ok = 0
    for i, wid in enumerate(wish_ids):
        for d in ([0, 2, 4] if i % 2 == 0 else [0, 1, 3, 5]):
            date = (today - datetime.timedelta(days=d)).isoformat()
            try:
                api('add_checkin', {**prof, 'wish_id': wid, 'date': date}, token)
                ok += 1
            except Exception:
                pass
    print('checkins:', ok)
    print('DONE — 可用该账号截图')

if __name__ == '__main__':
    main()
