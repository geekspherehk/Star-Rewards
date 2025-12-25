// PWA 移动端应用脚本

// 移动端功能函数
function addBehavior() {
    const behaviorInput = document.getElementById('behavior-input');
    const pointsInput = document.getElementById('points-input');
    
    if (!behaviorInput.value.trim() || !pointsInput.value) {
        alert('请填写完整信息');
        return;
    }
    
    const behavior = {
        description: behaviorInput.value.trim(),
        points: parseInt(pointsInput.value),
        timestamp: new Date().toISOString()
    };
    
    // 添加触觉反馈
    if (window.PWAManager) {
        window.PWAManager.addHapticFeedback('light');
    }
    
    // 更新UI
    updateBehaviorLog(behavior);
    updatePointsDisplay();
    
    // 清空输入
    behaviorInput.value = '';
    pointsInput.value = '';
    
    // 显示成功提示
    showNotification('行为记录已添加！', 'success');
}

function addGift() {
    const nameInput = document.getElementById('gift-name-input');
    const pointsInput = document.getElementById('gift-points-input');
    const linkInput = document.getElementById('gift-link-input');
    const descriptionInput = document.getElementById('gift-description-input');
    
    if (!nameInput.value.trim() || !pointsInput.value) {
        alert('请填写礼物名称和所需积分');
        return;
    }
    
    const gift = {
        name: nameInput.value.trim(),
        points: parseInt(pointsInput.value),
        link: linkInput.value.trim(),
        description: descriptionInput.value.trim(),
        id: Date.now()
    };
    
    // 添加触觉反馈
    if (window.PWAManager) {
        window.PWAManager.addHapticFeedback('light');
    }
    
    // 更新UI
    updateGiftList(gift);
    
    // 清空输入
    nameInput.value = '';
    pointsInput.value = '';
    linkInput.value = '';
    descriptionInput.value = '';
    
    // 显示成功提示
    showNotification('愿望已添加！', 'success');
}

function updateBehaviorLog(behavior) {
    const behaviorLog = document.getElementById('behavior-log');
    
    if (behaviorLog.innerHTML.includes('暂无记录')) {
        behaviorLog.innerHTML = '';
    }
    
    const behaviorItem = document.createElement('div');
    behaviorItem.className = 'behavior-item';
    behaviorItem.innerHTML = `
        <div class="behavior-text">
            <div>${behavior.description}</div>
            <small>${new Date(behavior.timestamp).toLocaleString()}</small>
        </div>
        <div class="behavior-points">${behavior.points > 0 ? '+' : ''}${behavior.points}</div>
    `;
    
    behaviorLog.insertBefore(behaviorItem, behaviorLog.firstChild);
}

function updateGiftList(gift) {
    const giftList = document.getElementById('gift-list');
    
    if (giftList.innerHTML.includes('暂无愿望')) {
        giftList.innerHTML = '';
    }
    
    const giftItem = document.createElement('div');
    giftItem.className = 'gift-item';
    giftItem.innerHTML = `
        <div class="gift-info">
            <div class="gift-name">${gift.name}</div>
            <div class="gift-points">${gift.points} 积分</div>
            ${gift.description ? `<small>${gift.description}</small>` : ''}
        </div>
        <div class="gift-actions">
            <button class="btn-small btn-redeem" onclick="redeemGift(${gift.id})">兑换</button>
            <button class="btn-small btn-delete" onclick="deleteGift(${gift.id})">删除</button>
        </div>
    `;
    
    giftList.appendChild(giftItem);
}

function updatePointsDisplay() {
    // 模拟积分更新
    const currentPoints = document.getElementById('current-points-value');
    const totalPoints = document.getElementById('total-points-value');
    
    // 这里应该连接实际的数据源
    if (currentPoints) currentPoints.textContent = Math.floor(Math.random() * 100);
    if (totalPoints) totalPoints.textContent = Math.floor(Math.random() * 500);
}

function redeemGift(giftId) {
    // 添加触觉反馈
    if (window.PWAManager) {
        window.PWAManager.addHapticFeedback('medium');
    }
    
    if (confirm('确认要兑换这个礼物吗？')) {
        showNotification('礼物兑换成功！', 'success');
        // 移除礼物项
        const giftItem = event.target.closest('.gift-item');
        giftItem.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            giftItem.remove();
        }, 300);
    }
}

function deleteGift(giftId) {
    if (confirm('确认要删除这个愿望吗？')) {
        // 添加触觉反馈
        if (window.PWAManager) {
            window.PWAManager.addHapticFeedback('light');
        }
        
        const giftItem = event.target.closest('.gift-item');
        giftItem.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            giftItem.remove();
            showNotification('愿望已删除', 'info');
        }, 300);
    }
}

function showNotification(message, type = 'info') {
    if (window.PWAManager) {
        window.PWAManager.showNotification(message, type);
    } else {
        // 备用通知方式
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#2196F3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 移动端专用的认证UI更新函数
function updateMobileAuthUI(user) {
    const userEmail = document.getElementById('user-email');
    const notLoggedInSection = document.getElementById('not-logged-in');
    const loggedInSection = document.getElementById('logged-in');
    
    if (user) {
        // 用户已登录
        if (userEmail) userEmail.textContent = user.email;
        if (notLoggedInSection) notLoggedInSection.style.display = 'none';
        if (loggedInSection) loggedInSection.style.display = 'block';
        
        // 更新积分显示
        updatePointsDisplay();
    } else {
        // 用户未登录
        if (userEmail) userEmail.textContent = '未登录';
        if (notLoggedInSection) notLoggedInSection.style.display = 'block';
        if (loggedInSection) loggedInSection.style.display = 'none';
    }
}

// 模块切换功能
document.addEventListener('DOMContentLoaded', function() {
    const moduleButtons = document.querySelectorAll('.module-btn');
    const modules = document.querySelectorAll('.module');
    
    moduleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetModule = this.dataset.module;
            
            // 添加触觉反馈
            if (window.PWAManager) {
                window.PWAManager.addHapticFeedback('light');
            }
            
            // 更新按钮状态
            moduleButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新模块显示
            modules.forEach(module => {
                module.classList.remove('active');
                if (module.id === targetModule + '-module') {
                    module.classList.add('active');
                }
            });
        });
    });
    
    // 初始化认证状态
    updateMobileAuthUI(null);
    
    console.log('✅ PWA 移动端应用初始化完成');
});

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
    
    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
    }
`;
document.head.appendChild(style);