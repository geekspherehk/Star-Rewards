// 卷自己主题脚本

// Supabase配置
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

// 电商URL检测和商品图片提取函数
function detectEcommerceUrl(url) {
    const patterns = [
        /jd\.com/,
        /tmall\.com/,
        /taobao\.com/,
        /suning\.com/,
        /amazon\.cn/,
        /vip\.com/,
        /xiaomi\.com/,
        /apple\.com\.cn/,
        /huawei\.com/,
        /oppo\.com/,
        /vivo\.com\.cn/,
        /samsung\.com/,
        /dell\.com/,
        /lenovo\.com\.cn/,
        /hp\.com/,
        /asus\.com\.cn/,
        /acer\.com\.cn/,
        /microsoftstore\.com\.cn/,
        /sony\.com\.cn/,
        /canon\.com\.cn/,
        /nikon\.com\.cn/,
        /gopro\.com/,
        /dji\.com/,
        /xiaoyi\.com/,
        /360\.com/,
        /tp-link\.com\.cn/,
        /netgear\.com\.cn/,
        /logitech\.com\.cn/,
        /razerzone\.com/,
        /steelseries\.com/,
        /hyperxgaming\.com/,
        /corsair\.com/,
        /coolermaster\.com/,
        /nzxt\.com/,
        /bequiet\.com/,
        /noctua\.at/,
        /arctic\.ac/,
        /corsair\.com/,
        /gskill\.com/,
        /kingston\.com/,
        /crucial\.com/,
        /wd\.com/,
        /seagate\.com/,
        /toshiba\.com\.cn/,
        /sandisk\.com/,
        /lexar\.com/,
        /transcend-info\.com/,
        /adata\.com/,
        /teamgroupinc\.com/,
        /patriotmemory\.com/,
        /corsair\.com/,
        /coolermaster\.com/,
        /thermaltake\.com\.cn/,
        /silverstonetek\.com/,
        /phanteks\.com/,
        /lian-li\.com/,
        /fractal-design\.com/,
        /nzxt\.com/,
        /bequiet\.com/,
        /noctua\.at/,
        /arctic\.ac/,
        /corsair\.com/,
        /razerzone\.com/,
        /logitech\.com\.cn/,
        /steelseries\.com/,
        /hyperxgaming\.com/,
        /corsair\.com/,
        /coolermaster\.com/,
        /nzxt\.com/,
        /bequiet\.com/,
        /noctua\.at/,
        /arctic\.ac/,
        /corsair\.com/,
        /gskill\.com/,
        /kingston\.com/,
        /crucial\.com/,
        /wd\.com/,
        /seagate\.com/,
        /toshiba\.com\.cn/,
        /sandisk\.com/,
        /lexar\.com/,
        /transcend-info\.com/,
        /adata\.com/,
        /teamgroupinc\.com/,
        /patriotmemory\.com/
    ];
    
    return patterns.some(pattern => pattern.test(url));
}

function extractProductImage(url) {
    if (url.includes('jd.com')) {
        return 'https://img14.360buyimg.com/n1/s450x450_jfs/t1/123456/1/12345/123456/1234567890.jpg';
    } else if (url.includes('tmall.com') || url.includes('taobao.com')) {
        return 'https://img.alicdn.com/imgextra/i4/1234567890/TB2q8x3XyypuKNjSZFqXXbGPpXa_!!1234567890.jpg_430x430q90.jpg';
    } else if (url.includes('suning.com')) {
        return 'https://image.suning.cn/uimg/b2c/newcatentries/123456789-123456789_2_800x800.jpg';
    } else {
        return 'https://via.placeholder.com/150x150/4CAF50/white?text=🎯';
    }
}

// 初始化Supabase客户端
function initSupabase() {
    try {
        return supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error('Supabase初始化失败:', error);
        return null;
    }
}

// 用户登出
function logout() {
    if (confirm('确定要登出吗？')) {
        localStorage.removeItem('user');
        localStorage.removeItem('userRole');
        window.location.reload();
    }
}

// 全局变量
let currentUser = null;
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];
let behaviorLogs = [];
let supabaseClient = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
function initializeApp() {
    // 初始化Supabase
    supabaseClient = initSupabase();
    
    // 检查用户登录状态
    const userData = localStorage.getItem('user');
    if (userData) {
        currentUser = JSON.parse(userData);
        updateUI();
        loadData();
    } else {
        showLoginForm();
    }
    
    // 绑定事件监听器
    bindEventListeners();
}

// 绑定事件监听器
function bindEventListeners() {
    // Tab切换
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    // 添加行为积分
    document.getElementById('add-behavior-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addBehaviorPoints();
    });
    
    // 添加礼物
    document.getElementById('add-gift-form').addEventListener('submit', function(e) {
        e.preventDefault();
        addGift();
    });
    
    // 预设行为按钮
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const behavior = this.dataset.behavior;
            const points = parseInt(this.dataset.points);
            addPresetBehavior(behavior, points);
        });
    });
    
    // 礼物链接输入检测
    document.getElementById('gift-link').addEventListener('input', function() {
        detectGiftLink(this.value);
    });
}

// 切换Tab
function switchTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // 显示对应内容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.style.display = 'none';
    });
    document.getElementById(`${tabName}-tab`).style.display = 'block';
    
    // 如果是历史记录，刷新数据
    if (tabName === 'history') {
        loadHistoryData();
    }
}

// 检测礼物链接
function detectGiftLink(url) {
    if (detectEcommerceUrl(url)) {
        document.getElementById('gift-image').value = extractProductImage(url);
    }
}

// 添加预设行为
function addPresetBehavior(behavior, points) {
    document.getElementById('behavior-input').value = behavior;
    document.getElementById('points-input').value = points;
    
    // 添加动画效果
    const btn = event.target;
    btn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        btn.style.transform = 'scale(1)';
    }, 150);
}

// 添加行为积分
function addBehaviorPoints() {
    const behavior = document.getElementById('behavior-input').value.trim();
    const points = parseInt(document.getElementById('points-input').value);
    
    if (!behavior || !points || points <= 0) {
        alert('请输入有效的行为和能量值！');
        return;
    }
    
    // 创建行为记录
    const behaviorLog = {
        id: Date.now(),
        behavior: behavior,
        points: points,
        timestamp: new Date().toISOString(),
        userId: currentUser.id
    };
    
    // 更新本地数据
    behaviorLogs.unshift(behaviorLog);
    currentPoints += points;
    totalPoints += points;
    
    // 保存到Supabase
    if (supabaseClient) {
        saveBehaviorToSupabase(behaviorLog);
    }
    
    // 更新UI
    updatePointsDisplay();
    addBehaviorToList(behaviorLog);
    
    // 清空表单
    document.getElementById('add-behavior-form').reset();
    
    // 显示成功动画
    showSuccessAnimation('🎯 能量值 + ' + points);
}

// 添加礼物
function addGift() {
    const name = document.getElementById('gift-name').value.trim();
    const points = parseInt(document.getElementById('gift-points').value);
    const link = document.getElementById('gift-link').value.trim();
    const image = document.getElementById('gift-image').value.trim();
    
    if (!name || !points || points <= 0) {
        alert('请输入有效的目标奖励名称和所需能量值！');
        return;
    }
    
    // 创建礼物
    const gift = {
        id: Date.now(),
        name: name,
        points: points,
        link: link,
        image: image || 'https://via.placeholder.com/150x150/667eea/white?text=🎯',
        userId: currentUser.id,
        createdAt: new Date().toISOString()
    };
    
    // 更新本地数据
    gifts.push(gift);
    
    // 保存到Supabase
    if (supabaseClient) {
        saveGiftToSupabase(gift);
    }
    
    // 添加到列表
    addGiftToList(gift);
    
    // 清空表单
    document.getElementById('add-gift-form').reset();
    
    // 显示成功动画
    showSuccessAnimation('🎯 目标奖励添加成功！');
}

// 兑换礼物
function redeemGift(giftId) {
    const gift = gifts.find(g => g.id === giftId);
    if (!gift) return;
    
    if (currentPoints < gift.points) {
        alert('能量值不足！还需要 ' + (gift.points - currentPoints) + ' 能量值');
        return;
    }
    
    if (confirm(`确定要用 ${gift.points} 能量值兑换 "${gift.name}" 吗？`)) {
        // 创建兑换记录
        const redeemLog = {
            id: Date.now(),
            giftId: giftId,
            giftName: gift.name,
            points: gift.points,
            timestamp: new Date().toISOString(),
            userId: currentUser.id
        };
        
        // 更新数据
        redeemedGifts.unshift(redeemLog);
        currentPoints -= gift.points;
        
        // 保存到Supabase
        if (supabaseClient) {
            saveRedeemToSupabase(redeemLog);
        }
        
        // 更新UI
        updatePointsDisplay();
        addRedeemedToList(redeemLog);
        
        // 显示成功动画
        showSuccessAnimation('🎉 目标达成！' + gift.name);
    }
}

// 更新UI
function updateUI() {
    if (currentUser) {
        document.getElementById('user-info').style.display = 'block';
        document.getElementById('user-name').textContent = currentUser.name;
        document.getElementById('user-role').textContent = currentUser.role || '用户';
        document.getElementById('main-content').style.display = 'block';
        
        updatePointsDisplay();
    }
}

// 更新积分显示
function updatePointsDisplay() {
    document.getElementById('current-points').textContent = currentPoints;
    document.getElementById('total-points').textContent = totalPoints;
    
    // 添加动画效果
    const cards = document.querySelectorAll('.points-card');
    cards.forEach(card => {
        card.style.transform = 'scale(1.05)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 200);
    });
}

// 添加行为到列表
function addBehaviorToList(behaviorLog) {
    const behaviorLogContainer = document.getElementById('behavior-log');
    
    // 如果元素不存在，直接返回
    if (!behaviorLogContainer) {
        console.log('behavior-log元素不存在，跳过添加行为记录');
        return;
    }
    
    const behaviorElement = document.createElement('div');
    behaviorElement.className = 'behavior-item';
    behaviorElement.style.cssText = `
        background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(255, 255, 255, 0.05));
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
        border-left: 4px solid #00d4ff;
        transition: all 0.3s ease;
        animation: slideInLeft 0.5s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(0, 212, 255, 0.2);
    `;
    
    behaviorElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; color: #00d4ff; font-size: 1.1rem;">🎯 ${behaviorLog.behavior}</div>
                <div style="color: #8892b0; font-size: 0.9rem; margin-top: 5px;">
                    ${new Date(behaviorLog.timestamp).toLocaleString('zh-CN')}
                </div>
            </div>
            <div style="color: #00d4ff; font-weight: bold; font-size: 1.3rem; text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);">
                +${behaviorLog.points}
            </div>
        </div>
    `;
    
    behaviorLogContainer.insertBefore(behaviorElement, behaviorLogContainer.firstChild);
    
    // 限制显示数量
    const items = behaviorLogContainer.querySelectorAll('.behavior-item');
    if (items.length > 20) {
        items[items.length - 1].remove();
    }
}

// 添加礼物到列表
function addGiftToList(gift) {
    const giftListContainer = document.getElementById('gift-list');
    
    // 如果元素不存在，直接返回
    if (!giftListContainer) {
        console.log('gift-list元素不存在，跳过添加礼物');
        return;
    }
    
    const giftElement = document.createElement('div');
    giftElement.className = 'gift-item';
    giftElement.style.cssText = `
        background: linear-gradient(135deg, rgba(255, 107, 107, 0.1), rgba(255, 255, 255, 0.05));
        border-radius: 15px;
        padding: 20px;
        margin-bottom: 15px;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
        border: 1px solid rgba(255, 107, 107, 0.2);
        position: relative;
        overflow: hidden;
    `;
    
    giftElement.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <img src="${gift.image}" alt="${gift.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 10px; border: 2px solid rgba(255, 107, 107, 0.3);">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #ff6b6b; font-size: 1.2rem; margin-bottom: 5px;">🎯 ${gift.name}</div>
                <div style="color: #8892b0; font-size: 0.9rem; margin-bottom: 10px;">需要能量值: <span style="color: #ff6b6b; font-weight: bold;">${gift.points}</span></div>
                ${gift.link ? `<div style="margin-top: 10px;"><a href="${gift.link}" target="_blank" style="color: #00d4ff; text-decoration: none; font-weight: 500;">🔗 查看详情</a></div>` : ''}
            </div>
            <button onclick="redeemGift(${gift.id})" style="background: linear-gradient(135deg, #ff6b6b, #ff4757); color: white; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(255, 107, 107, 0.4);" 
                    onmouseover="this.style.transform='translateY(-2px) scale(1.05)'" 
                    onmouseout="this.style.transform='translateY(0) scale(1)'"
                    ${currentPoints < gift.points ? 'disabled style="background: #666; cursor: not-allowed; box-shadow: none;"' : ''}>
                ${currentPoints >= gift.points ? '🎁 达成目标' : '🔒 能量不足'}
            </button>
        </div>
    `;
    
    giftListContainer.appendChild(giftElement);
}

// 添加已兑换礼物到列表
function addRedeemedToList(redeemLog) {
    const redeemedListContainer = document.getElementById('redeemed-list');
    
    // 如果元素不存在，直接返回
    if (!redeemedListContainer) {
        console.log('redeemed-list元素不存在，跳过添加兑换记录');
        return;
    }
    
    const redeemedElement = document.createElement('div');
    redeemedElement.className = 'redeemed-item';
    redeemedElement.style.cssText = `
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 255, 255, 0.05));
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
        border-left: 4px solid #ffd700;
        transition: all 0.3s ease;
        animation: slideInLeft 0.5s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(255, 215, 0, 0.2);
    `;
    
    redeemedElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; color: #ffd700; font-size: 1.1rem;">🎉 ${redeemLog.giftName}</div>
                <div style="color: #8892b0; font-size: 0.9rem; margin-top: 5px;">
                    ${new Date(redeemLog.timestamp).toLocaleString('zh-CN')}
                </div>
            </div>
            <div style="color: #ff6b6b; font-weight: bold; font-size: 1.3rem; text-shadow: 0 0 10px rgba(255, 107, 107, 0.5);">
                -${redeemLog.points}
            </div>
        </div>
    `;
    
    redeemedListContainer.insertBefore(redeemedElement, redeemedListContainer.firstChild);
    
    // 限制显示数量
    const items = redeemedListContainer.querySelectorAll('.redeemed-item');
    if (items.length > 20) {
        items[items.length - 1].remove();
    }
}

// 显示成功动画
function showSuccessAnimation(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #00d4ff, #0099cc);
        color: white;
        padding: 20px 30px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 1.1rem;
        z-index: 1000;
        animation: slideInRight 0.5s ease;
        box-shadow: 0 8px 25px rgba(0, 212, 255, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// 加载数据
function loadData() {
    if (!currentUser) return;
    
    // 从本地存储加载数据
    const savedBehaviors = localStorage.getItem(`behaviors_${currentUser.id}`);
    const savedGifts = localStorage.getItem(`gifts_${currentUser.id}`);
    const savedRedeemed = localStorage.getItem(`redeemed_${currentUser.id}`);
    const savedLogs = localStorage.getItem(`behaviorLogs_${currentUser.id}`);
    
    if (savedBehaviors) behaviors = JSON.parse(savedBehaviors);
    if (savedGifts) gifts = JSON.parse(savedGifts);
    if (savedRedeemed) redeemedGifts = JSON.parse(savedRedeemed);
    if (savedLogs) behaviorLogs = JSON.parse(savedLogs);
    
    // 计算积分
    currentPoints = parseInt(localStorage.getItem(`currentPoints_${currentUser.id}`) || '0');
    totalPoints = parseInt(localStorage.getItem(`totalPoints_${currentUser.id}`) || '0');
    
    // 更新显示
    updatePointsDisplay();
    
    // 加载列表数据
    loadLists();
}

// 加载列表数据
function loadLists() {
    // 获取所有列表元素
    const behaviorLogElement = document.getElementById('behavior-log');
    const giftListElement = document.getElementById('gift-list');
    const redeemedListElement = document.getElementById('redeemed-list');
    
    // 清空现有列表（如果元素存在）
    if (behaviorLogElement) behaviorLogElement.innerHTML = '';
    if (giftListElement) giftListElement.innerHTML = '';
    if (redeemedListElement) redeemedListElement.innerHTML = '';
    
    // 加载行为日志
    behaviorLogs.slice(0, 20).forEach(log => addBehaviorToList(log));
    
    // 加载礼物列表
    gifts.forEach(gift => addGiftToList(gift));
    
    // 加载已兑换列表
    redeemedGifts.slice(0, 20).forEach(redeem => addRedeemedToList(redeem));
    
    // 更新计数
    updateCounts();
}

// 更新计数
function updateCounts() {
    const behaviorCountElement = document.getElementById('behavior-count');
    const redeemedCountElement = document.getElementById('redeemed-count');
    
    if (behaviorCountElement) behaviorCountElement.textContent = behaviorLogs.length;
    if (redeemedCountElement) redeemedCountElement.textContent = redeemedGifts.length;
}

// 加载历史数据
function loadHistoryData() {
    updateCounts();
}

// 保存到Supabase
function saveBehaviorToSupabase(behaviorLog) {
    // 这里应该实现实际的Supabase保存逻辑
    console.log('保存行为到Supabase:', behaviorLog);
}

function saveGiftToSupabase(gift) {
    // 这里应该实现实际的Supabase保存逻辑
    console.log('保存礼物到Supabase:', gift);
}

function saveRedeemToSupabase(redeemLog) {
    // 这里应该实现实际的Supabase保存逻辑
    console.log('保存兑换记录到Supabase:', redeemLog);
}

// 显示登录表单
function showLoginForm() {
    // 这里可以实现登录逻辑
    alert('请先登录系统！');
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes slideInLeft {
        from { transform: translateX(-30px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(style);