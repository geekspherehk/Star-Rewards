# Star-Rewards 功能与性能测试报告

日期：2026-09-19 ｜ 测试人：QA（AI） ｜ 方式：线上 API 实测（2 个临时账号自清理，共 ~30 请求）+ 全量代码静态审计（api/index.php 2680 行 / 52 个 action）

## 一、功能测试结果

### 通过项 ✅
| # | 测试项 | 结果 |
|---|---|---|
| 1 | 未带 token 访问业务接口 | 401 拒绝 ✓ |
| 2 | 登录失败报错 | 401 通用报错，不泄露账号是否存在 ✓ |
| 3 | 注册合规门（监护人同意） | 缺 consent → 400 拒绝 ✓ |
| 4 | SQL 注入探针（`x' OR 1=1--`） | 正常入库，PDO 预处理生效 ✓ |
| 5 | points 非数字 / 超界（±10000） | 400 校验拒绝 ✓ |
| 6 | 非法 dimension / effort_type | 静默置空（白名单）✓ |
| 7 | 非法埋点事件名 | 400 Invalid event ✓ |
| 8 | 积分不足兑换礼物 | 400 Insufficient points ✓ |
| 9 | experience 愿望打卡 | 400 正确拦截 ✓ |
| 10 | 打卡日期边界（未来 / 超 6 天前，静态核查） | 400 ✓ |
| 11 | 同日重复打卡（UNIQUE 索引 + 23000） | 409 ✓ |
| 12 | delete_account 级联删除 + 测试数据清理 | 200，残留为零 ✓ |

### 发现的问题 🔴
| # | 严重度 | 问题 | 证据 | 建议 |
|---|---|---|---|---|
| 1 | **P1** | **current_points 无负数下限**：+3 后记 -5000，余额变 **-4997**（total_points 不受影响）。与 deleteBehavior 回滚"下限钳 0"的不变量矛盾，两处口径不一致 | 实测 `[N2] current=-4997`；api/index.php:1268 `current_points = current_points + ?` 无 GREATEST(0,…) | 产品拍板：允许"负债"（贴儿子欠分心智）还是钳 0。若钳 0 → UPDATE 加 `GREATEST(0, current_points + ?)`，一处改动 |
| 2 | **P2** | **profile_id 静默回退**：显式传不存在/越权的 profile_id=999999，不报 404，静默落到自己家庭第一个档案（实测 id=72 记录成功）。无越权泄漏，但会掩盖前端记错孩子的 bug | 实测 `[8] → 200`；resolveProfileId() 回退链 | 显式传了 profile_id 但不属于本家庭时改报 404；未传时才走 selected/first 回退 |
| 3 | P3 | add_checkin 把所有 23000 错误报成"Already checked in today"——FK 冲突（愿望被并发删除）也会误报 409 | api/index.php:2451 | 按 errno 1022/1062/1451 区分，或仅对 uniq_wish_date 冲突报 409 |
| 4 | P3 | add_checkin 的加分 UPDATE 缺 family_id 条件（`WHERE id=?`） | api/index.php:2456 | 上游已校验，属防御深度，顺手补上 |

## 二、性能测试结果

### 已治本 ✅
- `action=bootstrap` 聚合接口：首屏 DB 连接 9-10 → 1；`initializeApp` 幂等守卫修复 ×3 重复调用（06f28f9）。按当前 500 连接/小时配额，可支撑 ~100+ 次页面加载/小时。
- 列表接口有界：getBehaviors LIMIT 500、getCheckins LIMIT 200。
- rateLimit、埋点、cron 接口（PUSH_CRON_KEY + hash_equals）鉴权完备。

### 性能隐患 🟡
| # | 问题 | 量级影响 | 建议 |
|---|---|---|---|
| 1 | **getV2Overview N+1**：每个愿望 2 条查询（COUNT 打卡数 + 今日是否打卡）+ 8 素养 × 2 条覆盖查询 + 徽章 6 条。10 个愿望 ≈ **42 条查询/请求**（同一连接，不耗配额，但接口延迟随愿望数线性涨） | 10 愿望时明显 | 3 条 SQL 替换：①checkins 按 wish_id GROUP BY ②今日打卡 `WHERE wish_id IN (...) AND checkin_date=今天` ③coverage 按 dimension/category 各 1 条 GROUP BY |
| 2 | getCheckins 的 wish_id 分支**无 LIMIT**（另一分支有 200） | 长期使用后载荷增大 | 补 LIMIT 400（一年每日打卡量级） |
| 3 | behaviors/wishes 查询均为 `family_id AND profile_id AND …`，仅单列索引 | 万行级后变慢 | 加复合索引 `(family_id, profile_id)`；checkins 已有 uniq_wish_date 覆盖 ✓ |
| 4 | register 同步阻塞发 SMTP 验证邮件 | SMTP 慢时注册接口卡顿 | 可接受；后续可改异步队列 |
| 5 | rateLimit 每请求 2 次文件读写，读无锁 | 仅限流精度，不影响正确性 | 可接受 |
| 6 | getBehaviors 全量拉 500 条，无游标分页 | 前端 payload 大 | 前端目前一次全渲染，暂不需要；改造渲染时再做 |

## 三、结论

- **功能质量**：52 个接口的鉴权、校验、越权防护、幂等设计整体扎实，未发现注入/越权/敏感信息泄露。
- **两个必修**：负分无下限（P1，产品决策 + 1 行 SQL）；profile_id 静默回退（P2，1 处条件分支）。
- **一个值得做**：getV2Overview N+1 合并查询（纯后端重构，不改行为）。
- 本次测试未触碰前端 E2E（DB 配额敏感），打卡 UI 链路已有 verify_checkin_ui.js / verify_quick_add.js 覆盖。

*测试脚本：/tmp/sr_functional_test.py、/tmp/sr_functional_test2.py（临时账号均已级联删除）*
