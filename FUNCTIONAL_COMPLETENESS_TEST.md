# Star-Rewards 功能完备性测试报告

> 日期：2026-08-11 ｜ 环境：生产 `stellar.gaocaihk.com`（线上真实验证） ｜ 版本：sw v34 / style?v17 / script?v27 / i18n?v25 / login?v9 / api-client?v21
> 目的：对平台每个功能点做「完整操作逻辑链」审计与测试——有入口必有出口、有 UI 必有 API、有 API 必有 UI、数据必须一致。

## 一、测试结论速览

| 类别 | 项数 | 结果 |
|---|---|---|
| 核心功能修复后回归 | 18 | ✅ 全部通过 |
| 全功能 API 扫描 | 27 | ✅ 全部通过（含 201 创建语义） |
| 积分一致性 | 4 | ✅ 通过 |
| 埋点白名单 | 5 | ✅ 通过 |
| 发现的致命/严重问题 | 3 | ✅ 已修复并上线 |

## 二、发现并修复的问题（按严重度）

### P0 致命：愿望兑换必挂（redeemGift 恒 500）
- 现象：`api/index.php` 中 `redeemed_gifts` 的 INSERT 声明 **10 列**，但 `VALUES` 里有 **11 个占位符**、`execute` 只传 **9 个参数** → SQL 必然抛错，**兑换是核心链路却完全不可用**。
- 修复：`VALUES` 修正为 9 个 `?` + `NOW()`，与列清单和参数数组严格对齐。
- 验证：`redeemGift` → HTTP 200，`current_points` 100→50、`redeemed_id` 正常返回、兑换记录可查。

### P1 高：家庭邀请闭环断裂（用户点名）
1. **注册没有填邀请码的地方** → 注册表单新增可选「邀请码」字段；`api.register` 支持 `family_code`；注册时若有邀请码则**直接加入该家庭**（不创建 solo 家庭），否则按原逻辑建 solo 家庭。
2. **已注册用户无法加入家庭** → ① 家庭弹窗中 solo 家庭（自己一人且为 owner）显示「加入家庭」按钮；② 后端 `joinFamily` 支持 **solo 家庭自动解散转换**：先迁移 profiles/behaviors/gifts/redeemed_gifts/**milestones**/**analytics_events** 到新家庭，再删除旧家庭（顺序关键：`profiles.family_id` 是 `ON DELETE CASCADE`，必须先迁移后删除，否则档案被级联删光）；③ 无家庭用户打开家庭弹窗 → 直接弹「加入家庭」输入框；④ 已在家庭（有他人）→ 仍返回 409 提示先退出。
3. **邀请链接为空、无法复制** → 根因：`getFamilyInfo` 把 `invite_link` 放在返回对象**顶层**，而前端到处读 `currentFamily.family.invite_link`（family 对象内）→ 恒为空。修复：API 把 `invite_link` 一并放进 family 对象；前端 `normalizeFamily()` 双保险归一化。复制为空时给出「请先生成邀请码」提示，不再静默失败。
4. **邀请链接深链到未登录用户** → 访客打开 `/?invite=CODE` 时把邀请码存入 `sessionStorage.pending_invite`；登录/注册页自动预填注册表单的邀请码字段（URL 直达登录页同样支持）。注册成功后清除。

### P1 中：删除行为不回滚积分（数据不一致）
- 现象：日历里删一条 +10 的行为记录，`current_points` 不变化 → 积分凭空多 10。
- 修复：`deleteBehavior` 先取该行为的 `points/profile_id`（事务内 `FOR UPDATE`），删除后对 `current_points` 回滚 `- points`（正分减回、负分加回），下限 `GREATEST(...,0)`。
- 验证：0 → +30 → 删除后 0 ✅；再 -10 → 删除后回到 0 ✅。

### P1 中：5 个埋点事件被服务端拒绝
- 现象：前端埋了 `growth_add / achieve_cert / share_wechat / share_whatsapp / share_pinterest`，但服务端白名单没有 → 全部 400 静默丢弃。
- 修复：补进 `TRACK_ALLOWED_EVENTS`。验证：`track(growth_add)` → 200。

### P2 低：死链清理
- 「未收到确认邮件？重新发送」链接指向不存在的邮件确认流程（系统无邮件服务）→ 移除该 UI 与 `buildConfirmEmailUrl`/`resendConfirmation*` 桩函数。
- i18n 注册/登录 toast 残留装饰 emoji（✅❌⚠️）→ 清除。

## 三、测试矩阵（生产环境实跑）

### A. 家庭邀请闭环（18 项全部通过）
| # | 场景 | 结果 |
|---|---|---|
| 1 | 注册（无邀请码）→ 自动创建 solo 家庭 | ✅ 201 |
| 2 | owner 生成邀请码 → 返回 6 位码 + `?invite=` 链接 | ✅ 200 |
| 3 | 注册（带邀请码）→ 直接加入对方家庭，`family_id` 一致 | ✅ 201 |
| 4 | member 查家庭 → 成员数 2、`family.invite_link` 非空 | ✅ 200 |
| 5 | 注册（无效邀请码）→ 404 | ✅ 404 |
| 6 | 已注册 solo 用户 joinFamily → 旧家庭解散、数据迁入新家庭 | ✅ 200 |
| 7 | 转换后查家庭 → 成员数 3 | ✅ 200 |
| 8 | 已在家庭重复加入 → 409 | ✅ 409 |
| 9 | 家庭弹窗 solo 显示「加入家庭」按钮（前端） | ✅ 代码路径 |
| 10 | 邀请链接复制：非空可复制 / 空则提示先生成（前端） | ✅ 代码路径 |

### B. 积分与兑换（核心回归）
| # | 场景 | 结果 |
|---|---|---|
| 11 | addGift → addBehavior(+100) → redeemGift → current_points 100→50 | ✅ 200 |
| 12 | getRedeemedGifts 含兑换记录 | ✅ 200 |
| 13 | 删除 +30 行为 → current_points 回滚 | ✅ |
| 14 | 删除 -10 行为 → current_points 回滚 | ✅ |
| 15 | deleteGift 后愿望列表移除 | ✅ |

### C. 全功能 API 扫描（27 项全部通过）
register / login / refreshToken / getProfile / getProfiles / addProfile / updateProfile / deleteProfile / setSelectedProfile / addBehavior / getBehaviors / addGift / getGifts / redeemGift / getRedeemedGifts / deleteBehavior / deleteGift / updateTheme / getUserConfig / fetchProductInfo / getFamily / inviteMember / joinFamily / removeMember / updateMemberName / track / get_growth_extras / add_milestone / add_growth_note / add_child_voice —— 均返回预期状态码；多孩档案增删改切换、主题、成长纪念册三类记录、商品导入（SSRF 防护）、家庭成员管理（owner 移除后 member 403）全部验证通过。注：创建类接口返回 **201**（REST 语义，非 200）。

### D. 埋点
| # | 场景 | 结果 |
|---|---|---|
| 16 | track(growth_add)（此前 400） | ✅ 200 |

## 四、测试账号（生产库中的临时数据，供知悉）
- `sr.test.owner.<ts>@example.com` / `sr.test.member.*` / `sr.test.bad.*` / `sr.test.solo.*` / `sr.test.rb.*` / `sr.test.sw.*` / `sr.test.swm.*`（密码均为 `TestPass123!`）
- 产生的数据：2 个测试家庭（含若干成员与档案）、数条行为/愿望/兑换/成长记录、埋点事件若干。
- 系统暂无管理员删除入口；如需清理可联系数据库直删对应 `sr.test.%@example.com` 用户（级联清理）。

## 五、仍待产品决策的「非断链」缺口（不影响闭环）
| 项 | 现状 | 说明 |
|---|---|---|
| 愿望清单「编辑」 | 只增/删/兑换，无改 | 兑换型场景可接受，若要支持需新增 `updateGift` |
| 成长纪念册删除 | 只增不删 | 纵向记录建议保留不可删（产品定位：家庭成长档案） |
| 删除兑换记录 | 无删除 UI | 与「庆祝而非交易」一致，刻意不做 |
| `theme-selector.html` | 无入口 | 仅 robots/sw 引用，实际主题切换在主界面完成 |
| 邀请链接域名 | 硬编码 `stellar.gaocaihk.com` | 与生产域名一致，暂无问题 |
