# 多语言支持说明

## 概述

Star-Rewards应用现已支持中文和英文两种语言，用户可以在页面右上角的语言切换器中选择语言。

## 功能特性

1. **自动语言检测**：应用会记住用户选择的语言偏好
2. **实时切换**：切换语言后立即更新所有界面文本
3. **持久化存储**：语言选择保存在localStorage中
4. **版本控制**：使用版本号确保浏览器加载最新语言文件

## 使用方法

### 切换语言

1. 在页面右上角找到语言选择器
2. 选择"中文"或"English"
3. 页面会自动更新为所选语言

### 语言文件结构

- `i18n.js` - 多语言配置文件和翻译字典
- `i18n.css` - 语言切换器样式

## 添加新语言

要添加新的语言支持，请按照以下步骤：

1. 在`i18n.js`中添加新的语言对象
2. 更新HTML中的语言选择器选项
3. 为所有文本添加`data-i18n`属性

示例：

```javascript
const translations = {
    zh: {
        // 中文翻译
    },
    en: {
        // 英文翻译
    },
    ja: {
        // 日语翻译
    }
};
```

## 翻译键值

翻译使用点号分隔的层级结构，例如：

```javascript
// 访问嵌套翻译
t('login.title') // 返回登录标题
t('home.currentPoints') // 返回当前积分
```

## HTML标记

在HTML中使用`data-i18n`属性标记需要翻译的文本：

```html
<h1 data-i18n="app.title">Best Me</h1>
<button data-i18n="login.loginButton">登录</button>
<input data-i18n-placeholder="login.emailPlaceholder" placeholder="请输入邮箱">
```

## 技术实现

### 初始化

```javascript
// 在应用初始化时调用
initLanguage();
```

### 切换语言

```javascript
// 设置语言
setLanguage('en');

// 获取当前语言
const lang = getLanguage();

// 获取翻译文本
const text = t('login.title');
```

### 更新UI

```javascript
// 自动更新所有标记的元素
updateLanguageUI();
```

## 当前支持的语言

- **zh** - 简体中文
- **en** - English

## 未来计划

- 支持更多语言（日语、韩语、法语等）
- 自动检测浏览器语言
- 语言包按需加载
- 在线翻译功能