# Star Rewards PWA 部署指南

## 本地测试

1. 在项目根目录启动一个简单的HTTP服务器
   - 使用Python：`python -m http.server`
   - 或使用VS Code的Live Server插件

2. 在浏览器中访问：`http://localhost:8000`

3. **移动设备测试**：
   - 获取电脑的本地IP地址
   - 在手机浏览器中访问：`http://[您的IP地址]:8000/mobile-wrapper.html`
   - 点击"添加到主屏幕"以体验PWA效果

## GitHub Pages 部署注意事项

### 配置要求
- 确保 `manifest.json` 文件位于项目根目录
- 确保 `sw.js` 文件位于项目根目录
- 在 `index.html` 中正确引用这两个文件

### 常见问题修复
1. **资源引用路径问题**
   - 使用相对路径引用资源
   - 避免使用不存在的目录路径

2. **Service Worker 配置**
   - 只缓存实际存在的文件
   - 添加错误处理，避免因某些资源无法缓存而导致整个部署失败

3. **PWA 图标配置**
   - 如果使用图标，确保 `assets/icons` 目录存在且包含所有引用的图标文件
   - 或简化 `manifest.json`，暂时移除图标引用

### 验证部署
1. 部署后访问 `https://[用户名].github.io/[仓库名]/`
2. 使用Chrome DevTools的Application标签页检查PWA配置是否正确