// Hostinger MySQL API Client

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


// ── Constants ──
const MAX_POINTS = 10000;
const MAX_GIFT_POINTS = 100000;
const MAX_BEHAVIOR_DESC_LENGTH = 1000;
const MAX_GIFT_NAME_LENGTH = 255;
const MAX_GIFT_DESC_LENGTH = 2000;
const MAX_IMAGE_URL_LENGTH = 2048;
const BEHAVIOR_PAGE_SIZE = 500;
const DEBUG = false;

// Conditional logger — only logs when DEBUG is true
function log(...args) { if (DEBUG) console.log(...args); }

// ── State ──
let currentPoints = 0;
let totalPoints = 0;
let behaviors = [];
let gifts = [];
let redeemedGifts = [];
let diaryEntries = [];

// 当前登录用户信息
let currentUser = null;

// 用户登出
async function signOut() {
    try {
        console.log('开始执行登出流程...');
        
        await api.logout();
        
        sessionStorage.clear();
        
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_email');
        
        currentPoints = 0;
        totalPoints = 0;
        behaviors = [];
        gifts = [];
        redeemedGifts = [];
        currentUser = null;
        
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        updateRedeemedList();
        
        updateAuthUI(null);
        
        console.log('登出流程完成');
        showTemporaryMessage(t('common.logoutSuccess'), 'success');

        // 2秒后跳转到登录页面
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);

    } catch (error) {
        console.error('登出过程中发生错误:', error);
        showTemporaryMessage(`${t('common.logoutFailed')}: ${escapeHtml(error.message)}`, 'error');
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
        emptyMessage.innerHTML = t('common.noBehaviorRecords');
        logContainer.appendChild(emptyMessage);
        return;
    }
    
    // 创建统计卡片
    const statsDiv = document.createElement('div');
    statsDiv.className = 'behavior-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <div class="stat-icon">📊</div>
            <div class="stat-text">${t('common.totalRecords')}: ${totalBehaviors}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">✅</div>
            <div class="stat-text">${t('common.pointsEarned')}: +${totalPointsGained}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon">❌</div>
            <div class="stat-text">${t('common.pointsDeducted')}: ${totalPointsLost}</div>
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
                    <span class="behavior-points ${pointsClass}">${behavior.points}</span>
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
    
    // 如果元素不存在，直接返回
    if (!giftList) {
        console.log('gift-list元素不存在，跳过更新');
        return;
    }
    
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
                    this.alt = t('common.giftImage');
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
            placeholder.textContent = t('common.gift');
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
        pointsDiv.textContent = `${t('gifts.pointsRequired').replace('{points}', gift.points)}`;
        
        infoDiv.appendChild(headerDiv);
        infoDiv.appendChild(pointsDiv);
        
        contentDiv.appendChild(imageDiv);
        contentDiv.appendChild(infoDiv);
        li.appendChild(contentDiv);
        
        // 兑换按钮
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'redeem-btn';
        redeemBtn.textContent = t('common.redeemButton');
        redeemBtn.disabled = currentPoints < gift.points;
        redeemBtn.onclick = async () => {
            await redeemGift(index);
        };
        
        li.appendChild(redeemBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '🗑';
        deleteBtn.title = 'Delete';
        deleteBtn.style.cssText = 'background:none;border:none;font-size:1.2rem;cursor:pointer;padding:4px 8px;opacity:0.5;transition:opacity 0.2s;';
        deleteBtn.onmouseenter = () => deleteBtn.style.opacity = '1';
        deleteBtn.onmouseleave = () => deleteBtn.style.opacity = '0.5';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteGift(gift.id);
        };
        li.appendChild(deleteBtn);
        giftList.appendChild(li);
    });
}

function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    const redeemedCount = document.getElementById('redeemed-count');
    
    // 如果元素不存在，直接返回
    if (!redeemedList) {
        console.log('redeemed-list元素不存在，跳过更新');
        return;
    }
    
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
        emptyMessage.innerHTML = t('common.noRedeemedRecords');
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
            <span class="stat-text">${t('common.totalRedeemed')} ${redeemedGifts.length} ${t('common.items')}</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon">💎</span>
            <span class="stat-text">${t('common.totalPointsSpent')} ${totalRedeemedPoints} ${t('common.points')}</span>
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
                    this.alt = t('common.giftImage');
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
                    this.alt = t('common.giftImage');
                };
                imageDiv.appendChild(img);
            }
        } else {
            const placeholder = document.createElement('div');
            placeholder.className = 'redeemed-image-placeholder';
            placeholder.textContent = t('common.gift');
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
        pointsSpan.innerHTML = `<span class="points-badge">-${item.points}</span> ${t('common.points')}`;
        
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

// Helper: get locale based on current language
function getLocale() {
    return (typeof currentLanguage !== 'undefined' && currentLanguage === 'en') ? 'en-US' : 'zh-CN';
}

// 格式化兑换日期
function formatRedeemDate(dateString) {
    if (!dateString || dateString === t('common.unknownTime')) return t('common.justNow');

    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return t('common.justNow');
        if (diffMins < 60) return t('common.minutesAgo').replace('{minutes}', diffMins);
        if (diffHours < 24) return t('common.hoursAgo').replace('{hours}', diffHours);
        if (diffDays < 7) return t('common.daysAgo').replace('{days}', diffDays);

        // 超过一周显示具体日期
        return date.toLocaleDateString(getLocale(), {
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
        alert(t('common.enterBehaviorDesc'));
        document.getElementById('behavior-desc').focus();
        return;
    }

    if (isNaN(change)) {
        alert(t('common.enterValidPoints'));
        document.getElementById('points-change').focus();
        return;
    }

    if (change === 0) {
        alert(t('common.pointsCannotBeZero'));
        document.getElementById('points-change').focus();
        return;
    }
    
    const timestamp = new Date().toISOString();
    
    try {
        if (!api.getToken()) {
            throw new Error(t('common.notLoggedIn'));        }

        showLoading('Adding points...');

        const result = await api.addBehavior(desc, change);
        
        // Incremental update - no full reload needed
        currentPoints = result.current_points || currentPoints;
        totalPoints = result.total_points || totalPoints;
        
        // Add new behavior to local array
        const newBehavior = {
            id: result.id || Date.now(),
            description: desc,
            points: change,
            timestamp: new Date().toISOString()
        };
        behaviors.unshift(newBehavior);
        
        updatePointsDisplay();
        updateBehaviorLog();
        updateGiftList();
        
        document.getElementById('behavior-desc').value = '';
        document.getElementById('points-change').value = '';
        document.getElementById('behavior-desc').focus();
        
        const message = change > 0 ? 
            t('common.pointsAdded').replace('{points}', change) : 
            t('common.pointsDeductedMessage').replace('{points}', Math.abs(change));
        showTemporaryMessage(message, 'success');
        
        hideLoading();

    } catch (error) {
        console.error('添加积分失败:', error);
        hideLoading();
        showTemporaryMessage(t('common.addPointsFailed') + (error.message ? `: ${escapeHtml(error.message)}` : ''), 'error');
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
        
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`;
    });
}

// 添加礼物
async function addGift() {
    const name = document.getElementById('gift-name').value.trim();
    const giftPoints = parseInt(document.getElementById('gift-points').value);
    const description = document.getElementById('gift-description').value.trim();
    let imageUrl = document.getElementById('gift-image').value.trim();
    
    if (isEcommerceUrl(imageUrl)) {
        console.log('检测到电商平台URL，尝试提取商品图片...');
        const extractedImage = await extractProductImageFromUrl(imageUrl);
        if (extractedImage) {
            imageUrl = extractedImage;
            console.log('成功提取商品图片:', imageUrl);
        }
    }
    
    if (!name) {
        alert(t('common.enterGiftName'));
        document.getElementById('gift-name').focus();
        return;
    }

    if (isNaN(giftPoints) || giftPoints <= 0) {
        alert(t('common.enterValidPointsPositive'));
        document.getElementById('gift-points').focus();
        return;
    }
    
    try {
        if (!api.getToken()) {
            throw new Error(t('common.notLoggedIn'));        }
        
        const originalInputUrl = document.getElementById('gift-image').value.trim();
        const descriptionHtml = textToHtmlWithLinks(description);

        showLoading('Adding gift...');

        const result = await api.addGift(name, giftPoints, description, imageUrl, originalInputUrl);

        // Incremental update - add locally, no full reload
        const newGift = {
            id: result.id || Date.now(),
            name: name,
            points: giftPoints,
            description: description,
            description_html: descriptionHtml,
            image_url: imageUrl,
            original_url: originalInputUrl,
            created_at: new Date().toISOString()
        };
        gifts.unshift(newGift);

        updateGiftList();
        
        document.getElementById('gift-name').value = '';
        document.getElementById('gift-points').value = '';
        document.getElementById('gift-description').value = '';
        document.getElementById('gift-image').value = '';
        document.getElementById('gift-name').focus();

        showTemporaryMessage(t('common.addGiftSuccess').replace('{name}', escapeHtml(name)), 'success');
        
        hideLoading();

    } catch (error) {
        console.error('添加礼物失败:', error);
        hideLoading();
        showTemporaryMessage(t('common.addGiftFailed') + (error.message ? `: ${escapeHtml(error.message)}` : ''), 'error');
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

// 兑换礼物
async function redeemGift(giftId) {
    const id = typeof giftId === 'string' ? parseInt(giftId) : giftId;
    
    let gift = gifts.find(g => g.id === id);
    if (!gift) {
        gift = gifts[id];
    }
    
    if (!gift) {
        showTemporaryMessage(t('common.giftNotFound'), 'error');
        return;
    }

    if (currentPoints < gift.points) {
        showTemporaryMessage(t('common.insufficientPoints'), 'error');
        return;
    }

    const message = t('common.confirmRedeemMessage')
        .replace('{name}', escapeHtml(gift.name))
        .replace('{points}', gift.points);
    
    showConfirm(message, async () => {
        try {
            if (!api.getToken()) {
                throw new Error(t('common.notLoggedIn'));            }

            showLoading('Redeeming...');
            const result = await api.redeemGift(gift.id);
            
            // Incremental update - no full reload needed
            currentPoints = result.current_points || currentPoints;
            
            // Remove gift from local list
            gifts = gifts.filter(g => g.id !== gift.id);
            
            // Add to redeemed list
            const redeemedGift = {
                id: result.redeemed_id || Date.now(),
                name: result.redeemed_gift ? result.redeemed_gift.name : gift.name,
                points: result.redeemed_gift ? result.redeemed_gift.points : gift.points,
                image_url: result.redeemed_gift ? result.redeemed_gift.image_url : '',
                redeem_date: new Date().toISOString()
            };
            redeemedGifts.unshift(redeemedGift);

            updatePointsDisplay();
            updateGiftList();
            updateRedeemedList();

            hideLoading();
            showTemporaryMessage(t('common.redeemSuccess'), 'success');

        } catch (error) {
            console.error('兑换礼物失败:', error);
            hideLoading();
            showTemporaryMessage(t('common.redeemFailed') + (error.message ? `: ${escapeHtml(error.message)}` : ''), 'error');
        }
    });
}

// Delete a behavior record
async function deleteBehavior(behaviorId) {
    showConfirm('确定要删除这条行为记录吗？', async () => {
        try {
            showLoading('Deleting...');
            await api.deleteBehavior(behaviorId);
            // Remove from local array
            behaviors = behaviors.filter(b => b.id !== behaviorId);
            updatePointsDisplay();
            updateBehaviorLog();
            updateGiftList();
            updateDiaryList();
            hideLoading();
            showTemporaryMessage(t('common.deleted'), 'success');
        } catch (error) {
            hideLoading();
            showTemporaryMessage(t('common.deleteFailed') + ': ' + escapeHtml(error.message), 'error');
        }
    });
}

// Delete a gift
async function deleteGift(giftId) {
    showConfirm('确定要删除这个礼物吗？', async () => {
        try {
            showLoading('Deleting...');
            await api.deleteGift(giftId);
            // Remove from local array
            gifts = gifts.filter(g => g.id !== giftId);
            updateGiftList();
            updateDiaryList();
            hideLoading();
            showTemporaryMessage(t('common.deleted'), 'success');
        } catch (error) {
            hideLoading();
            showTemporaryMessage(t('common.deleteFailed') + ': ' + escapeHtml(error.message), 'error');
        }
    });
}

// 更新UI显示
function updateUI() {
    console.log('Script.js: 更新UI显示');
    updatePointsDisplay();
    updateBehaviorLog();
    updateGiftList();
    updateRedeemedList();
    updateDiaryList();
}

// 显示未登录状态
function showNotLoggedInState() {
    console.log('Script.js: 显示未登录状态');
    
    // 从sessionStorage加载本地数据
    loadDataFromSessionStorage();
    
    // 隐藏所有需要登录的内容，但保留成长日记模块可见
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
    
    // 即使在未登录状态下也显示成长日记
    updateDiaryList();
    
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
        
        initLanguage();
        
        const token = api.getToken();
        if (!token) {
            console.log('Script.js: 用户未登录');
            showNotLoggedInState();
            return;
        }
        
        const email = localStorage.getItem('user_email');
        currentUser = { email: email, id: localStorage.getItem('user_id') };
        console.log('Script.js: 用户已登录:', email);
        
        await loadDataFromCloud();
        console.log('Script.js: 云端数据加载成功');
        
        showLoggedInState(currentUser);
        
        updateUI();
        
        console.log('Script.js: 应用初始化完成');
        
    } catch (error) {
        console.error('Script.js: 应用初始化失败:', error);
        showTemporaryMessage(t('common.initFailed'), 'error');
    }
}

// 从云端加载用户数据
async function loadDataFromCloud() {
    console.log('Script.js: 开始从云端加载用户数据...');
    
    try {
        if (!api.getToken()) {
            throw new Error(t('common.notLoggedIn'));        }
        
        const [profile, behaviorsData, giftsData, redeemedGiftsData] = await Promise.all([
            api.getProfile(),
            api.getBehaviors(),
            api.getGifts(),
            api.getRedeemedGifts()
        ]);
        
        console.log('Script.js: 数据加载成功:');
        console.log('- 档案:', profile ? `当前积分: ${profile.current_points}, 总积分: ${profile.total_points}` : '无档案');
        console.log('- 行为记录:', behaviorsData.length, '条');
        console.log('- 礼物:', giftsData.length, '个');
        console.log('- 已兑换礼物:', redeemedGiftsData.length, '个');
        
        if (profile) {
            currentPoints = profile.current_points || 0;
            totalPoints = profile.total_points || 0;
        }
        behaviors = behaviorsData || [];
        
        gifts = (giftsData || []).map(gift => ({
            ...gift,
            description_html: gift.description ? textToHtmlWithLinks(gift.description) : '',
            image_url: gift.image_url || '',
            original_url: gift.original_url || ''
        }));
        
        redeemedGifts = (redeemedGiftsData || []).map(gift => ({
            ...gift,
            description_html: gift.description ? textToHtmlWithLinks(gift.description) : '',
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

// 模块切换功能
function showModule(moduleId) {
    // 隐藏所有模块内容
    const moduleContents = document.querySelectorAll('.module-content');
    moduleContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // 移除所有模块卡片的激活状态
    const moduleCards = document.querySelectorAll('.module-card');
    moduleCards.forEach(card => {
        card.classList.remove('active');
    });
    
    // 显示选中的模块
    const selectedModule = document.getElementById(moduleId);
    if (selectedModule) {
        selectedModule.classList.add('active');
    }
    
    // 激活对应的模块卡片
    const selectedCard = document.querySelector(`[onclick="showModule('${moduleId}')"]`);
    if (selectedCard) {
        selectedCard.classList.add('active');
    }
    
    console.log('切换到模块:', moduleId);
}

// 更新成长日记列表
function updateDiaryList() {
    const diaryList = document.getElementById('diary-list');
    if (!diaryList) {
        console.log('updateDiaryList: diary-list 元素未找到');
        return;
    }
    
    console.log('updateDiaryList: 开始更新成长日记');
    console.log('updateDiaryList: 行为记录数量:', behaviors ? behaviors.length : 0);
    console.log('updateDiaryList: 已兑换礼物数量:', redeemedGifts ? redeemedGifts.length : 0);
    
    if ((!behaviors || behaviors.length === 0) && (!redeemedGifts || redeemedGifts.length === 0)) {
        diaryList.innerHTML = `<p style="text-align: center; color: #666; padding: 20px;">${t('common.noDiaryRecords')}</p>`;
        return;
    }
    
    let html = '';
    
    // 创建响应式容器
    html += '<div style="display: flex; gap: 20px; flex-wrap: wrap;">';
    
    // 行为记录列表
    if (behaviors && behaviors.length > 0) {
        // 按日期分组行为记录
        const behaviorsByDate = {};
        behaviors.forEach(behavior => {
            const date = new Date(behavior.timestamp).toLocaleDateString(getLocale());
            if (!behaviorsByDate[date]) {
                behaviorsByDate[date] = [];
            }
            behaviorsByDate[date].push(behavior);
        });
        
        // 按日期排序
        const sortedBehaviorDates = Object.keys(behaviorsByDate).sort((a, b) => new Date(b) - new Date(a));
        
        html += '<div class="diary-section" style="flex: 1; min-width: 300px;">';
        html += `<h3 style="color: #4CAF50; margin-bottom: 15px; font-size: 18px;">📋 ${t('behaviors.title')}</h3>`;
        
        sortedBehaviorDates.forEach(date => {
            const dayBehaviors = behaviorsByDate[date];
            const dayPoints = dayBehaviors.reduce((sum, b) => sum + b.points, 0);
            
            html += `
                <div class="diary-entry">
                    <div class="diary-date">${date} <span class="diary-points">${dayPoints > 0 ? '+' : ''}${dayPoints} ${t('common.points')}</span></div>
                    <div class="diary-content">
            `;
            
            dayBehaviors.forEach(behavior => {
                const escapedDesc = escapeHtml(behavior.description || '');
                html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: ${behavior.points > 0 ? '#f8fff8' : '#fff8f8'}; border-left: 3px solid ${behavior.points > 0 ? '#4CAF50' : '#f44336'}; border-radius: 4px; position:relative;">
                        <span style="color: ${behavior.points > 0 ? '#4CAF50' : '#f44336'}; font-weight: bold;">${behavior.points > 0 ? '+' : ''}${behavior.points}</span>
                        - ${escapedDesc}
                        <button onclick="deleteBehavior(${behavior.id})" style="position:absolute;top:6px;right:6px;background:none;border:none;font-size:0.9rem;cursor:pointer;opacity:0.4;padding:2px 4px;" onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.4'" title="Delete">🗑</button>
                        <small style="color: #666; display: block; margin-top: 2px;">${new Date(behavior.timestamp).toLocaleTimeString(getLocale(), {hour: '2-digit', minute: '2-digit'})}</small>
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        html += '</div>';
    }
    
    // 已兑换礼物列表
    if (redeemedGifts && redeemedGifts.length > 0) {
        // 按日期分组已兑换礼物
        const giftsByDate = {};
        redeemedGifts.forEach(gift => {
            const date = new Date(gift.redeem_date).toLocaleDateString(getLocale());
            if (!giftsByDate[date]) {
                giftsByDate[date] = [];
            }
            giftsByDate[date].push(gift);
        });
        
        // 按日期排序
        const sortedGiftDates = Object.keys(giftsByDate).sort((a, b) => new Date(b) - new Date(a));
        
        html += '<div class="diary-section" style="flex: 1; min-width: 300px;">';
        html += `<h3 style="color: #ff9800; margin-bottom: 15px; font-size: 18px;">🎁 ${t('redeemed.title')}</h3>`;
        
        sortedGiftDates.forEach(date => {
            const dayGifts = giftsByDate[date];
            const dayPoints = dayGifts.reduce((sum, g) => sum + g.points, 0);
            
            html += `
                <div class="diary-entry">
                    <div class="diary-date">${date} <span class="diary-points">-${dayPoints} ${t('common.points')}</span></div>
                    <div class="diary-content">
            `;
            
            dayGifts.forEach(gift => {
                const escapedName = escapeHtml(gift.name || '');
                html += `
                    <div style="margin-bottom: 8px; padding: 8px; background: #fff8f0; border-left: 3px solid #ff9800; border-radius: 4px;">
                        <span style="color: #ff5722; font-weight: bold;">-${gift.points}</span>
                        - 🏆 ${escapedName}
                        <small style="color: #666; display: block; margin-top: 2px;">${new Date(gift.redeem_date).toLocaleTimeString(getLocale(), {hour: '2-digit', minute: '2-digit'})}</small>
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        html += '</div>';
    }
    
    html += '</div>'; // 关闭响应式容器
    
    console.log('updateDiaryList: 生成的HTML长度:', html.length);
    diaryList.innerHTML = html;
}