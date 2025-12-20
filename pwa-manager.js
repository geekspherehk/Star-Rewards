// PWA 管理器 - 纯PWA实现

// Service Worker 注册
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('./sw.js');
            console.log('✅ ServiceWorker 注册成功:', registration.scope);
            
            // 监听更新
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        console.log('🔄 新版本可用');
                        showUpdateNotification();
                    }
                });
            });
        } catch (error) {
            console.log('❌ ServiceWorker 注册失败:', error);
        }
    });
}

// PWA 安装提示
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (installButton) {
        installButton.style.display = 'block';
        installButton.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`用户${outcome === 'accepted' ? '接受' : '拒绝'}了安装提示`);
                deferredPrompt = null;
                installButton.style.display = 'none';
            }
        });
    }
});

// 检测是否在PWA模式下运行
function isRunningStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
}

// 显示更新通知
function showUpdateNotification() {
    if ('Notification' in navigator && Notification.permission === 'granted') {
        new Notification('应用更新', {
            body: '新版本可用，请刷新页面获取最新功能',
            icon: '/assets/icons/icon-192x192.png'
        });
    }
}

// 网络状态检测
function checkNetworkStatus() {
    const isOnline = navigator.onLine;
    console.log(`网络状态: ${isOnline ? '在线' : '离线'}`);
    
    if (!isOnline) {
        showNotification('您当前处于离线状态', 'warning');
    }
}

window.addEventListener('online', checkNetworkStatus);
window.addEventListener('offline', checkNetworkStatus);

// 移动端优化功能
const PWAManager = {
    // 触觉反馈
    addHapticFeedback: function(style = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 50,
                medium: 100,
                heavy: [50, 100, 50]
            };
            navigator.vibrate(patterns[style] || 50);
        }
    },
    
    // 显示通知
    showNotification: function(message, type = 'info') {
        // 创建自定义通知
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : type === 'error' ? '#F44336' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
            font-size: 14px;
            max-width: 300px;
            word-wrap: break-word;
        `;
        notification.textContent = message;
        
        // 添加关闭按钮
        const closeBtn = document.createElement('span');
        closeBtn.style.cssText = `
            margin-left: 10px;
            cursor: pointer;
            font-weight: bold;
        `;
        closeBtn.textContent = '×';
        closeBtn.onclick = () => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        };
        
        notification.appendChild(closeBtn);
        document.body.appendChild(notification);
        
        // 自动隐藏
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 3000);
    },
    
    // 获取应用状态
    getAppStatus: function() {
        return {
            isStandalone: isRunningStandalone(),
            isOnline: navigator.onLine,
            serviceWorker: 'serviceWorker' in navigator,
            notifications: 'Notification' in navigator,
            vibration: 'vibrate' in navigator
        };
    }
};

// 将PWAManager添加到全局作用域
window.PWAManager = PWAManager;

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// 初始化检查
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 PWA 管理器初始化完成');
    console.log('📱 应用状态:', PWAManager.getAppStatus());
    
    // 检查网络状态
    checkNetworkStatus();
    
    // 显示欢迎消息
    if (isRunningStandalone()) {
        PWAManager.showNotification('欢迎使用 Star Rewards 应用！', 'success');
    } else {
        console.log('📱 当前在浏览器中运行');
    }
});