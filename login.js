// login.js - 登录页面专用JavaScript文件

// 使用 Hostinger MySQL API Client
let supabase = null;

function initializeSupabase() {
    console.log('Login.js: 使用 Hostinger MySQL API');
    return null;
}

if (window._supabaseClient) {
    supabase = window._supabaseClient;
} else {
    supabase = initializeSupabase();
}

function isLoggedIn() {
    return !!api.getToken();
}

async function checkUserLoggedIn() {
    try {
        console.log('Login.js: 开始检查用户登录状态');
        
        const token = api.getToken();
        if (!token) {
            return { user: null, error: null };
        }
        
        const profile = await api.getProfile();
        return { user: { id: profile.user_id, email: localStorage.getItem('user_email') }, error: null };
    } catch (exception) {
        return { user: null, error: exception };
    }
}

// 智能URL构建器 - 支持多种部署环境
function buildConfirmEmailUrl() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const search = window.location.search;
    
    console.log('URL构建器 - 原始信息:', {
        origin: origin,
        pathname: pathname,
        search: search,
        fullUrl: window.location.href
    });
    
    // 获取基础路径（处理子目录部署）
    let basePath = '';
    
    // 情况1: GitHub Pages (路径包含项目名)
    if (pathname.includes('/Star-Rewards/')) {
        basePath = '/Star-Rewards';
    }
    // 情况2: 其他子目录部署
    else if (pathname.includes('/rewards/') || pathname.includes('/app/')) {
        const pathParts = pathname.split('/');
        const projectIndex = pathParts.findIndex(part => 
            part === 'rewards' || part === 'app' || part === 'Star-Rewards'
        );
        if (projectIndex !== -1) {
            basePath = '/' + pathParts.slice(0, projectIndex + 1).join('/');
        }
    }
    // 情况3: 本地开发或根目录部署
    else {
        basePath = '';
    }
    
    const finalUrl = origin + basePath + '/confirm-email.html';
    
    console.log('URL构建器 - 构建结果:', {
        basePath: basePath,
        finalUrl: finalUrl
    });
    
    return finalUrl;
}

// 用户注册
async function signUp(email, password) {
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    
    console.log('SignUp: 调用API注册...');
    const result = await api.register(email, password);
    
    console.log('SignUp: API响应:', result);
    return result;
}

// 用户登录
async function signIn(email, password) {
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    
    console.log('SignIn: 调用API登录...');
    const result = await api.login(email, password);
    
    console.log('SignIn: API响应:', result);
    return { user: { id: result.user_id, email: result.email }, session: { access_token: result.token } };

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
        showTemporaryMessage('✅ 注册成功！请登录', 'success');
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
        console.log('调用API登录接口...');
        console.log('邮箱:', email);
        let data = await signIn(email, password);
        
        console.log('登录成功，返回数据:', data);
        
        // 登录成功后清空表单
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        
        // 登录成功后清空表单
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        
        // 显示成功消息
        showTemporaryMessage('✅ 登录成功！正在跳转...', 'success');
        
        // 保存用户信息到localStorage - 安全地获取用户数据
        let userData = null;
        if (data && data.user) {
            userData = data.user;
            console.log('从data.user获取用户数据:', userData);
        } else if (data && data.data && data.data.user) {
            userData = data.data.user;
            console.log('从data.data.user获取用户数据:', userData);
        } else {
            console.warn('警告: 无法从登录响应中获取用户数据');
        }
        
        if (userData) {
            localStorage.setItem('supabase.user', JSON.stringify(userData));
            localStorage.setItem('supabase.userEmail', userData.email);
            localStorage.setItem('supabase.userId', userData.id);
            console.log('用户信息已保存:', userData.email);
            
            // 保存session到localStorage，以便页面跳转时恢复
            if (data.session) {
                localStorage.setItem('supabase_session', JSON.stringify(data.session));
                console.log('Login.js: Session已保存到localStorage:', {
                    hasSession: !!data.session,
                    hasAccessToken: !!data.session.access_token,
                    hasRefreshToken: !!data.session.refresh_token,
                    sessionKeys: Object.keys(data.session || {})
                });
                
                // 验证localStorage确实保存了数据
                const savedSession = localStorage.getItem('supabase_session');
                console.log('Login.js: localStorage保存验证:', !!savedSession);
            } else {
                console.log('Login.js: 警告 - 登录返回数据中没有session');
            }
        } else {
            console.warn('警告: 无法获取用户数据，但仍然继续登录流程');
        }
        
        // 登录成功，保存用户信息并跳转
        console.log('登录成功，保存用户信息...');
        await handleLoginSuccess(userData);
        
        // 短暂延迟确保所有异步操作完成
        console.log('等待300ms确保sessionStorage保存完成...');
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // 验证localStorage中的数据
        const sessionCheck = localStorage.getItem('supabase_session');
        console.log('Login.js: 跳转前localStorage检查:', !!sessionCheck);
        
        // 准备重定向到主应用页面
        console.log('准备重定向到主应用页面...');
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

// 处理登录成功 - 只保存用户信息
async function handleLoginSuccess(user) {
    console.log('Login.js: 用户登录成功:', user.email);
    
    // 只保存用户基本信息到sessionStorage
    sessionStorage.setItem('userEmail', user.email);
    sessionStorage.setItem('userId', user.id);
    
    console.log('Login.js: 登录信息已保存，准备跳转到主页...');
    
    // 短暂延迟确保保存完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 跳转到主应用页面（数据加载将在主页面进行）
    window.location.href = 'index.html';
}

// 初始化认证状态 - 使用 Hostinger MySQL API
async function initAuth() {
    console.log('Login.js: 初始化认证状态...');
    
    try {
        const token = api.getToken();
        if (token) {
            const profile = await api.getProfile();
            if (profile) {
                console.log('Login.js: 检测到已登录用户:', profile.email);
                localStorage.setItem('supabase.userEmail', profile.email);
                localStorage.setItem('supabase.userId', profile.user_id);
                showTemporaryMessage('✅ 检测到已登录状态，正在跳转...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
                return;
            }
        }
        console.log('Login.js: 用户未登录，显示登录表单');
    } catch (error) {
        console.error('Login.js: 初始化认证状态失败:', error);
    }
}

// 页面加载完成后初始化认证
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== Login.js: 登录页面加载完成 ===');
    console.log('Login.js: 当前页面路径:', window.location.pathname);
    console.log('Login.js: 全局Supabase状态:', {
        hasSupabase: !!window.supabase,
        hasSupabaseClient: !!window._supabaseClient,
        localStorageUser: localStorage.getItem('supabase.user'),
        localStorageUserEmail: localStorage.getItem('supabase.userEmail'),
        localStorageUserId: localStorage.getItem('supabase.userId')
    });
    
    // 初始化认证状态（包含数据加载和自动跳转）
    initAuth();
});

// 重新发送确认邮件
async function resendConfirmationEmail(email) {
    if (!email) throw new Error('邮箱不能为空');
    
    try {
        const result = await api.resendConfirmation(email);
        return result;
    } catch (error) {
        console.error('重新发送确认邮件失败:', error);
        throw error;
    }
}

// 处理重新发送确认邮件
async function handleResendConfirmation() {
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        showTemporaryMessage('⚠️ 请先输入您的邮箱地址', 'warning');
        return;
    }
    
    try {
        showTemporaryMessage('📧 正在重新发送确认邮件...', 'info');
        await resendConfirmationEmail(email);
        showTemporaryMessage('✅ 确认邮件已重新发送！请检查您的邮箱（包括垃圾邮件箱）', 'success');
    } catch (error) {
        console.error('重新发送确认邮件失败:', error);
        if (error.message && error.message.toLowerCase().includes('user already registered')) {
            showTemporaryMessage('📧 该邮箱已注册！如果无法登录，请尝试重置密码或联系支持。', 'warning');
        } else {
            showTemporaryMessage(`❌ 重新发送失败: ${escapeHtml(error.message)}`, 'error');
        }
    }
}