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

async function signUp(email, password, inviteCode) {
    if (!email || !password) throw new Error(t('common.enterEmailAndPassword'));    console.log('SignUp: 调用API注册...');
    const result = await api.register(email, password, inviteCode || '');
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
    const inviteInput = document.getElementById('register-invite');
    const inviteCode = inviteInput ? inviteInput.value.trim().toUpperCase() : '';
    if (!email || !password) {
        showTemporaryMessage(t('common.enterEmailAndPassword'), 'error');
        return;
    }
    if (password.length < 6) {
        showTemporaryMessage(t('common.passwordMinLength'), 'error');
        return;
    }
    try {
        await signUp(email, password, inviteCode);
        track('register');
        if (inviteCode) track('register_with_invite', { code: inviteCode });
        showTemporaryMessage(t('common.registerSuccess'), 'success');
        sessionStorage.removeItem('pending_invite');
        if (inviteInput) inviteInput.value = '';
        toggleAuthForm('login');
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
    } catch (error) {
        const msg = String(error.message || error);
        // 填了邀请码但注册失败 → 多半是邀请码无效/已过期/家庭已满，给更明确的提示
        if (inviteCode && /404|410|403|400/.test(msg)) {
            showTemporaryMessage(t('common.invalidInviteCode'), 'error');
        } else {
            showTemporaryMessage(t('common.registerFailed') + ': ' + escapeHtml(msg), 'error');
        }
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
    // 捕获 URL 上的 ?invite=CODE（邀请链接直达登录页时），存入 sessionStorage 供注册表单使用
    const urlInvite = (new URLSearchParams(window.location.search).get('invite') || '').trim().toUpperCase();
    if (urlInvite) sessionStorage.setItem('pending_invite', urlInvite);
    const pending = sessionStorage.getItem('pending_invite') || '';
    const inviteInput = document.getElementById('register-invite');
    if (inviteInput && pending) inviteInput.value = pending;
    initAuth();
});