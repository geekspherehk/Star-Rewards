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

// 家庭共享
let currentFamily = null; // { family, members, invite_link }

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
const ACH_SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
const ACHIEVEMENTS = [
    // glyph: 海报/canvas 用字符图徽（画布不绘制 SVG 源码，避免乱码）；web 仍用 SVG icon
    { id: 'first_star', icon: `<svg ${ACH_SVG}><polygon points="12 3 14.7 9.3 21.5 10.1 16.3 14.6 17.8 21.3 12 18 6.2 21.3 7.7 14.6 2.5 10.1 9.3 9.3 12 3"/></svg>`, glyph: '★', metric: 'behaviors', target: 1 },
    { id: 'ten_actions', icon: `<svg ${ACH_SVG}><path d="M12 22V11"/><path d="M12 11C12 7 9 5 5 5c0 4 3 6 7 6z"/><path d="M12 13c0-3.5 3-5.5 7-5.5 0 4-3 6-7 6z"/></svg>`, glyph: '✿', metric: 'behaviors', target: 10 },
    { id: 'fifty_actions', icon: `<svg ${ACH_SVG}><path d="M12 2 6 10h3l-4 6h14l-4-6h3z"/><path d="M12 16v6"/></svg>`, glyph: '✦', metric: 'behaviors', target: 50 },
    { id: 'hundred_points', icon: `<svg ${ACH_SVG}><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></svg>`, glyph: '✓', metric: 'totalPoints', target: 100 },
    { id: 'five_hundred', icon: `<svg ${ACH_SVG}><circle cx="12" cy="9" r="5"/><path d="M9.5 13.5 7 21l5-3 5 3-2.5-7.5"/></svg>`, glyph: '◉', metric: 'totalPoints', target: 500 },
    { id: 'thousand_pts', icon: `<svg ${ACH_SVG}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5z"/></svg>`, glyph: '♛', metric: 'currentPoints', target: 1000 },
    { id: 'streak3', icon: `<svg ${ACH_SVG}><path d="M12 22a7 7 0 0 0 7-7c0-3-2-5-3-6 .3 1.5-.5 2.5-1.5 3.2-1-3-3-4.2-3-7-3 2.5-5 5.5-5 10a7 7 0 0 0 5.5 6.8z"/></svg>`, glyph: '♨', metric: 'streak', target: 3 },
    { id: 'streak7', icon: `<svg ${ACH_SVG}><polygon points="13 2 4 14 11 14 10 22 20 9 13 9 13 2"/></svg>`, glyph: '⚡', metric: 'streak', target: 7 },
    { id: 'streak30', icon: `<svg ${ACH_SVG}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`, glyph: '☼', metric: 'streak', target: 30 },
    { id: 'first_redeem', icon: `<svg ${ACH_SVG}><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg>`, glyph: '♢', metric: 'redeemed', target: 1 },
    { id: 'five_redeems', icon: `<svg ${ACH_SVG}><path d="M5 21 13 13"/><path d="M13 13l7-7"/><path d="M14 3l.8 2.5L17 6l-2.2.8L14 9l-.8-2.2L11 6l2.2-.5z"/><path d="M19 13l.6 1.8L21 15l-1.4.6L19 17l-.6-1.4L17 15l1.4-.4z"/></svg>`, glyph: '✺', metric: 'redeemed', target: 5 },
    { id: 'multi_child', icon: `<svg ${ACH_SVG}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5"/><path d="M15 20c0-2 1-3.2 2-3.2s2 1.2 2 3.2"/></svg>`, glyph: '♣', metric: 'profiles', target: 2 },
    { id: 'variety', icon: `<svg ${ACH_SVG}><path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5 1-2 2.5-2H19a3 3 0 0 0 3-3c0-5-4-9-10-9z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="9" cy="14.5" r="1"/></svg>`, glyph: '✧', metric: 'days', target: 5 }
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
                ? `<div class="achievement-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>${t('home.achievements.unlocked')}</div>`
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
                showTemporaryMessage(`<span class="toast-badge">${badge.icon}</span>${escapeHtml(t('home.achievements.' + id + '.name'))} ${t('home.achievements.unlocked')}！`, 'success', true);
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

// ── 分享海报（canvas 生成成长海报）──
function getSelectedProfile() {
    return (Array.isArray(profiles) ? profiles : []).find(x => x.id === selectedProfileId) || {};
}

function openPosterModal() {
    const modal = document.getElementById('poster-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    renderPoster();
    const shareBtn = document.getElementById('poster-share-btn');
    if (shareBtn) {
        shareBtn.style.display = (navigator.share && navigator.canShare) ? 'inline-block' : 'none';
    }
    const inviteBox = document.getElementById('poster-invite-box');
    if (inviteBox) {
        inviteBox.style.display = (currentFamily && currentFamily.family) ? 'flex' : 'none';
    }
    track('view_poster');
}

function closePosterModal() {
    const modal = document.getElementById('poster-modal');
    if (modal) modal.style.display = 'none';
}

function posterColor() {
    return getSelectedProfile().color || '#FFB300';
}

function shadeColor(hex, factor) {
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(255,255,255,${factor})`;
    const n = parseInt(full, 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * factor + 255 * (1 - factor)));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * factor + 255 * (1 - factor)));
    const b = Math.min(255, Math.round((n & 255) * factor + 255 * (1 - factor)));
    return `rgb(${r},${g},${b})`;
}

// 判断背景色明暗，决定海报文字用深色还是白色（保证对比度）
function isLightColor(hex) {
    const h = String(hex).replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return false;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
}

function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// ── 海报字符徽章 ──
// 海报用 Unicode 字符（glyph）渲染徽章，避免画布把 SVG 源码当文本绘制（乱码）。
// 网页端仍用 ACHIEVEMENTS 的 SVG icon；这里只给海报兜底。
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",serif';

function renderPoster() {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const fontFamily = '"PingFang SC","Microsoft YaHei",sans-serif';
    ctx.clearRect(0, 0, W, H);

    // 背景渐变
    const color = posterColor();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, color);
    grad.addColorStop(0.55, shadeColor(color, 0.72));
    grad.addColorStop(1, shadeColor(color, 0.48));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 根据背景明暗选择文字/装饰颜色，保证对比度（浅色背景用深字，深色背景用白字）
    const light = isLightColor(color);
    const textMain = light ? 'rgba(45,35,25,0.95)' : 'rgba(255,255,255,0.96)';
    const textSub = light ? 'rgba(45,35,25,0.72)' : 'rgba(255,255,255,0.85)';
    const textFoot = light ? 'rgba(45,35,25,0.88)' : 'rgba(255,255,255,0.92)';
    const decoColor = light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.12)';
    const cardBg = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.2)';

    // 装饰圆
    ctx.globalAlpha = 1;
    ctx.fillStyle = decoColor;
    [[70, 140, 95], [640, 250, 60], [110, 960, 70], [655, 1030, 105]].forEach(([x, y, r]) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    });

    // 标题
    ctx.textAlign = 'center';
    ctx.fillStyle = textMain;
    ctx.font = 'bold 54px ' + fontFamily;
    ctx.fillText(t('home.posterTitle'), W / 2, 105);
    ctx.font = '26px ' + fontFamily;
    ctx.fillStyle = textSub;
    ctx.fillText(t('home.posterSubtitle'), W / 2, 158);

    // 头像圆 + emoji
    const p = getSelectedProfile();
    const cy = 330;
    const cr = 108;
    ctx.beginPath();
    ctx.arc(W / 2, cy, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();
    ctx.font = '108px ' + EMOJI_FONT;
    ctx.textBaseline = 'middle';
    ctx.fillText(p.avatar || '⭐', W / 2, cy + 10);
    ctx.textBaseline = 'alphabetic';

    // 名字 + 日期
    ctx.fillStyle = textMain;
    ctx.font = 'bold 54px ' + fontFamily;
    ctx.fillText((p.name || '孩子').slice(0, 10), W / 2, 512);
    ctx.font = '24px ' + fontFamily;
    ctx.fillStyle = textSub;
    ctx.fillText(new Date().toLocaleDateString(), W / 2, 556);

    // 三个统计卡
    const stats = [
        [t('home.currentPoints'), currentPoints],
        [t('home.totalPoints'), totalPoints],
        [t('home.streakDays'), calculateStreak(behaviors)]
    ];
    const cardW = 200;
    const cardH = 150;
    const gap = 18;
    const startX = (W - (cardW * 3 + gap * 2)) / 2;
    const cardY = 620;
    stats.forEach(([label, value], i) => {
        const x = startX + i * (cardW + gap);
        ctx.fillStyle = cardBg;
        roundRectPath(ctx, x, cardY, cardW, cardH, 18);
        ctx.fill();
        ctx.fillStyle = textMain;
        ctx.font = 'bold 50px ' + fontFamily;
        ctx.fillText(String(value), x + cardW / 2, cardY + 70);
        ctx.font = '22px ' + fontFamily;
        ctx.fillStyle = textSub;
        ctx.fillText(String(label), x + cardW / 2, cardY + 120);
    });

    // 成就
    const ach = computeAchievements();
    const unlocked = ach.filter(a => a.unlocked);
    ctx.fillStyle = textMain;
    ctx.font = 'bold 34px ' + fontFamily;
    ctx.fillText(t('home.achievements.title') + ' ' + unlocked.length + '/' + ach.length, W / 2, 850);

    const iconSize = 66;
    const cols = 5;
    const shown = unlocked.slice(0, 10);
    if (shown.length > 0) {
        const totalW = cols * iconSize + (cols - 1) * 18;
        const rowCount = Math.ceil(shown.length / cols);
        const baseY = 872;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        shown.forEach((a, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = (W - totalW) / 2 + col * (iconSize + 18);
            const y = baseY + row * (iconSize + 14) + (rowCount === 1 ? (iconSize + 14) / 4 : 0);
            const cx = x + iconSize / 2;
            const cy = y + iconSize / 2 + 2;
            // 品牌色圆底 + 白色字符徽章（画布稳健方案：不画 SVG 源码）
            ctx.beginPath();
            ctx.arc(cx, cy, iconSize / 2 + 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(108,92,231,0.95)';
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.98)';
            ctx.font = '40px ' + fontFamily;
            ctx.fillText(a.glyph || '★', cx, cy + 2);
        });
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';
    }

    // 底部
    ctx.fillStyle = textFoot;
    ctx.font = '28px ' + fontFamily;
    ctx.fillText(t('home.posterFooter'), W / 2, H - 105);
    ctx.font = '22px ' + fontFamily;
    ctx.fillStyle = textSub;
    ctx.fillText('stellar.gaocaihk.com', W / 2, H - 58);

    // 家庭邀请码（海报裂变）
    if (currentFamily && currentFamily.family && currentFamily.family.invite_code) {
        ctx.font = '20px ' + fontFamily;
        ctx.fillStyle = textSub;
        ctx.fillText(t('home.family.inviteCode') + '：' + currentFamily.family.invite_code, W / 2, H - 30);
    }
}

function copyPosterInvite() {
    const link = currentFamily && currentFamily.family ? currentFamily.family.invite_link : '';
    if (link) copyText(link, t('home.family.copied'));
    else showTemporaryMessage(t('home.family.invalidCode'), 'error');
}

function downloadPoster() {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
        if (!blob) {
            showTemporaryMessage(t('home.posterFailed'), 'error');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'star-rewards_' + (getSelectedProfile().name || 'poster').replace(/[^\w\u4e00-\u9fa5-]/g, '') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showTemporaryMessage(t('home.posterSaved'), 'success');
    }, 'image/png');
}

async function sharePoster() {
    track('share_poster');
    if (!navigator.share) return;
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    try {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (!blob) return;
        const file = new File([blob], 'star-rewards-poster.png', { type: 'image/png' });
        await navigator.share({ files: [file], title: t('home.posterTitle'), text: t('home.posterFooter') });
    } catch (e) {
        if (e.name !== 'AbortError') console.error('分享失败:', e);
    }
}

// 积分趋势图（Chart.js）
let pointsChart = null;
let chartLoadPromise = null;

// 懒加载 Chart.js：首屏不加载 196KB 的 chart.min.js，仅在需要渲染趋势图时才注入
function ensureChartLoaded() {
    if (typeof Chart !== 'undefined') return Promise.resolve();
    if (!chartLoadPromise) {
        chartLoadPromise = new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'chart.min.js?v=2';
            s.onload = () => resolve();
            s.onerror = () => reject(new Error('Chart.js 加载失败'));
            document.head.appendChild(s);
        });
    }
    return chartLoadPromise;
}

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
        // 懒加载 Chart.js 后重试渲染
        ensureChartLoaded()
            .then(() => renderPointsChart())
            .catch((err) => {
                console.warn('趋势图加载失败，已隐藏：', err);
                container.style.display = 'none';
            });
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
            <div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2"/></svg></div>
            <div class="stat-text">${t('common.totalRecords')}: ${totalBehaviors}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon is-plus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
            <div class="stat-text">${t('common.pointsEarned')}: +${totalPointsGained}</div>
        </div>
        <div class="stat-item">
            <div class="stat-icon is-minus"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg></div>
            <div class="stat-text">${t('common.pointsDeducted')}: ${totalPointsLost}</div>
        </div>
    `;
    logContainer.appendChild(statsDiv);
    
    // 创建行为日志容器（只显示最近 3 条，更多看成长日历）
    const behaviorsContainer = document.createElement('div');
    behaviorsContainer.className = 'behavior-log-container';
    
    behaviors.slice(0, 3).forEach((behavior, index) => {
        const behaviorDiv = document.createElement('div');
        behaviorDiv.className = 'behavior-item';
        behaviorDiv.style.animationDelay = `${index * 0.1}s`;
        
        // 根据积分正负设置不同的图标和样式
        const isPositive = behavior.points > 0;
        const iconSvg = isPositive
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        const pointsClass = isPositive ? 'positive-points' : 'negative-points';
        
        behaviorDiv.innerHTML = `
            <div class="behavior-icon ${isPositive ? 'is-positive' : 'is-negative'}">${iconSvg}</div>
            <div class="behavior-content">
                <div class="behavior-description">${escapeHtml(behavior.description)}</div>
                <div class="behavior-meta">
                    <span class="behavior-points ${pointsClass}">${behavior.points}</span>
                    <span class="behavior-date">${formatBehaviorDate(behavior.timestamp)}</span>
                    ${behavior.added_by_name ? `<span class="behavior-by">· ${escapeHtml(behavior.added_by_name)}</span>` : ''}
                </div>
            </div>
        `;
        
        behaviorsContainer.appendChild(behaviorDiv);
    });
    
    logContainer.appendChild(behaviorsContainer);

    // 更多记录 → 成长日历
    if (behaviors.length > 3) {
        const moreBtn = document.createElement('button');
        moreBtn.className = 'view-all-btn';
        moreBtn.innerHTML = `${t('home.viewAllRecords')} (${totalBehaviors}) →`;
        moreBtn.onclick = () => showModule('diary-module');
        logContainer.appendChild(moreBtn);
    }
    
    // 更新行为日志计数徽章
    const behaviorCount = document.getElementById('behavior-count');
    if (behaviorCount) {
        behaviorCount.textContent = totalBehaviors;
    }
}

function updateWishlistSummary() {
    const wsWishes = document.getElementById('ws-wishes');
    const wsTarget = document.getElementById('ws-target');
    const wsClosest = document.getElementById('ws-closest');
    if (!wsWishes || !wsTarget || !wsClosest) return;

    const totalWishes = gifts.length;
    const totalTarget = gifts.reduce((sum, g) => sum + (Number(g.points) || 0), 0);
    let closestPct = 0;
    gifts.forEach(g => {
        const pts = Number(g.points) || 0;
        if (pts <= 0) return;
        const p = Math.min(100, Math.round((currentPoints / pts) * 100));
        if (p > closestPct) closestPct = p;
    });
    wsWishes.textContent = totalWishes;
    wsTarget.textContent = totalTarget;
    wsClosest.textContent = closestPct + '%';
}

function updateGiftList() {
    const giftList = document.getElementById('gift-list');

    if (!giftList) {
        console.log('gift-list元素不存在，跳过更新');
        return;
    }

    updateWishlistSummary();

    giftList.innerHTML = '';

    if (gifts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gift-empty';
        empty.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v11M3 12v8h18v-8"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg>' +
            '<div>' + escapeHtml(t('gifts.emptyHint')) + '</div>';
        giftList.appendChild(empty);
        return;
    }

    gifts.forEach((gift, index) => {
        const card = document.createElement('div');
        card.className = 'gift-card';

        const pts = Number(gift.points) || 0;
        const pct = pts > 0 ? Math.max(0, Math.min(100, Math.round((currentPoints / pts) * 100))) : 0;
        const remaining = Math.max(0, pts - currentPoints);
        const ready = currentPoints >= pts && pts > 0;
        if (ready) card.classList.add('is-ready');

        const media = document.createElement('div');
        media.className = 'gc-media';
        const hasOriginalUrl = gift.original_url && isEcommerceUrl(gift.original_url);
        if (gift.image_url) {
            if (hasOriginalUrl) {
                const link = document.createElement('a');
                link.href = gift.original_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const img = document.createElement('img');
                img.src = gift.image_url;
                img.alt = gift.name;
                img.loading = 'lazy';
                img.onerror = function () { this.src = 'placeholder.svg'; this.alt = t('common.giftImage'); };
                link.appendChild(img);
                media.appendChild(link);
                const badge = document.createElement('a');
                badge.href = gift.original_url;
                badge.target = '_blank';
                badge.rel = 'noopener noreferrer';
                badge.className = 'gc-link-badge';
                badge.title = t('common.viewProduct');
                badge.setAttribute('aria-label', t('common.viewProduct'));
                badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
                media.appendChild(badge);
            } else {
                const img = document.createElement('img');
                img.src = gift.image_url;
                img.alt = gift.name;
                img.loading = 'lazy';
                img.onerror = function () { this.src = 'placeholder.svg'; this.alt = t('common.giftImage'); };
                media.appendChild(img);
            }
        } else {
            const img = document.createElement('img');
            img.src = 'placeholder.svg';
            img.alt = gift.name || t('common.giftImage');
            img.loading = 'lazy';
            media.appendChild(img);
        }
        card.appendChild(media);

        const body = document.createElement('div');
        body.className = 'gc-body';

        const head = document.createElement('div');
        head.className = 'gc-head';
        const title = document.createElement('div');
        title.className = 'gc-title';
        title.textContent = gift.name;
        head.appendChild(title);
        if (gift.category) {
            const cat = document.createElement('span');
            cat.className = 'gc-cat';
            cat.textContent = gift.category;
            head.appendChild(cat);
        }
        body.appendChild(head);

        if (gift.description) {
            const desc = document.createElement('div');
            desc.className = 'gc-desc';
            if (gift.description_html) {
                desc.innerHTML = gift.description_html;
            } else {
                desc.textContent = gift.description;
            }
            body.appendChild(desc);
        }

        const points = document.createElement('div');
        points.className = 'gc-points';
        points.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' +
            '<span>' + pts + ' ' + escapeHtml(t('common.points')) + '</span>';
        body.appendChild(points);

        const progress = document.createElement('div');
        progress.className = 'gc-progress';
        const track = document.createElement('div');
        track.className = 'gc-progress-track';
        const fill = document.createElement('div');
        fill.className = 'gc-progress-fill' + (ready ? ' is-ready' : '');
        fill.style.width = pct + '%';
        track.appendChild(fill);
        const meta = document.createElement('div');
        meta.className = 'gc-progress-meta';
        const pctEl = document.createElement('span');
        pctEl.className = 'gc-pct' + (ready ? ' is-ready' : '');
        pctEl.textContent = pct + '%';
        const stateEl = document.createElement('span');
        stateEl.className = 'gc-state ' + (ready ? 'is-ready' : 'is-pending');
        stateEl.textContent = ready ? t('gifts.progressReady') : t('gifts.progressRemain').replace('{points}', remaining);
        meta.appendChild(pctEl);
        meta.appendChild(stateEl);
        progress.appendChild(track);
        progress.appendChild(meta);
        body.appendChild(progress);

        const actions = document.createElement('div');
        actions.className = 'gc-actions';
        const redeemBtn = document.createElement('button');
        redeemBtn.className = 'gc-redeem' + (ready ? ' is-ready' : '');
        redeemBtn.textContent = t('common.achieveButton');
        redeemBtn.disabled = !ready;
        redeemBtn.onclick = async () => { await redeemGift(index); };
        actions.appendChild(redeemBtn);

        const delBtn = document.createElement('button');
        delBtn.className = 'gc-del';
        delBtn.title = t('common.delete');
        delBtn.setAttribute('aria-label', t('common.delete'));
        delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteGift(gift.id); };
        actions.appendChild(delBtn);

        body.appendChild(actions);
        card.appendChild(body);
        giftList.appendChild(card);
    });
}

function updateRedeemedList() {
    const redeemedList = document.getElementById('redeemed-list');
    const redeemedCount = document.getElementById('redeemed-count');

    if (!redeemedList) {
        console.log('redeemed-list元素不存在，跳过更新');
        return;
    }

    if (redeemedCount) {
        redeemedCount.textContent = redeemedGifts.length;
    }

    while (redeemedList.firstChild) {
        redeemedList.removeChild(redeemedList.firstChild);
    }

    if (redeemedGifts.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.className = 'empty-redeemed-message';
        emptyMessage.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M9 8h6M8.5 12.5 7 22l5-3 5 3-1.5-9.5"/></svg><div>' + escapeHtml(t('common.noRedeemedRecords')) + '</div>';
        redeemedList.appendChild(emptyMessage);
        return;
    }

    const totalRedeemedPoints = redeemedGifts.reduce((sum, item) => sum + item.points, 0);
    const statsDiv = document.createElement('div');
    statsDiv.className = 'redeemed-stats';
    statsDiv.innerHTML = `
        <div class="stat-item">
            <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6m12 5h1.5a2.5 2.5 0 0 0 0-5H18M6 4h12v5a6 6 0 0 1-12 0V4zM8 21h8M12 15v6"/></svg></span>
            <span class="stat-text">${escapeHtml(t('common.totalRedeemed'))} ${redeemedGifts.length} ${escapeHtml(t('common.items'))}</span>
        </div>
        <div class="stat-item">
            <span class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M6 3 2 9h20l-4-6M2 9l10 12 10-12M9 3 6 9l6 12 6-12-3-6"/></svg></span>
            <span class="stat-text">${escapeHtml(t('common.totalPointsSpent'))} ${totalRedeemedPoints} ${escapeHtml(t('common.points'))}</span>
        </div>
    `;
    redeemedList.appendChild(statsDiv);

    const giftsContainer = document.createElement('div');
    giftsContainer.className = 'redeemed-gifts-container';

    redeemedGifts.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'redeemed-item';
        itemElement.style.animationDelay = `${index * 0.1}s`;

        const imageDiv = document.createElement('div');
        imageDiv.className = 'redeemed-image-container';
        if (item.image_url) {
            const hasOriginalUrl = item.original_url && isEcommerceUrl(item.original_url);
            if (hasOriginalUrl) {
                const link = document.createElement('a');
                link.href = item.original_url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.name;
                img.className = 'redeemed-image';
                img.loading = 'lazy';
                img.width = 60;
                img.height = 60;
                img.onerror = function () { this.src = 'placeholder.svg'; this.alt = t('common.giftImage'); };
                link.appendChild(img);
                imageDiv.appendChild(link);
            } else {
                const img = document.createElement('img');
                img.src = item.image_url;
                img.alt = item.name;
                img.className = 'redeemed-image';
                img.loading = 'lazy';
                img.width = 60;
                img.height = 60;
                img.onerror = function () { this.src = 'placeholder.svg'; this.alt = t('common.giftImage'); };
                imageDiv.appendChild(img);
            }
        } else {
            const img = document.createElement('img');
            img.src = 'placeholder.svg';
            img.alt = item.name || t('common.giftImage');
            img.className = 'redeemed-image';
            img.loading = 'lazy';
            img.width = 60;
            img.height = 60;
            imageDiv.appendChild(img);
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'redeemed-content';

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

        if (item.description) {
            const descDiv = document.createElement('div');
            descDiv.className = 'redeemed-description';
            if (item.description_html) {
                descDiv.innerHTML = item.description_html;
            } else {
                descDiv.textContent = item.description;
            }
            contentDiv.appendChild(descDiv);
        }

        const infoDiv = document.createElement('div');
        infoDiv.className = 'redeemed-info';

        const pointsSpan = document.createElement('span');
        pointsSpan.className = 'redeemed-points';
        pointsSpan.innerHTML = `<span class="points-badge">-${item.points}</span> ${escapeHtml(t('common.points'))}`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'redeemed-date';
        dateSpan.textContent = formatRedeemDate(item.redeem_date);

        infoDiv.appendChild(pointsSpan);
        infoDiv.appendChild(dateSpan);
        if (item.added_by_name) {
            const bySpan = document.createElement('span');
            bySpan.className = 'redeemed-by';
            bySpan.textContent = t('home.family.addedBy') + '：' + item.added_by_name;
            infoDiv.appendChild(bySpan);
        }

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
        track('add_behavior', { points: change });

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
    let result = '';
    let lastIndex = 0;
    let m;
    // 逐段处理：非 URL 的纯文本一律先转义，杜绝 <script> 等注入
    while ((m = urlRegex.exec(text)) !== null) {
        result += escapeHtml(text.slice(lastIndex, m.index));
        let href = m[0];
        if (!href.includes('://') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
            href = 'http://' + href;
        }
        try {
            const urlObj = new URL(href);
            if (safeProtocols.includes(urlObj.protocol)) {
                result += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(m[0])}</a>`;
            } else {
                result += escapeHtml(m[0]);
            }
        } catch (e) {
            result += escapeHtml(m[0]);
        }
        lastIndex = urlRegex.lastIndex;
    }
    result += escapeHtml(text.slice(lastIndex));
    return result;
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
        track('add_gift', { points: giftPoints });

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
            track('redeem', { gift_id: gift.id, points: gift.points });

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
            showTemporaryMessage(t('common.achieveSuccess'), 'success');
            showCelebrationCertificate(gift);

        } catch (error) {
            console.error('兑换礼物失败:', error);
            hideLoading();
            showTemporaryMessage(t('common.redeemFailed') + (error.message ? `: ${escapeHtml(error.message)}` : ''), 'error');
        }
    });
}

// ── 成长纪念册（战略核心资产：纵向成长记录 + 情感纪念，可打印/分享驱动裂变） ──
function buildGrowthEvents() {
    const events = [];
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        events.push({ type: 'earn', date: b.timestamp || b.created_at, text: b.description || t('home.behaviors'), points: b.points || 0, by: b.added_by_name });
    });
    (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
        events.push({ type: 'redeem', date: r.redeem_date || r.created_at, text: r.name || t('gifts.title'), points: r.points || 0, by: r.added_by_name });
    });
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    return events;
}

function computeBestStreak() {
    const days = new Set((Array.isArray(behaviors) ? behaviors : []).map(b => {
        const d = new Date(b.timestamp || b.created_at);
        return isNaN(d) ? null : d.toISOString().slice(0, 10);
    }).filter(Boolean));
    if (days.size === 0) return 0;
    let best = 1, cur = 1;
    const sorted = [...days].sort();
    for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]), now = new Date(sorted[i]);
        const diff = Math.round((now - prev) / 86400000);
        if (diff === 1) { cur++; best = Math.max(best, cur); }
        else if (diff > 1) { cur = 1; }
    }
    return best;
}

function renderGrowthRecord() {
    const profile = getSelectedProfile();
    const name = profile.name || t('home.profile.add');
    const events = buildGrowthEvents();
    fetchGrowthExtras();
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    const earnedThisMonth = events.filter(e => e.type === 'earn' && (e.date || '').slice(0, 7) === ym)
        .reduce((s, e) => s + (e.points || 0), 0);
    const achievedThisMonth = events.filter(e => e.type === 'redeem' && (e.date || '').slice(0, 7) === ym).length;
    const bestStreak = computeBestStreak();

    const monthEl = document.getElementById('keepsake-month');
    if (monthEl) {
        monthEl.innerHTML = `
            <div class="km-card"><div class="km-value">${earnedThisMonth}</div><div class="km-label">${t('keepsake.earned')}</div></div>
            <div class="km-card"><div class="km-value">${achievedThisMonth}</div><div class="km-label">${t('keepsake.achieved')}</div></div>
            <div class="km-card"><div class="km-value">${bestStreak}</div><div class="km-label">${t('keepsake.bestStreak')}</div></div>`;
    }

    const tl = document.getElementById('keepsake-timeline');
    if (!tl) return;
    if (events.length === 0) {
        tl.innerHTML = `<div class="kt-empty">${t('keepsake.noData')}</div>`;
        return;
    }
    tl.innerHTML = events.slice(0, 60).map(e => {
        const d = new Date(e.date);
        const dateStr = isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const pts = e.type === 'earn' ? `+${e.points}` : `-${e.points}`;
        const by = e.by ? ` <span class="kt-by">· ${escapeHtml(e.by)}</span>` : '';
        return `<div class="kt-item ${e.type === 'redeem' ? 'kt-redeem' : ''}">
            <div class="kt-date">${dateStr}</div>
            <div class="kt-text">${escapeHtml(e.text)} <span class="kt-pts">${pts}</span>${by}</div>
        </div>`;
    }).join('');
}

// ── Plan A: longitudinal growth data layer (milestones / growth_notes / child_voice) ──
let growthExtras = { milestones: [], growth_notes: [], child_voice: [] };

async function fetchGrowthExtras() {
    try {
        const data = await api.getGrowthExtras();
        growthExtras = {
            milestones: data.milestones || [],
            growth_notes: data.growth_notes || [],
            child_voice: data.child_voice || []
        };
    } catch (e) {
        growthExtras = { milestones: [], growth_notes: [], child_voice: [] };
    }
    renderGrowthLists();
}

function renderGrowthLists() {
    const mEl = document.getElementById('keepsake-milestones');
    if (mEl) {
        if (!growthExtras.milestones.length) {
            mEl.innerHTML = `<div class="kt-empty">${t('keepsake.emptyMilestones')}</div>`;
        } else {
            mEl.innerHTML = growthExtras.milestones.map(m => `
                <div class="gl-item">
                    <div class="gl-cat">${escapeHtml(m.category || '')}</div>
                    <div class="gl-title">${escapeHtml(m.title || '')}</div>
                    ${m.detail ? `<div class="gl-detail">${escapeHtml(m.detail)}</div>` : ''}
                    ${m.occurred_on ? `<div class="gl-date">${escapeHtml(m.occurred_on)}</div>` : ''}
                </div>`).join('');
        }
    }
    const nEl = document.getElementById('keepsake-notes');
    if (nEl) {
        if (!growthExtras.growth_notes.length) {
            nEl.innerHTML = `<div class="kt-empty">${t('keepsake.emptyNotes')}</div>`;
        } else {
            nEl.innerHTML = growthExtras.growth_notes.map(n => `
                <div class="gl-item">
                    <div class="gl-title">${escapeHtml(n.title || '')}</div>
                    ${n.body ? `<div class="gl-detail">${escapeHtml(n.body)}</div>` : ''}
                    <div class="gl-meta">${noteMoodLabel(n.mood)} ${n.occurred_on ? '· ' + escapeHtml(n.occurred_on) : ''}</div>
                </div>`).join('');
        }
    }
    const vEl = document.getElementById('keepsake-voice');
    if (vEl) {
        if (!growthExtras.child_voice.length) {
            vEl.innerHTML = `<div class="kt-empty">${t('keepsake.emptyVoice')}</div>`;
        } else {
            vEl.innerHTML = growthExtras.child_voice.map(c => `
                <div class="gl-item gl-voice">
                    <div class="gl-detail">“${escapeHtml(c.content || '')}”</div>
                    ${c.recorded_on ? `<div class="gl-date">${escapeHtml(c.recorded_on)}</div>` : ''}
                </div>`).join('');
        }
    }
}

function noteMoodLabel(mood) {
    const map = { happy: '😊', proud: '🥰', calm: '😌', thinking: '🤔', sad: '😢' };
    return map[mood] || '😊';
}

function switchKeepsakeTab(tab) {
    document.querySelectorAll('.ktab').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    ['timeline', 'milestones', 'notes', 'voice'].forEach(t => {
        const p = document.getElementById('ktab-' + t);
        if (p) p.style.display = (t === tab) ? '' : 'none';
    });
}

let growthAddType = 'milestone';
function openGrowthAdd(type) {
    growthAddType = type || 'milestone';
    const titleEl = document.getElementById('growth-add-title');
    const titles = {
        milestone: t('keepsake.addMilestone'),
        note: t('keepsake.addNote'),
        voice: t('keepsake.addVoice')
    };
    if (titleEl) titleEl.textContent = titles[growthAddType] || '';
    document.getElementById('ga-milestone-fields').style.display = (growthAddType === 'milestone') ? '' : 'none';
    document.getElementById('ga-note-fields').style.display = (growthAddType === 'note') ? '' : 'none';
    document.getElementById('ga-voice-fields').style.display = (growthAddType === 'voice') ? '' : 'none';
    ['ga-title', 'ga-detail', 'ga-note-title', 'ga-note-body', 'ga-voice-content', 'ga-date'].forEach(id => {
        const e = document.getElementById(id);
        if (e) e.value = '';
    });
    const cat = document.getElementById('ga-cat');
    if (cat) cat.value = '其他';
    const mood = document.getElementById('ga-note-mood');
    if (mood) mood.value = 'happy';
    document.getElementById('growth-add-modal').style.display = 'flex';
}

function closeGrowthAddModal() {
    const m = document.getElementById('growth-add-modal');
    if (m) m.style.display = 'none';
}

async function submitGrowthAdd() {
    let ok = false;
    try {
        if (growthAddType === 'milestone') {
            const title = (document.getElementById('ga-title').value || '').trim();
            if (!title) { showTemporaryMessage(t('keepsake.milestoneTitle') + t('common.required')); return; }
            const cat = (document.getElementById('ga-cat').value || '其他').trim();
            const date = (document.getElementById('ga-date').value || '').trim();
            const detail = (document.getElementById('ga-detail').value || '').trim();
            await api.addMilestone(cat, title, detail, date || null);
            ok = true;
        } else if (growthAddType === 'note') {
            const title = (document.getElementById('ga-note-title').value || '').trim();
            if (!title) { showTemporaryMessage(t('keepsake.noteTitle') + t('common.required')); return; }
            const body = (document.getElementById('ga-note-body').value || '').trim();
            const mood = document.getElementById('ga-note-mood').value;
            await api.addGrowthNote(title, body, mood);
            ok = true;
        } else if (growthAddType === 'voice') {
            const content = (document.getElementById('ga-voice-content').value || '').trim();
            if (!content) { showTemporaryMessage(t('keepsake.voiceContent') + t('common.required')); return; }
            await api.addChildVoice(content);
            ok = true;
        }
    } catch (e) {
        showTemporaryMessage((e.message || t('common.error')), 'error');
        return;
    }
    if (ok) {
        closeGrowthAddModal();
        showTemporaryMessage(t('common.success'));
        track('growth_add', { type: growthAddType });
        await fetchGrowthExtras();
    }
}

function printKeepsake() {
    const profile = getSelectedProfile();
    const name = profile.name || t('home.profile.add');
    const events = buildGrowthEvents();
    const now = new Date();
    const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const earnedThisMonth = events.filter(e => e.type === 'earn' && (e.date || '').slice(0, 7) === ym).reduce((s, e) => s + (e.points || 0), 0);
    const achievedThisMonth = events.filter(e => e.type === 'redeem' && (e.date || '').slice(0, 7) === ym).length;
    const rows = events.slice(0, 200).map(e => {
        const d = new Date(e.date);
        const ds = isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const tag = e.type === 'earn' ? '记录' : '达成';
        const pts = e.type === 'earn' ? `+${e.points}` : `-${e.points}`;
        return `<tr><td>${ds}</td><td>${tag}</td><td>${escapeHtml(e.text)}</td><td style="text-align:right;color:${e.type === 'earn' ? '#6c5ce7' : '#ff9a3c'}">${pts}</td></tr>`;
    }).join('');
    const win = window.open('', '_blank');
    if (!win) { showTemporaryMessage(t('common.error'), 'error'); return; }
    win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>${escapeHtml(name)} · ${t('keepsake.title')}</title>
<style>
 body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#333;max-width:720px;margin:0 auto;padding:32px;}
 h1{text-align:center;color:#6c5ce7;margin:0 0 4px;} .sub{text-align:center;color:#ff9a3c;margin:0 0 24px;}
 .summary{display:flex;gap:12px;justify-content:center;margin-bottom:24px;}
 .card{flex:1;border:1px solid #eee;border-radius:12px;padding:14px;text-align:center;}
 .card b{display:block;font-size:22px;color:#6c5ce7;} .card span{font-size:12px;color:#999;}
 table{width:100%;border-collapse:collapse;} td,th{padding:8px 6px;border-bottom:1px solid #f0f0f0;font-size:14px;}
 th{color:#999;text-align:left;} .foot{text-align:center;color:#bbb;font-size:12px;margin-top:28px;}
</style></head><body>
<h1>${escapeHtml(name)} · ${t('keepsake.title')}</h1>
<p class="sub">${t('keepsake.subtitle')}</p>
<div class="summary">
 <div class="card"><b>${earnedThisMonth}</b><span>${t('keepsake.earned')}</span></div>
 <div class="card"><b>${achievedThisMonth}</b><span>${t('keepsake.achieved')}</span></div>
 <div class="card"><b>${events.length}</b><span>${t('keepsake.events')}</span></div>
</div>
<table><thead><tr><th>日期</th><th>类型</th><th>内容</th><th style="text-align:right">积分</th></tr></thead>
<tbody>${rows}</tbody></table>
<p class="foot">${t('common.certFoot')} · ${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}</p>
<script>window.onload=function(){setTimeout(function(){window.print();},300);};<\/script>
</body></html>`);
    win.document.close();
}

// ── 成就证书（达成即庆祝，而非交易兑换） ──
function drawCertStar(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i - Math.PI / 2;
        const a2 = a + Math.PI / 5;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffb300';
    ctx.fill();
    ctx.restore();
}

function showCelebrationCertificate(gift) {
    const canvas = document.getElementById('cert-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const profile = getSelectedProfile();
    const childName = profile.name || t('home.profile.add');
    const giftName = gift.name || '';
    const dateStr = new Date().toLocaleDateString('zh-CN');

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#667eea'); grad.addColorStop(1, '#764ba2');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.fillRect(28, 28, W - 56, H - 56);
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 4; ctx.strokeRect(44, 44, W - 88, H - 88);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#6c5ce7'; ctx.font = 'bold 40px sans-serif';
    ctx.fillText(t('common.certTitle'), W / 2, 130);

    ctx.fillStyle = '#333'; ctx.font = '22px sans-serif';
    ctx.fillText(childName, W / 2, 220);

    ctx.fillStyle = '#888'; ctx.font = '18px sans-serif';
    ctx.fillText(t('common.certSub'), W / 2, 260);

    ctx.fillStyle = '#764ba2'; ctx.font = 'bold 30px sans-serif';
    ctx.fillText('「' + (giftName || '') + '」', W / 2, 330);

    drawCertStar(ctx, W / 2, 425, 46);

    ctx.fillStyle = '#bbb'; ctx.font = '16px sans-serif';
    ctx.fillText(dateStr, W / 2, H - 80);
    ctx.fillText(t('common.certFoot'), W / 2, H - 56);

    document.getElementById('certificate-modal').style.display = 'flex';
    track('achieve_cert', { gift_id: gift.id });
}

function downloadCertificate() {
    const canvas = document.getElementById('cert-canvas');
    if (!canvas) return;
    canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'star-rewards-cert-' + (getSelectedProfile().name || 'cert') + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
}

function closeCertificateModal() {
    const m = document.getElementById('certificate-modal');
    if (m) m.style.display = 'none';
}

// ── 裂变硬化：海报一键分享到微信 / WhatsApp / Pinterest ──
function getInviteShareText() {
    const profile = getSelectedProfile();
    return t('home.family.shareInvite') + ' · ' + (profile.name || '') + ' ' + location.origin;
}
function shareToWeChat() {
    const link = currentFamily && currentFamily.family ? currentFamily.family.invite_link : location.origin;
    copyText(link, t('common.shareCopied'));
    track('share_wechat');
}
function shareToWhatsApp() {
    const link = currentFamily && currentFamily.family ? currentFamily.family.invite_link : location.origin;
    const text = getInviteShareText();
    window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + link), '_blank');
    track('share_whatsapp');
}
function shareToPinterest() {
    const link = currentFamily && currentFamily.family ? currentFamily.family.invite_link : location.origin;
    const text = getInviteShareText();
    window.open('https://pinterest.com/pin/create/button/?url=' + encodeURIComponent(link) + '&description=' + encodeURIComponent(text), '_blank');
    track('share_pinterest');
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
    updateModuleStats();
}

// 顶部模块卡迷你仪表盘：实时数据一眼可见（SVG 图标 + 数字，语言无关）
const STAT_ICO = {
    star: '<svg class="stat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 3 14.7 9.3 21.5 10.1 16.3 14.6 17.8 21.3 12 18 6.2 21.3 7.7 14.6 2.5 10.1 9.3 9.3 12 3"/></svg>',
    gift: '<svg class="stat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg>',
    check: '<svg class="stat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    note: '<svg class="stat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
};
function updateModuleStats() {
    const sP = document.getElementById('stat-points');
    if (sP) sP.innerHTML = `${STAT_ICO.star}${currentPoints} 分`;
    const sG = document.getElementById('stat-gifts');
    if (sG) sG.innerHTML = `${STAT_ICO.gift}${(Array.isArray(gifts) ? gifts : []).length} · ${STAT_ICO.check}${(Array.isArray(redeemedGifts) ? redeemedGifts : []).length} 已兑换`;
    const sD = document.getElementById('stat-diary');
    if (sD) sD.innerHTML = `${STAT_ICO.note}${(Array.isArray(behaviors) ? behaviors : []).length} 条记录`;
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
    // 演示数据下同步渲染行为记录/愿望清单/兑换记录（含空态引导）
    updateBehaviorLog();
    updateGiftList();
    updateRedeemedList();
    updateModuleStats();

    // 未登录不显示悬浮记分按钮
    const fab = document.getElementById('quick-add-fab');
    if (fab) fab.style.display = 'none';
    
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

    // 已登录：积分页默认显示悬浮记分按钮
    const fab = document.getElementById('quick-add-fab');
    if (fab) fab.style.display = 'flex';
    
    console.log('Script.js: 已登录状态UI已显示');
}

// 初始化应用 - 仅云端加载数据
async function initializeApp() {
    try {
        console.log('Script.js: 开始初始化应用...');
        
        initLanguage();
        
        const token = api.getToken();
        const inviteParam = (new URLSearchParams(window.location.search).get('invite') || '').trim().toUpperCase();
        if (!token) {
            console.log('Script.js: 用户未登录');
            // 未登录访客点开邀请链接 → 记住邀请码，跳转登录/注册页后用于预填注册表单
            if (inviteParam) sessionStorage.setItem('pending_invite', inviteParam);
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

        // 处理分享海报/邀请链接带来的 ?invite=CODE 深链
        const inviteCode = new URLSearchParams(window.location.search).get('invite');
        if (inviteCode) {
            try {
                const code = inviteCode.toUpperCase().trim();
                if (!currentFamily || (currentFamily.family && currentFamily.family.invite_code !== code)) {
                    openJoinFamilyModal(code);
                }
            } catch (e) {
                console.warn('处理邀请链接失败', e);
            }
        }

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
        
        const [profile, profilesData, behaviorsData, giftsData, redeemedGiftsData, familyData] = await Promise.all([
            api.getProfile(),
            api.getProfiles(),
            api.getBehaviors(),
            api.getGifts(),
            api.getRedeemedGifts(),
            api.getFamily().catch(() => null)
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

        currentFamily = normalizeFamily(familyData && familyData.family ? familyData : null);

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

    // 家庭共享入口按钮
    const famBtn = document.createElement('button');
    famBtn.type = 'button';
    famBtn.className = 'profile-chip profile-chip-family';
    famBtn.setAttribute('title', t('home.family.open'));
    famBtn.innerHTML = `<span class="profile-chip-avatar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></span><span class="profile-chip-name">${t('home.family.open')}</span>`;
    famBtn.onclick = () => openFamilyModal();
    container.appendChild(famBtn);


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
        editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>';
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

// ── 家庭共享 ──
// 统一：邀请链接挂到 family 对象上（API 顶层返回 invite_link，归一化到 family.invite_link，
// 保证所有 currentFamily.family.invite_link 读取点一致可用）
function normalizeFamily(d) {
    if (d && d.family && d.invite_link && !d.family.invite_link) {
        d.family.invite_link = d.invite_link;
    }
    return d;
}

function openFamilyModal() {
    const modal = document.getElementById('family-modal');
    if (!modal) return;
    if (!currentFamily || !currentFamily.family) {
        api.getFamily().then(d => {
            currentFamily = normalizeFamily(d && d.family ? d : null);
            openFamilyModal();
        }).catch(e => {
            const msg = String(e.message || e);
            if (/not in a family/i.test(msg)) { openJoinFamilyModal(); return; }
            showTemporaryMessage(msg, 'error');
        });
        return;
    }
    renderFamilyModal();
    modal.style.display = 'flex';
    track('open_family');
}

function closeFamilyModal() {
    const modal = document.getElementById('family-modal');
    if (modal) modal.style.display = 'none';
}

function renderFamilyModal() {
    if (!currentFamily || !currentFamily.family) return;
    const fam = currentFamily.family;
    const myId = parseInt(localStorage.getItem('user_id') || '0', 10);
    const myMember = currentFamily.members.find(m => parseInt(m.user_id, 10) === myId);
    const isOwner = myMember && myMember.role === 'owner';

    const listEl = document.getElementById('family-members');
    if (listEl) {
        listEl.innerHTML = '';
        (currentFamily.members || []).forEach(m => {
            const row = document.createElement('div');
            row.className = 'family-member' + (parseInt(m.user_id, 10) === myId ? ' is-self' : '');
            const roleLabel = m.role === 'owner' ? t('home.family.owner') : '';
            const selfLabel = parseInt(m.user_id, 10) === myId ? '（' + t('home.family.me') + '）' : '';
            row.innerHTML = `<span class="family-member-avatar">👤</span>` +
                `<span class="family-member-name">${escapeHtml(m.display_name || '成员')}${selfLabel}</span>` +
                (roleLabel ? `<span class="family-member-role">${roleLabel}</span>` : '');
            if (isOwner && parseInt(m.user_id, 10) !== myId) {
                const rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'family-member-remove';
                rm.textContent = t('home.family.removeMember');
                rm.onclick = () => familyRemoveMember(parseInt(m.user_id, 10));
                row.appendChild(rm);
            }
            listEl.appendChild(row);
        });
    }

    const codeEl = document.getElementById('family-invite-code');
    const linkEl = document.getElementById('family-invite-link');
    const newBtn = document.getElementById('family-new-invite-btn');
    const leaveBtn = document.getElementById('family-leave-btn');
    const joinBtn = document.getElementById('family-join-btn');
    if (codeEl) codeEl.textContent = fam.invite_code || '-';
    if (linkEl) linkEl.value = fam.invite_link || currentFamily.invite_link || '';
    if (newBtn) newBtn.style.display = isOwner ? 'inline-block' : 'none';
    if (leaveBtn) leaveBtn.style.display = isOwner ? 'none' : 'inline-block';
    // solo 家庭（自己一人且为 owner）时显示「加入家庭」入口，支持用邀请码加入其他家庭
    if (joinBtn) joinBtn.style.display = (isOwner && fam.member_count <= 1) ? 'inline-block' : 'none';

    const nameEl = document.getElementById('family-my-name');
    if (nameEl) nameEl.value = myMember ? (myMember.display_name || '') : '';
}

async function familyNewInvite() {
    try {
        const r = await api.inviteMember();
        track('create_invite');
        if (currentFamily && currentFamily.family) {
            currentFamily.family.invite_code = r.invite_code;
            currentFamily.family.invite_link = r.invite_link;
        }
        renderFamilyModal();
        showTemporaryMessage(t('home.family.newInvite') + ' ✓', 'success');
    } catch (e) {
        showTemporaryMessage(String(e.message || e), 'error');
    }
}

function copyFamilyInvite() {
    const el = document.getElementById('family-invite-link');
    if (el && el.value) copyText(el.value, t('home.family.copied'));
    else showTemporaryMessage(t('home.family.genFirst'), 'warning');
}

function copyFamilyCode() {
    const el = document.getElementById('family-invite-code');
    if (el && el.textContent && el.textContent !== '-') copyText(el.textContent, t('home.family.copied'));
    else showTemporaryMessage(t('home.family.genFirst'), 'warning');
}

function copyText(text, okMsg) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showTemporaryMessage(okMsg, 'success')).catch(() => fallbackCopy(text, okMsg));
    } else {
        fallbackCopy(text, okMsg);
    }
}

function fallbackCopy(text, okMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showTemporaryMessage(okMsg, 'success'); } catch (e) { showTemporaryMessage('复制失败', 'error'); }
    document.body.removeChild(ta);
}

async function familyUpdateName() {
    const el = document.getElementById('family-my-name');
    const name = el ? el.value.trim() : '';
    if (!name) { showTemporaryMessage(t('home.profile.nameRequired'), 'error'); return; }
    try {
        await api.updateMemberName(name);
        if (currentFamily && currentFamily.members) {
            const myId = parseInt(localStorage.getItem('user_id') || '0', 10);
            const m = currentFamily.members.find(x => parseInt(x.user_id, 10) === myId);
            if (m) m.display_name = name;
        }
        renderFamilyModal();
        showTemporaryMessage(t('home.family.updateNameSuccess'), 'success');
    } catch (e) {
        showTemporaryMessage(String(e.message || e), 'error');
    }
}

async function familyRemoveMember(targetId) {
    if (!confirm(t('home.family.removeConfirm'))) return;
    try {
        await api.removeMember(targetId);
        const r = await api.getFamily();
        currentFamily = r && r.family ? r : currentFamily;
        renderFamilyModal();
        showTemporaryMessage(t('home.family.removeSuccess'), 'success');
    } catch (e) {
        showTemporaryMessage(String(e.message || e), 'error');
    }
}

async function familyLeave() {
    if (!confirm(t('home.family.leaveConfirm'))) return;
    try {
        await api.leaveFamily();
        currentFamily = null;
        closeFamilyModal();
        await loadDataFromCloud();
        updateUI();
        showTemporaryMessage(t('home.family.leaveSuccess'), 'success');
    } catch (e) {
        showTemporaryMessage(String(e.message || e), 'error');
    }
}

function openJoinFamilyModal(code) {
    const modal = document.getElementById('join-family-modal');
    if (!modal) return;
    const codeEl = document.getElementById('join-code');
    if (codeEl) codeEl.value = code || '';
    const nameEl = document.getElementById('join-name');
    if (nameEl && !nameEl.value) {
        const email = localStorage.getItem('user_email') || '';
        nameEl.value = email ? email.split('@')[0] : '';
    }
    modal.style.display = 'flex';
}

function closeJoinFamilyModal() {
    const modal = document.getElementById('join-family-modal');
    if (modal) modal.style.display = 'none';
}

async function submitJoinFamily() {
    const codeEl = document.getElementById('join-code');
    const nameEl = document.getElementById('join-name');
    const code = (codeEl ? codeEl.value : '').trim().toUpperCase();
    const name = (nameEl ? nameEl.value : '').trim();
    if (!/^[0-9A-Z]{6}$/.test(code)) {
        showTemporaryMessage(t('home.family.invalidCode'), 'error');
        return;
    }
    try {
        const r = await api.joinFamily(code, name);
        track('join_family', { code: code });
        currentFamily = normalizeFamily(r && r.family ? r : currentFamily);
        closeJoinFamilyModal();
        await loadDataFromCloud();
        updateUI();
        showTemporaryMessage(t('home.family.joinSuccess'), 'success');
    } catch (e) {
        const msg = (e.message || String(e));
        showTemporaryMessage(msg.indexOf('409') >= 0 ? t('home.family.alreadyInFamily') : t('home.family.joinFailed') + ': ' + escapeHtml(msg), 'error');
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

    // 成长日历/趋势/成就 页签：切到该页时重新渲染（修复隐藏容器下 canvas 尺寸为 0、数据更新）
    if (moduleId === 'diary-module') {
        renderCalendar();
        renderCalendarDayDetail();
        renderPointsChart();
        renderAchievements();
    }

    // 成长纪念册：切到该页时聚合行为 + 兑换，生成时间轴与月度报告
    if (moduleId === 'growth-module') {
        renderGrowthRecord();
    }

    // 悬浮快速记分按钮只在积分页显示
    const fab = document.getElementById('quick-add-fab');
    if (fab) {
        fab.style.display = (moduleId === 'points-module') ? 'flex' : 'none';
    }
    
    console.log('切换到模块:', moduleId);
}

// 悬浮按钮：回到积分页并聚焦记录表单
function quickAddPoints() {
    showModule('points-module');
    focusBehaviorForm();
}

// 更新成长日记列表
function updateDiaryList() {
    if (!calendarCursor) {
        const now = new Date();
        calendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    renderCalendar();
    renderCalendarDayDetail();
}

// ── 成长日历：积分行为与兑换按天综合展示在月历上 ──
let calendarCursor = null;      // 当前展示月份的第一天
let calendarSelectedDay = null; // 'YYYY-MM-DD'

function getCalendarLocale() {
    return typeof currentLanguage !== 'undefined' && currentLanguage === 'en' ? 'en-US' : 'zh-CN';
}

function calendarDateKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.getMonth();
    const label = document.getElementById('calendar-month-label');
    if (label) {
        label.textContent = new Date(y, m, 1).toLocaleDateString(getCalendarLocale(), { year: 'numeric', month: 'long' });
    }

    // 收集当月每日活动：积分行为（正负） + 兑换
    const byDay = {};
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        const d = new Date(b.timestamp);
        if (isNaN(d)) return;
        const key = calendarDateKey(d);
        if (!byDay[key]) byDay[key] = { earned: 0, redeemed: 0, items: [] };
        const pts = Number(b.points) || 0;
        if (pts > 0) byDay[key].earned += pts;
        byDay[key].items.push({ type: 'b', id: b.id, points: pts, desc: b.description || '' });
    });
    (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
        const d = new Date(r.redeem_date || r.created_at);
        if (isNaN(d)) return;
        const key = calendarDateKey(d);
        if (!byDay[key]) byDay[key] = { earned: 0, redeemed: 0, items: [] };
        const pts = Number(r.points) || 0;
        byDay[key].redeemed += pts;
        byDay[key].items.push({ type: 'r', id: r.id, points: pts, desc: r.name || '' });
    });

    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // 周一开头
    const lang = getCalendarLocale();
    const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(lang, { weekday: 'short' }));
    const today = new Date();

    let html = '<div class="cal-weekdays">' + weekdays.map(w => `<span>${w}</span>`).join('') + '</div>';
    html += '<div class="cal-cells">';
    for (let i = 0; i < firstDow; i++) html += '<span class="cal-cell cal-empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const key = calendarDateKey(date);
        const day = byDay[key];
        const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
        const isSelected = key === calendarSelectedDay;
        let cls = 'cal-cell';
        if (isToday) cls += ' today';
        if (isSelected) cls += ' selected';
        if (day) cls += ' has-data';
        let inner = `<span class="cal-day-num">${d}</span>`;
        if (day && (day.earned > 0 || day.redeemed > 0)) {
            inner += '<span class="cal-day-marks">';
            if (day.earned > 0) inner += `<span class="cal-mark cal-earned">+${day.earned}</span>`;
            if (day.redeemed > 0) inner += `<span class="cal-mark cal-redeemed"><svg class="cal-mark-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg>${day.redeemed}</span>`;
            inner += '</span>';
        }
        html += `<span class="${cls}" onclick="calendarSelectDay('${key}')" title="${key}">${inner}</span>`;
    }
    html += '</div>';
    grid.innerHTML = html;
}

function calendarShiftMonth(delta) {
    if (!calendarCursor) calendarCursor = new Date();
    calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + delta, 1);
    calendarSelectedDay = null;
    renderCalendar();
    renderCalendarDayDetail();
}

function calendarSelectDay(key) {
    calendarSelectedDay = (calendarSelectedDay === key) ? null : key;
    renderCalendar();
    renderCalendarDayDetail();
}

function renderCalendarDayDetail() {
    const panel = document.getElementById('calendar-day-detail');
    if (!panel) return;
    if (!calendarSelectedDay) {
        panel.innerHTML = '';
        panel.style.display = 'none';
        return;
    }
    const items = [];
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        const d = new Date(b.timestamp);
        if (!isNaN(d) && calendarDateKey(d) === calendarSelectedDay) {
            items.push({ type: 'b', id: b.id, points: b.points, desc: b.description || '' });
        }
    });
    (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
        const d = new Date(r.redeem_date || r.created_at);
        if (!isNaN(d) && calendarDateKey(d) === calendarSelectedDay) {
            items.push({ type: 'r', id: r.id, points: r.points, desc: r.name || '' });
        }
    });
    if (items.length === 0) {
        panel.innerHTML = '';
        panel.style.display = 'none';
        return;
    }
    const title = new Date(calendarSelectedDay + 'T00:00:00').toLocaleDateString(getCalendarLocale(), { month: 'long', day: 'numeric', weekday: 'long' });
    let html = `<div class="cal-detail-title">${title}</div>`;
    items.forEach(it => {
        if (it.type === 'b') {
            const pos = Number(it.points) > 0;
            const ico = pos
                ? '<svg class="cal-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#1FA971" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
                : '<svg class="cal-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            html += `<div class="cal-detail-item behavior">${ico}<span class="cal-detail-pts ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${it.points}</span><span class="cal-detail-desc">${escapeHtml(it.desc)}</span>`;
            if (it.id) {
                html += `<button class="cal-detail-del" onclick="deleteBehavior(${it.id})" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
            }
            html += '</div>';
        } else {
            html += `<div class="cal-detail-item gift"><svg class="cal-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#E5484D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg><span class="cal-detail-pts neg">-${it.points}</span><span class="cal-detail-desc">${escapeHtml(it.desc)}</span></div>`;
        }
    });
    panel.innerHTML = html;
    panel.style.display = 'block';
}
