#!/bin/bash
# Pinterest 每日发布 — 自动化的单一入口
# 目的：把「清锁 → 发布 → 记日志」收敛成一条命令，agent 只需跑它 + 读输出。
# 即使 agent 中途断流（499/automation-run-interrupted），Pin 也已经发出去了。
set -u
cd /Users/work/code/Star-Rewards

LOG=/Users/work/code/Star-Rewards/.workbuddy/pinterest_daily.log
mkdir -p /tmp/pinshots .workbuddy

# 清理残留 Chrome profile 锁
pkill -9 -f "pinterest-profile" 2>/dev/null
sleep 2

NODE=$(ls -d /Users/xuversa/.workbuddy/binaries/node/versions/*/bin/node 2>/dev/null | tail -1)
export NODE_PATH=/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules

{
  echo "===== $(date '+%F %T') run start ====="
  "$NODE" scripts/pinterest_post.js 2>&1
  echo "===== exit: $? ====="
} >> "$LOG" 2>&1

# 给 agent 的输出：日志尾部（含 POST_OK / POST_FAIL / NEED_LOGIN / QUEUE_EMPTY）
tail -6 "$LOG"
