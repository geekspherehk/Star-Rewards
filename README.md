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

- HTML5 + CSS3
- Vanilla JavaScript
- Supabase (后端数据库)
- 响应式设计

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
├── script_juanziji.js     # 卷自己主题脚本
├── login.html             # 登录页面
├── login.js               # 登录脚本
├── supabase.min.js        # Supabase客户端
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

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

MIT License - 详见 LICENSE 文件

---

## 原版说明

Best Me 个人成长系统，记录成长轨迹，成就更好的自己


### 网页应用设计概述

这是一个现代化的Best Me个人成长系统，具有直观美观的用户界面，适合个人记录成长行为积分，并管理奖励兑换。核心功能包括：
- 记录行为积分（例如，好行为加分，坏行为扣分）。
- 添加和管理礼物列表（每个礼物有积分要求）。
- 检查积分是否足够，并允许兑换礼物（兑换后扣除积分，重置或标记礼物）。
- 数据持久化（使用浏览器本地存储，避免服务器）。
- 云端备份和恢复功能（使用Supabase）。

#### 界面特性
- **现代化设计**：采用渐变色彩和圆角设计，视觉效果更佳
- **响应式布局**：适配桌面和移动设备
- **交互反馈**：按钮悬停效果、动画过渡和临时消息提示
- **表单验证**：输入验证和用户友好的错误提示
- **直观的积分展示**：卡片式积分显示，清晰易读

#### 技术栈
- **前端**：HTML5、CSS3（Flexbox/Grid）、原生JavaScript（ES6+）
- **存储**：localStorage本地存储和Supabase云端存储
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
4. 数据会保存在浏览器本地（localStorage）和云端（Supabase），不同浏览器登录同一账户可同步数据。

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



# Star-Rewards 个人奖励与期望管理系统扩展设计方案
基于对当前Star-Rewards应用代码的分析，我提出以下扩展设计方案，将其从孩子奖励系统转变为通用的个人奖励和期望管理平台。

## 一、产品定位扩展
### 1. 核心价值转变
- 原定位 ：家长用于管理孩子行为和奖励的工具
- 新定位 ：个人目标追踪、习惯养成和自我奖励的综合管理平台
- 目标用户 ：希望培养良好习惯、达成个人目标并获得自我奖励的任何人
### 2. 应用场景扩展
- 学习打卡与奖励（如连续学习X天兑换喜欢的物品）
- 运动健身目标（如每周锻炼X次获得积分）
- 工作效率提升（如完成项目里程碑获得奖励）
- 健康生活习惯（如按时作息、减少使用手机时间）
## 二、数据模型扩展
### 1. 核心数据模型调整
```
// 用户档案扩展
extendedProfile = {
    id: string,              // 用户ID
    name: string,            // 用户名
    avatar: string,          // 头像URL
    current_points: number,  // 当前积分
    total_points: number,    // 总积分
    created_at: timestamp,   // 创建时间
    updated_at: timestamp    // 更新时间
}

// 行为记录扩展
extendedBehavior = {
    id: string,              // 记录ID
    user_id: string,         // 用户ID
    category: string,        // 新增：行为类别（学习、
    运动、工作、生活等）
    description: string,     // 行为描述
    points: number,          // 积分变化
    timestamp: timestamp,    // 记录时间
    recurring: boolean,      // 新增：是否为重复任务
    recurring_pattern: string, // 新增：重复模式（如每
    日、每周等）
    completed_at: timestamp  // 新增：完成时间（用于重
    复任务）
}

// 礼物（奖励）扩展
extendedGift = {
    id: string,              // 礼物ID
    user_id: string,         // 用户ID
    name: string,            // 礼物名称
    points: number,          // 所需积分
    description: string,     // 新增：礼物描述
    image_url: string,       // 新增：礼物图片
    category: string,        // 新增：礼物类别（实物、
    体验、服务等）
    created_at: timestamp    // 创建时间
}

// 目标/期望模型（新增）
goal = {
    id: string,              // 目标ID
    user_id: string,         // 用户ID
    title: string,           // 目标标题
    description: string,     // 目标描述
    start_date: date,        // 开始日期
    target_date: date,       // 目标日期
    target_points: number,   // 目标积分
    current_progress: number,// 当前进度
    category: string,        // 目标类别
    status: string,          // 状态（进行中、已完成、
    已放弃）
    created_at: timestamp,   // 创建时间
    updated_at: timestamp    // 更新时间
}
```
## 三、功能扩展设计
### 1. 核心功能增强 行为记录系统
- 自定义类别 ：用户可创建和管理行为类别（如学习、运动、工作、生活等）
- 预设模板 ：提供常见行为模板，如"晨跑30分钟"、"阅读1小时"等
- 重复任务 ：设置每日/每周重复任务，完成后自动记录积分
- 批量记录 ：支持一次性记录多项行为 积分系统
- 积分规则自定义 ：用户可设置不同行为的积分获取规则
- 积分有效期 ：可选设置积分有效期，增加紧迫感
- 积分历史图表 ：提供积分获取和消费的可视化图表 奖励兑换系统
- 奖励分类管理 ：将奖励分为实物、体验、服务等类别
- 奖励详情页 ：支持添加奖励图片和详细描述
- 愿望清单 ：添加心仪的奖励到愿望清单，作为长期目标
- 奖励评价 ：兑换后可对奖励进行评价和记录体验
### 2. 新功能开发 目标管理系统
- 个人目标设定 ：设定短期和长期目标，关联积分获取
- 进度追踪 ：可视化展示目标完成进度
- 目标提醒 ：设置目标提醒，避免遗忘
- 目标分享 ：可选分享目标到社交媒体，增加监督动力 习惯培养系统
- 习惯养成计划 ：创建21天/30天习惯养成计划
- 连续打卡 ：记录连续完成天数，提供打卡日历
- 习惯分析 ：分析习惯养成趋势，提供改进建议
- 习惯挑战 ：参与或创建习惯挑战，与朋友一起坚持 成就系统
- 里程碑奖励 ：达到特定成就时获得额外奖励
- 成就徽章 ：解锁各种成就徽章，增加收集乐趣
- 成就分享 ：分享成就到社交媒体
## 四、用户界面调整
### 1. 布局优化
- 响应式设计 ：适配不同设备屏幕
- 仪表盘设计 ：主页面改为仪表盘，展示关键数据和进度
- 导航栏重构 ：调整导航栏，包含：仪表盘、行为记录、奖励中心、目标管理、习惯培养、成就
### 2. 视觉设计
- 主题切换 ：支持明暗主题切换
- 个性化设置 ：允许用户自定义界面颜色和布局
- 数据可视化 ：增加图表和进度条，直观展示数据
### 3. 用户体验优化
- 引导流程 ：新用户首次使用时提供引导
- 智能推荐 ：基于用户行为推荐相关行为和奖励
- 批量操作 ：支持批量管理行为和奖励
## 五、技术实现建议
### 1. 前端架构优化
```
// 建议重构为模块化结构
/src
  /components     // 可复用组件
  /pages          // 页面组件
  /services       // API服务
  /utils          // 工具函数
  /store          // 状态管理
  /assets         // 静态资源
  App.js          // 应用入口
  main.js         // 主入口
```
### 2. 数据库扩展
- 新增表 ：goals（目标）、habit_tracker（习惯追踪）、achievements（成就）
- 现有表扩展 ：添加新字段以支持更多功能
- 索引优化 ：添加适当索引提升查询性能
### 3. API接口扩展
```
// 新增API接口示例
// 1. 目标管理
const createGoal = async (goalData) => {}
const updateGoalProgress = async (goalId, 
progress) => {}
const getGoalsByUser = async (userId, status) => {}

// 2. 习惯追踪
const createHabit = async (habitData) => {}
const checkinHabit = async (habitId, date) => {}
const getHabitStats = async (habitId) => {}

// 3. 成就系统
const checkAchievements = async (userId) => {}
const getUserAchievements = async (userId) => {}
```
## 六、实施路径
### 第一阶段：基础架构优化
1. 重构前端代码为模块化结构
2. 扩展数据库模型
3. 实现用户配置文件增强功能
### 第二阶段：核心功能扩展
1. 实现行为分类和重复任务功能
2. 扩展奖励系统，支持图片和详细描述
3. 开发目标管理基础功能
### 第三阶段：新功能开发
1. 实现习惯培养系统
2. 开发成就系统
3. 添加数据可视化功能
### 第四阶段：用户体验优化
1. 实现响应式设计
2. 添加个性化设置
3. 优化引导流程和智能推荐
## 七、预期成果
通过这些扩展，Star-Rewards将转变为一个功能全面的个人奖励和期望管理平台，能够帮助用户：

1. 更有效地追踪个人行为和习惯
2. 设定并达成各类个人目标
3. 通过奖励机制增强自我激励
4. 建立长期的自我管理习惯
这个扩展方案保持了原应用的核心价值，同时大大拓展了应用场景和用户群体，使其成为一个真正通用的个人成长工具。
