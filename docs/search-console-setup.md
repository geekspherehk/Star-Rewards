# 搜索引擎收录操作指引（10 分钟做完）

> 目标：让 5 篇英文 SEO 页尽快被 Google/必应 收录，开始吃自然搜索流量。
> 网站已就绪的基础：sitemap.xml（11 URL，含 lastmod）、robots.txt、hreflang 双向互链、OG 分享图。

## 一、Google Search Console（最重要，约 5 分钟）

1. 打开 https://search.google.com/search-console ，用你的 Google 账号登录
2. 「添加资源」→ 选**网址前缀** → 输入 `https://stellar.gaocaihk.com`
3. 验证所有权，推荐两种任选其一：
   - **HTML 文件**：下载 `googleXXXX.html`，把文件发我或放到网站根目录（告诉我即可，我上传）
   - **HTML 标记**：复制它给的 `<meta name="google-site-verification" content="...">` 发给我，我加进 index.html
4. 验证通过后，左侧「站点地图」→ 输入 `sitemap.xml` → 提交
5. 左侧「网址检查」→ 逐个粘贴以下 5 个英文页网址 → 点「请求编入索引」：
   - `https://stellar.gaocaihk.com/seo-guide-star-chart-en.html`
   - `https://stellar.gaocaihk.com/seo-chore-chart-en.html`
   - `https://stellar.gaocaihk.com/seo-kids-points-chart-en.html`
   - `https://stellar.gaocaihk.com/seo-habit-building-en.html`
   - `https://stellar.gaocaihk.com/seo-reward-ideas-en.html`

## 二、Bing Webmaster Tools（约 3 分钟，吃必应 + Yahoo + 部分 ChatGPT 搜索）

1. 打开 https://www.bing.com/webmasters ，用 Microsoft 账号登录
2. 选「从 Google Search Console 导入」→ 一键同步（最快）
3. 同样提交 `sitemap.xml`

## 三、Pinterest 发布（5 张 Pin 图已生成在 pins/ 目录）

| Pin 图 | 配文建议（发布时粘贴） | 目标链接 |
|---|---|---|
| pins/star-chart-en-pin.png | How to make a star chart that actually works — 6 steps by age | https://stellar.gaocaihk.com/seo-guide-star-chart-en.html |
| pins/chore-chart-en-pin.png | Chore chart for kids by age (with points) | https://stellar.gaocaihk.com/seo-chore-chart-en.html |
| pins/kids-points-en-pin.png | Kids points chart starter guide — turn behavior into motivation | https://stellar.gaocaihk.com/seo-kids-points-chart-en.html |
| pins/habit-building-en-pin.png | Build good habits with a points system — the science + 6 steps | https://stellar.gaocaihk.com/seo-habit-building-en.html |
| pins/reward-ideas-en-pin.png | 30+ reward ideas for kids by age group | https://stellar.gaocaihk.com/seo-reward-ideas-en.html |

操作：Pinterest 商业账号（免费）→ 创建 5 个 Pin，每张传对应图 + 粘贴配文 + 填目标链接 → 建一个画板叫 "Kids Reward Charts & Positive Parenting"。

## 四、验证收录（一周后自查）

- Google 搜 `site:stellar.gaocaihk.com` → 应能看到 10+ 页面
- GSC「效果」报告 → 看曝光/点击开始增长
- 任何问题随时叫我查埋点：`view_seo_article` 事件会记录英文页的真实访问

---
*文档生成：2026-09-05。有验证文件/标记要部署，直接丢给我。*
