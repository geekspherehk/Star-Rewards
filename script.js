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

// 多孩档案
let profiles = [];
let selectedProfileId = null;

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

// 连续打卡天数（streak）
function updateStreak() {
    const streakEl = document.getElementById('streak-count');
    if (!streakEl) return;
    streakEl.textContent = calculateStreak(behaviors);
}

function calculateStreak(behaviorList) {
    if (!Array.isArray(behaviorList) || behaviorList.length === 0) return 0;
    const daySet = new Set();
    behaviorList.forEach(b => {
        if (b && b.timestamp) {
            const d = new Date(b.timestamp);
            if (!isNaN(d)) daySet.add(d.toDateString());
        }
    });
    if (daySet.size === 0) return 0;

    // 从今天开始往回数连续天数；今天没记录则从昨天开始
    let streak = 0;
    let cursor = new Date();
    if (!daySet.has(cursor.toDateString())) {
        cursor.setDate(cursor.getDate() - 1);
    }
    while (daySet.has(cursor.toDateString())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

// ── 成就徽章系统（从现有数据计算，无需额外存储）──
const ACHIEVEMENTS = [
    { id: 'first_star', icon: '⭐', metric: 'behaviors', target: 1 },
    { id: 'ten_actions', icon: '🌱', metric: 'behaviors', target: 10 },
    { id: 'fifty_actions', icon: '🌳', metric: 'behaviors', target: 50 },
    { id: 'hundred_points', icon: '💯', metric: 'totalPoints', target: 100 },
    { id: 'five_hundred', icon: '🏅', metric: 'totalPoints', target: 500 },
    { id: 'thousand_pts', icon: '👑', metric: 'currentPoints', target: 1000 },
    { id: 'streak3', icon: '🔥', metric: 'streak', target: 3 },
    { id: 'streak7', icon: '⚡', metric: 'streak', target: 7 },
    { id: 'streak30', icon: '📅', metric: 'streak', target: 30 },
    { id: 'first_redeem', icon: '🎁', metric: 'redeemed', target: 1 },
    { id: 'five_redeems', icon: '🎉', metric: 'redeemed', target: 5 },
    { id: 'multi_child', icon: '👨‍👩‍👧', metric: 'profiles', target: 2 },
    { id: 'variety', icon: '🎨', metric: 'days', target: 5 }
];

function computeAchievements() {
    const behaviorList = Array.isArray(behaviors) ? behaviors : [];
    const redeemedList = Array.isArray(redeemedGifts) ? redeemedGifts : [];
    const profileList = Array.isArray(profiles) ? profiles : [];

    const daySet = new Set();
    behaviorList.forEach(b => {
        if (b && b.timestamp) {
            const d = new Date(b.timestamp);
            if (!isNaN(d)) daySet.add(d.toDateString());
        }
    });

    const metrics = {
        behaviors: behaviorList.length,
        totalPoints: Number(totalPoints) || 0,
        currentPoints: Number(currentPoints) || 0,
        streak: calculateStreak(behaviorList),
        redeemed: redeemedList.length,
        profiles: profileList.length,
        days: daySet.size
    };

    return ACHIEVEMENTS.map(a => {
        const current = metrics[a.metric] || 0;
        return {
            ...a,
            current: current,
            unlocked: current >= a.target,
            pct: Math.min(100, Math.round(current / a.target * 100))
        };
    });
}

function renderAchievements() {
    const grid = document.getElementById('achievements-grid');
    if (!grid) return;

    const list = computeAchievements();
    const unlockedCount = list.filter(a => a.unlocked).length;

    const titleEl = document.getElementById('achievements-title');
    if (titleEl) titleEl.textContent = `${t('home.achievements.title')} (${unlockedCount}/${list.length})`;

    // 新解锁检测（首次打开把当前已解锁设为基线，不弹提示）
    const baseKey = `sr_ach_${localStorage.getItem('user_id') || 'x'}_${selectedProfileId || 'x'}`;
    let known = [];
    try { known = JSON.parse(localStorage.getItem(baseKey) || '[]'); } catch (e) { /* ignore */ }
    const unlockedIds = list.filter(a => a.unlocked).map(a => a.id);
    const newly = unlockedIds.filter(id => !known.includes(id));
    try { localStorage.setItem(baseKey, JSON.stringify(unlockedIds)); } catch (e) { /* ignore */ }

    grid.innerHTML = '';
    list.forEach(a => {
        const card = document.createElement('div');
        card.className = 'achievement-card' + (a.unlocked ? ' unlocked' : ' locked');
        card.innerHTML = `
            <div class="achievement-icon">${a.icon}</div>
            <div class="achievement-name">${escapeHtml(t('home.achievements.' + a.id + '.name'))}</div>
            <div class="achievement-desc">${escapeHtml(t('home.achievements.' + a.id + '.desc'))}</div>
            ${a.unlocked
                ? `<div class="achievement-state">✓ ${t('home.achievements.unlocked')}</div>`
                : `<div class="achievement-progress"><div class="achievement-progress-bar" style="width:${a.pct}%"></div></div>
                   <div class="achievement-progress-text">${t('home.achievements.progress', { current: a.current, target: a.target })}</div>`}
        `;
        grid.appendChild(card);
    });

    // 新解锁的徽章依次弹出祝贺（最多 3 个，避免轰炸）
    newly.slice(0, 3).forEach((id, i) => {
        setTimeout(() => {
            const badge = list.find(a => a.id === id);
            if (badge) {
                showTemporaryMessage(`🏆 ${badge.icon} ${t('home.achievements.' + id + '.name')} ${t('home.achievements.unlocked')}！`, 'success');
            }
        }, 400 * (i + 1));
    });
}

// 导出当前孩子的数据为 CSV（含汇总 + 行为记录 + 兑换记录）
function exportData() {
    try {
        const rows = [];
        rows.push(['Star Rewards', new Date().toLocaleString()]);
        rows.push([]);
        rows.push([t('home.exportSummary')]);
        rows.push([t('home.currentPoints'), currentPoints]);
        rows.push([t('home.totalPoints'), totalPoints]);
        rows.push([t('home.streakDays'), calculateStreak(behaviors)]);
        rows.push([t('home.exportBehaviorCount'), (Array.isArray(behaviors) ? behaviors : []).length]);
        rows.push([t('home.exportRedeemedCount'), (Array.isArray(redeemedGifts) ? redeemedGifts : []).length]);
        rows.push([]);
        rows.push([t('behaviors.title')]);
        rows.push([t('behaviors.date'), t('behaviors.description'), t('behaviors.points')]);
        (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
            rows.push([b.timestamp ? new Date(b.timestamp).toLocaleString() : '', b.description || '', b.points]);
        });
        rows.push([]);
        rows.push([t('home.redeemed')]);
        rows.push([t('behaviors.date'), t('gifts.name'), t('gifts.points')]);
        (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
            const d = r.redeem_date || r.created_at;
            rows.push([d ? new Date(d).toLocaleString() : '', r.name || '', r.points]);
        });

        const csv = '\uFEFF' + rows.map(row => row.map(cell => {
            const s = String(cell ?? '');
            return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',')).join('\r\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const profileName = (Array.isArray(profiles) ? profiles : []).find(p => p.id === selectedProfileId) || {};
        a.href = url;
        a.download = `star-rewards_${(profileName.name || 'child').replace(/[^\w\u4e00-\u9fa5-]/g, '')}_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showTemporaryMessage(t('home.exportSuccess'), 'success');
    } catch (error) {
        console.error('导出数据失败:', error);
        showTemporaryMessage(t('home.exportFailed'), 'error');
    }
}

// 积分趋势图（Chart.js）
let pointsChart = null;

function renderPointsChart() {
    const canvas = document.getElementById('points-chart');
    const container = document.getElementById('chart-container');
    if (!canvas || !container) return;

    // 收集所有积分变动事件：行为加减分 + 兑换扣分（负向）
    const events = [];
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        if (b && b.timestamp) {
            const d = new Date(b.timestamp);
            if (!isNaN(d)) events.push({ date: d, delta: Number(b.points) || 0 });
        }
    });
    (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
        const dateStr = r.redeem_date || r.created_at;
        if (dateStr) {
            const d = new Date(dateStr);
            if (!isNaN(d)) events.push({ date: d, delta: -(Number(r.points) || 0) });
        }
    });

    // 没有任何变动记录时不显示图表
    if (events.length === 0) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    if (typeof Chart === 'undefined') {
        container.style.display = 'none';
        return;
    }

    // 按天聚合积分变动
    const dayMap = {};
    events.forEach(e => {
        const key = e.date.toDateString();
        dayMap[key] = (dayMap[key] || 0) + e.delta;
    });

    // 从最早记录日到今天逐日累计，曲线终点 = 当前积分
    const dayKeys = Object.keys(dayMap).map(k => new Date(k));
    const start = new Date(Math.min(...dayKeys));
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(0, 0, 0, 0);

    const fmt = typeof currentLanguage !== 'undefined' && currentLanguage === 'en' ? 'en-US' : 'zh-CN';
    const labels = [];
    const cumulativeData = [];
    let cumulative = 0;
    const cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard < 730) { // 最多 2 年，防死循环
        cumulative += dayMap[cursor.toDateString()] || 0;
        labels.push(cursor.toLocaleDateString(fmt, { month: 'numeric', day: 'numeric' }));
        cumulativeData.push(cumulative);
        cursor.setDate(cursor.getDate() + 1);
        guard++;
    }

    const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const textColor = isDark ? '#e0e0e0' : '#555';
    const gridColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

    if (pointsChart) {
        pointsChart.destroy();
    }

    pointsChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: t('home.currentPoints'),
                data: cumulativeData,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.12)',
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    ticks: { color: textColor, maxTicksLimit: 8, maxRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                    beginAtZero: true
                }
            }
        }
    });
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

    // 空状态引导
    if (gifts.length === 0) {
        const emptyMessage = document.createElement('li');
        emptyMessage.className = 'empty-behavior-message';
        emptyMessage.innerHTML = t('gifts.emptyHint');
        giftList.appendChild(emptyMessage);
    }
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
        updateStreak();
        renderPointsChart();
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

// 从商品链接一键导入标题与图片
async function importProductInfo() {
    const linkInput = document.getElementById('gift-link');
    const url = linkInput ? linkInput.value.trim() : '';
    if (!url) {
        alert(t('gifts.linkRequired'));
        if (linkInput) linkInput.focus();
        return;
    }
    if (!api.getToken()) {
        showTemporaryMessage(t('common.notLoggedIn'), 'error');
        return;
    }

    const btn = document.querySelector('.import-btn');
    if (btn) { btn.disabled = true; btn.textContent = t('gifts.importing'); }
    try {
        const info = await api.fetchProductInfo(url);
        if (!info || (!info.title && !info.image_url)) {
            throw new Error(t('gifts.importNoData'));
        }

        const nameInput = document.getElementById('gift-name');
        if (info.title && nameInput && !nameInput.value.trim()) {
            nameInput.value = info.title;
        }

        const imageInput = document.getElementById('gift-image');
        if (info.image_url && imageInput) {
            imageInput.value = info.image_url;
        }

        const preview = document.getElementById('gift-image-preview');
        if (preview) {
            if (info.image_url) {
                preview.src = info.image_url;
                preview.style.display = 'inline-block';
                preview.onerror = function () { this.style.display = 'none'; };
            } else {
                preview.style.display = 'none';
            }
        }

        showTemporaryMessage(t('gifts.importSuccess'), 'success');
    } catch (error) {
        console.error('导入商品信息失败:', error);
        showTemporaryMessage(`${t('gifts.importFailed')}: ${escapeHtml(error.message)}`, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = t('gifts.importButton'); }
    }
}

// 添加礼物
async function addGift() {
    const name = document.getElementById('gift-name').value.trim();
    const giftPoints = parseInt(document.getElementById('gift-points').value);
    const description = document.getElementById('gift-description').value.trim();
    const imageUrl = document.getElementById('gift-image').value.trim();
    const originalUrl = document.getElementById('gift-link') ? document.getElementById('gift-link').value.trim() : '';

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
        
        const descriptionHtml = textToHtmlWithLinks(description);

        showLoading('Adding gift...');

        const result = await api.addGift(name, giftPoints, description, imageUrl, originalUrl);

        // Incremental update - add locally, no full reload
        const newGift = {
            id: result.id || Date.now(),
            name: name,
            points: giftPoints,
            description: description,
            description_html: descriptionHtml,
            image_url: imageUrl,
            original_url: originalUrl,
            created_at: new Date().toISOString()
        };
        gifts.unshift(newGift);

        updateGiftList();
        
        document.getElementById('gift-name').value = '';
        document.getElementById('gift-points').value = '';
        document.getElementById('gift-description').value = '';
        document.getElementById('gift-image').value = '';
        if (document.getElementById('gift-link')) document.getElementById('gift-link').value = '';
        const preview = document.getElementById('gift-image-preview');
        if (preview) preview.style.display = 'none';
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
            updateStreak();
            renderPointsChart();
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
    updateStreak();
    renderPointsChart();
    renderAchievements();
    updateBehaviorLog();
    updateGiftList();
    updateRedeemedList();
    updateDiaryList();
    updateWelcomeBanner();
}

// 新用户空状态引导横幅
function updateWelcomeBanner() {
    const banner = document.getElementById('welcome-banner');
    if (!banner) return;
    const isNewProfile = (Array.isArray(behaviors) ? behaviors : []).length === 0 && !totalPoints;
    banner.style.display = isNewProfile ? 'flex' : 'none';
}

function focusBehaviorForm() {
    const input = document.getElementById('behavior-desc');
    if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => input.focus(), 300);
    }
}

// 显示未登录状态
function showNotLoggedInState() {
    console.log('Script.js: 显示未登录状态');
    
    // 从sessionStorage加载本地数据
    loadDataFromSessionStorage();
    
    // 成就也从本地演示数据计算
    renderAchievements();
    
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
        
        const [profile, profilesData, behaviorsData, giftsData, redeemedGiftsData] = await Promise.all([
            api.getProfile(),
            api.getProfiles(),
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
        profiles = profilesData || [];
        if (profile && profile.id) {
            selectedProfileId = profile.id;
            api.setSelectedProfileId(profile.id);
        }
        renderProfileSwitcher();
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

// ── 多孩档案切换 ──
function renderProfileSwitcher() {
    const container = document.getElementById('profile-switcher');
    if (!container) return;
    container.innerHTML = '';
    if (!profiles || profiles.length === 0) return;

    profiles.forEach(p => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'profile-chip' + (p.id === selectedProfileId ? ' active' : '');
        chip.style.setProperty('--chip-color', p.color || '#FFB300');
        chip.setAttribute('title', t('home.profile.switch'));
        chip.onclick = () => switchProfile(p.id);
        chip.innerHTML = `<span class="profile-chip-avatar">${escapeHtml(p.avatar || '⭐')}</span><span class="profile-chip-name">${escapeHtml(p.name || '孩子')}</span>`;

        const editBtn = document.createElement('span');
        editBtn.className = 'profile-chip-edit';
        editBtn.textContent = '✎';
        editBtn.setAttribute('title', t('home.profile.edit'));
        editBtn.onclick = (e) => {
            e.stopPropagation();
            openProfileModal(p.id);
        };
        chip.appendChild(editBtn);

        container.appendChild(chip);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'profile-chip profile-chip-add';
    addBtn.setAttribute('title', t('home.profile.add'));
    addBtn.innerHTML = `<span class="profile-chip-avatar">➕</span><span class="profile-chip-name">${t('home.profile.add')}</span>`;
    addBtn.onclick = () => openProfileModal();
    container.appendChild(addBtn);
}

async function switchProfile(profileId) {
    if (profileId === selectedProfileId) return;
    try {
        await api.setSelectedProfile(profileId);
        selectedProfileId = profileId;
        await loadDataFromCloud();
        updateUI();
        renderProfileSwitcher();
        const p = profiles.find(x => x.id === profileId);
        showTemporaryMessage(t('home.profile.switched', { name: p ? p.name : '' }), 'success');
    } catch (error) {
        console.error('切换孩子失败:', error);
        showTemporaryMessage(`${t('home.profile.switchFailed')}: ${escapeHtml(error.message)}`, 'error');
    }
}

// 档案弹窗
let editingProfileId = null;
const PROFILE_AVATARS = ['⭐', '🌟', '😊', '🐱', '🐶', '🦊', '🐼', '🦁', '👧', '👦', '🧒', '👶'];
const PROFILE_COLORS = ['#FFB300', '#FF7043', '#EC407A', '#AB47BC', '#7E57C2', '#5C6BC0', '#42A5F5', '#26C6DA', '#26A69A', '#66BB6A'];

function openProfileModal(profileId) {
    editingProfileId = profileId || null;
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    const nameInput = document.getElementById('profile-name');
    const title = document.getElementById('profile-modal-title');
    const deleteBtn = document.getElementById('profile-delete-btn');

    let p = null;
    if (editingProfileId) {
        p = profiles.find(x => x.id === editingProfileId);
    }
    if (title) title.textContent = editingProfileId ? t('home.profile.edit') : t('home.profile.add');
    if (nameInput) nameInput.value = p ? (p.name || '') : '';
    if (deleteBtn) deleteBtn.style.display = (editingProfileId && profiles.length > 1) ? 'inline-block' : 'none';

    renderAvatarPicker(p ? (p.avatar || '⭐') : '⭐');
    renderColorPicker(p ? (p.color || '#FFB300') : '#FFB300');

    modal.style.display = 'flex';
    if (nameInput) nameInput.focus();
}

function renderAvatarPicker(selected) {
    const wrap = document.getElementById('profile-avatar-picker');
    if (!wrap) return;
    wrap.innerHTML = '';
    PROFILE_AVATARS.forEach(a => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'picker-emoji' + (a === selected ? ' active' : '');
        b.textContent = a;
        b.onclick = () => {
            wrap.dataset.value = a;
            wrap.querySelectorAll('.picker-emoji').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
        };
        wrap.appendChild(b);
    });
    wrap.dataset.value = selected;
}

function renderColorPicker(selected) {
    const wrap = document.getElementById('profile-color-picker');
    if (!wrap) return;
    wrap.innerHTML = '';
    PROFILE_COLORS.forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'picker-color' + (c.toLowerCase() === String(selected).toLowerCase() ? ' active' : '');
        b.style.background = c;
        b.onclick = () => {
            wrap.dataset.value = c;
            wrap.querySelectorAll('.picker-color').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
        };
        wrap.appendChild(b);
    });
    wrap.dataset.value = selected;
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.style.display = 'none';
    editingProfileId = null;
}

async function saveProfile() {
    const nameInput = document.getElementById('profile-name');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) {
        showTemporaryMessage(t('home.profile.nameRequired'), 'error');
        if (nameInput) nameInput.focus();
        return;
    }
    const avatarWrap = document.getElementById('profile-avatar-picker');
    const colorWrap = document.getElementById('profile-color-picker');
    const avatar = avatarWrap ? (avatarWrap.dataset.value || '⭐') : '⭐';
    const color = colorWrap ? (colorWrap.dataset.value || '#FFB300') : '#FFB300';

    try {
        if (editingProfileId) {
            await api.updateProfile(editingProfileId, { name, avatar, color });
        } else {
            await api.addProfile(name, avatar, color);
        }
        closeProfileModal();
        await reloadProfiles();
        showTemporaryMessage(t('home.profile.saved'), 'success');
    } catch (error) {
        console.error('保存孩子档案失败:', error);
        showTemporaryMessage(`${t('home.profile.saveFailed')}: ${escapeHtml(error.message)}`, 'error');
    }
}

async function reloadProfiles() {
    try {
        profiles = await api.getProfiles() || [];
        renderProfileSwitcher();
    } catch (e) {
        console.error('重新加载档案失败', e);
    }
}

function deleteCurrentProfile() {
    if (!editingProfileId) return;
    if (profiles.length <= 1) {
        showTemporaryMessage(t('home.profile.onlyOne'), 'error');
        return;
    }
    if (!confirm(t('home.profile.deleteConfirm'))) return;
    (async () => {
        try {
            await api.deleteProfile(editingProfileId);
            closeProfileModal();
            await reloadProfiles();
            if (selectedProfileId === editingProfileId) {
                const first = profiles[0];
                if (first) {
                    await api.setSelectedProfile(first.id);
                    selectedProfileId = first.id;
                    await loadDataFromCloud();
                    updateUI();
                }
            }
            renderProfileSwitcher();
            showTemporaryMessage(t('home.profile.deleted'), 'success');
        } catch (error) {
            showTemporaryMessage(`${t('home.profile.deleteFailed')}: ${escapeHtml(error.message)}`, 'error');
        }
    })();
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
        initReminder();
    }
});

// ── 每日打卡提醒（本地通知，浏览器需保持打开）──
const REMINDER_KEY = 'sr_reminder';
let reminderTimer = null;

function initReminder() {
    const timeInput = document.getElementById('reminder-time');
    if (!timeInput) return;
    const saved = loadReminder();
    if (saved && saved.time) timeInput.value = saved.time;
    updateReminderButton();
    if (reminderTimer) clearInterval(reminderTimer);
    reminderTimer = setInterval(checkReminder, 30000);
    checkReminder();
}

function loadReminder() {
    try {
        return JSON.parse(localStorage.getItem(REMINDER_KEY) || 'null');
    } catch (e) {
        return null;
    }
}

function saveReminder(data) {
    try { localStorage.setItem(REMINDER_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

function updateReminderButton() {
    const btn = document.getElementById('reminder-toggle');
    if (!btn) return;
    const saved = loadReminder();
    if (saved && saved.enabled) {
        btn.textContent = t('home.reminderDisable');
        btn.classList.add('active');
    } else {
        btn.textContent = t('home.reminderEnable');
        btn.classList.remove('active');
    }
}

async function toggleReminder() {
    const saved = loadReminder() || {};
    if (!saved.enabled) {
        if (!('Notification' in window)) {
            showTemporaryMessage(t('home.reminderUnsupported'), 'error');
            return;
        }
        let permission = Notification.permission;
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            showTemporaryMessage(t('home.reminderDenied'), 'error');
            return;
        }
        const timeInput = document.getElementById('reminder-time');
        saved.enabled = true;
        saved.time = timeInput && timeInput.value ? timeInput.value : '19:00';
        saved.lastDate = '';
        saveReminder(saved);
        showTemporaryMessage(t('home.reminderOn'), 'success');
    } else {
        saved.enabled = false;
        saveReminder(saved);
        showTemporaryMessage(t('home.reminderOff'), 'success');
    }
    updateReminderButton();
}

function checkReminder() {
    const saved = loadReminder();
    if (!saved || !saved.enabled || !saved.time) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const now = new Date();
    const today = now.toDateString();
    const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

    if (hhmm === saved.time && saved.lastDate !== today) {
        saved.lastDate = today;
        saveReminder(saved);
        try {
            const profile = (Array.isArray(profiles) ? profiles : []).find(p => p.id === selectedProfileId);
            new Notification(t('home.reminderTitle'), {
                body: t('home.reminderBody', { name: profile && profile.name ? profile.name : '' }),
                icon: '/favicon.svg'
            });
        } catch (e) { /* ignore */ }
        showTemporaryMessage(t('home.reminderNow'), 'success');
    }
}

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