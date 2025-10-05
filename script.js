// 初始化数据
let points = parseInt(localStorage.getItem('points')) || 0;
let behaviors = JSON.parse(localStorage.getItem('behaviors')) || [];
let gifts = JSON.parse(localStorage.getItem('gifts')) || [];

// 更新积分显示
function updatePointsDisplay() {
    document.getElementById('current-points').textContent = points;
    localStorage.setItem('points', points);
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
        redeemBtn.disabled = points < gift.points;
        redeemBtn.onclick = () => redeemGift(index);
        
        li.appendChild(redeemBtn);
        giftList.appendChild(li);
    });
    localStorage.setItem('gifts', JSON.stringify(gifts));
}

// 添加积分
function addPoints() {
    const desc = document.getElementById('behavior-desc').value;
    const change = parseInt(document.getElementById('points-change').value);
    
    if (desc && !isNaN(change)) {
        points += change;
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
    if (points >= gift.points) {
        points -= gift.points;
        alert(`恭喜！已兑换 ${gift.name}。剩余积分: ${points}`);
        gifts.splice(index, 1); // 移除已兑换礼物
        updatePointsDisplay();
        updateGiftList();
    }
}

// 页面加载时初始化
window.onload = () => {
    updatePointsDisplay();
    updateBehaviorLog();
    updateGiftList();
};
