// login.js - 登录页面专用JavaScript文件

// Supabase 配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM';
let supabase;

// 初始化Supabase客户端 - 与script.js保持一致的使用全局缓存机制
function initializeSupabase() {
    try {
        // 检查是否已经存在初始化的客户端
        if (window._supabaseClient) {
            console.log('Login.js: 使用已存在的Supabase客户端实例');
            console.log('Login.js: 已存在的实例信息:', {
                url: window._supabaseClient.supabaseUrl,
                hasAuth: !!window._supabaseClient.auth,
                hasFrom: !!window._supabaseClient.from,
                instanceId: window._supabaseClient.toString()
            });
            return window._supabaseClient;
        }
        
        console.log('Login.js: 创建新的Supabase客户端实例');
        if (typeof window.supabase === 'undefined') {
            console.warn('Login.js: Supabase SDK 未加载');
            return null;
        }
        
        const client = window.supabase.createClient(supabaseUrl, supabaseKey, {
            auth: {
                storage: localStorage, // 使用localStorage存储会话信息
                autoRefreshToken: true, // 启用自动刷新令牌
                persistSession: true // 启用会话持久化
            },
            global: {
                headers: {
                    'apikey': supabaseKey
                }
            }
        });
        
        // 保存客户端实例到全局变量，供所有页面共享
        window._supabaseClient = client;
        console.log('Login.js: Supabase客户端初始化成功', {
            url: client.supabaseUrl,
            hasAuth: !!client.auth,
            hasFrom: !!client.from,
            instanceId: client.toString()
        });
        return client;
    } catch (error) {
        console.error('Login.js: Supabase 初始化失败:', error);
        return null;
    }
}

// 获取共享的Supabase实例
if (window._supabaseClient) {
    supabase = window._supabaseClient;
    console.log('Login页面: 使用已存在的Supabase实例');
} else {
    supabase = initializeSupabase();
}

// 检查用户是否已登录 - 与script.js保持一致，返回{user, error}格式
async function checkUserLoggedIn() {
    try {
        console.log('Login.js: 开始检查用户登录状态');
        console.log('Login.js: Supabase实例信息:', {
            url: supabase?.supabaseUrl,
            hasAuth: !!supabase?.auth,
            instanceId: supabase?.toString()
        });
        
        if (!supabase) {
            console.warn('Login.js: Supabase 客户端未初始化');
            return { user: null, error: new Error('Supabase 客户端未初始化') };
        }
        
        // 首先检查是否有会话
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Login.js: 会话检查结果:', {
            hasSession: !!sessionData?.session,
            hasAccessToken: !!sessionData?.session?.access_token,
            hasError: !!sessionError,
            errorMessage: sessionError?.message
        });
        
        // 如果没有会话，返回未登录状态（这不是错误）
        if (!sessionData?.session) {
            console.log('Login.js: 无活跃会话，用户未登录');
            return { user: null, error: null };
        }
        
        // 如果有会话，尝试获取用户信息
        const { data, error } = await supabase.auth.getUser();
        
        console.log('Login.js: 获取用户信息结果:', {
            hasUser: !!data?.user,
            userId: data?.user?.id,
            userEmail: data?.user?.email,
            hasError: !!error,
            errorMessage: error?.message
        });
        
        if (error) {
            return { user: null, error };
        }
        
        return { user: data.user, error: null };
    } catch (exception) {
        console.log('Login.js: 检查登录状态时发生异常:', exception.message);
        return { user: null, error: exception };
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
    
    console.log('SignIn: 调用supabase.auth.signInWithPassword...');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    console.log('SignIn: Supabase原始响应:', {
        hasData: !!data,
        hasError: !!error,
        dataType: typeof data,
        dataKeys: data ? Object.keys(data) : '无数据',
        dataContent: data
    });
    
    if (error) {
        console.log('SignIn: 登录错误:', error);
        throw error;
    }
    
    // 确保返回的数据结构一致
    if (!data) {
        throw new Error('登录成功但未返回数据');
    }
    
    console.log('SignIn: 返回数据成功');
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
        console.log('邮箱:', email);
        let { data, error } = await signIn(email, password);
        
        if (error) throw error;
        
        // 如果data为undefined，尝试从Supabase客户端获取当前会话
        if (!data) {
            console.log('警告: 登录返回data为undefined，尝试从Supabase客户端获取当前会话');
            const { data: sessionData } = await supabase.auth.getSession();
            console.log('从getSession获取的数据:', sessionData);
            
            if (sessionData && sessionData.session) {
                data = {
                    session: sessionData.session,
                    user: sessionData.session.user
                };
                console.log('使用getSession数据重构data:', data);
            } else {
                console.error('无法获取会话数据');
                throw new Error('登录成功但无法获取用户会话数据');
            }
        }
        
        console.log('登录成功，返回数据:', data);
        console.log('登录数据详细结构:', {
            dataType: typeof data,
            dataKeys: data ? Object.keys(data) : '无数据',
            hasUser: !!(data && data.user),
            hasSession: !!(data && data.session),
            userData: data && data.user,
            sessionData: data && data.session,
            dataString: JSON.stringify(data, null, 2)
        });
        
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
        
        // 准备重定向到主页
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

// 处理登录成功 - 只保存用户信息
async function handleLoginSuccess(user) {
    console.log('Login.js: 用户登录成功:', user.email);
    
    // 只保存用户基本信息到sessionStorage
    sessionStorage.setItem('userEmail', user.email);
    sessionStorage.setItem('userId', user.id);
    
    console.log('Login.js: 登录信息已保存，准备跳转到主页...');
    
    // 短暂延迟确保保存完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 跳转到主页（数据加载将在主页进行）
    window.location.href = 'index.html';
}

// 初始化认证状态 - 简化版本
async function initAuth() {
    console.log('Login.js: 初始化认证状态...');
    
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Login.js: Supabase客户端未初始化，开始初始化...');
            supabase = initializeSupabase();
            if (!supabase) {
                console.error('Login.js: Supabase客户端初始化失败');
                return;
            }
        }
        
        // 检查当前认证状态
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
            console.log('Login.js: 获取用户信息失败:', error.message);
            // 用户未登录，保持在登录页面
            return;
        }
        
        if (user) {
            console.log('Login.js: 检测到已登录用户:', user.email);
            // 用户已登录，直接跳转到主页
            
            // 保存用户信息
            localStorage.setItem('supabase.user', JSON.stringify(user));
            localStorage.setItem('supabase.userEmail', user.email);
            localStorage.setItem('supabase.userId', user.id);
            
            // 显示提示信息
            showTemporaryMessage('✅ 检测到已登录状态，正在跳转...', 'success');
            
            // 跳转到主页（数据加载将在主页进行）
            console.log('Login.js: 用户已登录，跳转到主页...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1000);
        } else {
            console.log('Login.js: 用户未登录，显示登录表单');
            // 用户未登录，保持在登录页面
        }
        
    } catch (error) {
        console.error('Login.js: 初始化认证状态失败:', error);
        // 发生错误，保持在登录页面
    }
}

// 初始化全局Supabase客户端的通用函数
async function initializeGlobalSupabase() {
    // 如果页面刚跳转，优先尝试从localStorage恢复客户端（优先级最高）
    if (localStorage.getItem('supabase_session')) {
        console.log('Login.js: 检测到localStorage中有session，尝试恢复Supabase客户端');
        try {
            const sessionData = JSON.parse(localStorage.getItem('supabase_session'));
            console.log('Login.js: session数据解析:', {
                hasSessionData: !!sessionData,
                hasAccessToken: !!sessionData?.access_token,
                hasRefreshToken: !!sessionData?.refresh_token,
                accessTokenLength: sessionData?.access_token?.length || 0,
                refreshTokenLength: sessionData?.refresh_token?.length || 0
            });
            
            if (sessionData && sessionData.access_token && sessionData.refresh_token) {
                console.log('Login.js: 开始初始化Supabase客户端');
                supabase = initializeSupabase();
                console.log('Login.js: Supabase客户端初始化完成:', !!supabase);
                
                // 恢复会话
                console.log('Login.js: 开始调用setSession恢复会话...');
                const { data, error } = await supabase.auth.setSession({
                    access_token: sessionData.access_token,
                    refresh_token: sessionData.refresh_token
                });
                
                console.log('Login.js: setSession调用结果:', {
                    hasData: !!data,
                    hasError: !!error,
                    errorMessage: error?.message,
                    hasUser: !!data?.user,
                    userId: data?.user?.id
                });
                
                if (error) {
                    console.log('Login.js: Session恢复失败:', error);
                    localStorage.removeItem('supabase_session');
                    // 清除可能存在的旧客户端
                    window._supabaseClient = null;
                } else {
                    console.log('Login.js: Session恢复成功, 用户ID:', data?.user?.id);
                    window._supabaseClient = supabase;
                    // 清除localStorage，因为已经恢复
                    localStorage.removeItem('supabase_session');
                }
                return supabase;
            } else {
                console.log('Login.js: session数据格式不完整，跳过恢复');
                localStorage.removeItem('supabase_session');
            }
        } catch (e) {
            console.error('Login.js: session恢复过程中发生错误:', e);
            localStorage.removeItem('supabase_session');
            window._supabaseClient = null;
        }
    }
    
    // 如果已经存在全局客户端，直接使用
    if (window._supabaseClient) {
        console.log('Login.js: 使用已存在的全局Supabase客户端');
        supabase = window._supabaseClient;
        return supabase;
    }
    
    // 否则创建新的客户端并保存到全局
    console.log('Login.js: 创建新的全局Supabase客户端');
    supabase = initializeSupabase();
    return supabase;
}

// 检查当前会话状态并提供更清晰的日志
async function checkAndLogSessionStatus() {
    if (!supabase) {
        console.log('Login.js: Supabase客户端未初始化，无法检查会话状态');
        return;
    }
    
    try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        console.log('Login.js: 当前会话状态检查:', {
            hasSession: !!sessionData?.session,
            hasAccessToken: !!sessionData?.session?.access_token,
            hasRefreshToken: !!sessionData?.session?.refresh_token,
            hasError: !!sessionError,
            errorMessage: sessionError?.message,
            sessionKeys: sessionData?.session ? Object.keys(sessionData.session) : []
        });
        
        if (sessionData?.session) {
            console.log('Login.js: 发现活跃会话，用户ID:', sessionData.session.user?.id);
        } else {
            console.log('Login.js: 无活跃会话，这是正常状态');
        }
    } catch (error) {
        console.log('Login.js: 检查会话状态时出错:', error.message);
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