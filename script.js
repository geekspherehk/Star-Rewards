// Supabase 配置 - 替换为你的实际配置
const supabaseUrl = 'https://pjxpyppafaxepdzqgume.supabase.co'; // 例如: https://your-project-id.supabase.co
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeHB5cHBhZmF4ZXBkenFndW1lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NDk5NzgsImV4cCI6MjA3NTIyNTk3OH0.RmAMBhVeJ-bWHqjdrnHaRMvidR9Jvk5s7TyTPZN3GMM'; // 例如: eyJhb...
let supabase;

// 全局错误处理
window.addEventListener('error', (event) => {
    console.error('全局错误捕获:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('未处理的Promise拒绝:', event.reason);
});

// 检测URL是否为电商平台URL
function isEcommerceUrl(url) {
    const ecommercePatterns = [
        /jd\.com/,           // 京东
        /tmall\.com/,        // 天猫
        /taobao\.com/,       // 淘宝
        /suning\.com/,       // 苏宁
        /amazon\.(cn|com)/,  // 亚马逊
        /pinduoduo\.com/,    // 拼多多
        /dangdang\.com/,     // 当当
        /vip\.com/,          // 唯品会
        /youzan\.com/,       // 有赞
        /mi\.com/,           // 小米
        /huawei\.com/,       // 华为
        /lenovo\.com/        // 联想
    ];
    
    return ecommercePatterns.some(pattern => pattern.test(url));
}

// 从电商平台URL提取商品图片
async function extractProductImageFromUrl(url) {
    try {
        // 对于不同电商平台，使用不同的策略提取或生成图片URL
        if (url.includes('jd.com')) {
            // 京东：尝试从URL中提取商品ID并生成图片URL
            const match = url.match(/item\.jd\.com\/(\d+)\.html/);
            if (match && match[1]) {
                const productId = match[1];
                // 返回京东商品主图URL（注意：这是基于京东图片CDN规则生成的）
                return `https://img12.360buyimg.com/n7/jfs/t${productId.slice(-3)}/${productId}/smalls/${productId}_1.jpg`;
            }
        } else if (url.includes('tmall.com') || url.includes('taobao.com')) {
            // 淘宝/天猫：尝试从URL中提取商品ID
            const match = url.match(/id=(\d+)/) || url.match(/item\.(taobao|tmall)\.com\/item\.htm\?(.*?)(?:id=(\d+))/);
            if (match && match[1]) {
                const productId = match[1];
                // 使用淘宝商品图片占位服务
                return `https://img.alicdn.com/imgextra/i${productId.slice(-1)}/${productId}.jpg`;
            }
        } else if (url.includes('amazon')) {
            // 亚马逊：使用通用占位图
            return 'https://m.media-amazon.com/images/G/01/gc/designs/livepreview/amazon_dkblue_noto_email_v2016_us-main._CB468775337_.png';
        } else {
            // 其他电商平台：使用商品详情页的通用图片占位服务
            return `https://via.placeholder.com/80?text=商品图片`;
        }
        
        // 如果无法提取，则使用默认的商品图片占位图
        return 'https://via.placeholder.com/80?text=商品';
    } catch (error) {
        console.error('提取商品图片失败:', error);
        return null;
    }
}

// 初始化Supabase客户端
function initializeSupabase() {
    try {
        // 检查是否已经存在初始化的客户端
        if (window._supabaseClient) {
            console.log('Script.js: 使用已存在的Supabase客户端实例');
            console.log('Script.js: 已存在的实例信息:', {
                url: window._supabaseClient.supabaseUrl,
                hasAuth: !!window._supabaseClient.auth,
                hasFrom: !!window._supabaseClient.from
            });
            return window._supabaseClient;
        }
        
        if (typeof window.supabase === 'undefined') {
            console.warn('Script.js: Supabase SDK 未加载');
            return null;
        }
        
        console.log('Script.js: 创建新的Supabase客户端实例');
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
        
        // 保存客户端实例到全局变量
        window._supabaseClient = client;
        console.log('Script.js: Supabase客户端初始化成功', {
            url: client.supabaseUrl,
            hasAuth: !!client.auth,
            hasFrom: !!client.from
        });
        return client;
    } catch (error) {
        console.error('Script.js: Supabase 初始化失败:', error);
        return null;
    }
}

// 移除checkUserLoggedIn函数 - 认证逻辑全部移至login页面

// 本地数据变量
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];

// 当前登录用户信息
let currentUser = null;

// 移除restoreBasicData函数 - 认证逻辑全部移至login页面

// 用户登出 - 简化版本，只清除sessionStorage并重定向
async function signOut() {
    try {
        console.log('开始执行登出流程...');
        
        // 尝试调用Supabase登出API，但忽略错误
        if (supabase) {
            console.log('调用Supabase登出API...');
            try {
                const { error } = await supabase.auth.signOut();
                if (error) {
                    console.warn('Supabase登出失败（忽略）:', error.message);
                } else {
                    console.log('Supabase登出成功');
                }
            } catch (apiError) {
                console.warn('Supabase登出API调用失败（忽略）:', apiError.message);
            }
        }
        
        // 清空sessionStorage中的用户数据
        sessionStorage.clear();
        
        // 清空localStorage中的认证数据
        localStorage.removeItem('supabase.user');
        localStorage.removeItem('supabase.userEmail');
        localStorage.removeItem('supabase.userId');
        localStorage.removeItem('supabase_session');
        
        // 重置本地数据
        currentPoints = 0;
        totalPoints = 0;
        behaviors = [];
        gifts = [];
        redeemedGifts = [];
        currentUser = null;
        
        console.log('更新UI显示...');
        // 更新显示
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        // 更新认证UI
        console.log('更新认证UI状态...');
        updateAuthUI(null);
        
        console.log('登出流程完成');
        showTemporaryMessage('👋 已退出登录', 'success');
        
        // 2秒后跳转到登录页面
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        
    } catch (error) {
        console.error('登出过程中发生错误:', error);
        showTemporaryMessage(`❌ 登出失败: ${escapeHtml(error.message)}`, 'error');
        throw error;
    }
}

// 简化版的更新认证UI状态 - 只处理显示逻辑
function updateAuthUI(user) {
    console.log('更新认证UI状态，用户状态:', user ? '已登录' : '未登录');
    
    // 在主页处理UI更新
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 用户已登录，更新UI显示用户信息
        console.log('显示用户登录信息，邮箱:', user.email);
        if (userEmail) userEmail.textContent = user.email;
        
        // 显示已登录状态（隐藏未登录卡片，显示主要内容）
        showLoggedInState(user);
    } else {
        // 用户未登录，隐藏登录信息
        console.log('隐藏用户登录信息');
        
        // 显示未登录状态（显示未登录卡片，隐藏主要内容）
        showNotLoggedInState();
    }
}

// 移除initAuth函数 - 认证逻辑全部移至login页面



function updatePointsDisplay() {
    const currentPointsElement = document.getElementById('current-points');
    const totalPointsElement = document.getElementById('total-points');
    
    if (currentPointsElement) {
        currentPointsElement.textContent = currentPoints;
    }
    
    if (totalPointsElement) {
        totalPointsElement.textContent = totalPoints;
    }
}

function updateBehaviorLog() {
    const logContainer = document.getElementById('behavior-log');
    if (!logContainer) return;
    
    logContainer.innerHTML = '';
    
    // 添加统计信息
    const totalBehaviors = behaviors.length;
    const totalPointsGained = behaviors.filter(b => b.points > 0).reduce((sum, b) => sum + b.points, 0);
    const totalPointsLost = behaviors.filter(b => b.points < 0).reduce((sum, b) => sum + b.points, 0);
    
    if (behaviors.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-behavior-message';
        emptyMessage.innerHTML = '📋 暂无记录，开始记录您的行为吧！';
        logContainer.appendChild(emptyMessage);
        return;
    }
    
    // 创建统计卡片
    const statsDiv = document.createElement('div');
    statsDiv.className = 'behavior-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-icon">📊</div>
            <div class="stat-text">总记录: ${totalBehaviors}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">✅</div>
            <div class="stat-text">获得积分: +${totalPointsGained}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">❌</div>
            <div class="stat-text">扣除积分: ${totalPointsLost}</div>
        </div>
    `;
    logContainer.appendChild(statsDiv);
    
    // 创建行为日志容器
    const behaviorsContainer = document.createElement('div');
    behaviorsContainer.className = 'behavior-log-container';
    
    behaviors.forEach((behavior, index) => {
        const behaviorDiv = document.createElement('div');
        behaviorDiv.className = 'behavior-item';
        behaviorDiv.style.animationDelay = `${index * 0.1}s`;
        
        // 根据积分正负设置不同的图标和样式
        const isPositive = behavior.points > 0;
        const icon = isPositive ? '✅' : '❌';
        const pointsClass = isPositive ? 'positive-points' : 'negative-points';
        
        behaviorDiv.innerHTML = `
            <div class="behavior-icon">${icon}</div>
            <div class="behavior-content">
                <div class="behavior-description">${escapeHtml(behavior.description)}</div>
                <div class="behavior-meta">
                    <span class="behavior-points ${pointsClass}">${behavior.points > 0 ? '+' : ''}${behavior.points}</span>
                    <span class="behavior-date">${formatBehaviorDate(behavior.timestamp)}</span>
                </div>
            </div>
        `;
        
        behaviorsContainer.appendChild(behaviorDiv);
    });
    
    logContainer.appendChild(behaviorsContainer);
    
    // 更新行为日志计数徽章
    const behaviorCount = document.getElementById('behavior-count');
    if (behaviorCount) {
        behaviorCount.textContent = totalBehaviors;
    }
}

function updateGiftList() {
    const giftList = document.getElementById('gift-list');
    giftList.innerHTML = '';
    gifts.forEach((gift, index) => {
        const li = document.createElement('li');
        li.className = 'gift-item';
        
        // 礼物内容容器
        const contentDiv = document.createElement('div');
        contentDiv.className = 'item-content';
        
        // 礼物图片区域
        const imageDiv = document.createElement('div');
        imageDiv.className = 'gift-image-container';
        if (gift.image_url) {
            // 检查是否有原始电商URL
            const hasOriginalUrl = gift.original_url && isEcommerceUrl(gift.original_url);
            
            if (hasOriginalUrl) {
                // 创建可点击的链接
                const link = document.createElement('a');
                link.href = gift.original_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                
                const img = document.createElement('img');
                img.src = gift.image_url;
                img.alt = gift.name;
                img.className = 'gift-image';
                img.onerror = function() {
                    this.src = 'https://via.placeholder.com/80';
                    this.alt = '礼物图片';
                };
                
                link.appendChild(img);
                imageDiv.appendChild(link);
            } else {
                const img = document.createElement('img');
                img.src = gift.image_url;
                img.alt = gift.name;
                img.className = 'gift-image';
                img.onerror = function() {
                    this.src = 'https://via.placeholder.com/80';
                    this.alt = '礼物图片';
                };
                imageDiv.appendChild(img);
            }
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'gift-image-placeholder';
            placeholder.textContent = '🎁';
            imageDiv.appendChild(placeholder);
        }
        
        // 礼物信息区域
        const infoDiv = document.createElement('div');
        infoDiv.className = 'gift-info';
        
        // 礼物标题和类别
        const headerDiv = document.createElement('div');
        headerDiv.className = 'gift-header';
        
        const titleDiv = document.createElement('div');
        titleDiv.className = 'item-title';
        titleDiv.textContent = gift.name;
        
        if (gift.category) {
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'category-badge';
            categoryBadge.textContent = gift.category;
            headerDiv.appendChild(categoryBadge);
        }
        
        headerDiv.appendChild(titleDiv);
        
        // 礼物描述
        if (gift.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'gift-description';
            // 如果有HTML格式的描述（包含可点击链接），则使用它
            if (gift.description_html) {
                descDiv.innerHTML = gift.description_html;
            } else {
                // 否则使用原始文本描述
                descDiv.textContent = gift.description;
            }
            infoDiv.appendChild(descDiv);
        }
        
        // 礼物积分要求
        const pointsDiv = document.createElement('div');
        pointsDiv.className = 'item-details';
        pointsDiv.textContent = `需要 ${gift.points} 分`;
        
        infoDiv.appendChild(headerDiv);
        infoDiv.appendChild(pointsDiv);
        
        contentDiv.appendChild(imageDiv);
        contentDiv.appendChild(infoDiv);
        li.appendChild(contentDiv);
        
        // 兑换按钮
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'redeem-btn';
        redeemBtn.textContent = '🎁 兑换';
        redeemBtn.disabled = currentPoints < gift.points;
        redeemBtn.onclick = async () => {
            await redeemGift(index);
        };
        
        li.appendChild(redeemBtn);
        giftList.appendChild(li);
    });
}

function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    const redeemedCount = document.getElementById('redeemed-count');
    
    // 更新计数徽章
    if (redeemedCount) {
        redeemedCount.textContent = redeemedGifts.length;
    }
    
    // 清空现有内容
    while (redeemedList.firstChild) {
        redeemedList.removeChild(redeemedList.firstChild);
    }
    
    if (redeemedGifts.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-redeemed-message';
        emptyMessage.innerHTML = '🎁 还没有兑换记录，快去兑换喜欢的奖励吧！';
        redeemedList.appendChild(emptyMessage);
        return;
    }
    
    // 添加统计信息
    const totalRedeemedPoints = redeemedGifts.reduce((sum, item) => sum + item.points, 0);
    const statsDiv = document.createElement('div');
    statsDiv.className = 'redeemed-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-icon">🏆</span>
            <span class="stat-text">共兑换 ${redeemedGifts.length} 件礼物</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon">💎</span>
            <span class="stat-text">总计消耗 ${totalRedeemedPoints} 积分</span>
        </div>
    `;
    redeemedList.appendChild(statsDiv);
    
    // 创建礼物列表容器
    const giftsContainer = document.createElement('div');
    giftsContainer.className = 'redeemed-gifts-container';
    
    redeemedGifts.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'redeemed-item';
        itemElement.style.animationDelay = `${index * 0.1}s`;
        
        // 礼物图片区域
        const imageDiv = document.createElement('div');
        imageDiv.className = 'redeemed-image-container';
        if (item.image_url) {
            // 检查是否有原始电商URL
            const hasOriginalUrl = item.original_url && isEcommerceUrl(item.original_url);
            
            if (hasOriginalUrl) {
                // 创建可点击的链接
                const link = document.createElement('a');
                link.href = item.original_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.name;
                img.className = 'redeemed-image';
                img.onerror = function() {
                    this.src = 'https://via.placeholder.com/60';
                    this.alt = '礼物图片';
                };
                
                link.appendChild(img);
                imageDiv.appendChild(link);
            } else {
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.name;
                img.className = 'redeemed-image';
                img.onerror = function() {
                    this.src = 'https://via.placeholder.com/60';
                    this.alt = '礼物图片';
                };
                imageDiv.appendChild(img);
            }
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'redeemed-image-placeholder';
            placeholder.textContent = '🎁';
            imageDiv.appendChild(placeholder);
        }
        
        // 内容区域
        const contentDiv = document.createElement('div');
        contentDiv.className = 'redeemed-content';
        
        // 礼物标题和类别
        const headerDiv = document.createElement('div');
        headerDiv.className = 'redeemed-header';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'redeemed-name';
        nameDiv.textContent = item.name;
        
        if (item.category) {
            const categoryBadge = document.createElement('span');
            categoryBadge.className = 'category-badge small';
            categoryBadge.textContent = item.category;
            headerDiv.appendChild(categoryBadge);
        }
        
        headerDiv.appendChild(nameDiv);
        
        // 礼物描述
        if (item.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'redeemed-description';
            // 如果有HTML格式的描述（包含可点击链接），则使用它
            if (item.description_html) {
                descDiv.innerHTML = item.description_html;
            } else {
                // 否则使用原始文本描述
                descDiv.textContent = item.description;
            }
            contentDiv.appendChild(descDiv);
        }
        
        // 底部信息
        const infoDiv = document.createElement('div');
        infoDiv.className = 'redeemed-info';
        
        // 积分信息
        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'redeemed-points';
        pointsSpan.innerHTML = `<span class="points-badge">-${item.points}</span> 积分`;
        
        // 时间信息
        const dateSpan = document.createElement('span');
        dateSpan.className = 'redeemed-date';
        dateSpan.textContent = formatRedeemDate(item.redeem_date);
        
        infoDiv.appendChild(pointsSpan);
        infoDiv.appendChild(dateSpan);
        
        contentDiv.appendChild(headerDiv);
        contentDiv.appendChild(infoDiv);
        
        itemElement.appendChild(imageDiv);
        itemElement.appendChild(contentDiv);
        
        giftsContainer.appendChild(itemElement);
    });
    
    redeemedList.appendChild(giftsContainer);
}

// 格式化兑换日期
function formatRedeemDate(dateString) {
    if (!dateString || dateString === '未知时间') return '刚刚';
    
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins} 分钟前`;
        if (diffHours < 24) return `${diffHours} 小时前`;
        if (diffDays < 7) return `${diffDays} 天前`;
        
        // 超过一周显示具体日期
        return date.toLocaleDateString('zh-CN', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return dateString;
    }
}

// 格式行为日志日期
function formatBehaviorDate(timestamp) {
    return formatRedeemDate(timestamp);
}


// 添加积分 - 直接更新云端
async function addPoints() {
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
    
    const timestamp = new Date().toISOString();
    
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
        }
        
        if (supabase) {
            const { data: user, error: userError } = await supabase.auth.getUser();
            if (!userError && user.user) {
                // 先同步云端数据
                await loadDataFromCloud();
                
                // 更新本地数据
                currentPoints += change;
                if (change > 0) {
                    totalPoints += change;
                }
                behaviors.unshift({ description: desc, points: change, timestamp });
                
                // 并行更新云端
                await Promise.all([
                    supabase
                        .from('behaviors')
                        .insert({
                            user_id: user.user.id,
                            description: desc,
                            points: change,
                            timestamp: timestamp
                        }),
                    supabase
                        .from('profiles')
                        .upsert({
                            id: user.user.id,
                            current_points: currentPoints,
                            total_points: totalPoints,
                            updated_at: timestamp
                        })
                ]);
            }
        } else {
            // 无云端时仅本地更新
            currentPoints += change;
            if (change > 0) {
                totalPoints += change;
            }
            behaviors.unshift({ description: desc, points: change, timestamp });
        }
        
        // 数据已保存在云端，无需本地存储
        
        // 更新显示
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
        
    } catch (error) {
        console.error('添加积分失败:', error);
        showTemporaryMessage('❌ 添加积分失败', 'error');
    }
}

// 将文本中的URL转换为可点击的HTML链接
function textToHtmlWithLinks(text) {
    if (!text) return '';
    
    // 增强的URL正则表达式，支持多种URL格式：
    // 1. 带协议的URL: http://example.com, https://example.com
    // 2. 以www开头的URL: www.example.com
    // 3. 支持各种顶级域名和路径
    const urlRegex = /(https?:\/\/[\w\-._~:/?#[\]@!$&'()*+,;=]+|www\.[\w\-._~:/?#[\]@!$&'()*+,;=]+)/g;
    
    // 安全协议列表
    const safeProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
    
    // 将匹配到的URL替换为HTML链接
    return text.replace(urlRegex, function(url) {
        // 处理URL，添加协议（如果需要）并进行安全检查
        let href = url;
        
        // 检查URL是否包含协议
        if (!url.includes('://') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
            // 为没有协议的URL添加http://
            href = 'http://' + url;
        }
        
        // 安全检查：验证URL协议是否安全
        const urlObj = new URL(href);
        if (!safeProtocols.includes(urlObj.protocol)) {
            // 如果是不安全的协议，返回原始文本而不是链接
            return url;
        }
        
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// 添加礼物 - 直接更新云端
async function addGift() {
    const name = document.getElementById('gift-name').value.trim();
    const giftPoints = parseInt(document.getElementById('gift-points').value);
    const description = document.getElementById('gift-description').value.trim();
    let imageUrl = document.getElementById('gift-image').value.trim();
    
    // 检查imageUrl是否为电商平台URL，如果是则自动提取商品图片
    if (isEcommerceUrl(imageUrl)) {
        console.log('检测到电商平台URL，尝试提取商品图片...');
        const extractedImage = await extractProductImageFromUrl(imageUrl);
        if (extractedImage) {
            imageUrl = extractedImage;
            console.log('成功提取商品图片:', imageUrl);
        }
    }
    
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
    
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
            if (!supabase) {
                throw new Error('Supabase客户端初始化失败');
            }
        }
        
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user.user) {
            throw new Error('用户未登录');
        }
        
        // 先从云端获取最新数据
        await loadDataFromCloud();
        
        const originalInputUrl = document.getElementById('gift-image').value.trim();
        // 将描述转换为HTML格式（包含可点击链接）
        const descriptionHtml = textToHtmlWithLinks(description);
        
        const gift = {
            name: name,
            points: giftPoints,
            description: description, // 存储原始文本描述
            description_html: descriptionHtml, // 存储转换后的HTML描述
            image_url: imageUrl,
            original_url: originalInputUrl, // 存储原始输入的URL（可能是电商URL）
            created_at: new Date().toISOString()
        };
        
        // 添加到本地数组
        gifts.unshift(gift);
        
        // 更新云端数据
        await supabase
            .from('gifts')
            .insert({
                user_id: user.user.id,
                name: name,
                points: giftPoints,
                description: description,
                created_at: gift.created_at
            });
        
        console.log('礼物已添加到云端');
        
        // 数据已保存在云端，无需本地存储
        
        // 更新UI
        updateGiftList();
        
        // 清空输入
        document.getElementById('gift-name').value = '';
        document.getElementById('gift-points').value = '';
        document.getElementById('gift-description').value = '';
        document.getElementById('gift-image').value = '';
        document.getElementById('gift-name').focus();
        
        showTemporaryMessage(`🎁 礼物 "${escapeHtml(name)}" 添加成功！`, 'success');
        
    } catch (error) {
        console.error('添加礼物失败:', error);
        showTemporaryMessage('添加礼物失败', 'error');
    }
}

// 设置预设行为
function setPresetBehavior(description, points) {
    const descInput = document.getElementById('behavior-desc');
    const pointsInput = document.getElementById('points-change');
    
    if (descInput && pointsInput) {
        descInput.value = description;
        pointsInput.value = points;
        
        // 给输入框添加视觉反馈
        descInput.style.borderColor = '#4CAF50';
        pointsInput.style.borderColor = '#4CAF50';
        
        // 2秒后恢复正常边框颜色
        setTimeout(() => {
            descInput.style.borderColor = '';
            pointsInput.style.borderColor = '';
        }, 2000);
    }
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

// 兑换礼物 - 直接更新云端
async function redeemGift(giftId) {
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
            if (!supabase) {
                throw new Error('Supabase客户端初始化失败');
            }
        }
        
        const { data: user, error: userError } = await supabase.auth.getUser();
        if (userError || !user.user) {
            throw new Error('用户未登录');
        }
        
        // 先从云端获取最新数据
        await loadDataFromCloud();
        
        // 确保giftId是数字类型
        const id = typeof giftId === 'string' ? parseInt(giftId) : giftId;
        
        // 查找礼物，先按ID查找，如果找不到再按索引查找
        let gift = gifts.find(g => g.id === id);
        if (!gift) {
            gift = gifts[id]; // 按索引查找
        }
        
        if (!gift) {
            showTemporaryMessage('❌ 礼物不存在！', 'error');
            return;
        }

        if (currentPoints < gift.points) {
            showTemporaryMessage('❌ 积分不足！', 'error');
            return;
        }

        // 确认兑换
        const confirmed = confirm(`确定要兑换 "${escapeHtml(gift.name)}" 吗？这将消耗 ${gift.points} 分。`);
        if (!confirmed) return;

        // 更新本地数据
        currentPoints -= gift.points;
        const localRedeemDate = new Date().toLocaleString('zh-CN');
        redeemedGifts.push({
            name: gift.name,
            points: gift.points,
            description: gift.description || '',
            description_html: gift.description_html || '', // 保留HTML格式的描述（包含可点击链接）
            image_url: gift.image_url || '',
            original_url: gift.original_url || '', // 添加原始电商URL
            redeem_date: localRedeemDate
        });
        
        // 从本地礼物列表中移除
        const indexToRemove = gifts.findIndex(g => g.id === gift.id);
        if (indexToRemove !== -1) {
            gifts.splice(indexToRemove, 1);
        } else {
            const indexByPosition = gifts.indexOf(gift);
            if (indexByPosition !== -1) {
                gifts.splice(indexByPosition, 1);
            }
        }
        
        // 数据已保存在云端，无需本地存储
        
        // 更新UI
        updatePointsDisplay();
        updateGiftList();
        updateRedeemedList();
        
        // 同步到云端
        const now = new Date().toISOString();
        const { error: transactionError } = await supabase.rpc('execute_transaction', {
            user_id_param: user.user.id,
            gift_id_param: gift.id,
            gift_name_param: gift.name,
            gift_points_param: gift.points,
            gift_description_param: gift.description || '',
            redeem_date_param: now,
            current_points_param: currentPoints
        });

        if (transactionError) throw transactionError;
        showTemporaryMessage('🎉 兑换成功！', 'success');
        
    } catch (error) {
        console.error('兑换礼物失败:', error);
        showTemporaryMessage('兑换礼物失败', 'error');
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


// 更新认证UI状态
function updateAuthUI(user) {
    // 检查当前页面
    const currentPage = window.location.pathname.split('/').pop();
    
    // 如果在登录页面，只处理已登录用户的情况
    if (currentPage === 'login.html') {
        if (user) {
            window.location.href = 'index.html';
        }
        return;
    }
    
    // 在主页处理UI更新
    const loggedIn = document.getElementById('logged-in');
    const userEmail = document.getElementById('user-email');
    
    if (user) {
        // 用户已登录，更新UI显示用户信息
        if (loggedIn) loggedIn.style.display = 'block';
        if (userEmail) userEmail.textContent = user.email;
    } else {
        // 用户未登录，显示登录状态
        if (loggedIn) loggedIn.style.display = 'none';
    }
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


// 显示未登录状态
function showNotLoggedInState() {
    console.log('Script.js: 显示未登录状态');
    
    // 隐藏所有需要登录的内容
    const pointsSection = document.getElementById('points-section');
    const giftsSection = document.getElementById('gifts-section');
    const redeemedSection = document.getElementById('redeemed-section');
    const loggedInState = document.getElementById('logged-in-state');
    const notLoggedInState = document.getElementById('not-logged-in-state');
    
    if (pointsSection) pointsSection.style.display = 'none';
    if (giftsSection) giftsSection.style.display = 'none';
    if (redeemedSection) redeemedSection.style.display = 'none';
    if (loggedInState) loggedInState.style.display = 'none';
    
    // 显示未登录提示
    if (notLoggedInState) {
        notLoggedInState.style.display = 'block';
    }
    
    console.log('Script.js: 未登录状态UI已显示');
}

// 显示已登录状态
function showLoggedInState(user) {
    console.log('Script.js: 显示已登录状态:', user.email);
    
    // 显示所有需要登录的内容
    const pointsSection = document.getElementById('points-section');
    const giftsSection = document.getElementById('gifts-section');
    const redeemedSection = document.getElementById('redeemed-section');
    const loggedInState = document.getElementById('logged-in-state');
    const notLoggedInState = document.getElementById('not-logged-in-state');
    
    if (pointsSection) pointsSection.style.display = 'block';
    if (giftsSection) giftsSection.style.display = 'block';
    if (redeemedSection) redeemedSection.style.display = 'block';
    if (loggedInState) loggedInState.style.display = 'block';
    
    // 隐藏未登录提示
    if (notLoggedInState) {
        notLoggedInState.style.display = 'none';
    }
    
    console.log('Script.js: 已登录状态UI已显示');
}

// 初始化应用 - 仅云端加载数据
async function initializeApp() {
    try {
        console.log('Script.js: 开始初始化应用...');
        
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
            if (!supabase) {
                console.error('Script.js: Supabase初始化失败');
                showTemporaryMessage('❌ 数据库连接失败', 'error');
                return;
            }
        }
        
        // 直接通过Supabase检查登录状态
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
            // 用户未登录，显示未登录状态
            console.log('Script.js: 用户未登录');
            showNotLoggedInState();
            return;
        }
        
        // 用户已登录
        currentUser = { email: user.email, id: user.id };
        console.log('Script.js: 用户已登录:', user.email);
        
        // 仅从云端加载数据
        await loadDataFromCloud();
        console.log('Script.js: 云端数据加载成功');
        
        showLoggedInState(currentUser);
        
        // 更新UI
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        console.log('Script.js: 应用初始化完成');
        
    } catch (error) {
        console.error('Script.js: 应用初始化失败:', error);
        showTemporaryMessage('❌ 应用初始化失败，请刷新页面重试', 'error');
    }
}

// 从云端加载用户数据
async function loadDataFromCloud() {
    console.log('Script.js: 开始从云端加载用户数据...');
    
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
            if (!supabase) {
                throw new Error('Supabase客户端初始化失败');
            }
        }
        
        // 获取当前用户
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('Script.js: 获取用户信息失败:', userError);
            throw new Error('用户未登录');
        }
        
        console.log('Script.js: 当前用户:', user.email);
        
        // 并行加载所有用户数据
        const [
            profileResponse,
            behaviorsResponse,
            giftsResponse,
            redeemedGiftsResponse
        ] = await Promise.all([
            // 加载用户档案
            supabase
                .from('profiles')
                .select('current_points, total_points')
                .eq('id', user.id)
                .single(),
            
            // 加载行为记录
            supabase
                .from('behaviors')
                .select('description, points, timestamp')
                .eq('user_id', user.id)
                .order('timestamp', { ascending: false }),
            
            // 加载礼物列表
            supabase
                .from('gifts')
                .select('id, name, points, description, created_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
            
            // 加载已兑换礼物
            supabase
                .from('redeemed_gifts')
                .select('name, points, description, redeem_date')
                .eq('user_id', user.id)
                .order('redeem_date', { ascending: false })
        ]);
        
        // 处理响应数据
        const profile = profileResponse.data;
        const behaviorsData = behaviorsResponse.data || [];
        const giftsData = giftsResponse.data || [];
        const redeemedGiftsData = redeemedGiftsResponse.data || [];
        
        console.log('Script.js: 数据加载成功:');
        console.log('- 档案:', profile ? `当前积分: ${profile.current_points}, 总积分: ${profile.total_points}` : '无档案');
        console.log('- 行为记录:', behaviorsData.length, '条');
        console.log('- 礼物:', giftsData.length, '个');
        console.log('- 已兑换礼物:', redeemedGiftsData.length, '个');
        
        // 更新本地数据
        if (profile) {
            currentPoints = profile.current_points || 0;
            totalPoints = profile.total_points || 0;
        }
        behaviors = behaviorsData;
        
        // 处理礼物数据，添加description_html字段
        gifts = giftsData.map(gift => ({
            ...gift,
            description_html: gift.description ? textToHtmlWithLinks(gift.description) : '',
            // 添加其他必要的本地字段，使用默认值
            image_url: gift.image_url || '',
            original_url: gift.original_url || ''
        }));
        
        // 处理已兑换礼物数据，添加description_html字段
        redeemedGifts = redeemedGiftsData.map(gift => ({
            ...gift,
            description_html: gift.description ? textToHtmlWithLinks(gift.description) : '',
            // 添加其他必要的本地字段，使用默认值
            image_url: gift.image_url || '',
            original_url: gift.original_url || ''
        }));
        
        console.log('Script.js: 云端数据加载完成');
        return true;
        
    } catch (error) {
        console.error('Script.js: 从云端加载数据失败:', error);
        throw error;
    }
}

// 从sessionStorage加载数据 - 登录页面存储的数据
function loadDataFromSessionStorage() {
    console.log('从sessionStorage加载数据...');
    
    // 加载业务数据
    const savedCurrentPoints = sessionStorage.getItem('currentPoints');
    const savedTotalPoints = sessionStorage.getItem('totalPoints');
    const savedBehaviors = sessionStorage.getItem('behaviors');
    const savedGifts = sessionStorage.getItem('gifts');
    const savedRedeemedGifts = sessionStorage.getItem('redeemedGifts');
    
    if (savedCurrentPoints) currentPoints = parseInt(savedCurrentPoints) || 0;
    if (savedTotalPoints) totalPoints = parseInt(savedTotalPoints) || 0;
    if (savedBehaviors) {
        try {
            behaviors = JSON.parse(savedBehaviors);
        } catch (e) {
            console.warn('解析行为数据失败:', e);
            behaviors = [];
        }
    }
    if (savedGifts) {
        try {
            gifts = JSON.parse(savedGifts);
        } catch (e) {
            console.warn('解析礼物数据失败:', e);
            gifts = [];
        }
    }
    if (savedRedeemedGifts) {
        try {
            redeemedGifts = JSON.parse(savedRedeemedGifts);
        } catch (e) {
            console.warn('解析已兑换礼物数据失败:', e);
            redeemedGifts = [];
        }
    }
    
    console.log('sessionStorage数据加载完成');
}

// 移除loadDataFromCloud函数 - 数据加载逻辑全部移至login页面

// 数据保存到云端 - 移除本地存储依赖
async function saveDataToCloud() {
    console.log('保存数据到云端...');
    
    try {
        // 确保Supabase客户端已初始化
        if (!supabase) {
            console.log('Script.js: 初始化Supabase客户端...');
            supabase = initializeSupabase();
            if (!supabase) {
                throw new Error('Supabase客户端初始化失败');
            }
        }
        
        const { data: user, error } = await supabase.auth.getUser();
        if (error || !user) {
            throw new Error('用户未登录');
        }
        
        // 并行更新所有数据
        await Promise.all([
            // 更新用户档案
            supabase
                .from('profiles')
                .update({ 
                    current_points: currentPoints,
                    total_points: totalPoints,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.user.id),
            
            // 这里可以添加其他数据表的更新逻辑
            // 行为记录、礼物列表等通常不需要全量更新
        ]);
        
        console.log('云端数据保存完成');
        
    } catch (error) {
        console.error('保存到云端失败:', error);
        throw error;
    }
}


// 移除复杂的Supabase初始化逻辑 - 认证逻辑全部移至login页面


// 页面加载完成后的初始化 - 简化版本
document.addEventListener('DOMContentLoaded', async function() {
    console.log('=== Script.js: 页面加载完成，开始初始化应用 ===');
    
    // 检查当前页面
    const currentPage = window.location.pathname.split('/').pop();
    console.log('Script.js: 当前页面:', currentPage);
    
    // 只在主页执行应用初始化
    if (currentPage === 'index.html' || currentPage === '') {
        console.log('Script.js: 在主页，开始初始化应用...');
        await initializeApp();
    }
});

// Tab 切换功能
function switchTab(tabId) {
    // 隐藏所有标签页内容
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // 移除所有标签按钮的激活状态
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // 显示选中的标签页
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // 激活对应的标签按钮
    const selectedButton = document.querySelector(`[onclick="switchTab('${tabId}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    
    console.log('切换到标签页:', tabId);
}