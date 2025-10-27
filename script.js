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
    
    if (behaviors.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '暂无行为记录';
        logContainer.appendChild(emptyMessage);
        return;
    }
    
    behaviors.forEach(behavior => {
        const div = document.createElement('div');
        div.className = 'behavior-item';
        
        const descSpan = document.createElement('span');
        descSpan.textContent = escapeHtml(behavior.description);
        
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'points';
        pointsSpan.textContent = `${behavior.points > 0 ? '+' : ''}${behavior.points}`;
        
        const dateSmall = document.createElement('small');
        dateSmall.textContent = new Date(behavior.timestamp).toLocaleString();
        
        div.appendChild(descSpan);
        div.appendChild(pointsSpan);
        div.appendChild(dateSmall);
        logContainer.appendChild(div);
    });
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
    
    // 清空现有内容
    while (redeemedList.firstChild) {
        redeemedList.removeChild(redeemedList.firstChild);
    }
    
    if (redeemedGifts.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.className = 'empty-message';
        emptyMessage.textContent = '暂无兑换记录';
        redeemedList.appendChild(emptyMessage);
        return;
    }
    
    redeemedGifts.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'redeemed-item';
        
        const nameSpan = document.createElement('span');
        nameSpan.className = 'redeemed-name';
        nameSpan.textContent = item.name;
        
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'redeemed-points';
        pointsSpan.textContent = `-${item.points} 分`;
        
        const dateSpan = document.createElement('span');
        dateSpan.className = 'redeemed-date';
        dateSpan.textContent = item.redeem_date || '未知时间';
        
        itemElement.appendChild(nameSpan);
        itemElement.appendChild(pointsSpan);
        itemElement.appendChild(dateSpan);
        
        redeemedList.appendChild(itemElement);
    });
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
    
    // 如果用户已登录，直接更新云端数据
    if (supabase) {
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (!userError && user.user) {
            try {
                // 先更新云端积分
                const newCurrentPoints = currentPoints + change;
                const newTotalPoints = change > 0 ? totalPoints + change : totalPoints;
                
                const { error } = await supabase
                    .from('profiles')
                    .upsert(
                        { 
                            id: user.user.id, 
                            current_points: newCurrentPoints,
                            total_points: newTotalPoints,
                            updated_at: new Date().toISOString()
                        },
                        { onConflict: ['id'] }
                    );
                
                if (error) throw error;
                
                // 更新本地状态
                currentPoints = newCurrentPoints;
                totalPoints = newTotalPoints;
                behaviors.push({ desc, change, timestamp: new Date().toISOString() });
                
                // 更新UI
                updatePointsDisplay();
                updateBehaviorLog();
                updateGiftList();
                
            } catch (error) {
                console.error('同步积分到云端失败:', error);
                return; // 如果云端更新失败，则不进行本地操作
            }
        } else {
            // 用户未登录，只在本地操作
            currentPoints += change;
            if (change > 0) {
                totalPoints += change;
            }
            behaviors.push({ desc, change, timestamp: new Date().toISOString() });
            updatePointsDisplay();
            updateBehaviorLog();
            updateGiftList();
        }
    } else {
        // Supabase未初始化，只在本地操作
        currentPoints += change;
        if (change > 0) {
            totalPoints += change;
        }
        behaviors.push({ desc, change, timestamp: new Date().toISOString() });
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
    }
    
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

    try {
        // 如果用户已登录，通过云端完成兑换操作
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
                        current_points_param: currentPoints - gift.points
                    });

                    if (transactionError) throw transactionError;
                    
                    // 成功后更新本地状态
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
                        // 如果按ID找不到，按索引查找
                        const indexByPosition = gifts.indexOf(gift);
                        if (indexByPosition !== -1) {
                            gifts.splice(indexByPosition, 1);
                        }
                    }
                    
                    // 更新UI
                    updatePointsDisplay();
                    updateGiftList();
                    updateRedeemedList();
                    
                    showTemporaryMessage('🎉 兑换成功！', 'success');
                } catch (error) {
                    console.error('兑换失败:', error);
                    showTemporaryMessage(`❌ 兑换失败，请重试: ${escapeHtml(error.message)}`, 'error');
                    return;
                }
            } else {
                // 用户未登录，只在本地操作
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
                    // 如果按ID找不到，按索引查找
                    const indexByPosition = gifts.indexOf(gift);
                    if (indexByPosition !== -1) {
                        gifts.splice(indexByPosition, 1);
                    }
                }
                
                // 更新UI
                updatePointsDisplay();
                updateGiftList();
                updateRedeemedList();
                
                showTemporaryMessage('🎉 兑换成功！(本地模式)', 'success');
            }
        } else {
            // Supabase未初始化，只在本地操作
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
                // 如果按ID找不到，按索引查找
                const indexByPosition = gifts.indexOf(gift);
                if (indexByPosition !== -1) {
                    gifts.splice(indexByPosition, 1);
                }
            }
            
            // 更新UI
            updatePointsDisplay();
            updateGiftList();
            updateRedeemedList();
            
            showTemporaryMessage('🎉 兑换成功！(本地模式)', 'success');
        }
    } catch (error) {
        console.error('兑换过程中出现错误:', error);
        showTemporaryMessage(`❌ 兑换失败: ${escapeHtml(error.message)}`, 'error');
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


document.addEventListener('DOMContentLoaded', function() {
    console.log('登录页面开始加载...');
    
    // 检查用户是否已经登录
    console.log('开始检查用户登录状态...');
    checkUserLoggedIn().then(isLoggedIn => {
        console.log('登录状态检查完成，结果:', isLoggedIn ? '已登录' : '未登录');
        if (isLoggedIn) {
            // 如果已登录，重定向到主页
            const currentPath = window.location.pathname.split('/').pop();
            console.log('当前页面路径:', currentPath);
            if (currentPath === 'login.html') {
                console.log('用户已登录，正在重定向到主页...');
                showTemporaryMessage('🔒 已登录，正在跳转到主页...', 'success');
            }
        } else {
            console.log('用户未登录，保持在登录页面');
            showTemporaryMessage('🔑 请登录或注册', 'info');
        }
    }).catch(error => {
        console.error('检查登录状态时出错:', error);
        showTemporaryMessage('❌ 检查登录状态失败', 'error');
    });
});