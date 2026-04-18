// login.js - 登录页面专用JavaScript文件

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

function buildConfirmEmailUrl() {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    let basePath = '';
    if (pathname.includes('/Star-Rewards/')) {
        basePath = '/Star-Rewards';
    } else if (pathname.includes('/rewards/') || pathname.includes('/app/')) {
        const pathParts = pathname.split('/');
        const projectIndex = pathParts.findIndex(part => part === 'rewards' || part === 'app' || part === 'Star-Rewards');
        if (projectIndex !== -1) {
            basePath = '/' + pathParts.slice(0, projectIndex + 1).join('/');
        }
    }
    return origin + basePath + '/confirm-email.html';
}

async function signUp(email, password) {
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    console.log('SignUp: 调用API注册...');
    const result = await api.register(email, password);
    console.log('SignUp: API响应:', result);
    return result;
}

async function signIn(email, password) {
    if (!email || !password) throw new Error('邮箱和密码不能为空');
    console.log('SignIn: 调用API登录...');
    const result = await api.login(email, password);
    console.log('SignIn: API响应:', result);
    return { user: { id: result.user_id, email: result.email }, session: { access_token: result.token } };
}

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
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    } catch (error) {
        showTemporaryMessage(`❌ 注册失败: ${escapeHtml(error.message)}`, 'error');
    }
}

async function handleSignIn() {
    console.log('开始处理用户登录...');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        showTemporaryMessage('⚠️ 请输入邮箱和密码', 'error');
        return;
    }
    try {
        console.log('调用API登录接口...');
        let data = await signIn(email, password);
        console.log('登录成功，返回数据:', data);
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        showTemporaryMessage('✅ 登录成功！正在跳转...', 'success');
        let userData = data.user;
        if (userData) {
            localStorage.setItem('supabase.user', JSON.stringify(userData));
            localStorage.setItem('supabase.userEmail', userData.email);
            localStorage.setItem('supabase.userId', userData.id);
            if (data.session) {
                localStorage.setItem('supabase_session', JSON.stringify(data.session));
            }
        }
        console.log('登录成功，保存用户信息...');
        await handleLoginSuccess(userData);
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showTemporaryMessage(`❌ 登录失败: ${escapeHtml(error.message)}`, 'error');
    }
}

function showTemporaryMessage(message, type = 'info') {
    const existingMessage = document.querySelector('.temporary-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    const messageElement = document.createElement('div');
    messageElement.className = `temporary-message ${type}`;
    messageElement.textContent = message;
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
    document.body.appendChild(messageElement);
    setTimeout(() => {
        if (messageElement.parentNode) {
            messageElement.parentNode.removeChild(messageElement);
        }
    }, 3000);
}

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

async function handleLoginSuccess(user) {
    console.log('Login.js: 用户登录成功:', user.email);
    sessionStorage.setItem('userEmail', user.email);
    sessionStorage.setItem('userId', user.id);
    await new Promise(resolve => setTimeout(resolve, 100));
    window.location.href = 'index.html';
}

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

document.addEventListener('DOMContentLoaded', function() {
    console.log('=== Login.js: 登录页面加载完成 ===');
    initAuth();
});

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