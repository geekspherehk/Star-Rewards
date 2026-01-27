# Star-Rewards - 积分奖励系统

一个功能完整的积分奖励管理系统，支持多主题切换，适用于个人成长、儿童激励等不同场景。

## 🌟 功能特色

- **经典版** - 简洁实用的积分奖励系统
- **卷娃模式** - 专为儿童设计的成长激励系统  
- **卷自己模式** - 个人成长专用的能量值驱动系统

## 🚀 快速开始

### 本地运行
```bash
# 使用Python启动本地服务器
python -m http.server 8000

# 或使用Node.js
npx serve .
```

### GitHub Pages 部署

1. **Fork 这个仓库**
2. **启用 GitHub Pages** 
   - 进入仓库 Settings → Pages
   - Source 选择 "Deploy from a branch"
   - Branch 选择 "main" 和 "/ (root)"
   - 点击 Save
3. **访问应用**
   - 主题选择页：`https://[你的用户名].github.io/Star-Rewards/theme-selector.html`
   - 经典版：`https://[你的用户名].github.io/Star-Rewards/index.html`
   - 卷娃模式：`https://[你的用户名].github.io/Star-Rewards/theme_juanwa.html`
   - 卷自己模式：`https://[你的用户名].github.io/Star-Rewards/theme_juanziji.html`

## 📱 主题介绍

### 🌈 卷娃模式
专为儿童设计的成长激励系统：
- 🎨 温暖明亮的界面设计
- 🏆 宝贝愿望和成长日记
- 💝 亲子互动体验
- 🌟 成长积分系统

### 💪 卷自己模式
个人成长专用的自律打卡系统：
- ⚡ 能量值概念替代积分
- 🎯 目标奖励和成就系统
- 📊 成长轨迹记录
- 🔥 自律任务打卡

### ⭐ 经典版
简洁实用的积分管理系统：
- ✨ 优雅的界面设计
- 📊 完整的积分管理
- 🎁 灵活的礼物兑换
- 📈 详细的历史记录

## 🛠️ 技术栈

- **前端**：HTML5 + CSS3 + Vanilla JavaScript
- **后端**：Supabase (数据库和认证)
- **存储**：SessionStorage (临时数据)、LocalStorage (会话信息)
- **设计**：响应式设计、现代化UI

## 📁 文件结构

```
Star-Rewards/
├── index.html              # 经典版主页面
├── theme-selector.html     # 主题选择页面
├── theme_juanwa.html       # 卷娃主题页面
├── theme_juanziji.html     # 卷自己主题页面
├── style.css              # 经典版样式
├── style_juanwa.css       # 卷娃主题样式
├── style_juanziji.css     # 卷自己主题样式
├── script.js              # 经典版脚本
├── script_juanwa.js       # 卷娃主题脚本
├── script_juanziji.js     # 卷自己主题脚本
├── login.html             # 登录页面
├── login.js               # 登录脚本
├── supabase.min.js        # Supabase客户端
├── behavior-templates.html # 行为模板页面
├── mobile-wrapper.html    # 移动端包装页面
├── mobile-app.js          # 移动端脚本
└── README.md              # 项目说明
```

## 🔧 配置说明

### Supabase 配置
1. 在 [Supabase](https://supabase.com) 注册账号
2. 创建新项目
3. 在 `script.js` 和 `script_juanziji.js` 中更新以下配置：
   ```javascript
   const SUPABASE_URL = '你的Supabase项目URL';
   const SUPABASE_ANON_KEY = '你的匿名访问密钥';
   ```

### 数据库结构
详见 `sql.txt` 文件中的数据库表结构定义。

## 🎯 使用场景

- **家庭教育** - 使用卷娃模式激励孩子成长
- **个人成长** - 使用卷自己模式提升自律能力
- **团队管理** - 使用经典版进行积分奖励管理
- **习惯养成** - 各种模式都支持习惯打卡和奖励机制

## 📖 使用指南

### 基本使用流程
1. **用户注册/登录** - 使用邮箱密码创建账户
2. **选择主题** - 根据需求选择适合的主题模式
3. **记录行为** - 添加积极行为获取积分，消极行为扣除积分
4. **设置奖励** - 添加心仪的礼物或奖励
5. **兑换奖励** - 使用累积的积分兑换奖励

### 高级功能
- **行为模板** - 使用预设的行为模板快速记录
- **数据同步** - 在不同设备间同步数据
- **历史记录** - 查看详细的行为和积分历史
- **移动端支持** - 在手机上也能流畅使用

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

### 贡献指南
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

MIT License - 详见 LICENSE 文件

## 🔮 未来计划

- [ ] 添加数据可视化图表
- [ ] 支持多用户管理
- [ ] 实现行为模板自定义
- [ ] 添加成就系统
- [ ] 支持数据导出功能

---

## 原版说明

Best Me 个人成长系统，记录成长轨迹，成就更好的自己

### 网页应用设计概述

这是一个现代化的Best Me个人成长系统，具有直观美观的用户界面，适合个人记录成长行为积分，并管理奖励兑换。核心功能包括：
- 记录行为积分（例如，好行为加分，坏行为扣分）
- 添加和管理礼物列表（每个礼物有积分要求）
- 检查积分是否足够，并允许兑换礼物（兑换后扣除积分，重置或标记礼物）
- 数据持久化（使用浏览器临时存储，避免服务器）
- 云端备份和恢复功能（使用Supabase）

#### 界面特性
- **现代化设计**：采用渐变色彩和圆角设计，视觉效果更佳
- **响应式布局**：适配桌面和移动设备
- **交互反馈**：按钮悬停效果、动画过渡和临时消息提示
- **表单验证**：输入验证和用户友好的错误提示
- **直观的积分展示**：卡片式积分显示，清晰易读

#### 技术栈
- **前端**：HTML5、CSS3（Flexbox/Grid）、原生JavaScript（ES6+）
- **存储**：SessionStorage临时存储、LocalStorage会话存储和Supabase云端存储
- **用户认证**：Supabase Authentication（支持邮箱/密码注册登录）
- **字体**：Google Fonts提供更好的中文字体渲染
- **图标**：使用Emoji作为简单图标元素

### 如何运行和测试
1. 创建文件夹，放入以上三个文件。
2. 用浏览器打开`index.html`。
3. 测试：
   - 首先进行用户注册或登录（支持邮箱/密码认证）
   - 在"记录行为积分"部分输入行为描述和积分变化（正数加分，负数扣分），点击"记录积分"。
   - 在"添加礼物"部分输入礼物名称和所需积分，点击"添加礼物"。
   - 当积分足够时，礼物旁的"兑换"按钮启用，点击后扣分并移除礼物。
   - 使用"备份到云端"和"从云端恢复"按钮管理数据。
4. 数据会保存在浏览器临时存储（SessionStorage）和云端（Supabase），不同浏览器登录同一账户可同步数据。

### 改进建议
- **UI提升**：可以进一步优化动画效果，添加更多视觉反馈，或使用专业的UI框架如Bootstrap或Tailwind CSS。
- **功能扩展**：
  - 添加积分历史图表（用Chart.js库）展示积分趋势
  - 多孩子支持（用数组存储多个孩子数据）
  - 成就系统和徽章奖励
  - 设置积分目标和提醒功能
- **部署**：上传到GitHub Pages或Netlify免费托管，成为在线应用。
- **性能优化**：对于大量数据，可以实现虚拟滚动和数据分页。
- 如果你有特定要求（如用React实现，或添加后端），告诉我，我可以调整代码！

这个是基础版，如果你遇到问题或想优化某个部分，随时问。