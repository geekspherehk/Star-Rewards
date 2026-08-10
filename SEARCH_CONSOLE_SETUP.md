# Google Search Console 接入指南（Star Rewards）

> 目标：让 Google 收录我们的 3 个公开 SEO 内容页，产生自然流量。
> 站点侧已经就绪，只需在你自己的 Google 账号里完成"验证 + 提交 sitemap"两步。

---

## 0. 现状（已就绪，无需改动）

| 检查项 | 状态 | 说明 |
|---|---|---|
| 站点可访问 | ✅ | https://stellar.gaocaihk.com |
| `robots.txt` 声明 sitemap | ✅ | 含 `Sitemap: https://stellar.gaocaihk.com/sitemap.xml` |
| `sitemap.xml` 有效 | ✅ | 6 条 URL，含 3 个 SEO 页，content-type `application/xml` |
| SEO 页无 `noindex` | ✅ | 仅 `login.html`/`theme-selector.html` 加了 noindex（正确） |
| 页面 `lang="zh-CN"` | ✅ | 利于中文搜索排名 |

---

## 1. 添加属性（Property）

1. 打开 https://search.google.com/search-console
2. 左侧 **"添加资源 / Add property"** → 选 **"网址前缀 / URL prefix"**
3. 输入：`https://stellar.gaocaihk.com/`（**必须带结尾斜杠**）
4. 点 **"继续 / Continue"**

---

## 2. 验证所有权（二选一，推荐 A）

### A. DNS TXT 记录（推荐，零代码改动，验证整个域名）
1. 在验证页选 **"网域提供商 / Domain name provider" → 其他 / Other**
2. 复制 Google 给的 **TXT 记录值**（形如 `google-site-verification=ABCD1234...`）
3. 到 Hostinger 控制台 → **域名 / DNS → DNS 记录**，添加一条：
   - 类型 `TXT`，主机名 `@`（或留空），值 = 上面那串
4. 回到 GSC 点 **"验证 / Verify"**（DNS 生效通常 1 分钟～几小时）

### B. HTML 标记（Meta tag，改代码）
1. 在验证页选 **"HTML 标记 / HTML tag"**
2. 复制 `<meta name="google-site-verification" content="CODE">` 里的 `CODE`
3. 把它发给研发，会注入到以下页面 `<head>` 顶部并部署：
   - `index.html`、`seo-guide-star-chart.html`、`seo-habit-building.html`、`seo-reward-ideas.html`
4. 回到 GSC 点 **"验证"**

---

## 3. 提交 Sitemap

1. 左侧 **"站点地图 / Sitemaps"**
2. 输入：`sitemap.xml`
3. 点 **"提交 / Submit"**
4. 几小时后刷新，应显示"成功"且已发现 6 个网址。

---

## 4. 主动请求收录 3 个 SEO 页（加速索引）

1. 左侧 **"网址检查 / URL Inspection"**
2. 分别粘贴以下 3 个 URL，逐个点 **"请求编入索引 / Request indexing"**：
   - `https://stellar.gaocaihk.com/seo-guide-star-chart.html`
   - `https://stellar.gaocaihk.com/seo-habit-building.html`
   - `https://stellar.gaocaihk.com/seo-reward-ideas.html`
3. Google 通常 1–2 周内处理；可在 **"效果 / Performance"** 看曝光/点击。

---

## 5. 监控指标（衡量 R1 有机增长）

在 GSC **"效果"** 报表关注：
- **总曝光 / 点击 / 平均排名**（按页面、按查询）
- 重点查询词：`儿童积分奖励表`、`儿童好习惯养成`、`奖励孩子的方法`、`star chart kids`、`reward chart`
- 目标：3 个 SEO 页每月自然点击逐步上升。

配合站内埋点（`scripts/analytics_report.py` 读 live）看 D1/D7 留存与注册转化，闭环评估 R1。

---

## 6. 可选：Bing / IndexNow（额外覆盖）

Bing 也是可观流量源，且 IndexNow 提交极简：
1. 生成随机 key（如 `starrewards-xxxx-xxxx`），在站点根放 `XXXX.txt` 内容为 key
2. 文档见 https://www.bing.com/indexnow
3. 提交 `https://stellar.gaocaihk.com/sitemap.xml` 到 Bing Webmaster Tools

> 需要的话，研发可帮你托管 key 文件并部署。
