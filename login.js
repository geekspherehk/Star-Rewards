// login.js - 登录页面专用JavaScript文件

// Supabase 配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM';

// 初始化Supabase客户端
let supabase;
function initializeSupabase() {
    try {
        if (typeof window.supabase === 'undefined') {
            console.warn('Supabase SDK 未加载');
            return null;
        }
        return window.supabase.createClient(supabaseUrl, supabaseKey);
    } catch (error) {
        console.error('Supabase 初始化失败:', error);
        return null;
    }
}
supabase = initializeSupabase();

// 检查用户是否已登录
async function checkUserLoggedIn() {
    if (!supabase) return false;
    
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        return !error && !!user;
    } catch (error) {
        console.error('检查登录状态失败:', error);
        return false;
    }
}

// 用户注册
async function signUp(email, password) {
    if (!supabase) throw new Error('Supabase 未初始化');
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    if (password.length < 6) throw new Error('密码长度至少为6位');
    
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
}

// 用户登录
async function signIn(email, password) {
    if (!supabase) throw new Error('Supabase 未初始化');
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    // 确保返回的数据结构一致
    if (!data) {
        throw new Error('登录成功但未返回数据');
    }
    
    return data;
}

// 恢复用户数据到sessionStorage
async function restoreBasicData() {
    if (!supabase) {
        console.log('Supabase未初始化，无法恢复数据');
        return;
    }
    
    try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            console.log('无法获取用户信息:', userError);
            return;
        }
        
        console.log('获取到用户信息，开始恢复数据...');
        
        // 获取用户数据
        const { data: profileData } = await supabase
            .from('profiles')
            .select('current_points, total_points')
            .eq('id', user.id)
            .single();
        
        const { data: behaviorsData } = await supabase
            .from('behaviors')
            .select('description, points, timestamp')
            .eq('user_id', user.id)
            .order('timestamp', { ascending: false })
            .limit(5);
        
        const { data: giftsData } = await supabase
            .from('gifts')
            .select('id, name, points')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
            .limit(5);
        
        const { data: redeemedData } = await supabase
            .from('redeemed_gifts')
            .select('id, gift_id, name, points, redeem_date')
            .eq('user_id', user.id)
            .order('redeem_date', { ascending: false })
            .limit(5);
        
        // 保存到sessionStorage
        if (profileData) {
            sessionStorage.setItem('currentPoints', profileData.current_points || 0);
            sessionStorage.setItem('totalPoints', profileData.total_points || 0);
            console.log('积分数据已保存到sessionStorage');
        }
        if (behaviorsData) {
            sessionStorage.setItem('behaviors', JSON.stringify(behaviorsData));
            console.log('行为数据已保存到sessionStorage');
        }
        if (giftsData) {
            sessionStorage.setItem('gifts', JSON.stringify(giftsData));
            console.log('礼物数据已保存到sessionStorage');
        }
        if (redeemedData) {
            sessionStorage.setItem('redeemedGifts', JSON.stringify(redeemedData));
            console.log('已兑换礼物数据已保存到sessionStorage');
        }
        
        console.log('数据恢复完成');
        
    } catch (error) {
        console.error('恢复数据失败:', error);
    }
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
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!email || !password) {
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    
    if (password.length < 6) {
        showTemporaryMessage('⚠️ 密码至少需要6位字符', 'error');
        return;
    }
    
    try {
        await signUp(email, password);
        showTemporaryMessage('✅ 注册成功！请检查邮箱确认', 'success');
        toggleAuthForm('login');
        // 清空表单
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    } catch (error) {
        showTemporaryMessage(`❌ 注册失败: ${escapeHtml(error.message)}`, 'error');
    }
}

// 处理用户登录
async function handleSignIn() {
    console.log('开始处理用户登录...');
    
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    console.log('登录信息 - 邮箱:', email ? '已提供' : '未提供');
    
    if (!email || !password) {
        console.log('登录信息不完整，邮箱或密码为空');
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    
    try {
        console.log('调用Supabase登录接口...');
        const { data, error } = await signIn(email, password);
        
        if (error) throw error;
        
        console.log('登录成功，返回数据:', data);
        
        // 登录成功后清空表单
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        
        // 显示成功消息
        showTemporaryMessage('✅ 登录成功！正在跳转...', 'success');
        
        // 保存用户信息到localStorage - 安全地获取用户数据
        let userData = null;
        if (data && data.user) {
            userData = data.user;
        } else if (data && data.data && data.data.user) {
            userData = data.data.user;
        }
        
        if (userData) {
            localStorage.setItem('user', JSON.stringify(userData));
            localStorage.setItem('userEmail', userData.email);
            localStorage.setItem('userId', userData.id);
            console.log('用户信息已保存:', userData.email);
        } else {
            console.warn('警告: 无法获取用户数据，但仍然继续登录流程');
        }
        
        // 恢复基本数据并跳转到主页
        console.log('开始恢复基本数据...');
        await restoreBasicData();
        console.log('数据恢复完成');
        
        // 立即重定向到主页
        console.log('准备重定向到主页...');
        window.location.href = 'index.html';
        
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showTemporaryMessage(`❌ 登录失败: ${escapeHtml(error.message)}`, 'error');
    }
}

// 显示临时消息
function showTemporaryMessage(message, type = 'info') {
    // 移除任何现有的消息
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // 创建新消息元素
    const messageElement = document.createElement('div');
    messageElement.className = `temporary-message ${type}`;
    messageElement.textContent = message;
    
    // 添加样式
    messageElement.style.position = 'fixed';
    messageElement.style.top = '20px';
    messageElement.style.left = '50%';
    messageElement.style.transform = 'translateX(-50%)';
    messageElement.style.padding = '10px 20px';
    messageElement.style.borderRadius = '5px';
    messageElement.style.color = 'white';
    messageElement.style.fontWeight = 'bold';
    messageElement.style.zIndex = '1000';
    messageElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    
    // 根据消息类型设置背景色
    switch(type) {
        case 'success':
            messageElement.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            messageElement.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            messageElement.style.backgroundColor = '#ff9800';
            break;
        default:
            messageElement.style.backgroundColor = '#2196F3';
    }
    
    // 添加到页面
    document.body.appendChild(messageElement);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 3000);
}

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

// 页面加载完成后初始化认证
document.addEventListener('DOMContentLoaded', function() {
    // 检查用户是否已经登录，如果已登录则跳转到主页
    checkUserLoggedIn().then(isLoggedIn => {
        if (isLoggedIn) {
            window.location.href = 'index.html';
        }
    }).catch(error => {
        console.error('检查登录状态失败:', error);
    });
});