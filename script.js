// Supabase 配置 - 替换为你的实际配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co'; // 例如: https://your-project-id.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM'; // 例如: eyJhb...
const supabase = Supabase.createClient(supabaseUrl, supabaseKey);

// 本地数据变量
let currentPoints = parseInt(localStorage.getItem('currentPoints')) || 0;
let totalPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
let behaviors = JSON.parse(localStorage.getItem('behaviors')) || [];
let gifts = JSON.parse(localStorage.getItem('gifts')) || [];
let redeemedGifts = JSON.parse(localStorage.getItem('redeemedGifts')) || [];

// 初始化 Supabase 匿名认证
async function initAuth() {
    try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        updateCloudStatus(`已登录 (UID: ${data.user.id.substring(0, 8)}...)`);
    } catch (error) {
        console.error('匿名登录失败:', error);
        updateCloudStatus('登录失败');
    }
}

// 云端状态更新
function updateCloudStatus(status) {
    document.getElementById('cloud-status').textContent = status;
}

function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        console.error('无法保存到localStorage:', e);
        alert('本地数据保存失败，请检查浏览器存储设置！');
    }
}

function updatePointsDisplay() {
    document.getElementById('current-points').textContent = currentPoints;
    document.getElementById('total-points').textContent = totalPoints;
    localStorage.setItem('currentPoints', currentPoints);
    localStorage.setItem('totalPoints', totalPoints);
}

function updateBehaviorLog() {
    const logList = document.getElementById('behavior-log');
    logList.innerHTML = '';
    behaviors.forEach(behavior => {
        const li = document.createElement('li');
        li.textContent = `${behavior.desc}: ${behavior.change} 分`;
        logList.appendChild(li);
    });
    saveToLocalStorage('behaviors', behaviors);
}

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
    saveToLocalStorage('gifts', gifts);
}

function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    redeemedList.innerHTML = '';
    redeemedGifts.forEach(gift => {
        const li = document.createElement('li');
        li.textContent = `${gift.name} - 兑换时间: ${gift.redeemDate}`;
        redeemedList.appendChild(li);
    });
    saveToLocalStorage('redeemedGifts', redeemedGifts);
}

// 备份到云端
async function backupToCloud() {
    const user = supabase.auth.getUser();
    if (!user.data.user) {
        alert('请等待登录...');
        return;
    }
    const data = {
        currentPoints,
        totalPoints,
        behaviors,
        gifts,
        redeemedGifts,
        lastBackup: new Date().toISOString()
    };
    try {
        const { error } = await supabase
            .from('user_data')
            .upsert(
                { uid: user.data.user.id, data },
                { onConflict: ['uid'] }
            );
        if (error) throw error;
        alert('备份成功！');
        updateCloudStatus('备份成功');
    } catch (error) {
        console.error('备份失败:', error);
        alert('备份失败: ' + error.message);
    }
}

// 从云端恢复
async function restoreFromCloud() {
    const user = supabase.auth.getUser();
    if (!user.data.user) {
        alert('请等待登录...');
        return;
    }
    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('uid', user.data.user.id)
            .single();
        if (error) throw error;
        if (data) {
            currentPoints = data.data.currentPoints || 0;
            totalPoints = data.data.totalPoints || 0;
            behaviors = data.data.behaviors || [];
            gifts = data.data.gifts || [];
            redeemedGifts = data.data.redeemedGifts || [];
            // 保存到本地
            saveToLocalStorage('currentPoints', currentPoints);
            saveToLocalStorage('totalPoints', totalPoints);
            saveToLocalStorage('behaviors', behaviors);
            saveToLocalStorage('gifts', gifts);
            saveToLocalStorage('redeemedGifts', redeemedGifts);
            // 更新显示
            updatePointsDisplay();
            updateBehaviorLog();
            updateGiftList();
            updateRedeemedList();
            alert('恢复成功！');
            updateCloudStatus('恢复成功');
        } else {
            alert('云端无数据！');
        }
    } catch (error) {
        console.error('恢复失败:', error);
        alert('恢复失败: ' + error.message);
    }
}

// 添加积分
function addPoints() {
    const desc = document.getElementById('behavior-desc').value;
    const change = parseInt(document.getElementById('points-change').value);
    
    if (desc && !isNaN(change)) {
        currentPoints += change;
        if (change > 0) {
            totalPoints += change;
        }
        behaviors.push({ desc, change, timestamp: new Date().toISOString() });
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
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
        gifts.splice(index, 1);
        alert(`恭喜！已兑换 ${gift.name}。剩余积分: ${currentPoints}`);
        updatePointsDisplay();
        updateGiftList();
        updateRedeemedList();
    }
}

function clearData() {
    if (confirm('确定要清空所有数据吗？（本地数据，云端需手动备份）')) {
        localStorage.clear();
        currentPoints = 0;
        totalPoints = 0;
        behaviors = [];
        gifts = [];
        redeemedGifts = [];
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
    }
}

// 页面加载时初始化
window.onload = async () => {
    await initAuth();
    const user = supabase.auth.getUser();
    if (user.data.user) {
        await restoreFromCloud(); // 尝试从云端加载
    } else {
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
    }
};
