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

async function signUp(email, password, inviteCode, consent) {
    if (!email || !password) throw new Error(t('common.enterEmailAndPassword'));    console.log('SignUp: 调用API注册...');
    const result = await api.register(email, password, inviteCode || '', consent);
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
    const forms = ['login-form', 'register-form', 'forgot-form', 'reset-form'];
    const target = formType + '-form';
    forms.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === target) ? 'block' : 'none';
    });
    // 登录/注册是顶部主标签，切换表单时同步标签高亮（forgot/reset 不属标签，不动）
    if (formType === 'login' || formType === 'register') {
        document.querySelectorAll('.auth-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.form === formType);
        });
    }
}

// 顶部标签切换：同步表单显示 + 隐藏登录失败提示
function switchAuthTab(formType) {
    toggleAuthForm(formType);
    const hint = document.getElementById('login-hint');
    if (hint) hint.style.display = 'none';
}

// ── 忘记密码：请求发送重置邮件 ──
async function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
        showTemporaryMessage(t('common.enterEmailAndPassword'), 'error');
        return;
    }
    try {
        await api.forgotPassword(email);
        // 防枚举：无论邮箱是否存在，后端都返回成功 → 提示统一措辞
        showTemporaryMessage(t('login.forgotSent'), 'success');
        toggleAuthForm('login');
        document.getElementById('forgot-email').value = '';
    } catch (error) {
        showTemporaryMessage(t('login.forgotFailed') + ': ' + escapeHtml(String(error.message || error)), 'error');
    }
}

// ── 邮箱验证：凭邮件链接里的 token 置已验证 ──
async function handleVerifyEmail() {
    const token = (new URLSearchParams(window.location.search).get('verify') || '').trim();
    if (!token) return;
    try {
        await api.verifyEmail(token);
        showTemporaryMessage(t('verify.success'), 'success');
        // 清掉 URL 上的 token，避免刷新/分享泄漏；回到登录表单
        window.history.replaceState({}, '', 'login.html');
        setTimeout(() => toggleAuthForm('login'), 1500);
    } catch (error) {
        const msg = String(error.message || error);
        showTemporaryMessage(/invalid or expired/i.test(msg) ? t('verify.invalid') : t('common.loginFailed') + ': ' + escapeHtml(msg), 'error');
        window.history.replaceState({}, '', 'login.html');
    }
}

// ── 重置密码：凭邮件链接里的 token 设置新密码 ──
async function handleResetPassword() {
    const p1 = document.getElementById('reset-password').value;
    const p2 = document.getElementById('reset-password2').value;
    if (!p1 || p1.length < 6) {
        showTemporaryMessage(t('common.passwordMinLength'), 'error');
        return;
    }
    if (p1 !== p2) {
        showTemporaryMessage(t('login.resetMismatch'), 'error');
        return;
    }
    const token = (new URLSearchParams(window.location.search).get('reset') || '').trim();
    if (!token) {
        showTemporaryMessage(t('login.resetInvalid'), 'error');
        return;
    }
    try {
        await api.resetPassword(token, p1);
        showTemporaryMessage(t('login.resetDone'), 'success');
        // 清掉 URL 上的 token，避免刷新/分享泄漏；回到登录表单
        window.history.replaceState({}, '', 'login.html');
        document.getElementById('reset-password').value = '';
        document.getElementById('reset-password2').value = '';
        setTimeout(() => toggleAuthForm('login'), 1200);
    } catch (error) {
        const msg = String(error.message || error);
        showTemporaryMessage(/invalid or expired/i.test(msg) ? t('login.resetInvalid') : t('common.loginFailed') + ': ' + escapeHtml(msg), 'error');
    }
}

async function handleSignUp() {
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const inviteInput = document.getElementById('register-invite');
    const inviteCode = inviteInput ? inviteInput.value.trim().toUpperCase() : '';
    const consentEl = document.getElementById('register-consent');
    const consent = consentEl ? consentEl.checked : false;
    if (!email || !password) {
        showTemporaryMessage(t('common.enterEmailAndPassword'), 'error');
        return;
    }
    if (password.length < 6) {
        showTemporaryMessage(t('common.passwordMinLength'), 'error');
        return;
    }
    if (!consent) {
        showTemporaryMessage(t('common.consentRequired'), 'error');
        if (consentEl) consentEl.focus();
        return;
    }
    try {
        const result = await signUp(email, password, inviteCode, true);
        track('register');
        if (inviteCode) track('register_with_invite', { code: inviteCode });
        showTemporaryMessage(t('common.registerSuccess'), 'success');
        sessionStorage.removeItem('pending_invite');
        // 注册即登录：api.register 内部已写入 token，直接跳转首页，由 onboarding 引导承接新用户
        const userData = { id: result.user_id, email: result.email || email };
        localStorage.setItem('user_email', userData.email);
        localStorage.setItem('user_id', String(userData.id));
        await handleLoginSuccess(userData);
    } catch (error) {
        const msg = String(error.message || error);
        // 把后端错误码映射为本地化友好提示，避免直接透传英文原文
        if (/Email already registered/i.test(msg)) {
            showTemporaryMessage(t('common.emailRegistered'), 'error');
        } else if (/Invalid email format/i.test(msg)) {
            showTemporaryMessage(t('common.emailFormatInvalid'), 'error');
        } else if (/Password must be 6-255/i.test(msg)) {
            showTemporaryMessage(t('common.passwordLengthInvalid'), 'error');
        } else if (inviteCode && /404|410|403|400/.test(msg)) {
            showTemporaryMessage(t('common.invalidInviteCode'), 'error');
        } else if (/Network error/i.test(msg)) {
            showTemporaryMessage(t('common.networkError'), 'error');
        } else {
            showTemporaryMessage(t('common.registerGenericError'), 'error');
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
        const msg = String(error.message || error);
        const hint = document.getElementById('login-hint');
        if (/Invalid email or password/i.test(msg)) {
            // 账号不存在或密码错误：本地化提示，并引导新用户去注册（常误把新邮箱填进登录框）
            showTemporaryMessage(t('common.invalidCredentials'), 'error');
            if (hint) hint.style.display = 'block';
        } else if (/Network error/i.test(msg)) {
            showTemporaryMessage(t('common.networkError'), 'error');
        } else {
            showTemporaryMessage(t('common.loginFailed'), 'error');
        }
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
    // 验证/重置邮件链接场景（?verify= / ?reset=）：绝不自动跳转首页，
    // 否则会与下方的邮件链接处理器并发，在 verifyEmail 完成前就把页面跳走，导致验证/重置失效
    const _up = new URLSearchParams(window.location.search);
    if (_up.get('verify') || _up.get('reset')) {
        console.log('Login.js: 邮件链接模式（verify/reset），跳过自动跳转');
        return;
    }
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
    // 邮件重置链接 ?reset=TOKEN → 直接展示"设置新密码"表单
    const resetToken = (new URLSearchParams(window.location.search).get('reset') || '').trim();
    if (resetToken) {
        toggleAuthForm('reset');
    }
    // 邮箱验证链接 ?verify=TOKEN → 调用验证接口并提示结果
    const verifyToken = (new URLSearchParams(window.location.search).get('verify') || '').trim();
    if (verifyToken) {
        handleVerifyEmail();
    }
    initAuth();
});