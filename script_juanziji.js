// 卷自己主题脚本

// Supabase配置
const SUPABASE_URL = 'https://pjxpyppafaxepdzqgume.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM';

// 全局变量
let currentUser = null;
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];
let behaviorLogs = [];
let supabaseClient = null;

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
        return 'https://image.suning.cn/uimg/b2c/newcatentries/1234567890-1234567890_2_800x800.jpg';
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
async function logout() {
    if (confirm('确定要登出吗？')) {
        try {
            // 清除本地数据
            localStorage.removeItem('user');
            localStorage.removeItem('userRole');
            
            // 清除全局变量
            currentUser = null;
            currentPoints = 0;
            totalPoints = 0;
            behaviors = [];
            gifts = [];
            redeemedGifts = [];
            behaviorLogs = [];
            
            // 更新UI
            updateAuthUI(null);
            updatePointsDisplay();
            loadLists();
            
            // 跳转到登录页面
            window.location.href = 'login.html';
        } catch (error) {
            console.error('登出失败:', error);
            alert('登出过程中出现错误，请重试');
        }
    }
}

// 检查用户是否已登录
async function checkUserLoggedIn() {
    try {
        // 尝试从localStorage获取用户信息
        const userData = localStorage.getItem('supabase.user');
        if (userData) {
            currentUser = JSON.parse(userData);
            return true;
        }
        
        // 如果localStorage中没有用户信息，尝试从Supabase获取当前会话
        if (supabaseClient) {
            const { data: { user }, error } = await supabaseClient.auth.getUser();
            if (error || !user) {
                console.log('用户未登录或会话已过期');
                return false;
            }
            
            // 保存用户信息到localStorage
            currentUser = user;
            localStorage.setItem('supabase.user', JSON.stringify(user));
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('检查用户登录状态时出错:', error);
        return false;
    }
}

// 更新认证UI
function updateAuthUI(user) {
    const loggedInState = document.getElementById('logged-in-state');
    const notLoggedInState = document.getElementById('not-logged-in-state');
    const userEmailElement = document.getElementById('user-email');
    
    if (user && loggedInState && notLoggedInState) {
        // 已登录状态
        loggedInState.style.display = 'block';
        notLoggedInState.style.display = 'none';
        if (userEmailElement) {
            userEmailElement.textContent = user.email || '用户';
        }
    } else if (loggedInState && notLoggedInState) {
        // 未登录状态
        loggedInState.style.display = 'none';
        notLoggedInState.style.display = 'block';
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
async function initializeApp() {
    console.log('开始初始化应用...');
    
    // 初始化多语言
    initLanguage();
    
    // 检查用户登录状态
    const userData = localStorage.getItem('supabase.user');
    console.log('从localStorage获取用户数据:', userData);
    
    if (!userData) {
        console.log('未检测到登录用户，显示登录提示');
        showLoginForm();
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        console.log('当前用户:', currentUser);
        
        // 显示用户信息
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) {
            userEmailElement.textContent = currentUser.email || '用户';
        }
        
        // 显示已登录状态，隐藏未登录状态
        const loggedInState = document.getElementById('logged-in-state');
        const notLoggedInState = document.getElementById('not-logged-in-state');
        
        if (loggedInState) loggedInState.style.display = 'block';
        if (notLoggedInState) notLoggedInState.style.display = 'none';
        
        // 初始化Supabase客户端
        supabaseClient = initSupabase();
        
        // 加载用户数据
        await loadUserData();
    } catch (error) {
        console.error('解析用户数据失败:', error);
        showLoginForm();
    }
}

// 加载用户数据
async function loadUserData() {
    console.log('开始加载用户数据...');
    
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        // 加载数据
        await loadData();
        
        // 绑定事件监听器
        bindEventListeners();
        
        console.log('用户数据加载完成');
    } catch (error) {
        console.error('加载用户数据失败:', error);
        alert('加载用户数据时出现错误，请刷新页面重试');
    }
}

// 显示登录表单
function showLoginForm() {
    console.log('显示登录表单');
    const loggedInState = document.getElementById('logged-in-state');
    const notLoggedInState = document.getElementById('not-logged-in-state');
    
    if (loggedInState) loggedInState.style.display = 'none';
    if (notLoggedInState) notLoggedInState.style.display = 'block';
    
    // 确保登录按钮有正确的事件处理
    const loginButton = document.querySelector('#not-logged-in-state button');
    if (loginButton) {
        loginButton.onclick = function() {
            window.location.href = 'login.html';
        };
    }
}

// 绑定事件监听器
function bindEventListeners() {
    console.log('绑定事件监听器...');
    
    // Tab切换
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => switchTab(button.dataset.tab));
    });
    
    // 行为积分表单提交
    const behaviorForm = document.getElementById('behaviorForm');
    if (behaviorForm) {
        behaviorForm.addEventListener('submit', addBehaviorPoints);
    }
    
    // 礼物表单提交
    const giftForm = document.getElementById('giftForm');
    if (giftForm) {
        giftForm.addEventListener('submit', addGiftItem);
    }
    
    // 预设行为按钮
    const presetButtons = document.querySelectorAll('.preset-btn');
    presetButtons.forEach(button => {
        button.addEventListener('click', () => setPresetBehavior(button.dataset.points, button.textContent));
    });
    
    // 礼物链接输入检测
    const giftLinkInput = document.getElementById('giftLink');
    if (giftLinkInput) {
        giftLinkInput.addEventListener('input', detectEcommerceUrl);
    }
    
    // 登出按钮
    const logoutButton = document.getElementById('logoutBtn');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // 登录按钮
    const loginButton = document.getElementById('loginBtn');
    if (loginButton) {
        loginButton.onclick = function() {
            window.location.href = 'login.html';
        };
    }
}

// 切换Tab
function switchTab(tabId) {
    // 隐藏所有tab内容
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // 移除所有tab按钮的active类
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 显示选中的tab内容
    document.getElementById(tabId).classList.add('active');
    
    // 为选中的tab按钮添加active类
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// 设置预设行为
function setPresetBehavior(behavior, points) {
    document.getElementById('behavior-desc').value = behavior;
    document.getElementById('points-change').value = points;
}

// 添加行为积分
async function addBehaviorPoints() {
    const descInput = document.getElementById('behavior-desc');
    const pointsInput = document.getElementById('points-change');
    
    const description = descInput.value.trim();
    const pointsChange = parseInt(pointsInput.value) || 0;
    
    if (!description) {
        alert('请输入行为描述');
        return;
    }
    
    if (pointsChange === 0) {
        alert('请输入有效的积分变化值');
        return;
    }
    
    // 创建行为日志对象
    const behaviorLog = {
        id: Date.now(), // 简单的ID生成方式
        description: description,
        points: pointsChange,
        timestamp: new Date().toISOString()
    };
    
    // 更新本地数据
    behaviorLogs.unshift(behaviorLog);
    currentPoints += pointsChange;
    if (pointsChange > 0) {
        totalPoints += pointsChange;
    }
    
    // 保存到Supabase
    await saveBehaviorToSupabase(behaviorLog);
    
    // 更新显示
    updatePointsDisplay();
    addBehaviorToList(behaviorLog);
    updateCounts();
    
    // 清空表单
    descInput.value = '';
    pointsInput.value = '';
    
    // 显示成功消息
    showSuccessAnimation(pointsChange > 0 ? `+${pointsChange} 能量值已添加！` : `${pointsChange} 能量值已扣除`);
}

// 添加预设行为
async function addPresetBehavior(behavior, points) {
    // 创建行为日志对象
    const behaviorLog = {
        id: Date.now(),
        description: behavior,
        points: points,
        timestamp: new Date().toISOString()
    };
    
    // 更新本地数据
    behaviorLogs.unshift(behaviorLog);
    currentPoints += points;
    totalPoints += points;
    
    // 保存到Supabase
    await saveBehaviorToSupabase(behaviorLog);
    
    // 更新显示
    updatePointsDisplay();
    addBehaviorToList(behaviorLog);
    updateCounts();
    
    // 显示成功消息
    showSuccessAnimation(`+${points} 能量值已添加！`);
}

// 添加行为到列表
function addBehaviorToList(behaviorLog) {
    const logContainer = document.getElementById('behavior-log');
    
    // 如果元素不存在，直接返回
    if (!logContainer) {
        console.log('behavior-log元素不存在，跳过添加行为');
        return;
    }
    
    const logElement = document.createElement('div');
    logElement.className = 'behavior-log-item';
    logElement.style.cssText = `
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
    
    logElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 600; color: #00d4ff; font-size: 1.1rem;">⚡ ${behaviorLog.description}</div>
                <div style="color: #ffffff; font-size: 0.95rem; margin-top: 5px; opacity: 0.9; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">
                    ${new Date(behaviorLog.timestamp).toLocaleString('zh-CN')}
                </div>
            </div>
            <div style="color: ${behaviorLog.points > 0 ? '#4ade80' : '#ff6b6b'}; font-weight: bold; font-size: 1.3rem; text-shadow: 0 0 10px ${behaviorLog.points > 0 ? 'rgba(74, 222, 128, 0.5)' : 'rgba(255, 107, 107, 0.5)'};">
                ${behaviorLog.points}
            </div>
        </div>
    `;
    
    logContainer.insertBefore(logElement, logContainer.firstChild);
    
    // 限制显示数量
    const items = logContainer.querySelectorAll('.behavior-log-item');
    if (items.length > 50) {
        items[items.length - 1].remove();
    }
}

// 添加礼物到列表
function addGiftToList(gift) {
    const giftList = document.getElementById('gift-list');
    
    // 如果元素不存在，直接返回
    if (!giftList) {
        console.log('gift-list元素不存在，跳过添加礼物');
        return;
    }
    
    const giftElement = document.createElement('div');
    giftElement.className = 'gift-item';
    giftElement.setAttribute('data-gift-id', gift.id);
    giftElement.style.cssText = `
        background: linear-gradient(135deg, rgba(123, 31, 162, 0.1), rgba(255, 255, 255, 0.05));
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
        border-left: 4px solid #7b1fa2;
        transition: all 0.3s ease;
        animation: slideInLeft 0.5s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(123, 31, 162, 0.2);
    `;
    
    giftElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #ffffff; font-size: 1.1rem; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">🎯 ${gift.name}</div>
                ${gift.description ? `<div style="color: #e1f5fe; font-size: 0.95rem; margin: 8px 0; opacity: 0.9;">${gift.description}</div>` : ''}
                ${gift.link ? `<div style="margin: 8px 0;"><a href="${gift.link}" target="_blank" style="color: #bbdefb; text-decoration: none; font-size: 0.9rem; font-weight: 500;">🔗 查看详情</a></div>` : ''}
                ${gift.image ? `<div style="margin-top: 10px;"><img src="${gift.image}" alt="${gift.name}" style="max-width: 100px; max-height: 100px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);"></div>` : ''}
            </div>
            <div style="text-align: right; margin-left: 15px;">
                <div style="color: #ffcccb; font-weight: bold; font-size: 1.2rem; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${gift.points} 能量值</div>
                <button onclick="redeemGift('${gift.id}', '${gift.name}', ${gift.points})" 
                        style="margin-top: 10px; padding: 6px 12px; background: linear-gradient(135deg, #7b1fa2, #4a148c); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; box-shadow: 0 2px 5px rgba(0,0,0,0.2); transition: all 0.2s ease;"
                        onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"
                        ${currentPoints < gift.points ? 'disabled' : ''}>
                    兑换奖励
                </button>
            </div>
        </div>
    `;
    
    giftList.appendChild(giftElement);
}

// 渲染礼物列表
function renderGiftList() {
    const giftList = document.getElementById('gift-list');
    
    // 如果元素不存在，直接返回
    if (!giftList) {
        console.log('gift-list元素不存在，跳过渲染礼物列表');
        return;
    }
    
    // 清空当前列表
    giftList.innerHTML = '';
    
    // 重新添加所有礼物
    gifts.forEach(gift => {
        addGiftToList(gift);
    });
}

// 添加已兑换到列表
function addRedeemedToList(redeem) {
    const redeemedList = document.getElementById('redeemed-list');
    
    // 如果元素不存在，直接返回
    if (!redeemedList) {
        console.log('redeemed-list元素不存在，跳过添加已兑换');
        return;
    }
    
    // 调试信息
    console.log('addRedeemedToList: 处理兑换记录:', redeem);
    
    // 安全获取礼物名称
    const giftName = redeem.gift_name || redeem.name || '未知礼物';
    console.log('addRedeemedToList: 礼物名称:', giftName);
    
    // 安全获取时间戳
    const timestamp = redeem.created_at || redeem.timestamp || new Date().toISOString();
    console.log('addRedeemedToList: 时间戳:', timestamp);
    
    // 安全格式化日期
    let formattedDate = '未知时间';
    try {
        formattedDate = new Date(timestamp).toLocaleString('zh-CN');
        if (formattedDate === 'Invalid Date') {
            formattedDate = '未知时间';
        }
    } catch (error) {
        console.error('addRedeemedToList: 日期格式化失败:', error);
        formattedDate = '未知时间';
    }
    console.log('addRedeemedToList: 格式化日期:', formattedDate);
    
    const redeemedElement = document.createElement('div');
    redeemedElement.className = 'redeemed-item';
    redeemedElement.style.cssText = `
        background: linear-gradient(135deg, rgba(76, 175, 80, 0.1), rgba(255, 255, 255, 0.05));
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
        border-left: 4px solid #4caf50;
        transition: all 0.3s ease;
        animation: slideInLeft 0.5s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        border: 1px solid rgba(76, 175, 80, 0.2);
    `;
    
    redeemedElement.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <div style="font-weight: 700; color: #ffffff; font-size: 1.1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">🎁 ${giftName}</div>
                <div style="color: #ffffff; font-size: 0.95rem; margin-top: 5px; opacity: 0.95; text-shadow: 0 1px 2px rgba(0,0,0,0.4);">
                    兑换时间: ${formattedDate}
                </div>
            </div>
            <div style="color: #ffffff; font-weight: bold; font-size: 1rem; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">
                ✓ 已完成
            </div>
        </div>
    `;
    
    redeemedList.appendChild(redeemedElement);
}

// 显示成功动画
function showSuccessAnimation(message) {
    // 创建临时消息元素
    const messageEl = document.createElement('div');
    messageEl.textContent = message;
    messageEl.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(46, 204, 113, 0.95);
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        font-size: 1.2rem;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        backdrop-filter: blur(10px);
        animation: successFade 2s ease-out forwards;
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes successFade {
            0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            20% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            80% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(messageEl);
    
    // 2秒后移除元素
    setTimeout(() => {
        messageEl.remove();
        style.remove();
    }, 2000);
}

// 更新积分显示
function updatePointsDisplay() {
    const currentPointsElement = document.getElementById('current-points');
    const totalPointsElement = document.getElementById('total-points');
    
    if (currentPointsElement) currentPointsElement.textContent = currentPoints;
    if (totalPointsElement) totalPointsElement.textContent = totalPoints;
}

// 添加礼物
async function addGift() {
    const nameInput = document.getElementById('gift-name');
    const pointsInput = document.getElementById('gift-points');
    const descriptionInput = document.getElementById('gift-description');
    const linkInput = document.getElementById('gift-link');
    const imageInput = document.getElementById('gift-image');
    
    const name = nameInput.value.trim();
    const points = parseInt(pointsInput.value) || 0;
    const description = descriptionInput.value.trim();
    const link = linkInput.value.trim();
    const image = imageInput.value.trim();
    
    if (!name) {
        alert('请输入礼物名称');
        return;
    }
    
    if (points <= 0) {
        alert('请输入有效的积分值');
        return;
    }
    
    // 创建礼物对象
    const gift = {
        id: Date.now(),
        name: name,
        points: points,
        description: description,
        link: link,
        image: image,
        timestamp: new Date().toISOString()
    };
    
    // 更新本地数据
    gifts.unshift(gift);
    
    // 保存到Supabase
    await saveGiftToSupabase(gift);
    
    // 更新显示
    addGiftToList(gift);
    updateCounts();
    
    // 清空表单
    nameInput.value = '';
    pointsInput.value = '';
    descriptionInput.value = '';
    linkInput.value = '';
    imageInput.value = '';
    document.getElementById('image-preview').innerHTML = '';
    
    // 显示成功消息
    showSuccessAnimation('目标奖励添加成功！🎯');
}

// 兑换礼物
async function redeemGift(giftId, giftName, pointsRequired) {
    if (currentPoints < pointsRequired) {
        alert('能量值不足，无法兑换该奖励！');
        return;
    }
    
    if (!confirm(`确定要兑换"${giftName}"吗？这将消耗${pointsRequired}点能量值。`)) {
        return;
    }
    
    // 创建兑换记录对象
    const redeemLog = {
        id: Date.now(),
        giftId: giftId,
        giftName: giftName,
        points: pointsRequired,
        timestamp: new Date().toISOString()
    };
    
    try {
        const timestamp = new Date().toISOString();
        
        // 使用存储过程确保数据一致性
        const { data, error } = await supabaseClient.rpc('redeem_gift_transaction', {
            user_id_param: currentUser.id,
            gift_id_param: giftId,
            gift_name_param: giftName,
            gift_points_param: pointsRequired,
            gift_description_param: '', // 卷自己版可能没有描述字段
            redeem_date_param: timestamp,
            current_points_param: currentPoints - pointsRequired
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
        redeemedGifts.unshift(redeemLog);
        currentPoints -= pointsRequired;
        
        // 从礼物列表中移除已兑换的礼物
        const indexToRemove = gifts.findIndex(g => g.id === giftId);
        if (indexToRemove !== -1) {
            gifts.splice(indexToRemove, 1);
        }
        
        // 更新显示
        updatePointsDisplay();
        addRedeemedToList(redeemLog);
        updateCounts();
        
        // 重新渲染礼物列表
        renderGiftList();
        
        // 更新礼物列表中的按钮状态
        document.querySelectorAll('.gift-item button').forEach(button => {
            const giftPoints = parseInt(button.parentElement.querySelector('div').textContent);
            if (currentPoints < giftPoints) {
                button.disabled = true;
            }
        });
        
        // 显示成功消息
        showSuccessAnimation('兑换成功！奖励已发放 🎁');
    } catch (error) {
        console.error('兑换失败:', error);
        alert('兑换失败，请稍后重试');
    }
}

// 检测礼物链接
function detectGiftLink(link) {
    if (detectEcommerceUrl(link)) {
        const imageUrl = extractProductImage(link);
        document.getElementById('gift-image').value = imageUrl;
        document.getElementById('image-preview').innerHTML = `<img src="${imageUrl}" alt="预览" style="max-width: 100px; max-height: 100px; margin-top: 10px;">`;
    }
}

// 加载数据
async function loadData() {
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        // 从Supabase加载行为数据
        const { data: behaviorData, error: behaviorError } = await supabaseClient
            .from('behaviors')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false })
            .limit(20);
        
        if (behaviorError) {
            console.error('加载行为数据失败:', behaviorError);
        } else {
            behaviorLogs = behaviorData || [];
        }
        
        // 从Supabase加载礼物数据
        const { data: giftData, error: giftError } = await supabaseClient
            .from('gifts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });
        
        if (giftError) {
            console.error('加载礼物数据失败:', giftError);
        } else {
            gifts = giftData || [];
        }
        
        // 从Supabase加载兑换记录数据
        const { data: redeemData, error: redeemError } = await supabaseClient
            .from('redeemed_gifts')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .limit(20);
        
        if (redeemError) {
            console.error('加载兑换记录数据失败:', redeemError);
        } else {
            redeemedGifts = redeemData || [];
            console.log('加载兑换记录数据成功:', redeemedGifts);
            console.log('第一条兑换记录示例:', redeemedGifts[0]);
        }
        
        // 计算积分
        currentPoints = behaviorLogs.reduce((sum, log) => sum + log.points, 0);
        totalPoints = behaviorLogs.filter(log => log.points > 0).reduce((sum, log) => sum + log.points, 0);
        
        // 更新显示
        updatePointsDisplay();
        loadLists();
    } catch (error) {
        console.error('加载数据时出错:', error);
        alert('加载数据时出现错误，请刷新页面重试');
    }
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

// 保存行为到Supabase
async function saveBehaviorToSupabase(behaviorLog) {
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('behaviors')
            .insert([
                {
                    user_id: currentUser.id,
                    description: behaviorLog.description,
                    points: behaviorLog.points,
                    timestamp: behaviorLog.timestamp
                }
            ]);
        
        if (error) {
            console.error('保存行为到Supabase失败:', error);
        } else {
            console.log('行为已保存到Supabase:', data);
        }
    } catch (error) {
        console.error('保存行为时出错:', error);
    }
}

// 保存礼物到Supabase
async function saveGiftToSupabase(gift) {
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('gifts')
            .insert([
                {
                    user_id: currentUser.id,
                    name: gift.name,
                    points: gift.points,
                    description: gift.description,
                    link: gift.link,
                    image: gift.image,
                    timestamp: gift.timestamp
                }
            ]);
        
        if (error) {
            console.error('保存礼物到Supabase失败:', error);
        } else {
            console.log('礼物已保存到Supabase:', data);
        }
    } catch (error) {
        console.error('保存礼物时出错:', error);
    }
}

// 保存兑换记录到Supabase
async function saveRedeemToSupabase(redeemLog) {
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('redeemed_gifts')
            .insert([
                {
                    user_id: currentUser.id,
                    gift_id: redeemLog.giftId,
                    gift_name: redeemLog.giftName,
                    points: redeemLog.points,
                    timestamp: redeemLog.timestamp
                }
            ]);
        
        if (error) {
            console.error('保存兑换记录到Supabase失败:', error);
            throw error;
        } else {
            console.log('兑换记录已保存到Supabase:', data);
        }
    } catch (error) {
        console.error('保存兑换记录时出错:', error);
        throw error;
    }
}

// 更新用户积分到数据库
async function updateUserPoints(newPoints) {
    if (!supabaseClient || !currentUser) {
        console.log('Supabase客户端未初始化或用户未登录');
        return;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .update({
                current_points: newPoints,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        if (error) {
            console.error('更新用户积分到Supabase失败:', error);
            throw error;
        } else {
            console.log('用户积分已更新到Supabase:', data);
        }
    } catch (error) {
        console.error('更新用户积分时出错:', error);
        throw error;
    }
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

// 登出功能
async function signOut() {
    await logout();
}