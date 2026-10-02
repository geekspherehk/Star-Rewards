#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
monitor_discussion.py — 监测 discussion.md 家长论坛的新留言

功能：
  - 轮询 discussion.md（默认每 30 秒一次）
  - 防并发：发现 .discussion.lock 锁文件，或文件 120 秒内刚被修改，则跳过本轮
  - 用状态文件记录“已告警过的留言”（按内容 hash），只在出现【新未回复留言】时提示
  - 检测到新留言：打印告警，并把内容写入 .workbuddy/discussion_inbox.json 待办

约定（与 discussion.md 论坛区一致）：
  - 家长留言块以 `### 💬 家长` 开头
  - 产品经理回复块以 `### 📋 产品经理回复` 开头，且紧接在其回复的家长留言下方
  - 一条家长留言若“下一块就是 PM 回复”，视为已回复

用法：
  python3 scripts/monitor_discussion.py            # 持续监听（Ctrl+C 退出）
  python3 scripts/monitor_discussion.py --once     # 只检查一次并退出
  python3 scripts/monitor_discussion.py --interval 10   # 每 10 秒检查
  python3 scripts/monitor_discussion.py --once --force  # 忽略防并发守卫

注意：本脚本只负责“监测 + 告警 + 写待办”，PM 回复由产品经理（我）读取后撰写。
"""

import os
import sys
import time
import json
import hashlib
import argparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
DISCUSSION = os.path.join(PROJECT, "discussion.md")
LOCK = os.path.join(PROJECT, ".discussion.lock")
WORKBUDDY = os.path.join(PROJECT, ".workbuddy")
STATE_FILE = os.path.join(WORKBUDDY, "discussion_monitor_state.json")
INBOX_FILE = os.path.join(WORKBUDDY, "discussion_inbox.json")

PARENT_PREFIX = "### 💬 家长"
REPLY_PREFIX = "### 📋 产品经理回复"


def ts():
    return time.strftime("%Y-%m-%d %H:%M:%S")


def read_blocks(path):
    """把文件解析成有序的块列表，每块是 parent 或 reply。"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except FileNotFoundError:
        return []
    blocks = []
    cur = None
    for line in lines:
        s = line.rstrip("\n")
        if s.startswith("### ") and (
            s.startswith(PARENT_PREFIX) or s.startswith(REPLY_PREFIX)
        ):
            if cur is not None:
                blocks.append(cur)
            cur = {
                "type": "parent" if s.startswith(PARENT_PREFIX) else "reply",
                "header": s,
                "body": [],
            }
        elif cur is not None:
            cur["body"].append(s)
    if cur is not None:
        blocks.append(cur)
    return blocks


def msg_hash(block):
    content = block["header"] + "\n" + "\n".join(block["body"])
    return hashlib.sha1(content.encode("utf-8")).hexdigest()[:12]


def load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"alerted": []}


def save_state(state):
    os.makedirs(WORKBUDDY, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2)


def load_inbox():
    try:
        with open(INBOX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_inbox(inbox):
    os.makedirs(WORKBUDDY, exist_ok=True)
    with open(INBOX_FILE, "w", encoding="utf-8") as f:
        json.dump(inbox, f, ensure_ascii=False, indent=2)


def check(force=False):
    # —— 防并发守卫 ——
    if os.path.exists(LOCK):
        print(f"[{ts()}] 检测到 .discussion.lock，跳过本轮（有人在写）。")
        return
    try:
        mtime = os.path.getmtime(DISCUSSION)
    except FileNotFoundError:
        print(f"[{ts()}] discussion.md 不存在，跳过。")
        return
    if not force and (time.time() - mtime) < 120:
        print(f"[{ts()}] 文件 120s 内刚被修改，跳过本轮（防读到半截）。")
        return

    blocks = read_blocks(DISCUSSION)
    state = load_state()
    alerted = set(state.get("alerted", []))

    new_alerts = []
    for i, b in enumerate(blocks):
        if b["type"] != "parent":
            continue
        replied = (i + 1 < len(blocks)) and blocks[i + 1]["type"] == "reply"
        h = msg_hash(b)
        if replied:
            alerted.discard(h)  # 已回复 → 从待告警集合移除
            continue
        if h not in alerted:
            alerted.add(h)
            new_alerts.append(b)

    state["alerted"] = list(alerted)
    save_state(state)

    if new_alerts:
        print(f"[{ts()}] ⚠️ 发现 {len(new_alerts)} 条未回复的家长留言：")
        inbox = load_inbox()
        for b in new_alerts:
            body = "\n".join(b["body"]).strip()
            print("  " + "-" * 44)
            print("  " + b["header"])
            for bl in b["body"]:
                if bl.strip():
                    print("  " + bl)
            inbox.append(
                {"header": b["header"], "body": body, "detected_at": ts()}
            )
        save_inbox(inbox)
        print(f"[{ts()}] 已写入待办 → {INBOX_FILE}")
        print(f"[{ts()}] 请产品经理（我）读取并回复。")
    else:
        print(f"[{ts()}] 无新未回复留言。")


def loop(interval):
    print(f"开始监听 {DISCUSSION}（每 {interval}s 检查一次，Ctrl+C 退出）")
    try:
        while True:
            check()
            time.sleep(interval)
    except KeyboardInterrupt:
        print(f"\n[{ts()}] 已停止监听。")


def main():
    ap = argparse.ArgumentParser(description="监测 discussion.md 家长论坛新留言")
    ap.add_argument("--once", action="store_true", help="只检查一次并退出")
    ap.add_argument("--interval", type=int, default=30, help="轮询间隔秒数（默认30）")
    ap.add_argument("--force", action="store_true", help="忽略防并发守卫")
    args = ap.parse_args()
    if args.once:
        check(force=args.force)
    else:
        loop(args.interval)


if __name__ == "__main__":
    main()
