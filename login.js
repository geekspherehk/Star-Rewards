// login.js - 登录页面专用JavaScript文件

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
    if (!email || !password) throw new Error(t('common.enterEmailAndPassword'));    console.log('SignUp: 调用API注册...');
    const result = await api.register(email, password);
    console.log('SignUp: API响应:', result);
    return result;
}

async function signIn(email, password) {
    if (!email || !password) throw new Error(t('common.enterEmailAndPassword'));    console.log('SignIn: 调用API登录...');
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
        showTemporaryMessage(t('common.enterEmailAndPassword'), 'error');
        return;
    }
    if (password.length < 6) {
        showTemporaryMessage(t('common.passwordMinLength'), 'error');
        return;
    }
    try {
        await signUp(email, password);
        track('register');
        showTemporaryMessage(t('common.registerSuccess'), 'success');
        toggleAuthForm('login');
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    } catch (error) {
        showTemporaryMessage(t('common.registerFailed') + ': ' + escapeHtml(error.message), 'error');
    }
}

async function handleSignIn() {
    console.log('开始处理用户登录...');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) {
        showTemporaryMessage(t('common.enterEmailAndPassword'), 'error');
        return;
    }
    try {
        console.log('调用API登录接口...');
        let data = await signIn(email, password);
        track('login');
        console.log('登录成功，返回数据:', data);
        document.getElementById('login-email').value = '';
        document.getElementById('login-password').value = '';
        showTemporaryMessage(t('common.loginSuccessMessage'), 'success');
        let userData = data.user;
        if (userData) {
            localStorage.setItem('user_email', userData.email);
            localStorage.setItem('user_id', userData.id);
        }
        console.log('登录成功，保存用户信息...');
        await handleLoginSuccess(userData);
    } catch (error) {
        console.error('登录过程中发生错误:', error);
        showTemporaryMessage(t('common.loginFailed') + ': ' + escapeHtml(error.message), 'error');
    }
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
                showTemporaryMessage(t('common.alreadyLoggedIn'), 'success');
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
    if (!email) throw new Error(t('common.enterEmailFirst'));
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
        showTemporaryMessage(t('common.enterEmailFirst'), 'warning');
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