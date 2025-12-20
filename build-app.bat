@echo off
echo 🚀 Star Rewards 移动APP打包脚本
echo ========================================

REM 检查Node.js是否安装
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js 未安装，请先安装Node.js
    echo 📥 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo ✅ Node.js 已安装

REM 安装依赖
echo 📦 安装项目依赖...
call npm install
if %errorlevel% neq 0 (
    echo ❌ 依赖安装失败
    pause
    exit /b 1
)

REM 初始化Capacitor（如果不存在）
if not exist "capacitor.config.ts" (
    echo 🔧 初始化Capacitor...
    call npx cap init "Star Rewards" "com.starrrewards.app" --web-dir="."
)

:menu
echo.
echo 📱 请选择打包选项:
echo ========================================
echo 1. 添加Android平台
echo 2. 添加iOS平台（需要macOS）
echo 3. 同步Web代码到原生项目
echo 4. 打开Android Studio
echo 5. 打开Xcode（需要macOS）
echo 6. 构建Android发布版本
echo 7. 构建iOS发布版本（需要macOS）
echo 8. 生成PWA版本
echo 9. 退出
echo ========================================

set /p choice="请输入选项编号(1-9): "

if "%choice%"=="1" goto add_android
if "%choice%"=="2" goto add_ios
if "%choice%"=="3" goto sync
if "%choice%"=="4" goto open_android
if "%choice%"=="5" goto open_ios
if "%choice%"=="6" goto build_android
if "%choice%"=="7" goto build_ios
if "%choice%"=="8" goto build_pwa
if "%choice%"=="9" goto end

echo ❌ 无效选项，请重新选择
goto menu

:add_android
echo 📱 添加Android平台...
call npx cap add android
if %errorlevel% equ 0 (
    echo ✅ Android平台添加成功
) else (
    echo ❌ Android平台添加失败
)
pause
goto menu

:add_ios
echo 🍎 添加iOS平台...
call npx cap add ios
if %errorlevel% equ 0 (
    echo ✅ iOS平台添加成功
) else (
    echo ❌ iOS平台添加失败
)
pause
goto menu

:sync
echo 🔄 同步Web代码...
call npx cap sync
if %errorlevel% equ 0 (
    echo ✅ 代码同步成功
) else (
    echo ❌ 代码同步失败
)
pause
goto menu

:open_android
echo 🚀 打开Android Studio...
call npx cap open android
if %errorlevel% equ 0 (
    echo ✅ Android Studio已打开
) else (
    echo ❌ 打开Android Studio失败
)
pause
goto menu

:open_ios
echo 🚀 打开Xcode...
call npx cap open ios
if %errorlevel% equ 0 (
    echo ✅ Xcode已打开
) else (
    echo ❌ 打开Xcode失败
)
pause
goto menu

:build_android
echo 📦 构建Android发布版本...
echo ⚠️  请在Android Studio中手动构建发布版本
echo 📝 步骤：Build -\> Generate Signed Bundle / APK
start npx cap open android
pause
goto menu

:build_ios
echo 📦 构建iOS发布版本...
echo ⚠️  请在Xcode中手动构建发布版本
echo 📝 步骤：Product -\> Archive
start npx cap open ios
pause
goto menu

:build_pwa
echo 🌐 生成PWA版本...
echo ✅ PWA配置文件已生成：
echo   - manifest.json
echo   - mobile-wrapper.html
echo.
echo 📤 部署步骤：
echo 1. 将整个项目部署到支持HTTPS的服务器
echo 2. 在手机浏览器访问：https://your-domain.com/mobile-wrapper.html
echo 3. 点击浏览器菜单中的"添加到主屏幕"
pause
goto menu

:end
echo 👋 感谢使用Star Rewards打包工具！
pause