// Supabase 配置 - 替换为你的实际配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co'; // 例如: https://your-project-id.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM'; // 例如: eyJhb...
let supabase;

try {
    if (typeof window.supabase === 'undefined') {
        throw new Error('Supabase SDK 未加载');
    }
    supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
    updateCloudStatus('Supabase 初始化成功');
} catch (error) {
    console.error('Supabase 初始化失败:', error);
    updateCloudStatus('云端连接失败，请检查网络或配置');
}

// 本地数据变量
let currentPoints = parseInt(localStorage.getItem('currentPoints')) || 0;
let totalPoints = parseInt(localStorage.getItem('totalPoints')) || 0;
let behaviors = JSON.parse(localStorage.getItem('behaviors')) || [];
let gifts = JSON.parse(localStorage.getItem('gifts')) || [];
let redeemedGifts = JSON.parse(localStorage.getItem('redeemedGifts')) || [];

// 用户注册
async function signUp(email, password) {
    if (!supabase) {
        updateCloudStatus('Supabase 未初始化，无法注册');
        throw new Error('Supabase 未初始化');
    }
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('注册失败:', error);
        throw error;
    }
}

// 用户登录
async function signIn(email, password) {
    if (!supabase) {
        updateCloudStatus('Supabase 未初始化，无法登录');
        throw new Error('Supabase 未初始化');
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('登录失败:', error);
        throw error;
    }
}

// 用户登出
async function signOut() {
    if (!supabase) {
        updateCloudStatus('Supabase 未初始化，无法登出');
        return;
    }
    
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) throw error;
        
        // 清空本地数据
        localStorage.clear();
        currentPoints = 0;
        totalPoints = 0;
        behaviors = [];
        gifts = [];
        redeemedGifts = [];
        
        // 更新显示
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        // 更新认证UI
        updateAuthUI(null);
        
        showTemporaryMessage('👋 已退出登录，本地数据已清空', 'success');
    } catch (error) {
        console.error('登出失败:', error);
        showTemporaryMessage(`❌ 登出失败: ${error.message}`, 'error');
    }
}

// 初始化 Supabase 认证状态监听
function initAuth() {
    if (!supabase) {
        updateCloudStatus('Supabase 未初始化');
        return;
    }
    
    // 监听认证状态变化
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('认证状态变化:', event, session);
        
        if (event === 'SIGNED_IN') {
            updateAuthUI(session.user);
            updateCloudStatus(`已登录 (UID: ${session.user.id.substring(0, 8)}...)`);
            showTemporaryMessage('🔒 登录成功', 'success');
            restoreFromCloud(); // 登录后自动恢复数据
        } else if (event === 'SIGNED_OUT') {
            updateAuthUI(null);
            updateCloudStatus('未登录');
            showTemporaryMessage('🔓 已退出登录', 'success');
        }
    });
    
    // 检查当前会话
    supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
            console.error('获取会话失败:', error);
            return;
        }
        
        if (data.session) {
            updateAuthUI(data.session.user);
            updateCloudStatus(`已登录 (UID: ${data.session.user.id.substring(0, 8)}...)`);
        } else {
            updateAuthUI(null);
            updateCloudStatus('未登录');
        }
    });
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
        li.className = 'behavior-item';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = behavior.desc;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'item-details';
        detailsDiv.textContent = `${behavior.change > 0 ? '+' : ''}${behavior.change} 分`;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(detailsDiv);
        li.appendChild(contentDiv);
        logList.appendChild(li);
    });
    saveToLocalStorage('behaviors', behaviors);
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
        li.className = 'redeemed-item';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = gift.name;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'item-details';
        detailsDiv.textContent = `兑换时间: ${gift.redeemDate}`;
        
        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(detailsDiv);
        li.appendChild(contentDiv);
        redeemedList.appendChild(li);
    });
    saveToLocalStorage('redeemedGifts', redeemedGifts);
}

// 备份到云端
async function backupToCloud() {
    if (!supabase) {
        alert('Supabase 未初始化，无法备份！');
        return;
    }
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
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
                { uid: user.user.id, data },
                { onConflict: ['uid'] }
            );
        if (error) throw error;
        showTemporaryMessage('📤 数据备份成功！', 'success');
        updateCloudStatus('备份成功');
    } catch (error) {
        console.error('备份失败:', error);
        showTemporaryMessage(`❌ 备份失败: ${error.message}`, 'error');
        updateCloudStatus('备份失败');
        throw error; // 重新抛出错误供上层处理
    }
}

// 从云端恢复
async function restoreFromCloud() {
    if (!supabase) {
        showTemporaryMessage('❌ Supabase 未初始化，无法恢复！', 'error');
        return;
    }
    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
        showTemporaryMessage('⏳ 请等待登录...', 'error');
        return;
    }
    try {
        const { data, error } = await supabase
            .from('user_data')
            .select('data')
            .eq('uid', user.user.id)
            .single();
        
        // 特别处理 PGRST116 错误（无数据）
        if (error && error.code === 'PGRST116') {
            showTemporaryMessage('☁️ 云端无数据，使用本地数据', 'success');
            updateCloudStatus('无云端数据');
            return;
        }
        
        if (error) throw error;
        if (data) {
            // 解析数据，处理可能的字符串格式
            let parsedData = data.data;
            if (typeof data.data === 'string') {
                try {
                    parsedData = JSON.parse(data.data);
                } catch (parseError) {
                    console.error('JSON解析失败:', parseError);
                    throw new Error('云端数据格式不正确');
                }
            }
            
            // 验证数据结构
            if (typeof parsedData !== 'object' || parsedData === null) {
                throw new Error('云端数据格式不正确');
            }
            
            // 确保数组字段存在且为数组类型
            if (!Array.isArray(parsedData.behaviors)) parsedData.behaviors = [];
            if (!Array.isArray(parsedData.gifts)) parsedData.gifts = [];
            if (!Array.isArray(parsedData.redeemedGifts)) parsedData.redeemedGifts = [];
            
            // 恢复数据
            currentPoints = parsedData.currentPoints || 0;
            totalPoints = parsedData.totalPoints || 0;
            behaviors = parsedData.behaviors;
            gifts = parsedData.gifts;
            redeemedGifts = parsedData.redeemedGifts;
            
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
            
            showTemporaryMessage('📥 数据恢复成功！', 'success');
            updateCloudStatus('恢复成功');
        } else {
            showTemporaryMessage('☁️ 云端无数据！', 'error');
        }
    } catch (error) {
        console.error('恢复失败:', error);
        showTemporaryMessage(`🔄 恢复失败: ${error.message}`, 'error');
        updateCloudStatus('恢复失败');
    }
}

// 添加积分
function addPoints() {
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
    
    currentPoints += change;
    if (change > 0) {
        totalPoints += change;
    }
    behaviors.push({ desc, change, timestamp: new Date().toISOString() });
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
function addGift() {
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
    
    gifts.push({ name, points: giftPoints });
    updateGiftList();
    
    // 清空输入并给出反馈
    document.getElementById('gift-name').value = '';
    document.getElementById('gift-points').value = '';
    document.getElementById('gift-name').focus();
    
    showTemporaryMessage(`🎁 礼物 "${name}" 添加成功！`, 'success');
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
function redeemGift(index) {
    const gift = gifts[index];
    if (currentPoints >= gift.points) {
        // 确认兑换
        if (!confirm(`确定要兑换 "${gift.name}" 吗？这将扣除 ${gift.points} 分`)) {
            return;
        }
        
        currentPoints -= gift.points;
        const redeemDate = new Date().toLocaleString('zh-CN');
        redeemedGifts.push({ name: gift.name, points: gift.points, redeemDate });
        gifts.splice(index, 1);
        
        updatePointsDisplay();
        updateGiftList();
        updateRedeemedList();
        
        // 显示成功消息
        showTemporaryMessage(`🎉 恭喜！成功兑换 "${gift.name}"`, 'success');
    } else {
        showTemporaryMessage(`😢 积分不足，无法兑换 "${gift.name}"`, 'error');
    }
}

function clearData() {
    if (confirm('⚠️ 确定要清空所有数据吗？此操作不可恢复！\n\n（本地数据将被清空，云端数据需手动备份）')) {
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
        
        // 显示成功消息
        showTemporaryMessage('🗑️ 所有数据已清空', 'success');
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

// 切换认证表单（登录/注册）
function toggleAuthForm(formType) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    if (formType === 'register') {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    } else {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
    }
}

// 处理用户注册
async function handleSignUp() {
    // 添加调试日志
    console.log('注册按钮被点击');
    
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    console.log('输入的邮箱:', email);
    console.log('输入的密码长度:', password ? password.length : 0);
    
    if (!email || !password) {
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    
    if (password.length < 6) {
        showTemporaryMessage('⚠️ 密码至少需要6位字符', 'error');
        return;
    }
    
    try {
        console.log('开始注册过程...');
        await signUp(email, password);
        showTemporaryMessage('✅ 注册成功！请检查邮箱确认', 'success');
        // 切换到登录表单
        toggleAuthForm('login');
        // 清空注册表单
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    } catch (error) {
        console.error('注册过程中发生错误:', error);
        showTemporaryMessage(`❌ 注册失败: ${error.message}`, 'error');
    }
}

// 处理用户登录
async function handleSignIn() {
    // 添加调试日志
    console.log('登录按钮被点击');
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('输入的邮箱:', email);
    console.log('输入的密码长度:', password ? password.length : 0);
    
    if (!email || !password) {
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    
    try {
        console.log('开始登录过程...');
        await signIn(email, password);
        // 登录成功后清空表单
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showTemporaryMessage(`❌ 登录失败: ${error.message}`, 'error');
    }
}

// 更新认证UI状态
function updateAuthUI(user) {
    const authForms = document.getElementById('auth-forms');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loggedIn = document.getElementById('logged-in');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 用户已登录
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        loggedIn.style.display = 'block';
        userEmail.textContent = user.email;
    } else {
        // 用户未登录
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        loggedIn.style.display = 'none';
        userEmail.textContent = '';
    }
}

// 页面加载时初始化
window.onload = async () => {
    // 添加输入验证
    const pointsChangeInput = document.getElementById('points-change');
    const giftPointsInput = document.getElementById('gift-points');
    
    if (pointsChangeInput) validatePointsInput(pointsChangeInput);
    if (giftPointsInput) validateGiftPointsInput(giftPointsInput);
    
    // 添加输入框焦点效果
    const inputs = document.querySelectorAll('input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.style.borderColor = '#4CAF50';
            this.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.2)';
        });
        
        input.addEventListener('blur', function() {
            this.style.borderColor = '#ddd';
            this.style.boxShadow = 'none';
        });
    });
    
    if (!supabase) {
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        return;
    }
    
    // 初始化认证
    initAuth();
};
