// 初始化数据
let currentPoints = parseInt(localStorage.getItem('currentPoints')) || 0;
let totalPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
let behaviors = JSON.parse(localStorage.getItem('behaviors')) || [];
let gifts = JSON.parse(localStorage.getItem('gifts')) || [];
let redeemedGifts = JSON.parse(localStorage.getItem('redeemedGifts')) || [];

// 更新积分显示
function updatePointsDisplay() {
    document.getElementById('current-points').textContent = currentPoints;
    document.getElementById('total-points').textContent = totalPoints;
    localStorage.setItem('currentPoints', currentPoints);
    localStorage.setItem('totalPoints', totalPoints);
}

// 更新行为日志
function updateBehaviorLog() {
    const logList = document.getElementById('behavior-log');
    logList.innerHTML = '';
    behaviors.forEach(behavior => {
        const li = document.createElement('li');
        li.textContent = `${behavior.desc}: ${behavior.change} 分`;
        logList.appendChild(li);
    });
    localStorage.setItem('behaviors', JSON.stringify(behaviors));
}

// 更新礼物列表
function updateGiftList() {
    const giftList = document.getElementById('gift-list');
    giftList.innerHTML = '';
    gifts.forEach((gift, index) => {
        const li = document.createElement('li');
        li.textContent = `${gift.name} - 需要 ${gift.points} 分`;
        
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'redeem-btn';
        redeemBtn.textContent = '兑换';
        redeemBtn.disabled = currentPoints < gift.points;
        redeemBtn.onclick = () => redeemGift(index);
        
        li.appendChild(redeemBtn);
        giftList.appendChild(li);
    });
    localStorage.setItem('gifts', JSON.stringify(gifts));
}

// 更新已兑换礼物列表
function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    redeemedList.innerHTML = '';
    redeemedGifts.forEach(gift => {
        const li = document.createElement('li');
        li.textContent = `${gift.name} - 兑换时间: ${gift.redeemDate}`;
        redeemedList.appendChild(li);
    });
    localStorage.setItem('redeemedGifts', JSON.stringify(redeemedGifts));
}

// 添加积分
function addPoints() {
    const desc = document.getElementById('behavior-desc').value;
    const change = parseInt(document.getElementById('points-change').value);
    
    if (desc && !isNaN(change)) {
        currentPoints += change;
        if (change > 0) {
            totalPoints += change; // 只有加分时累加总积分
        }
        behaviors.push({ desc, change });
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList(); // 更新按钮状态
        document.getElementById('behavior-desc').value = '';
        document.getElementById('points-change').value = '';
    } else {
        alert('请填写描述和积分变化！');
    }
}

// 添加礼物
function addGift() {
    const name = document.getElementById('gift-name').value;
    const giftPoints = parseInt(document.getElementById('gift-points').value);
    
    if (name && !isNaN(giftPoints)) {
        gifts.push({ name, points: giftPoints });
        updateGiftList();
        document.getElementById('gift-name').value = '';
        document.getElementById('gift-points').value = '';
    } else {
        alert('请填写礼物名称和所需积分！');
    }
}

// 兑换礼物
function redeemGift(index) {
    const gift = gifts[index];
    if (currentPoints >= gift.points) {
        currentPoints -= gift.points;
        const redeemDate = new Date().toLocaleString('zh-CN');
        redeemedGifts.push({ name: gift.name, points: gift.points, redeemDate });
        gifts.splice(index, 1); // 移除已兑换礼物
        alert(`恭喜！已兑换 ${gift.name}。剩余积分: ${currentPoints}`);
        updatePointsDisplay();
        updateGiftList();
        updateRedeemedList();
    }
}

// 页面加载时初始化
window.onload = () => {
    updatePointsDisplay();
    updateBehaviorLog();
    updateGiftList();
    updateRedeemedList();
};
