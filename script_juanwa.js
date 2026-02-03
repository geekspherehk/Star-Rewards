// 卷娃小能手页面的JavaScript逻辑

// Supabase配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM';

// 全局变量
let supabase;
let currentUser = null;
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];

// 初始化Supabase客户端
function initializeSupabase() {
    try {
        if (window._supabaseClient) {
            console.log('使用已存在的Supabase客户端实例');
            return window._supabaseClient;
        }
        
        if (typeof window.supabase === 'undefined') {
            console.warn('Supabase SDK 未加载');
            return null;
        }
        
        const client = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: {
                storage: localStorage,
                autoRefreshToken: true,
                persistSession: true
            },
            global: {
                headers: {
                    'apikey': supabaseKey
                }
            }
        });
        
        window._supabaseClient = client;
        console.log('Supabase客户端初始化成功');
        return client;
    } catch (error) {
        console.error('Supabase 初始化失败:', error);
        return null;
    }
}

// 页面初始化函数
async function initializeJuanwaPage() {
    try {
        console.log('开始初始化卷娃小能手页面...');
        
        // 初始化多语言
        initLanguage();
        
        // 初始化Supabase
        supabase = initializeSupabase();
        if (!supabase) {
            console.error('Supabase初始化失败');
            showTemporaryMessage('❌ 数据库连接失败', 'error');
            return;
        }
        
        // 检查用户登录状态
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            console.log('用户未登录，跳转到登录页面');
            window.location.href = 'login.html';
            return;
        }
        
        // 用户已登录
        currentUser = { email: user.email, id: user.id };
        console.log('用户已登录:', user.email);
        
        // 更新UI显示用户信息
        updateAuthUI(user);
        
        // 从数据库加载用户数据
        await loadUserDataFromDatabase();
        
        console.log('卷娃小能手页面初始化完成');
        
    } catch (error) {
        console.error('页面初始化失败:', error);
        showTemporaryMessage('❌ 页面初始化失败', 'error');
    }
}

// 更新认证UI状态
function updateAuthUI(user) {
    const loggedInState = document.getElementById('logged-in-state');
    const notLoggedInState = document.getElementById('not-logged-in-state');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 已登录状态
        if (loggedInState) loggedInState.style.display = 'block';
        if (notLoggedInState) notLoggedInState.style.display = 'none';
        if (userEmail) userEmail.textContent = user.email;
    } else {
        // 未登录状态
        if (loggedInState) loggedInState.style.display = 'none';
        if (notLoggedInState) notLoggedInState.style.display = 'block';
    }
}

// 从数据库加载用户数据
async function loadUserDataFromDatabase() {
    console.log('开始从数据库加载用户数据...');
    
    try {
        if (!currentUser) {
            throw new Error('用户未登录');
        }
        
        // 并行加载所有数据
        const [
            profileResponse,
            behaviorsResponse,
            giftsResponse,
            redeemedGiftsResponse
        ] = await Promise.all([
            // 加载用户档案
            supabase
                .from('profiles')
                .select('current_points, total_points')
                .eq('id', currentUser.id)
                .single(),
            
            // 加载行为记录
            supabase
                .from('behaviors')
                .select('description, points, timestamp')
                .eq('user_id', currentUser.id)
                .order('timestamp', { ascending: false }),
            
            // 加载礼物列表
            supabase
                .from('gifts')
                .select('id, name, points, description, created_at')
                .eq('user_id', currentUser.id)
                .order('created_at', { ascending: false }),
            
            // 加载已兑换礼物
            supabase
                .from('redeemed_gifts')
                .select('name, points, description, redeem_date')
                .eq('user_id', currentUser.id)
                .order('redeem_date', { ascending: false })
        ]);
        
        // 处理响应数据
        if (profileResponse.data) {
            currentPoints = profileResponse.data.current_points || 0;
            totalPoints = profileResponse.data.total_points || 0;
        }
        
        behaviors = behaviorsResponse.data || [];
        gifts = giftsResponse.data || [];
        redeemedGifts = redeemedGiftsResponse.data || [];
        
        console.log('数据加载成功:');
        console.log('- 当前积分:', currentPoints);
        console.log('- 总积分:', totalPoints);
        console.log('- 行为记录:', behaviors.length, '条');
        console.log('- 礼物:', gifts.length, '个');
        console.log('- 已兑换礼物:', redeemedGifts.length, '个');
        
        // 更新UI显示
        updateAllUI();
        
    } catch (error) {
        console.error('加载用户数据失败:', error);
        throw error;
    }
}

// 更新所有UI
function updateAllUI() {
    updatePointsDisplay();
    updateBehaviorLog();
    updateGiftList();
    updateRedeemedList();
}

// 更新积分显示
function updatePointsDisplay() {
    const currentPointsElement = document.getElementById('current-points');
    const totalPointsElement = document.getElementById('total-points');
    
    if (currentPointsElement) {
        currentPointsElement.textContent = currentPoints;
    }
    
    if (totalPointsElement) {
        totalPointsElement.textContent = totalPoints;
    }
}

// 更新行为日志
function updateBehaviorLog() {
    const behaviorLog = document.getElementById('behavior-log');
    const behaviorCount = document.getElementById('behavior-count');
    
    if (!behaviorLog) return;
    
    if (behaviors.length === 0) {
        behaviorLog.innerHTML = '<div class="empty-message">还没有成长记录哦，快来记录宝贝的第一个成长瞬间吧！</div>';
        if (behaviorCount) behaviorCount.textContent = '0';
        return;
    }
    
    let html = '<div class="behavior-log-container">';
    behaviors.forEach((behavior, index) => {
        const isPositive = behavior.points > 0;
        const icon = isPositive ? '✅' : '❌';
        const pointsClass = isPositive ? 'positive-points' : 'negative-points';
        
        html += `
            <div class="behavior-item" style="animation-delay: ${index * 0.1}s;">
                <div class="behavior-icon">${icon}</div>
                <div class="behavior-content">
                    <div class="behavior-description">${escapeHtml(behavior.description)}</div>
                    <div class="behavior-meta">
                        <span class="behavior-points ${pointsClass}">${behavior.points}</span>
                        <span class="behavior-date">${formatBehaviorDate(behavior.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    behaviorLog.innerHTML = html;
    if (behaviorCount) behaviorCount.textContent = behaviors.length;
}

// 更新礼物列表
function updateGiftList() {
    const giftList = document.getElementById('gift-list');
    
    if (!giftList) return;
    
    if (gifts.length === 0) {
        giftList.innerHTML = '<div class="empty-message">还没有愿望清单哦，快来添加宝贝的第一个愿望吧！</div>';
        return;
    }
    
    let html = '';
    gifts.forEach((gift, index) => {
        html += `
            <div class="gift-item" style="animation-delay: ${index * 0.1}s;">
                <div class="gift-info">
                    <div class="gift-header">
                        <div class="gift-name">${escapeHtml(gift.name)}</div>
                        <div class="gift-points">⭐ ${gift.points}</div>
                    </div>
                    ${gift.description ? `<div class="gift-description">${escapeHtml(gift.description)}</div>` : ''}
                </div>
                <button class="redeem-btn" onclick="redeemGift(${index})">✨ 兑换愿望</button>
            </div>
        `;
    });
    
    giftList.innerHTML = html;
}

// 更新已兑换礼物列表
function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    const redeemedCount = document.getElementById('redeemed-count');
    
    if (!redeemedList) return;
    
    if (redeemedGifts.length === 0) {
        redeemedList.innerHTML = '<div class="empty-message">还没有愿望达成记录哦，加油！</div>';
        if (redeemedCount) redeemedCount.textContent = '0';
        return;
    }
    
    let html = '<div class="redeemed-gifts-container">';
    redeemedGifts.forEach((gift, index) => {
        html += `
            <div class="redeemed-item" style="animation-delay: ${index * 0.1}s;">
                <div class="redeemed-icon">🏆</div>
                <div class="redeemed-content">
                    <div class="redeemed-name">${escapeHtml(gift.name)}</div>
                    <div class="redeemed-info">
                        <span class="redeemed-points">⭐ ${gift.points}</span>
                        <span class="redeemed-date">${formatRedeemDate(gift.redeem_date)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    redeemedList.innerHTML = html;
    if (redeemedCount) redeemedCount.textContent = redeemedGifts.length;
}

// 添加积分
async function addPoints() {
    const behaviorDesc = document.getElementById('behavior-desc').value.trim();
    const pointsChange = parseInt(document.getElementById('points-change').value) || 0;
    
    if (!behaviorDesc) {
        showTemporaryMessage('请输入成长记录内容', 'error');
        return;
    }
    
    if (pointsChange === 0) {
        showTemporaryMessage('请输入小星星数量', 'error');
        return;
    }
    
    try {
        const timestamp = new Date().toISOString();
        
        // 更新本地数据
        currentPoints += pointsChange;
        if (pointsChange > 0) {
            totalPoints += pointsChange;
        }
        
        behaviors.unshift({
            description: behaviorDesc,
            points: pointsChange,
            timestamp: timestamp
        });
        
        // 保存到数据库
        await Promise.all([
            supabase.from('behaviors').insert({
                user_id: currentUser.id,
                description: behaviorDesc,
                points: pointsChange,
                timestamp: timestamp
            }),
            supabase.from('profiles').upsert({
                id: currentUser.id,
                current_points: currentPoints,
                total_points: totalPoints,
                updated_at: timestamp
            })
        ]);
        
        // 清空输入框
        document.getElementById('behavior-desc').value = '';
        document.getElementById('points-change').value = '';
        
        // 更新UI
        updateAllUI();
        
        showTemporaryMessage(`✨ 成功添加成长记录！获得 ${pointsChange} 颗小星星`, 'success');
        
    } catch (error) {
        console.error('添加成长记录失败:', error);
        showTemporaryMessage('添加成长记录失败', 'error');
    }
}

// 添加礼物
async function addGift() {
    const giftName = document.getElementById('gift-name').value.trim();
    const giftPoints = parseInt(document.getElementById('gift-points').value) || 0;
    const giftDescription = document.getElementById('gift-description').value.trim();
    
    if (!giftName) {
        showTemporaryMessage('请输入愿望名称', 'error');
        return;
    }
    
    if (giftPoints <= 0) {
        showTemporaryMessage('请输入需要的小星星数量', 'error');
        return;
    }
    
    try {
        const timestamp = new Date().toISOString();
        
        // 保存到数据库
        const { data, error } = await supabase.from('gifts').insert({
            user_id: currentUser.id,
            name: giftName,
            points: giftPoints,
            description: giftDescription,
            created_at: timestamp
        });
        
        if (error) throw error;
        
        // 更新本地数据
        gifts.unshift({
            id: data[0].id,
            name: giftName,
            points: giftPoints,
            description: giftDescription,
            created_at: timestamp
        });
        
        // 清空输入框
        document.getElementById('gift-name').value = '';
        document.getElementById('gift-points').value = '';
        document.getElementById('gift-description').value = '';
        
        // 更新UI
        updateGiftList();
        
        showTemporaryMessage(`🎁 愿望 "${giftName}" 添加成功！`, 'success');
        
    } catch (error) {
        console.error('添加愿望失败:', error);
        showTemporaryMessage('添加愿望失败', 'error');
    }
}

// 兑换礼物
async function redeemGift(giftIndex) {
    const gift = gifts[giftIndex];
    
    if (currentPoints < gift.points) {
        showTemporaryMessage(`小星星不够哦！需要 ${gift.points} 颗，当前有 ${currentPoints} 颗`, 'error');
        return;
    }
    
    if (!confirm(`确定要用 ${gift.points} 颗小星星兑换 "${gift.name}" 吗？`)) {
        return;
    }
    
    try {
        const timestamp = new Date().toISOString();
        
        // 使用存储过程确保数据一致性
        const { data, error } = await supabase.rpc('redeem_gift_transaction', {
            user_id_param: currentUser.id,
            gift_id_param: gift.id,
            gift_name_param: gift.name,
            gift_points_param: gift.points,
            gift_description_param: gift.description || '',
            redeem_date_param: timestamp,
            current_points_param: currentPoints - gift.points
        });
        
        if (error) {
            console.error('存储过程执行失败:', error);
            throw error;
        }
        
        // 检查存储过程是否返回成功
        if (!data) {
            throw new Error('兑换失败，请检查积分和礼物状态');
        }
        
        // 所有数据库操作成功后，再更新本地数据
        // 扣除积分
        currentPoints -= gift.points;
        
        // 从礼物列表中移除
        gifts.splice(giftIndex, 1);
        
        // 添加到已兑换列表
        redeemedGifts.unshift({
            name: gift.name,
            points: gift.points,
            description: gift.description,
            redeem_date: timestamp
        });
        
        // 更新UI
        updateAllUI();
        
        showTemporaryMessage(`🎉 恭喜！成功兑换 "${gift.name}"！`, 'success');
        
    } catch (error) {
        console.error('兑换失败:', error);
        showTemporaryMessage('兑换失败', 'error');
    }
}

// 切换标签页
function switchTab(tabId) {
    // 隐藏所有标签页内容
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // 移除所有标签按钮的激活状态
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // 显示选中的标签页内容
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // 激活对应的标签按钮
    const activeButton = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }
}

// 设置预设行为
function setPresetBehavior(description, points) {
    document.getElementById('behavior-desc').value = description;
    document.getElementById('points-change').value = points;
}

// 用户登出
async function signOut() {
    try {
        if (supabase) {
            await supabase.auth.signOut();
        }
        
        // 清空本地存储
        localStorage.clear();
        sessionStorage.clear();
        
        // 跳转到登录页面
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('登出失败:', error);
        showTemporaryMessage('登出失败', 'error');
    }
}

// 显示临时消息
function showTemporaryMessage(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = {
        success: 'linear-gradient(135deg, #4CAF50, #45a049)',
        error: 'linear-gradient(135deg, #f44336, #d32f2f)',
        info: 'linear-gradient(135deg, #2196F3, #1976D2)'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: 600;
        z-index: 1000;
        animation: slideInRight 0.5s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.5s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 3000);
}

// HTML转义函数
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// 格式化行为日期
function formatBehaviorDate(timestamp) {
    if (!timestamp) return '刚刚';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        
        return date.toLocaleDateString('zh-CN', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return '未知时间';
    }
}

// 格式化兑换日期
function formatRedeemDate(dateString) {
    if (!dateString || dateString === '未知时间') return '刚刚';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        
        return date.toLocaleDateString('zh-CN', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化卷娃小能手页面...');
    initializeJuanwaPage();
});

// 全局错误处理
window.addEventListener('error', function(event) {
    console.error('全局错误捕获:', event.error);
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise拒绝:', event.reason);
});