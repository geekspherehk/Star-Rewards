// Supabase 配置 - 替换为你的实际配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co'; // 例如: https://your-project-id.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM'; // 例如: eyJhb...
let supabase;

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误捕获:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});

// 初始化Supabase客户端
function initializeSupabase() {
    try {
        // 检查是否已经存在初始化的客户端
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
                storage: localStorage, // 使用localStorage存储会话信息
                autoRefreshToken: true, // 启用自动刷新令牌
                persistSession: true // 启用会话持久化
            }
        });
        
        // 保存客户端实例到全局变量
        window._supabaseClient = client;
        console.log('Supabase客户端初始化成功');
        return client;
    } catch (error) {
        console.error('Supabase 初始化失败:', error);
        return null;
    }
}

// 初始化Supabase
supabase = initializeSupabase();

// 检查用户是否已登录的函数
async function checkUserLoggedIn() {
    if (!supabase) {
        console.log('Supabase 未初始化');
        return false;
    }
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            console.error('获取用户信息失败:', error);
            return false;
        }
        
        return !!user;
    } catch (error) {
        console.error('检查用户登录状态时出错:', error);
        return false;
    }
}

// 本地数据变量
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];

// 当前登录用户信息
let currentUser = null;

// // 页面加载时从数据库获取数据
// window.addEventListener('DOMContentLoaded', async () => {
//     console.log('页面开始加载...');
    
//     // 检查当前页面
//     const currentPage = window.location.pathname.split('/').pop();
//     console.log('当前页面:', currentPage);
    
//     // 只在主页进行登录检查和数据加载
//     if (currentPage === 'index.html' || currentPage === '') {
//         console.log('在主页，开始检查登录状态和加载数据...');
//         checkUserLoggedIn().then(isLoggedIn => {
//             console.log('登录状态检查完成，结果:', isLoggedIn ? '已登录' : '未登录');
//             if (isLoggedIn) {
//                 // 如果已登录，重定向到主页
//             } else {
//                 console.log('用户未登录，保持在登录页面');
//                 showTemporaryMessage('🔑 请登录或注册', 'info');
//             }
//         }).catch(error => {
//             console.error('检查登录状态时出错:', error);
//             showTemporaryMessage('❌ 检查登录状态失败', 'error');
//         });
//         // if (supabase) {
//         //     console.log('尝试从云端获取数据...');
//         //     try {
//         //          // 方法二：获取当前用户信息
//         //         const { data: { user }, error } = await supabase.auth.getUser();
//         //         if (user) {
//         //             console.log('当前用户:', user.email);
//         //             // 使用用户信息
//         //         } else {
//         //             console.log('未获取到用户信息');
//         //         }
//         //         // 方法一：获取当前会话
//         //         const { data } = await supabase.auth.getSession();
//         //         if (data.session) {
//         //             console.log('用户已登录:', data.session.user.email);
//         //             // 使用会话信息
//         //         } else {
//         //             console.log('用户未登录');
//         //         }               
                
//         //         // 检查用户是否已登录
//         //         const { data: { session } } = await supabase.auth.getSession();
//         //         console.log('获取到的会话信息:', session ? '已登录' : '未登录');
                
//         //         if (session) {
//         //             console.log('用户已登录，正在从云端恢复数据...');
//         //             // 从数据库加载数据
//         //             await restoreBasicData();
//         //             console.log('云端数据恢复完成');
//         //         } else {
//         //             console.log('用户未登录，将使用默认数据');
//         //         }
//         //         // 无论是否登录，都调用updateAuthUI来正确设置UI状态
//         //         updateAuthUI(session?.user || null);
//         //     } catch (error) {
//         //         console.error('检查用户登录状态时出错:', error);
//         //         // 确保UI状态正确更新
//         //         updateAuthUI(null);
//         //     }
//         // } else {
//         //     console.log('Supabase未初始化，使用本地数据');
//         //     // Supabase未初始化，使用本地数据
//         //     updatePointsDisplay();
//         //     updateBehaviorLog();
//         //     updateGiftList();
//         //     updateRedeemedList();
//         //     // 确保UI状态正确更新
//         //     updateAuthUI(null);
//         // }
//     }
    
//     // console.log('初始化认证状态监听...');
//     // // 初始化认证状态监听
//     // if (supabase) {
//     //     initAuth();
//     // }
    
//     console.log('页面加载完成');
// });

// 简化版的数据恢复函数，仅在登录页面使用
async function restoreBasicData() {
    if (!supabase) {
        console.log('Supabase 未初始化，无法恢复数据');
        return;
    }
    
    try {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user.user) {
            console.log('无法获取用户信息');
            return;
        }
        
        // 从 profiles 表获取积分信息
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('current_points, total_points')
            .eq('id', user.user.id)
            .single();
        
        // 特别处理 PGRST116 错误（无数据）
        if (profileError && profileError.code === 'PGRST116') {
            console.log('云端无数据');
            return;
        }
        
        if (profileError) throw profileError;
        
        // 从 behaviors 表获取最近5个行为记录
        const { data: behaviorsData, error: behaviorsError } = await supabase
            .from('behaviors')
            .select('description, points, timestamp')
            .eq('user_id', user.user.id)
            .order('timestamp', { ascending: false })
            .limit(5);
        
        if (behaviorsError) throw behaviorsError;
        
        // 从 gifts 表获取最近5个礼物信息
        const { data: giftsData, error: giftsError } = await supabase
            .from('gifts')
            .select('id, name, points')
            .eq('user_id', user.user.id)
            .order('id', { ascending: false })
            .limit(5);
        
        if (giftsError) throw giftsError;
        
        // 从 redeemed_gifts 表获取最近5个已兑换礼物信息
        const { data: redeemedData, error: redeemedError } = await supabase
            .from('redeemed_gifts')
            .select('id, gift_id, name, points, redeem_date')
            .eq('user_id', user.user.id)
            .order('redeem_date', { ascending: false })
            .limit(5);
        
        if (redeemedError) throw redeemedError;
        
        // 保存所有数据到 sessionStorage，以便主页可以访问
        if (profileData) {
            sessionStorage.setItem('currentPoints', profileData.current_points || 0);
            sessionStorage.setItem('totalPoints', profileData.total_points || 0);
        }
        
        if (behaviorsData) {
            sessionStorage.setItem('behaviors', JSON.stringify(behaviorsData));
        }
        
        if (giftsData) {
            sessionStorage.setItem('gifts', JSON.stringify(giftsData));
        }
        
        if (redeemedData) {
            sessionStorage.setItem('redeemedGifts', JSON.stringify(redeemedData));
        }
        
        console.log('所有数据恢复成功');
    } catch (error) {
        console.error('恢复数据失败:', error);
    }
}

// 用户登出
async function signOut() {
    console.log('开始用户登出流程...');
    
    if (!supabase) {
        console.log('Supabase未初始化，无法执行登出操作');
        return;
    }
    
    try {
        console.log('调用Supabase登出接口...');
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('Supabase登出接口返回错误:', error);
            throw error;
        }
        
        console.log('登出成功，清空本地数据...');
        // 清空本地数据
        localStorage.clear();
        sessionStorage.clear();
        currentPoints = 0;
        totalPoints = 0;
        behaviors = [];
        gifts = [];
        redeemedGifts = [];
        
        console.log('更新UI显示...');
        // 更新显示
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        // 更新认证UI
        console.log('更新认证UI状态...');
        updateAuthUI(null);
        
        console.log('登出流程完成');
        showTemporaryMessage('👋 已退出登录，本地数据已清空', 'success');
        
        // 2秒后跳转到登录页面
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    } catch (error) {
        console.error('登出过程中发生错误:', error);
        showTemporaryMessage(`❌ 登出失败: ${escapeHtml(error.message)}`, 'error');
        throw error; // 重新抛出错误供上层处理
    }
}

// 更新认证UI状态
function updateAuthUI(user) {
    console.log('更新认证UI状态，用户状态:', user ? '已登录' : '未登录');
    
    // 检查当前页面
    const currentPage = window.location.pathname.split('/').pop();
    
    // 如果在登录页面，只处理已登录用户的情况
    if (currentPage === 'login.html') {
        // 不再自动跳转，让用户留在登录页面
        // if (user) {
        //     window.location.href = 'index.html';
        // }
        return;
    }
    
    // 在主页处理UI更新
    const loggedIn = document.getElementById('logged-in');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 用户已登录，更新UI显示用户信息
        console.log('显示用户登录信息，邮箱:', user.email);
        if (loggedIn) loggedIn.style.display = 'block';
        if (userEmail) userEmail.textContent = user.email;
    } else {
        // 用户未登录，隐藏登录信息
        console.log('隐藏用户登录信息');
        if (loggedIn) loggedIn.style.display = 'none';
    }
}

// 初始化 Supabase 认证状态监听
function initAuth() {
    console.log('开始初始化认证状态监听');
    
    if (!supabase) {
        console.log('Supabase未初始化，无法设置认证监听');
        return;
    }
    
    // console.log('设置认证状态变化监听器');
    // // 监听认证状态变化
    // supabase.auth.onAuthStateChange((event, session) => {
    //     console.log('认证状态发生变化:', event, session ? '有会话信息' : '无会话信息');
        
    //     if (event === 'SIGNED_IN') {
    //         console.log('用户登录事件，用户邮箱:', session.user.email, '用户ID:', session.user.id);
    //         updateAuthUI(session.user);
    //         updateCloudStatus(`已登录 (UID: ${session.user.id.substring(0, 8)}...)`);
    //         showTemporaryMessage('🔒 登录成功', 'success');
    //         console.log('开始从云端恢复数据...');
    //         restoreFromCloud(); // 登录后自动恢复数据
    //     } else if (event === 'SIGNED_OUT') {
    //         console.log('用户登出事件');
    //         updateAuthUI(null);
    //         updateCloudStatus('未登录');
    //         showTemporaryMessage('🔓 已退出登录', 'success');
    //         // 检查当前页面，避免在登录页面时重定向
    //         const currentPage = window.location.pathname.split('/').pop();
    //         console.log('当前页面:', currentPage);
    //         if (currentPage === 'index.html') {
    //             // 登出后重定向到登录页面（仅在主页时）
    //             console.log('在主页登出，重定向到登录页面');
    //             window.location.href = 'login.html';
    //         }
    //     } else {
    //         console.log('其他认证事件:', event);
    //     }
    // });
    
    console.log('检查当前会话状态');
    // 检查当前会话
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            console.error('获取会话失败:', error);
            return;
        }
        
        console.log('获取会话结果:', data.session ? '已登录' : '未登录');
        if (data.session) {
            console.log('当前会话用户:', data.session.user.email, '用户ID:', data.session.user.id);
            updateAuthUI(data.session.user);
        } else {
            console.log('当前无有效会话');
            updateAuthUI(null);
        }
    });
}



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

function updateBehaviorLog() {
    const logContainer = document.getElementById('behavior-log');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    // 添加统计信息
    const totalBehaviors = behaviors.length;
    const totalPointsGained = behaviors.filter(b => b.points > 0).reduce((sum, b) => sum + b.points, 0);
    const totalPointsLost = behaviors.filter(b => b.points < 0).reduce((sum, b) => sum + b.points, 0);
    
    if (behaviors.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-behavior-message';
        emptyMessage.innerHTML = '📋 暂无行为记录，开始记录孩子的好行为吧！';
        logContainer.appendChild(emptyMessage);
        return;
    }
    
    // 创建统计卡片
    const statsDiv = document.createElement('div');
    statsDiv.className = 'behavior-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-icon">📊</div>
            <div class="stat-text">总记录: ${totalBehaviors}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">✅</div>
            <div class="stat-text">获得积分: +${totalPointsGained}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">❌</div>
            <div class="stat-text">扣除积分: ${totalPointsLost}</div>
        </div>
    `;
    logContainer.appendChild(statsDiv);
    
    // 创建行为日志容器
    const behaviorsContainer = document.createElement('div');
    behaviorsContainer.className = 'behavior-log-container';
    
    behaviors.forEach((behavior, index) => {
        const behaviorDiv = document.createElement('div');
        behaviorDiv.className = 'behavior-item';
        behaviorDiv.style.animationDelay = `${index * 0.1}s`;
        
        // 根据积分正负设置不同的图标和样式
        const isPositive = behavior.points > 0;
        const icon = isPositive ? '✅' : '❌';
        const pointsClass = isPositive ? 'positive-points' : 'negative-points';
        
        behaviorDiv.innerHTML = `
            <div class="behavior-icon">${icon}</div>
            <div class="behavior-content">
                <div class="behavior-description">${escapeHtml(behavior.description)}</div>
                <div class="behavior-meta">
                    <span class="behavior-points ${pointsClass}">${behavior.points > 0 ? '+' : ''}${behavior.points}</span>
                    <span class="behavior-date">${formatBehaviorDate(behavior.timestamp)}</span>
                </div>
            </div>
        `;
        
        behaviorsContainer.appendChild(behaviorDiv);
    });
    
    logContainer.appendChild(behaviorsContainer);
    
    // 更新行为日志计数徽章
    const behaviorCount = document.getElementById('behavior-count');
    if (behaviorCount) {
        behaviorCount.textContent = totalBehaviors;
    }
}

function updateGiftList() {
    const giftList = document.getElementById('gift-list');
    giftList.innerHTML = '';
    gifts.forEach((gift, index) => {
        const li = document.createElement('li');
        li.className = 'gift-item';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = gift.name;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'item-details';
        detailsDiv.textContent = `需要 ${gift.points} 分`;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(detailsDiv);
        li.appendChild(contentDiv);
        
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'redeem-btn';
        redeemBtn.textContent = '🎁 兑换';
        redeemBtn.disabled = currentPoints < gift.points;
        redeemBtn.onclick = async () => {
            await redeemGift(index);
        };
        
        li.appendChild(redeemBtn);
        giftList.appendChild(li);
    });
}

function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    const redeemedCount = document.getElementById('redeemed-count');
    
    // 更新计数徽章
    if (redeemedCount) {
        redeemedCount.textContent = redeemedGifts.length;
    }
    
    // 清空现有内容
    while (redeemedList.firstChild) {
        redeemedList.removeChild(redeemedList.firstChild);
    }
    
    if (redeemedGifts.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-redeemed-message';
        emptyMessage.innerHTML = '🎁 还没有兑换记录，快去兑换喜欢的礼物吧！';
        redeemedList.appendChild(emptyMessage);
        return;
    }
    
    // 添加统计信息
    const totalRedeemedPoints = redeemedGifts.reduce((sum, item) => sum + item.points, 0);
    const statsDiv = document.createElement('div');
    statsDiv.className = 'redeemed-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-icon">🏆</span>
            <span class="stat-text">共兑换 ${redeemedGifts.length} 件礼物</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon">💎</span>
            <span class="stat-text">总计消耗 ${totalRedeemedPoints} 积分</span>
        </div>
    `;
    redeemedList.appendChild(statsDiv);
    
    // 创建礼物列表容器
    const giftsContainer = document.createElement('div');
    giftsContainer.className = 'redeemed-gifts-container';
    
    redeemedGifts.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'redeemed-item';
        itemElement.style.animationDelay = `${index * 0.1}s`;
        
        // 礼物图标
        const iconDiv = document.createElement('div');
        iconDiv.className = 'redeemed-icon';
        iconDiv.textContent = '🎁';
        
        // 内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'redeemed-content';
        
        // 礼物名称
        const nameDiv = document.createElement('div');
        nameDiv.className = 'redeemed-name';
        nameDiv.textContent = item.name;
        
        // 底部信息
        const infoDiv = document.createElement('div');
        infoDiv.className = 'redeemed-info';
        
        // 积分信息
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'redeemed-points';
        pointsSpan.innerHTML = `<span class="points-badge">-${item.points}</span> 积分`;
        
        // 时间信息
        const dateSpan = document.createElement('span');
        dateSpan.className = 'redeemed-date';
        dateSpan.textContent = formatRedeemDate(item.redeem_date);
        
        infoDiv.appendChild(pointsSpan);
        infoDiv.appendChild(dateSpan);
        
        contentDiv.appendChild(nameDiv);
        contentDiv.appendChild(infoDiv);
        
        itemElement.appendChild(iconDiv);
        itemElement.appendChild(contentDiv);
        
        giftsContainer.appendChild(itemElement);
    });
    
    redeemedList.appendChild(giftsContainer);
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
        
        // 超过一周显示具体日期
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

// 格式行为日志日期
function formatBehaviorDate(timestamp) {
    return formatRedeemDate(timestamp);
}


// 添加积分
async function addPoints() {
    const desc = document.getElementById('behavior-desc').value.trim();
    const change = parseInt(document.getElementById('points-change').value);
    
    if (!desc) {
        alert('请输入行为描述！');
        document.getElementById('behavior-desc').focus();
        return;
    }
    
    if (isNaN(change)) {
        alert('请输入有效的积分变化值！');
        document.getElementById('points-change').focus();
        return;
    }
    
    if (change === 0) {
        alert('积分变化不能为0！');
        document.getElementById('points-change').focus();
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    // 更新本地数据
    currentPoints += change;
    if (change > 0) {
        totalPoints += change;
    }
    behaviors.unshift({ description: desc, points: change, timestamp });
    
    // 保存到本地存储
    saveDataToLocalStorage();
    
    // 如果用户已登录，同时更新云端数据
    if (supabase) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!userError && user.user) {
            try {
                // 插入行为记录
                const { data, error } = await supabase
                    .from('behaviors')
                    .insert({
                        user_id: user.user.id,
                        description: desc,
                        points: change,
                        timestamp: timestamp
                    })
                    .select();
                
                if (error) throw error;
                
                // 更新profiles表中的积分
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: user.user.id,
                        current_points: currentPoints,
                        total_points: totalPoints,
                        updated_at: timestamp
                    });
                
                if (profileError) throw profileError;
                
            } catch (error) {
                console.error('同步到云端失败:', error);
                showTemporaryMessage('⚠️ 本地更新成功，但云端同步失败', 'warning');
            }
        }
    }
    
    // 更新显示
    updatePointsDisplay();
    updateBehaviorLog();
    updateGiftList();
    
    // 清空输入并给出反馈
    document.getElementById('behavior-desc').value = '';
    document.getElementById('points-change').value = '';
    document.getElementById('behavior-desc').focus();
    
    // 显示成功消息
    const message = change > 0 ? 
        `✅ 成功添加 ${change} 分！` : 
        `⚠️ 扣除 ${Math.abs(change)} 分`;
    showTemporaryMessage(message, 'success');
}

// 添加礼物
async function addGift() {
    const name = document.getElementById('gift-name').value.trim();
    const giftPoints = parseInt(document.getElementById('gift-points').value);
    
    if (!name) {
        alert('请输入礼物名称！');
        document.getElementById('gift-name').focus();
        return;
    }
    
    if (isNaN(giftPoints) || giftPoints <= 0) {
        alert('请输入有效的积分值（大于0）！');
        document.getElementById('gift-points').focus();
        return;
    }
    
    // 如果用户已登录，同时更新云端数据
    if (supabase) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!userError && user.user) {
            try {
                const { data, error } = await supabase
                    .from('gifts')
                    .insert({
                        user_id: user.user.id,
                        name: name,
                        points: giftPoints
                    })
                    .select();
                
                if (error) throw error;
                
                // 将包含id的完整礼物对象添加到数组中
                gifts.push(data[0]);
                updateGiftList();
            } catch (error) {
                console.error('同步礼物到云端失败:', error);
                // 如果云端同步失败，仍然在本地添加礼物
                gifts.push({ name, points: giftPoints });
                updateGiftList();
            }
        } else {
            // 用户未登录，只在本地添加
            gifts.push({ name, points: giftPoints });
            updateGiftList();
        }
    } else {
        // Supabase未初始化，只在本地添加
        gifts.push({ name, points: giftPoints });
        updateGiftList();
    }
    
    // 清空输入并给出反馈
    document.getElementById('gift-name').value = '';
    document.getElementById('gift-points').value = '';
    document.getElementById('gift-name').focus();
    
    showTemporaryMessage(`🎁 礼物 "${escapeHtml(name)}" 添加成功！`, 'success');
}

// 显示临时消息
function showTemporaryMessage(message, type) {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.position = 'fixed';
    messageEl.style.top = '20px';
    messageEl.style.left = '50%';
    messageEl.style.transform = 'translateX(-50%)';
    messageEl.style.padding = '15px 25px';
    messageEl.style.borderRadius = '8px';
    messageEl.style.color = 'white';
    messageEl.style.fontWeight = 'bold';
    messageEl.style.zIndex = '1000';
    messageEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    // 根据类型设置背景色
    if (type === 'success') {
        messageEl.style.background = 'linear-gradient(135deg, #4CAF50, #2E7D32)';
    } else {
        messageEl.style.background = 'linear-gradient(135deg, #f44336, #d32f2f)';
    }
    
    // 添加到页面
    document.body.appendChild(messageEl);
    
    // 3秒后移除
    setTimeout(() => {
        messageEl.style.transition = 'opacity 0.5s ease';
        messageEl.style.opacity = '0';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 500);
    }, 3000);
}

// 兑换礼物
async function redeemGift(giftId) {
    // 确保giftId是数字类型
    const id = typeof giftId === 'string' ? parseInt(giftId) : giftId;
    
    // 查找礼物，先按ID查找，如果找不到再按索引查找
    let gift = gifts.find(g => g.id === id);
    if (!gift) {
        gift = gifts[id]; // 按索引查找
    }
    
    if (!gift) {
        showTemporaryMessage('❌ 礼物不存在！', 'error');
        return;
    }

    if (currentPoints < gift.points) {
        showTemporaryMessage('❌ 积分不足！', 'error');
        return;
    }

    // 确认兑换
    const confirmed = confirm(`确定要兑换 "${escapeHtml(gift.name)}" 吗？这将消耗 ${gift.points} 分。`);
    if (!confirmed) return;

    // 先更新本地数据
    currentPoints -= gift.points;
    const localRedeemDate = new Date().toLocaleString('zh-CN');
    redeemedGifts.push({
        name: gift.name,
        points: gift.points,
        redeem_date: localRedeemDate
    });
    
    // 从本地礼物列表中移除
    const indexToRemove = gifts.findIndex(g => g.id === gift.id);
    if (indexToRemove !== -1) {
        gifts.splice(indexToRemove, 1);
    } else {
        const indexByPosition = gifts.indexOf(gift);
        if (indexByPosition !== -1) {
            gifts.splice(indexByPosition, 1);
        }
    }
    
    // 保存到本地存储
    saveDataToLocalStorage();
    
    // 更新UI
    updatePointsDisplay();
    updateGiftList();
    updateRedeemedList();
    
    // 如果用户已登录，同步到云端
    if (supabase) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!userError && user.user) {
            try {
                const now = new Date().toISOString();
                // 调用数据库函数执行兑换逻辑
                const { error: transactionError } = await supabase.rpc('execute_transaction', {
                    user_id_param: user.user.id,
                    gift_id_param: gift.id,
                    gift_name_param: gift.name,
                    gift_points_param: gift.points,
                    redeem_date_param: now,
                    current_points_param: currentPoints
                });

                if (transactionError) throw transactionError;
                showTemporaryMessage('🎉 兑换成功！', 'success');
            } catch (error) {
                console.error('同步到云端失败:', error);
                showTemporaryMessage('⚠️ 本地更新成功，但云端同步失败', 'warning');
            }
        } else {
            showTemporaryMessage('🎉 兑换成功！(本地模式)', 'success');
        }
    } else {
        showTemporaryMessage('🎉 兑换成功！(本地模式)', 'success');
    }
}



// 表单验证和用户体验增强
function validatePointsInput(inputElement) {
    inputElement.addEventListener('input', function() {
        if (this.value < -1000) this.value = -1000;
        if (this.value > 1000) this.value = 1000;
    });
}

function validateGiftPointsInput(inputElement) {
    inputElement.addEventListener('input', function() {
        if (this.value < 1) this.value = 1;
        if (this.value > 10000) this.value = 10000;
    });
}


// 更新认证UI状态
function updateAuthUI(user) {
    // 检查当前页面
    const currentPage = window.location.pathname.split('/').pop();
    
    // 如果在登录页面，只处理已登录用户的情况
    if (currentPage === 'login.html') {
        if (user) {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // 在主页处理UI更新
    const loggedIn = document.getElementById('logged-in');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 用户已登录，更新UI显示用户信息
        if (loggedIn) loggedIn.style.display = 'block';
        if (userEmail) userEmail.textContent = user.email;
    } else {
        // 用户未登录，显示登录状态
        if (loggedIn) loggedIn.style.display = 'none';
    }
}

// // 页面加载时初始化
// window.onload = async () => {
//     // 添加输入验证
//     const pointsChangeInput = document.getElementById('points-change');
//     const giftPointsInput = document.getElementById('gift-points');
    
//     if (pointsChangeInput) validatePointsInput(pointsChangeInput);
//     if (giftPointsInput) validateGiftPointsInput(giftPointsInput);
    
//     // 添加输入框焦点效果
//     const inputs = document.querySelectorAll('input');
//     inputs.forEach(input => {
//         input.addEventListener('focus', function() {
//             this.style.borderColor = '#4CAF50';
//             this.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.2)';
//         });
        
//         input.addEventListener('blur', function() {
//             this.style.borderColor = '#ddd';
//             this.style.boxShadow = 'none';
//         });
//     });
    
//     // 检查当前页面
//     const currentPage = window.location.pathname.split('/').pop();
    
//     // 只在主页初始化认证
//     if ((currentPage === 'index.html' || currentPage === '') && supabase) {
//         // 初始化认证
//         initAuth();
//     }
// };

// HTML 转义函数，防止 XSS 攻击
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"]/g, function(m) { return map[m]; });
}


// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('主页开始加载...');
    
    // 检查当前页面
    const currentPage = window.location.pathname.split('/').pop();
    console.log('当前页面:', currentPage);
    
    // 只在主页进行初始化
    if (currentPage === 'index.html' || currentPage === '') {
        console.log('在主页，开始初始化...');
        initializeApp();
    }
});

// 初始化应用
async function initializeApp() {
    try {
        console.log('开始初始化应用...');
        
        // 1. 检查用户登录状态
        const isLoggedIn = await checkUserLoggedIn();
        console.log('用户登录状态:', isLoggedIn ? '已登录' : '未登录');
        
        if (!isLoggedIn) {
            // 未登录，跳转到登录页面
            console.log('用户未登录，跳转到登录页面...');
            window.location.href = 'login.html';
            return;
        }
        
        // 2. 获取当前用户信息
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            console.error('获取用户信息失败:', error);
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        console.log('当前用户:', user.email);
        
        // 3. 从localStorage加载缓存数据（如果有）
        loadDataFromLocalStorage();
        
        // 4. 从云端加载最新数据
        await loadDataFromCloud();
        
        // 5. 更新UI
        updateAuthUI(user);
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        console.log('应用初始化完成');
        
    } catch (error) {
        console.error('应用初始化失败:', error);
        showTemporaryMessage('❌ 应用初始化失败，请刷新页面重试', 'error');
    }
}

// 从localStorage加载数据
function loadDataFromLocalStorage() {
    console.log('从localStorage加载数据...');
    
    // 加载用户信息
    const savedUserEmail = localStorage.getItem('userEmail');
    const savedUserId = localStorage.getItem('userId');
    
    if (savedUserEmail && savedUserId) {
        console.log('找到缓存的用户信息:', savedUserEmail);
    }
    
    // 加载业务数据
    const savedCurrentPoints = localStorage.getItem('currentPoints');
    const savedTotalPoints = localStorage.getItem('totalPoints');
    const savedBehaviors = localStorage.getItem('behaviors');
    const savedGifts = localStorage.getItem('gifts');
    const savedRedeemedGifts = localStorage.getItem('redeemedGifts');
    
    if (savedCurrentPoints) currentPoints = parseInt(savedCurrentPoints) || 0;
    if (savedTotalPoints) totalPoints = parseInt(savedTotalPoints) || 0;
    if (savedBehaviors) {
        try {
            behaviors = JSON.parse(savedBehaviors);
        } catch (e) {
            console.warn('解析行为数据失败:', e);
            behaviors = [];
        }
    }
    if (savedGifts) {
        try {
            gifts = JSON.parse(savedGifts);
        } catch (e) {
            console.warn('解析礼物数据失败:', e);
            gifts = [];
        }
    }
    if (savedRedeemedGifts) {
        try {
            redeemedGifts = JSON.parse(savedRedeemedGifts);
        } catch (e) {
            console.warn('解析已兑换礼物数据失败:', e);
            redeemedGifts = [];
        }
    }
    
    console.log('本地数据加载完成');
}

// 从云端加载数据
async function loadDataFromCloud() {
    if (!currentUser || !supabase) {
        console.log('无法加载云端数据：用户未登录或Supabase未初始化');
        return;
    }
    
    console.log('从云端加载数据...');
    
    try {
        // 从profiles表获取积分信息
        const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('current_points, total_points')
            .eq('id', currentUser.id)
            .single();
        
        if (profileError && profileError.code !== 'PGRST116') {
            throw profileError;
        }
        
        // 从behaviors表获取行为记录
        const { data: behaviorsData, error: behaviorsError } = await supabase
            .from('behaviors')
            .select('description, points, timestamp')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false });
        
        if (behaviorsError) throw behaviorsError;
        
        // 从gifts表获取礼物信息
        const { data: giftsData, error: giftsError } = await supabase
            .from('gifts')
            .select('id, name, points')
            .eq('user_id', currentUser.id)
            .order('id', { ascending: false });
        
        if (giftsError) throw giftsError;
        
        // 从redeemed_gifts表获取已兑换礼物信息
        const { data: redeemedData, error: redeemedError } = await supabase
            .from('redeemed_gifts')
            .select('id, gift_id, name, points, redeem_date')
            .eq('user_id', currentUser.id)
            .order('redeem_date', { ascending: false });
        
        if (redeemedError) throw redeemedError;
        
        // 更新本地数据
        if (profileData) {
            currentPoints = profileData.current_points || 0;
            totalPoints = profileData.total_points || 0;
        }
        
        if (behaviorsData) {
            behaviors = behaviorsData;
        }
        
        if (giftsData) {
            gifts = giftsData;
        }
        
        if (redeemedData) {
            redeemedGifts = redeemedData;
        }
        
        // 保存到localStorage
        saveDataToLocalStorage();
        
        console.log('云端数据加载完成');
        
    } catch (error) {
        console.error('从云端加载数据失败:', error);
        // 使用本地数据继续运行
        showTemporaryMessage('⚠️ 云端数据加载失败，使用本地数据', 'warning');
    }
}

// 保存数据到localStorage
function saveDataToLocalStorage() {
    localStorage.setItem('currentPoints', currentPoints.toString());
    localStorage.setItem('totalPoints', totalPoints.toString());
    localStorage.setItem('behaviors', JSON.stringify(behaviors));
    localStorage.setItem('gifts', JSON.stringify(gifts));
    localStorage.setItem('redeemedGifts', JSON.stringify(redeemedGifts));
}