// login.js - 登录页面专用JavaScript文件

// Supabase 配置 - 替换为你的实际配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM';
let supabase;

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
        console.log('正在检查用户登录状态...');
        const { data: { user }, error } = await supabase.auth.getUser();
        console.log('用户信息:', user);
        console.log('错误信息:', error);
        
        if (error) {
            console.error('获取用户信息失败:', error);
            return false;
        }
        
        const isLoggedIn = !!user;
        console.log('用户是否已登录:', isLoggedIn);
        return isLoggedIn;
    } catch (error) {
        console.error('检查用户登录状态时出错:', error);
        return false;
    }
}

// 用户注册
async function signUp(email, password) {
    if (!supabase) {
        throw new Error('Supabase 未初始化');
    }
    
    // 验证输入
    if (!email || !password) {
        throw new Error('邮箱和密码不能为空');
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('请输入有效的邮箱地址');
    }
    
    if (password.length < 6) {
        throw new Error('密码长度至少为6位');
    }
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('注册过程中发生错误:', error);
        throw error;
    }
}

// 用户登录
async function signIn(email, password) {
    if (!supabase) {
        throw new Error('Supabase 未初始化');
    }
    
    // 验证输入
    if (!email || !password) {
        throw new Error('邮箱和密码不能为空');
    }
    
    // 邮箱格式验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error('请输入有效的邮箱地址');
    }
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) throw error;
        
        return data;
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        throw error;
    }
}

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
    console.log('开始处理用户注册...');
    
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    console.log('注册信息 - 邮箱:', email ? '已提供' : '未提供', '密码长度:', password ? password.length : 0);
    
    if (!email || !password) {
        console.log('注册信息不完整，邮箱或密码为空');
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    
    if (password.length < 6) {
        console.log('密码长度不足6位');
        showTemporaryMessage('⚠️ 密码至少需要6位字符', 'error');
        return;
    }
    
    try {
        console.log('调用Supabase注册接口...');
        await signUp(email, password);
        console.log('注册成功');
        showTemporaryMessage('✅ 注册成功！请检查邮箱确认', 'success');
        // 切换到登录表单
        toggleAuthForm('login');
        // 清空注册表单
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        console.log('已切换到登录表单并清空注册表单');
    } catch (error) {
        console.error('注册过程中发生错误:', error);
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
        await signIn(email, password);
        console.log('登录成功');
        
        // 登录成功后清空表单
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        // 显示成功消息
        showTemporaryMessage('✅ 登录成功！', 'success');
        
        // 恢复基本数据
        console.log('开始恢复基本数据...');
        await restoreBasicData();
        console.log('数据恢复完成');
        
        // 延迟1秒后重定向到主页
        console.log('准备重定向到主页...');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
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
                // setTimeout(() => {
                //     window.location.href = 'index.html';
                // }, 1500);
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