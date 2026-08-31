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
let checkins = [];      // 打卡记录（含补卡），供成长日历按日期展示
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

async function openPosterModal() {
    const modal = document.getElementById('poster-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    await renderPoster();
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

// 把 hex 颜色转 rgba（用于头像光晕等需要透明度的场景）
function hexToRgba(hex, a) {
    const h = String(hex || '').replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(255,255,255,${a})`;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
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

// ── 海报背景图（懒加载，cover-fit 铺满 750×1200 画布）──
// 图未就绪时 renderPoster 会用粉彩渐变兜底，保证海报始终可生成。
let posterBgImg = null;
let posterBgPromise = null;
function ensurePosterBg() {
    if (posterBgImg && posterBgImg.complete && posterBgImg.naturalWidth > 0) return Promise.resolve(posterBgImg);
    if (posterBgPromise) return posterBgPromise;
    posterBgImg = new Image();
    posterBgImg.decoding = 'async';
    posterBgPromise = new Promise((resolve) => {
        posterBgImg.onload = () => resolve(posterBgImg);
        posterBgImg.onerror = () => { posterBgImg = null; resolve(null); };
    });
    posterBgImg.src = 'poster-bg.png?v=2';
    return posterBgPromise;
}

// 「成长海报」背景：标题/副标/统计标签/页脚/域名/扫码提示已 baked 进图片。
// 画布只叠加孩子动态数据（头像/名字/数值/徽章/二维码），避免遮挡插画图案。
async function renderPoster() {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;
    const fontFamily = '"PingFang SC","Microsoft YaHei",sans-serif';
    await ensurePosterBg();
    ctx.clearRect(0, 0, W, H);

    // ── 背景：1500×2400 baked 图 → 750×1200 画布 1:1 适配（2:3 等比）──
    if (posterBgImg && posterBgImg.naturalWidth > 0) {
        ctx.drawImage(posterBgImg, 0, 0, W, H);
    } else {
        // 兜底：图片未加载时仍可生成（粉彩渐变 + 同样的关键文字）
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#FFF8EC');
        g.addColorStop(1, '#C7C5F0');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
    }

    const textMain = 'rgba(45,35,25,0.95)';
    const textSub  = 'rgba(45,35,25,0.72)';
    const color = posterColor();

    // ── 头像柔光（孩子色相光晕）──
    const halo = ctx.createRadialGradient(W / 2, 460, 20, W / 2, 460, 200);
    halo.addColorStop(0, hexToRgba(color, 0.22));
    halo.addColorStop(1, hexToRgba(color, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(W / 2, 460, 200, 0, Math.PI * 2);
    ctx.fill();

    // ── 头像：彩色环 + 白色圆 + 表情 ──
    const p = getSelectedProfile();
    const avY = 460, cr = 98;
    ctx.save();
    ctx.shadowColor = 'rgba(45,35,25,0.22)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 6;
    ctx.beginPath();
    ctx.arc(W / 2, avY, cr, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.fill();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(W / 2, avY, cr + 8, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = '96px ' + EMOJI_FONT;
    ctx.textBaseline = 'middle';
    ctx.fillText(p.avatar || '\u2b50', W / 2, avY + 8);
    ctx.textBaseline = 'alphabetic';

    // ── 名字 + 日期 ──
    ctx.fillStyle = textMain;
    ctx.font = 'bold 52px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText((p.name || '\u5b69\u5b50').slice(0, 10), W / 2, 660);
    ctx.font = '24px ' + fontFamily;
    ctx.fillStyle = textSub;
    ctx.fillText(new Date().toLocaleDateString(), W / 2, 704);

    // ── 三统计数字（标签已在背景图 baked）──
    const stats = [currentPoints, totalPoints, calculateStreak(behaviors)];
    const panelW = 604, panelH = 156, panelX = (W - panelW) / 2, panelY = 736;
    const colW = panelW / 3;
    ctx.fillStyle = textMain;
    ctx.font = 'bold 52px ' + fontFamily;
    stats.forEach((value, i) => {
        const cx = panelX + colW * i + colW / 2;
        ctx.fillText(String(value), cx, panelY + 118);
    });

    // ── 成就标题 + 数字 + 紫底白字徽章 ──
    const ach = computeAchievements();
    const unlocked = ach.filter(a => a.unlocked);
    ctx.fillStyle = textMain;
    ctx.font = 'bold 30px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('\u2726 ' + t('home.achievements.title') + ' ' + unlocked.length + '/' + ach.length + ' \u2726', W / 2, 940);

    const iconSize = 60, cols = 5, gap = 18;
    const shown = unlocked.slice(0, 10);
    if (shown.length > 0) {
        const totalW = cols * iconSize + (cols - 1) * gap;
        const rowCount = Math.ceil(shown.length / cols);
        const baseY = 970;
        ctx.textBaseline = 'middle';
        shown.forEach((a, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const x = (W - totalW) / 2 + col * (iconSize + gap);
            const y = baseY + row * (iconSize + 14) + (rowCount === 1 ? (iconSize + 14) / 4 : 0);
            const icX = x + iconSize / 2, icY = y + iconSize / 2 + 2;
            ctx.beginPath();
            ctx.arc(icX, icY, iconSize / 2 + 5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(108,92,231,0.95)';
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.98)';
            ctx.font = '36px ' + fontFamily;
            ctx.fillText(a.glyph || '\u2605', icX, icY + 2);
        });
        ctx.textBaseline = 'alphabetic';
    }

    // ── 右下角二维码（动态绘制，扫码访问平台）──
    const qrSize = 128;
    const qrX = W - 44 - qrSize;
    const qrY = H - 44 - qrSize;
    drawQrCode(ctx, 'https://stellar.gaocaihk.com/', qrX, qrY, qrSize, true);
}

// ── 海报二维码：把平台链接编码为二维码，扫码访问 ──
function drawQrCode(ctx, text, x, y, size, light) {
    if (typeof qrcode !== 'function') return; // 库未加载时跳过，不影响海报其余内容
    let qr;
    try {
        qr = qrcode(0, 'M');
        qr.addData(text);
        qr.make();
    } catch (e) {
        return;
    }
    const count = qr.getModuleCount();
    const cell = size / count;
    // 白底
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.fillRect(x - 5, y - 5, size + 10, size + 10);
    // 深色模块（浅色海报用深墨，深色海报用白）
    ctx.fillStyle = light ? 'rgba(45,35,25,0.95)' : 'rgba(255,255,255,0.98)';
    for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
            if (qr.isDark(r, c)) {
                ctx.fillRect(Math.round(x + c * cell), Math.round(y + r * cell), Math.ceil(cell), Math.ceil(cell));
            }
        }
    }
}

function copyPosterInvite() {
    const link = currentFamily && currentFamily.family ? currentFamily.family.invite_link : '';
    if (link) copyText(link, t('home.family.copied'));
    else showTemporaryMessage(t('home.family.invalidCode'), 'error');
}

async function downloadPoster() {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;
    await renderPoster();
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
    await renderPoster();
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
        moreBtn.onclick = () => showModule('achievements-module');
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

// ── 礼物模板（5 大类 50 个，一键填好名称/分/图） ──
const GT_CATS = [
    { key: 'time', icon: '⏰' },
    { key: 'priv', icon: '👑' },
    { key: 'fun',  icon: '🎉' },
    { key: 'exp',  icon: '🌟' },
    { key: 'item', icon: '🎁' }
];
let gtActiveCat = 'time';
let gtCustomMode = false;

function getGiftTemplates() {
    // 直接读 translations，避免 t() 旧版对对象返 key 字符串
    const lang = (typeof currentLanguage !== 'undefined' && currentLanguage)
              || localStorage.getItem('language')
              || 'zh';
    const dict = (typeof translations !== 'undefined' && translations && translations[lang]) || null;
    const raw = dict && dict.giftTemplates && dict.giftTemplates.list;
    if (!raw) console.warn('[gt] giftTemplates.list 缺失,lang=', lang);
    return raw || {};
}

function renderGiftTemplateTabs() {
    const box = document.getElementById('gt-tabs');
    if (!box) return;
    box.innerHTML = '';
    GT_CATS.forEach(cat => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gt-tab' + (cat.key === gtActiveCat ? ' is-active' : '');
        btn.dataset.cat = cat.key;
        btn.innerHTML = '<span class="gt-tab-ico">' + cat.icon + '</span><span class="gt-tab-name">' + escapeHtml(t('giftTemplates.cat.' + cat.key) || cat.key) + '</span>';
        btn.onclick = () => {
            gtActiveCat = cat.key;
            renderGiftTemplateTabs();
            renderGiftTemplateGrid();
        };
        box.appendChild(btn);
    });
}

function renderGiftTemplateGrid() {
    const grid = document.getElementById('gt-grid');
    if (!grid) { console.warn('[gt] #gt-grid 不存在'); return; }
    const list = getGiftTemplates();
    grid.innerHTML = '';
    const keys = Object.keys(list);
    if (keys.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'gt-empty';
        empty.textContent = t('giftTemplates.emptyHint') || '暂无可选模板';
        grid.appendChild(empty);
        return;
    }
    let count = 0;
    keys.forEach(key => {
        if (!key.startsWith(gtActiveCat + '_')) return;
        const tmpl = list[key];
        if (!tmpl || !tmpl.name) return;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'gt-card';
        // 时间/特权类用暖橙/淡紫底色突出，但不再每张卡加角标徽章（信息已在 tab 上）
        if (tmpl.badge === 'time') card.classList.add('gt-card--time');
        if (tmpl.badge === 'priv') card.classList.add('gt-card--priv');
        card.innerHTML = '<span class="gt-card-name">' + escapeHtml(tmpl.name) + '</span>'
            + '<span class="gt-card-desc">' + escapeHtml(tmpl.desc || '') + '</span>'
            + '<span class="gt-card-pts">' + (tmpl.points || 0) + ' <svg class="gt-coin" viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><circle cx="12" cy="12" r="9"/></svg></span>';
        card.onclick = () => fillGiftFromTemplate(tmpl);
        grid.appendChild(card);
        count++;
    });
    // 「自定义」卡片：作为当前分类最后一张卡
    const customCard = document.createElement('button');
    customCard.type = 'button';
    customCard.className = 'gt-card gt-card--custom';
    customCard.innerHTML = '<span class="gt-card-custom-plus">+</span>'
        + '<span class="gt-card-name">' + escapeHtml(t('giftTemplates.custom') || '自定义') + '</span>'
        + '<span class="gt-card-desc">' + escapeHtml(t('giftTemplates.customDesc') || '自己起名设分') + '</span>';
    customCard.onclick = () => setGiftCustomMode(true);
    grid.appendChild(customCard);
    if (count === 0) {
        // 分类下没模板时，customCard 已经作为唯一一张显示
        console.log('[gt] 分类', gtActiveCat, '无模板，只显示自定义卡');
    }
    console.log('[gt] 渲染', count, '个模板+自定义卡,分类=', gtActiveCat);
}

function fillGiftFromTemplate(tmpl) {
    const nameInput = document.getElementById('gift-name');
    const pointsInput = document.getElementById('gift-points');
    if (nameInput) {
        nameInput.value = tmpl.name || '';
        nameInput.focus();
        nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (pointsInput) pointsInput.value = tmpl.points || '';
    if (nameInput) {
        nameInput.classList.add('gt-flash');
        setTimeout(() => nameInput.classList.remove('gt-flash'), 700);
    }
}

function setGiftCustomMode(on) {
    gtCustomMode = !!on;
    const box = document.getElementById('gift-template-box');
    if (box) box.style.display = on ? 'none' : '';
    const btn = document.getElementById('gt-custom-btn');
    if (btn) btn.style.display = on ? 'none' : '';
    // 进入自定义时聚焦名称输入框
    if (on) {
        const nameInput = document.getElementById('gift-name');
        if (nameInput) {
            nameInput.value = '';
            nameInput.focus();
        }
        const ptsInput = document.getElementById('gift-points');
        if (ptsInput) ptsInput.value = '';
    }
}

function initGiftTemplates() {
    const customBtn = document.getElementById('gt-custom-btn');
    if (customBtn) customBtn.onclick = () => setGiftCustomMode(true);
    renderGiftTemplateTabs();
    renderGiftTemplateGrid();
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

        // 有图才渲染图区（电商图保留外链 badge；纯图直接展示）；
        // 无图时不渲染 .gc-media，避免默认占位图占满卡片上半部
        const hasImage = !!gift.image_url;
        if (hasImage) {
            const media = document.createElement('div');
            media.className = 'gc-media';
            const hasOriginalUrl = gift.original_url && isEcommerceUrl(gift.original_url);
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
            card.appendChild(media);
        }

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

        const result = await api.addBehavior(desc, change, { dimension: getSelectedBehaviorDimension() });
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
            showWishAchieveCard(gift);

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

// 礼物兑换 → 暖色「心愿达成」祝贺卡片（区别于成长成就证书）
function drawWishHeart(ctx, cx, cy, r) {
    // 简化的心形 path，居中绘制
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, r * 0.3);
    ctx.bezierCurveTo(0, -r * 0.4, -r, -r * 0.4, -r, r * 0.1);
    ctx.bezierCurveTo(-r, r * 0.7, -r * 0.2, r * 0.95, 0, r * 1.2);
    ctx.bezierCurveTo(r * 0.2, r * 0.95, r, r * 0.7, r, r * 0.1);
    ctx.bezierCurveTo(r, -r * 0.4, 0, -r * 0.4, 0, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#ff7a8a';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
}

function showWishAchieveCard(gift) {
    const canvas = document.getElementById('cert-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const profile = getSelectedProfile();
    const childName = profile.name || t('home.profile.add');
    const giftName = gift.name || '';
    const dateStr = new Date().toLocaleDateString(
        (localStorage.getItem('lang') || 'zh-CN').startsWith('en') ? 'en-US' : 'zh-CN'
    );

    // 暖色粉橘渐变背景
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#ffd6a5');
    grad.addColorStop(0.5, '#ffadad');
    grad.addColorStop(1, '#ff8fab');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // 白色卡片
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    const roundRect = (x, y, w, h, r) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    };
    roundRect(28, 28, W - 56, H - 56, 18);
    ctx.fill();

    // 顶部小彩带：3 个圆点
    [W / 2 - 60, W / 2, W / 2 + 60].forEach((x, i) => {
        ctx.beginPath();
        ctx.arc(x, 70, 8, 0, Math.PI * 2);
        ctx.fillStyle = ['#ff8fab', '#ffb300', '#6c5ce7'][i];
        ctx.fill();
    });

    // 标题：心愿达成
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d6336c';
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(t('common.wishAchieveTitle'), W / 2, 140);

    // 孩子名
    ctx.fillStyle = '#444';
    ctx.font = '24px sans-serif';
    ctx.fillText(childName, W / 2, 200);

    // 副标
    ctx.fillStyle = '#888';
    ctx.font = '18px sans-serif';
    ctx.fillText(t('common.wishAchieveSub'), W / 2, 232);

    // 礼物名（加引号、突出）
    ctx.fillStyle = '#d6336c';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('「' + (giftName || '') + '」', W / 2, 310);

    // 心形装饰
    drawWishHeart(ctx, W / 2, 410, 38);

    // 温暖祝福
    ctx.fillStyle = '#555';
    ctx.font = '20px sans-serif';
    ctx.fillText(t('common.wishAchieveBlessing'), W / 2, 490);

    // 底部日期 + 签名
    ctx.fillStyle = '#aaa';
    ctx.font = '15px sans-serif';
    ctx.fillText(dateStr, W / 2, H - 70);
    ctx.fillText(t('common.wishAchieveFoot'), W / 2, H - 45);

    document.getElementById('certificate-modal').style.display = 'flex';
    track('wish_achieved', { gift_id: gift.id });
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
        a.download = 'star-rewards-wish-' + (getSelectedProfile().name || 'wish') + '.png';
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
    updateV2ModuleStat();
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
    
    // 顶栏：未登录 → 显示紧凑登录按钮，隐藏用户芯片
    const chipWrap = document.getElementById('user-chip-wrap');
    if (chipWrap) chipWrap.style.display = 'none';
    const loginBtn = document.getElementById('topbar-login-btn');
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    
    // 隐藏需要登录的内容
    const pointsSection = document.getElementById('points-section');
    const giftsSection = document.getElementById('gifts-section');
    const redeemedSection = document.getElementById('redeemed-section');
    
    if (pointsSection) pointsSection.style.display = 'none';
    if (giftsSection) giftsSection.style.display = 'none';
    if (redeemedSection) redeemedSection.style.display = 'none';
    
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
    
    // 顶栏：已登录 → 显示用户芯片（头像+孩子名），隐藏登录按钮
    const chipWrap = document.getElementById('user-chip-wrap');
    if (chipWrap) chipWrap.style.display = 'block';
    const loginBtn = document.getElementById('topbar-login-btn');
    if (loginBtn) loginBtn.style.display = 'none';
    const emailEl = document.getElementById('um-email');
    if (emailEl) emailEl.textContent = user.email || '';
    renderProfileSwitcher();
    
    // 显示所有需要登录的内容
    const pointsSection = document.getElementById('points-section');
    const giftsSection = document.getElementById('gifts-section');
    const redeemedSection = document.getElementById('redeemed-section');
    
    if (pointsSection) pointsSection.style.display = 'block';
    if (giftsSection) giftsSection.style.display = 'block';
    if (redeemedSection) redeemedSection.style.display = 'block';

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
        setupH5();
        
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
        setupA2HS();
        setupPushReminder();

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

        // V2 全人成长：静默预载仪表盘数据（不影响主流程）
        loadV2Data();

        // 教育专栏（静态文章卡片，无需等待云数据）
        renderEduColumn();

        // 首次登录引导（仅首次，关闭后不再出现）
        maybeShowOnboarding();

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

        // 打卡记录由 loadV2Data→refreshCheckins 负责加载（节流），不再在首屏并发批量拉取，降低 DB 连接峰值

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
    // 顶栏用户芯片：当前孩子头像 + 名字
    const cur = (Array.isArray(profiles) ? profiles : []).find(p => p.id === selectedProfileId);
    const ucAvatar = document.getElementById('uc-avatar');
    const ucName = document.getElementById('uc-name');
    if (ucAvatar) ucAvatar.textContent = cur ? (cur.avatar || '⭐') : '⭐';
    if (ucName) ucName.textContent = cur ? (cur.name || '孩子') : t('home.profile.switch');

    // 下拉菜单：孩子列表
    const container = document.getElementById('um-children');
    if (!container) return;
    container.innerHTML = '';
    if (!profiles || profiles.length === 0) return;

    profiles.forEach(p => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'um-item um-child' + (p.id === selectedProfileId ? ' is-active' : '');
        item.innerHTML = '<span class="um-avatar">' + escapeHtml(p.avatar || '⭐') + '</span><span class="um-child-name">' + escapeHtml(p.name || '孩子') + '</span>' +
            (p.id === selectedProfileId ? '<svg class="um-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : '');
        item.onclick = () => switchProfile(p.id);
        container.appendChild(item);
    });
}

// ── 顶栏用户菜单（选择孩子 / 家庭 / 退出） ──
function toggleUserMenu(event) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('user-menu');
    if (!menu) return;
    menu.hidden = !menu.hidden;
}
function closeUserMenu() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.hidden = true;
}
document.addEventListener('click', (e) => {
    const wrap = document.getElementById('user-chip-wrap');
    if (wrap && !wrap.contains(e.target)) closeUserMenu();
});

async function switchProfile(profileId) {
    if (profileId === selectedProfileId) return;
    try {
        await api.setSelectedProfile(profileId);
        selectedProfileId = profileId;
        await loadDataFromCloud();
        updateUI();
        renderProfileSwitcher();
        closeUserMenu();
        // V2：切换孩子后重置仪表盘缓存并刷新
        v2Data = null;
        v2PrevUnlocked = null;
        loadV2Data();
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

    // 邀请进度：成员数 / 1 起步（有 2+ 成员=完成一次邀请）
    const memberCount = (currentFamily.members || []).length;
    const progressBox = document.getElementById('family-invite-progress-box');
    const progressVal = document.getElementById('family-invite-progress-val');
    const progressFill = document.getElementById('family-invite-progress-fill');
    if (progressBox && progressVal && progressFill) {
        const invited = Math.max(0, memberCount - 1);   // 除自己外
        const pct = Math.min(100, Math.round((invited / 1) * 100));
        progressVal.textContent = invited + '/1';
        progressFill.style.width = (invited > 0 ? pct : 0) + '%';
        progressBox.style.display = isOwner ? 'block' : 'none';
    }
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
        initGiftTemplates();
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

    // 成长成就：切到该页时重新渲染（修复隐藏容器下 canvas 尺寸为 0、数据更新）
    if (moduleId === 'achievements-module') {
        renderCalendar();
        renderCalendarDayDetail();
        renderPointsChart();
        loadV2Data();
        renderAchStats();
        renderRedeemSummary();
    }

    // 目标：首次进入展示三步引导，并确保愿望列表已渲染
    if (moduleId === 'gifts-module') {
        maybeShowV2Guide();
        loadV2Data();
    }

    // 首页：确保今日打卡/总览已渲染
    if (moduleId === 'points-module') {
        loadV2Data();
    }

    // 悬浮快速记分按钮只在积分页显示
    const fab = document.getElementById('quick-add-fab');
    if (fab) {
        fab.style.display = (moduleId === 'points-module') ? 'flex' : 'none';
    }
    
    console.log('切换到模块:', moduleId);
}

// 悬浮按钮：回到首页「今日打卡」卡
function quickCheckin() {
    showModule('points-module');
    const el = document.getElementById('today-checkin');
    if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ── 添加到主屏幕引导（A2HS）──
let deferredInstallPrompt = null;
function isStandaloneMode() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
        (window.navigator.standalone === true) ||
        (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches);
}
function isIOSDevice() {
    return /iP(hone|od|ad)/.test(navigator.userAgent) && !window.MSStream;
}
function a2hsDismiss() {
    try { localStorage.setItem('a2hs_dismissed', '1'); } catch (e) {}
    const b = document.getElementById('a2hs-banner');
    if (b) b.style.display = 'none';
}
function a2hsCloseIos() {
    const o = document.getElementById('a2hs-ios-overlay');
    if (o) o.style.display = 'none';
}
function a2hsCloseManual() {
    const o = document.getElementById('a2hs-manual-overlay');
    if (o) o.style.display = 'none';
}
function a2hsInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        if (deferredInstallPrompt.userChoice && deferredInstallPrompt.userChoice.finally) {
            deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
        }
        return;
    }
    if (isIOSDevice()) {
        const o = document.getElementById('a2hs-ios-overlay');
        if (o) o.style.display = 'flex';
        return;
    }
    // Android 无安装提示可用（首次访问/微信内）：给出浏览器菜单手动安装步骤
    const o = document.getElementById('a2hs-manual-overlay');
    if (o) {
        const note = document.getElementById('a2hs-wechat-note');
        if (note) note.style.display = /MicroMessenger|QQ/i.test(navigator.userAgent) ? 'block' : 'none';
        o.style.display = 'flex';
    }
}
function setupA2HS() {
    if (isStandaloneMode()) return;
    let dismissed = false;
    try { dismissed = !!localStorage.getItem('a2hs_dismissed'); } catch (e) {}
    if (dismissed) return;
    const isMobile = /Mobi|Android|iPhone|iPad/.test(navigator.userAgent) || (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    if (!isMobile) return;
    setTimeout(() => {
        const b = document.getElementById('a2hs-banner');
        if (!b || b.style.display === 'flex') return;
        const openModal = document.querySelector('.modal-overlay[style*="flex"]');
        if (!openModal) b.style.display = 'flex';
    }, 2500);
}
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    try { if (localStorage.getItem('a2hs_dismissed')) return; } catch (err) {}
    if (isStandaloneMode()) return;
    const b = document.getElementById('a2hs-banner');
    if (b) b.style.display = 'flex';
});
window.addEventListener('appinstalled', () => { a2hsDismiss(); deferredInstallPrompt = null; });

// ── 微信/应用内浏览器提示：建议用系统浏览器打开 ──
function closeWechatHint() {
    const el = document.getElementById('wechat-browser-hint');
    if (el) el.style.display = 'none';
}
function setupH5() {
    if (/MicroMessenger|QQ/i.test(navigator.userAgent)) {
        const el = document.getElementById('wechat-browser-hint');
        if (el) el.style.display = 'flex';
    }
}

// ── Web Push 打卡提醒 ──
const PUSH_VAPID_PUBLIC = 'BLVaoZiNBa--RnEpgOg40pd6cLrpxXOe5oYZhg_Q0LsY_-w-oLhWgvjY06cADVwpS3NaiZQBIE1r1xLLFrAlte4';
function pushState() { try { return localStorage.getItem('push_reminder') === '1'; } catch (e) { return false; } }
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
}
function pushSupported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}
async function setupPushReminder() {
    renderPushToggle();
    // 已开启提醒：每次进入 App 触发一次每日提醒检查（免 cron 兜底）
    if (pushState()) {
        api.sendDailyReminder().catch(() => {});
    }
}
function renderPushToggle() {
    const el = document.getElementById('push-toggle-row');
    if (!el) return;
    if (!pushSupported()) { el.style.display = 'none'; return; }
    el.style.display = 'flex';
    const label = document.getElementById('push-toggle-label');
    if (label) label.textContent = t(pushState() ? 'v2.pushOn' : 'v2.pushOff');
    const box = document.getElementById('push-toggle');
    if (box) box.checked = pushState();
}
async function togglePushReminder() {
    const el = document.getElementById('push-toggle');
    const want = !!(el && el.checked);
    try {
        if (want) {
            const perm = await Notification.requestPermission();
            if (perm !== 'granted') {
                if (el) el.checked = false;
                showTemporaryMessage(t('v2.pushDenied'), 'error');
                return;
            }
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUSH_VAPID_PUBLIC)
            });
            await api.savePushSubscription(sub, true);
            try { localStorage.setItem('push_reminder', '1'); } catch (e) {}
        } else {
            await api.savePushSubscription(null, false);
            try { localStorage.setItem('push_reminder', '0'); } catch (e) {}
        }
        renderPushToggle();
        showTemporaryMessage(want ? t('v2.pushEnabled') : t('v2.pushDisabled'), 'success');
    } catch (e) {
        if (el) el.checked = !want;
        showTemporaryMessage((e && e.message) || t('common.error'), 'error');
    }
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

    // 收集当月每日活动：积分行为（正负） + 打卡 + 兑换
    const byDay = {};
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        const d = new Date(b.timestamp);
        if (isNaN(d)) return;
        const key = calendarDateKey(d);
        if (!byDay[key]) byDay[key] = { earned: 0, redeemed: 0, checkins: 0, items: [] };
        const pts = Number(b.points) || 0;
        if (pts > 0) byDay[key].earned += pts;
        byDay[key].items.push({ type: 'b', id: b.id, points: pts, desc: b.description || '' });
    });
    (Array.isArray(checkins) ? checkins : []).forEach(c => {
        const key = c.checkin_date;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        if (!byDay[key]) byDay[key] = { earned: 0, redeemed: 0, checkins: 0, items: [] };
        byDay[key].checkins += 1;
        byDay[key].items.push({ type: 'c', id: c.id, points: 5, desc: c.wish_title || '' });
    });
    (Array.isArray(redeemedGifts) ? redeemedGifts : []).forEach(r => {
        const d = new Date(r.redeem_date || r.created_at);
        if (isNaN(d)) return;
        const key = calendarDateKey(d);
        if (!byDay[key]) byDay[key] = { earned: 0, redeemed: 0, checkins: 0, items: [] };
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
        if (day && day.redeemed > 0) cls += ' has-redeemed';
        let inner = `<span class="cal-day-num">${d}</span>`;
        if (day && (day.earned > 0 || day.redeemed > 0 || day.checkins > 0)) {
            inner += '<span class="cal-day-marks">';
            if (day.earned > 0) inner += `<span class="cal-mark cal-earned">+${day.earned}</span>`;
            if (day.checkins > 0) inner += `<span class="cal-mark cal-checkin"><svg class="cal-mark-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>+${day.checkins * 5}</span>`;
            if (day.redeemed > 0) inner += `<span class="cal-mark cal-redeemed"><svg class="cal-mark-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg>-${day.redeemed}</span>`;
            inner += '</span>';
        }
        html += `<span class="${cls}" onclick="calendarSelectDay('${key}')" title="${key}">${inner}</span>`;
    }
    html += '</div>';
    grid.innerHTML = html;
    renderRedeemSummary();
}

// 愿望达成汇总：日历下方三栏（达成愿望数 / 兑换次数 / 消耗积分）
function renderRedeemSummary() {
    const el = document.getElementById('redeem-summary');
    if (!el) return;
    const list = Array.isArray(redeemedGifts) ? redeemedGifts : [];
    const distinct = new Set(list.map(r => (r.name || '').trim())).size;
    const totalPts = list.reduce((s, r) => s + (Number(r.points) || 0), 0);
    const setText = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    setText('rs-count', distinct);
    setText('rs-times', list.length);
    setText('rs-points', totalPts);
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
    (Array.isArray(checkins) ? checkins : []).forEach(c => {
        if (c.checkin_date === calendarSelectedDay) {
            const note = c.note ? ('：' + c.note) : '';
            items.push({ type: 'c', id: c.id, points: 5, desc: (c.wish_title || t('v2.checkin')) + note });
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
        } else if (it.type === 'c') {
            html += `<div class="cal-detail-item checkin"><svg class="cal-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#6C5CE7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span class="cal-detail-pts pos">+${it.points}</span><span class="cal-detail-desc">${escapeHtml(it.desc)}</span></div>`;
        } else {
            html += `<div class="cal-detail-item gift"><svg class="cal-detail-icon" viewBox="0 0 24 24" fill="none" stroke="#F5A524" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M3 12v9h18v-9"/><path d="M12 8C12 8 10 3 7.5 4.5S8 8 12 8zM12 8c0 0 2-5 4.5-3.5S16 8 12 8z"/></svg><span class="cal-detail-pts neg">-${it.points}</span><span class="cal-detail-desc">${escapeHtml(it.desc)}</span></div>`;
        }
    });
    panel.innerHTML = html;
    panel.style.display = 'block';
}
// ════════════════════════════════════════════════════════════
// V2 全人版愿望清单体系 — 前端逻辑（2026-08-13 追加模块）
// 8 大素养 × 愿望/打卡/指标/徽章；数据由 get_v2_overview 一次性提供
// ════════════════════════════════════════════════════════════

const V2_CATS = [
    { code: 'self_drive',   short: '自驱' },
    { code: 'money',        short: '理财' },
    { code: 'empathy',      short: '共情' },
    { code: 'relationship', short: '社交' },
    { code: 'planning',     short: '规划' },
    { code: 'resilience',   short: '抗挫' },
    { code: 'health',       short: '健康' },
    { code: 'aesthetics',   short: '审美' }
];

const V2_BADGE_SVGS = {
    self_drive: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    money: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="17"/><path d="M9.5 9.5c0-1 1.1-1.5 2.5-1.5s2.5.5 2.5 1.5-1.1 1.5-2.5 1.5-2.5.5-2.5 1.5 1.1 1.5 2.5 1.5 2.5-.5 2.5-1.5"/></svg>',
    empathy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    relationship: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    planning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
    resilience: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="8.5 11.5 11 14 15.5 9"/></svg>',
    health: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
    aesthetics: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><circle cx="11" cy="11" r="2"/></svg>',
    all_rounder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c1.8 2.4 4.6 3.6 7.5 3.5-0.4 3-1.6 5.7-4 7.5 2.4 1.8 3.6 4.5 4 7.5-2.9-.1-5.7 1.1-7.5 3.5-1.8-2.4-4.6-3.6-7.5-3.5 0.4-3 1.6-5.7 4-7.5-2.4-1.8-3.6-4.5-4-7.5 2.9.1 5.7-1.1 7.5-3.5z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    persist_21: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/></svg>',
    invite_friend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'
};

let v2Data = null;          // get_v2_overview 缓存
let v2PrevUnlocked = null;  // 徽章解锁状态（用于「新徽章」提示）
let v2CoveredCount = 0;

// 注：CSS 变量名使用连字符（--cat-self-drive），而 DB 里的 category code 用下划线（self_drive），
// 因此在生成 var() 引用时把下划线转成连字符，避免 var(--cat-self_drive) 失效导致色块变透明
function v2CatVar(code) { return 'var(--cat-' + (code || '').replace(/_/g, '-') + ')'; }
function v2CatSoftVar(code) { return 'var(--cat-' + (code || '').replace(/_/g, '-') + '-soft)'; }

// 行为表单素养标注（激活 behaviors.dimension）
function getSelectedBehaviorDimension() {
    const el = document.getElementById('behavior-dimension');
    return el ? el.value : '';
}

// 拉取该档案的打卡记录（含补卡），供成长日历按日期展示
// 节流：同一分钟内最多拉取一次（force=true 强制刷新，用于打卡/补卡后），
// 避免每次切换模块/每次操作都多发一个 get_checkins 请求把 DB 连接配额打满
let lastCheckinsRefresh = 0;
async function refreshCheckins(force = false) {
    if (!api.getToken()) { checkins = []; return; }
    const now = Date.now();
    if (!force && now - lastCheckinsRefresh < 60000) return;
    lastCheckinsRefresh = now;
    try {
        const res = await api.getCheckins(0);
        checkins = (res && Array.isArray(res.checkins)) ? res.checkins : [];
    } catch (e) {
        console.warn('checkins load failed:', e);
    }
}

async function loadV2Data(forceCheckins = false) {
    if (!api.getToken()) return null;
    try {
        v2Data = await api.getV2Overview();
        await refreshCheckins(forceCheckins);
        renderV2All();
        updateDiaryList();   // 打卡记录就绪后刷新成长日历（含本周成长）
        return v2Data;
    } catch (e) {
        console.warn('V2 overview load failed:', e);
        return null;
    }
}

function renderV2All() {
    if (!v2Data) return;
    renderQuickBehaviorCat();
    renderV2Flower();
    renderV2Legend();
    renderV2Focus();
    renderV2Suggestions();
    renderV2Wishes();
    renderV2Badges();
    renderV2Indicators();
    renderV2Report();
    renderHomeCheckin();
    renderAchStats();
    updateV2ModuleStat();
}

// ── 行为记录卡（V2 临时加分入口）──
function renderQuickBehaviorCat() {
    const sel = document.getElementById('qb-cat');
    if (!sel) return;
    if (sel.children.length) return;  // 只渲染一次
    sel.innerHTML = V2_CATS.map(c =>
        '<option value="' + c.code + '">' + escapeHtml(c.short) + ' · ' + escapeHtml(t('v2.badge.' + c.code)) + '</option>'
    ).join('');
}
function qbStep(delta) {
    const el = document.getElementById('qb-pts');
    if (!el) return;
    const v = Math.max(1, Math.min(20, (parseInt(el.value, 10) || 0) + delta));
    el.value = v;
}
async function quickAddBehavior() {
    const descEl = document.getElementById('qb-desc');
    const catEl = document.getElementById('qb-cat');
    const ptsEl = document.getElementById('qb-pts');
    if (!descEl || !catEl || !ptsEl) return;
    const desc = descEl.value.trim();
    const cat = catEl.value;
    const pts = parseInt(ptsEl.value, 10);
    if (!desc) { descEl.focus(); showTemporaryMessage(t('common.enterBehaviorDesc'), 'error'); return; }
    if (!pts || pts < 1) { ptsEl.focus(); showTemporaryMessage(t('common.enterValidPointsPositive'), 'error'); return; }
    try {
        await api.addBehavior(desc, pts, { dimension: cat });
        track('quick_add_behavior', { points: pts, category: cat });
        const catObj = V2_CATS.find(x => x.code === cat);
        showTemporaryMessage(t('home.recordBehaviorSuccess', { points: pts, cat: catObj ? catObj.short : cat }), 'success');
        descEl.value = '';
        ptsEl.value = 3;
        // 立即刷新（积分/雷达图/指标）
        try { v2Data = await api.getV2Overview(); renderV2All(); } catch (e) {}
        try {
            const prof = await api.getProfile();
            if (prof && typeof prof.current_points === 'number') {
                currentPoints = prof.current_points;
                updatePointsDisplay();
            }
        } catch (e) {}
    } catch (e) {
        showTemporaryMessage(t('common.addPointsFailed') + (e && e.error ? ': ' + e.error : ''), 'error');
    }
}
function renderHomeCheckin() {
    const el = document.getElementById('today-checkin-list');
    if (!el) return;
    try {
        const wishes = (v2Data && v2Data.wishes) || [];
        const active = wishes.filter(w => w.status !== 'achieved' && w.wish_type !== 'experience');
        if (!active.length) {
            el.innerHTML = '<div class="today-checkin-empty"><span>' + escapeHtml(t('v2.emptyWishes')) + '</span>' +
                '<button type="button" class="add-points-btn" onclick="showModule(\'gifts-module\')"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>' + escapeHtml(t('home.setGoalCta')) + '</span></button></div>';
            return;
        }
        const fallbackCat = (typeof V2_CATS !== 'undefined' && V2_CATS[0]) || { code: 'self_drive', short: '自驱' };
        el.innerHTML = active.map(w => {
            const c = (typeof V2_CATS !== 'undefined' && V2_CATS.find(x => x.code === w.category)) || fallbackCat;
            const done = !!w.today_checked;
            const checkinBtn = done
                ? '<button type="button" class="v2-checkin-btn is-done" disabled><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + escapeHtml(t('v2.checkedIn')) + '</button>'
                : '<button type="button" class="v2-checkin-btn" onclick="v2Checkin(' + w.id + ')"><svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' + escapeHtml(t('v2.checkin')) + ' +5</button>';
            const makeupBtn = '<button type="button" class="v2-makeup-btn tci-makeup" onclick="openMakeupCheckin(' + w.id + ')" title="' + escapeHtml(t('v2.makeupTip')) + '">' +
                '<svg class="btn-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>' +
                '<span class="tmi-text">' + escapeHtml(t('v2.makeup')) + '</span></button>';
            return '<div class="today-checkin-row" style="--pc:' + v2CatVar(c.code) + ';--pc-soft:' + v2CatSoftVar(c.code) + '">' +
                '<span class="tci-cat">' + c.short + '</span>' +
                '<div class="tci-main">' +
                    '<span class="tci-title">' + escapeHtml(w.title || '') + '</span>' +
                    '<span class="tci-streak">' + escapeHtml(t('v2.streak', { n: w.streak || 0 })) + '</span>' +
                '</div>' +
                '<div class="tci-actions">' + checkinBtn + makeupBtn + '</div>' +
            '</div>';
        }).join('');
    } catch (err) {
        console.error('renderHomeCheckin 失败:', err);
        el.innerHTML = '<div class="today-checkin-empty"><span>' + escapeHtml(t('common.error')) + '，请刷新重试</span></div>';
    }
}

// ── 成长成就页：汇总统计条 ──
function renderAchStats() {
    const el = document.getElementById('ach-stats');
    if (!el || !v2Data) { if (el) el.innerHTML = ''; return; }
    const wishes = v2Data.wishes || [];
    const achievedGoals = wishes.filter(w => w.status === 'achieved').length;
    const checkinDays = wishes.reduce((s, w) => s + (w.streak || 0), 0);
    const badges = v2Data.badges || {};
    const badgeCount = Object.values(badges).filter(b => b && b.unlocked).length;
    const cov = Object.values((v2Data.coverage || {})).filter(c => c && c.active).length;
    const unit = getLanguage() === 'en' ? ' goals' : ' 个目标';
    el.innerHTML =
        '<div class="ach-stat"><span class="as-val">' + achievedGoals + '</span><span class="as-label">' + escapeHtml(t('ach.statGoals')) + '</span></div>' +
        '<div class="ach-stat"><span class="as-val">' + checkinDays + '</span><span class="as-label">' + escapeHtml(t('ach.statCheckins')) + '</span></div>' +
        '<div class="ach-stat"><span class="as-val">' + badgeCount + '/' + Object.keys(badges).length + '</span><span class="as-label">' + escapeHtml(t('ach.statBadges')) + '</span></div>' +
        '<div class="ach-stat"><span class="as-val">' + cov + '/8</span><span class="as-label">' + escapeHtml(t('ach.statRose')) + '</span></div>';
    renderWeeklyReport();
}

// ── 本周成长：本周打卡次数 / 获得积分 / 统计区间 ──
function renderWeeklyReport() {
    const el = document.getElementById('weekly-stats');
    if (!el) return;
    const now = new Date();
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const monKey = key(mon);
    const sunKey = key(new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6));
    let checkins = 0, pts = 0;
    (Array.isArray(checkins) ? checkins : []).forEach(c => {
        if (c.checkin_date >= monKey && c.checkin_date <= sunKey) { checkins++; pts += 5; }
    });
    (Array.isArray(behaviors) ? behaviors : []).forEach(b => {
        const d = new Date(b.timestamp);
        if (!isNaN(d)) {
            const k = key(d);
            if (k >= monKey && k <= sunKey && Number(b.points) > 0) pts += Number(b.points);
        }
    });
    el.innerHTML =
        '<div class="ws-stat"><span class="ws-value">' + checkins + '</span><span class="ws-label">' + escapeHtml(t('v2.weeklyCheckins')) + '</span></div>' +
        '<div class="ws-stat"><span class="ws-value">+' + pts + '</span><span class="ws-label">' + escapeHtml(t('v2.weeklyPoints')) + '</span></div>' +
        '<div class="ws-stat ws-stat--closest"><span class="ws-value">' + escapeHtml(monKey.slice(5)) + '~' + escapeHtml(sunKey.slice(5)) + '</span><span class="ws-label">' + escapeHtml(t('v2.weeklyRange')) + '</span></div>';
}

// ── 全人玫瑰：8 瓣覆盖 + 全能小星星进度 ──
// ── 全人玫瑰：8 瓣圆形环（对应八瓣玫瑰理论），中心显示覆盖数 ──
// 素养积累分：行为记录 ×1 + 达成愿望 ×3（持续积累，不是一次性点亮）
function v2CatScore(cov) {
    if (!cov) return 0;
    return (cov.behaviors || 0) + (cov.wishes_achieved || 0) * 3;
}
// 水平分级：0 未开始 / 1 萌芽 / 2 成长 / 3 绽放
function v2CatLevel(cov) {
    const s = v2CatScore(cov);
    if (s <= 0) return 0;
    if (s <= 3) return 1;
    if (s <= 7) return 2;
    return 3;
}

// 单瓣水滴形（尖端贴近花心 100,90，向外延伸至 y≈8），径向排列成玫瑰
function v2PetalPath() {
    // 尖端(近花心) (100,90)，外端圆润 (100,12)，最宽处 x≈80/120
    return 'M100 90 C 86 78 80 40 100 12 C 120 40 114 78 100 90 Z';
}
// 内瓣（成长/绽放时叠加，营造层叠花瓣感）
function v2PetalInner() {
    return 'M100 84 C 90 74 86 46 100 22 C 114 46 110 74 100 84 Z';
}

function renderV2Flower() {
    const el = document.getElementById('v2-flower');
    if (!el || !v2Data) return;
    const covMap = v2Data.coverage || {};
    v2CoveredCount = 0;
    const N = V2_CATS.length;          // 8
    const cx = 100, cy = 100, R = 72;  // viewBox 200x200
    const angle = i => (-90 + i * 360 / N) * Math.PI / 180;
    const pt = (i, r) => [cx + Math.cos(angle(i)) * r, cy + Math.sin(angle(i)) * r];
    const raw = V2_CATS.map(c => v2CatScore(covMap[c.code] || {}));
    const maxRaw = Math.max(8, ...raw);
    const vals = raw.map(s => Math.round(s / maxRaw * 100));

    // 花瓣：8 瓣完全相同（统一柔色），仅作为花朵外形框架；强弱差异完全由雷达数据表达
    let petals = '';
    V2_CATS.forEach((c, i) => {
        const ang = i * 45;                 // 顶部开始、顺时针 45° 一瓣
        const cov = covMap[c.code] || { behaviors: 0, wishes_achieved: 0 };
        const score = v2CatScore(cov);
        if (score > 0) v2CoveredCount++;
        const labelRot = ang <= 180 ? ang : ang - 360; // 标签始终正立
        petals +=
            '<g class="petal-g" transform="rotate(' + ang + ' ' + cx + ' ' + cy + ')" title="' + escapeHtml(t('v2.badge.' + c.code)) + '">' +
                '<path class="petal-bg" d="' + v2PetalPath() + '"/>' +
            '</g>' +
            '<g class="petal-label" transform="rotate(' + ang + ' ' + cx + ' ' + cy + ') translate(100 4) rotate(' + (-labelRot) + ')">' +
                '<text class="petal-label-txt" text-anchor="middle">' + c.short + '</text>' +
            '</g>';
    });

    // 雷达参考网格（作为底层背景，最外圈 = 范围边界，清晰可见）+ 轴线
    let refRings = '';
    [25, 50, 75, 100].forEach(g => {
        const pts = V2_CATS.map((_, i) => pt(i, R * g / 100).map(n => n.toFixed(1)).join(',')).join(' ');
        refRings += '<polygon class="radar-ring' + (g === 100 ? ' outer' : '') + '" points="' + pts + '"/>';
    });
    let axes = '';
    V2_CATS.forEach((c, i) => {
        const [x, y] = pt(i, R);
        axes += '<line class="radar-axis" x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
    });
    const dpts = V2_CATS.map((_, i) => pt(i, R * vals[i] / 100).map(n => n.toFixed(1)).join(',')).join(' ');
    const dots = V2_CATS.map((_, i) => {
        const [x, y] = pt(i, R * vals[i] / 100);
        return '<circle class="radar-dot" cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4"/>';
    }).join('');

    el.innerHTML =
        '<svg class="v2-flower-svg" viewBox="0 0 200 200" role="img" aria-label="' + escapeHtml(t('v2.flowerTitle')) + '">' +
            '<circle class="rose-halo" cx="' + cx + '" cy="' + cy + '" r="96"/>' +
            '<g class="radar-backdrop">' + refRings + axes + '</g>' +
            '<g class="rose-petals">' + petals + '</g>' +
            '<g class="radar-overlay">' +
                '<polygon class="radar-area" points="' + dpts + '"/>' + dots +
            '</g>' +
        '</svg>';

    const fill = document.getElementById('v2-ar-fill');
    if (fill) fill.style.width = (v2CoveredCount / 8 * 100) + '%';
    const cnt = document.getElementById('v2-ar-count');
    if (cnt) cnt.textContent = v2CoveredCount + '/8';

    // 强弱总结（最强 3 + 最弱 2）
    const ranked = V2_CATS.map((c, i) => ({ code: c.code, short: c.short, v: vals[i] }))
        .sort((a, b) => b.v - a.v);
    const top = ranked.slice(0, 3).filter(x => x.v > 0);
    const bottom = ranked.slice(-2).filter(x => x.v < 100);
    const sumEl = document.getElementById('v2-flower-summary');
    if (sumEl) {
        if (!top.length) {
            sumEl.textContent = t('v2.flowerEmpty');
        } else {
            const strongTxt = top.map(x => x.short).join('、');
            const weakTxt = bottom.length ? bottom.map(x => x.short).join('、') : '';
            sumEl.innerHTML = t('v2.flowerSummary', { strong: strongTxt, weak: weakTxt });
        }
    }
}

// ── 素养图鉴（JS 渲染，名称与花瓣标签一致：二字素养名 + 小名） ──
function renderV2Legend() {
    const el = document.getElementById('v2-legend');
    if (!el) return;
    el.innerHTML = V2_CATS.map(c =>
        '<div class="v2-legend-row" style="--pc:' + v2CatVar(c.code) + ';--pc-soft:' + v2CatSoftVar(c.code) + '">' +
            '<span class="v2-legend-dot"></span>' +
            '<span class="v2-legend-name"><b>' + c.short + '</b> ' + escapeHtml(t('v2.badge.' + c.code)) + '</span>' +
            '<span class="v2-legend-desc">' + escapeHtml(t('v2.badgeDesc.' + c.code)) + '</span>' +
        '</div>'
    ).join('');
}

// ── 本月主打瓣 ──
function renderV2Focus() {
    const el = document.getElementById('v2-focus-chips');
    if (!el || !v2Data) return;
    el.innerHTML = V2_CATS.map(c => {
        const on = v2Data.focus === c.code;
        return '<button type="button" class="v2-focus-chip ' + (on ? 'is-active' : '') + '" style="--pc:' + v2CatVar(c.code) + '" onclick="v2SetFocus(\'' + c.code + '\')">' +
            '<span class="fc-dot"></span>' + escapeHtml(t('v2.badge.' + c.code)) +
        '</button>';
    }).join('');
    const hint = document.getElementById('v2-focus-hint');
    if (hint) {
        if (v2Data.focus) {
            hint.style.display = 'flex';
            hint.textContent = t('v2.focusHint');
        } else {
            hint.style.display = 'none';
        }
    }
}

async function v2SetFocus(code) {
    try {
        await api.setMonthlyFocus(code);
        if (v2Data) v2Data.focus = code;
        renderV2Focus();
        renderV2Flower();
        renderV2Suggestions();
        showTemporaryMessage(t('v2.focusSetDone'), 'success');
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

// ── 右侧成长建议：本月主打 = 用户已选 focus；副推 = 剩余最弱 2 项 ──
function renderV2Suggestions() {
    const el = document.getElementById('v2-suggest');
    if (!el || !v2Data) return;
    try {
        const covMap = v2Data.coverage || {};
        const rank = V2_CATS.map(c => ({ c, v: v2CatScore(covMap[c.code] || {}) }))
            .sort((a, b) => a.v - b.v); // 升序：最弱在前
        if (!rank.some(x => x.v > 0)) {
            el.innerHTML =
                '<div class="v2-suggest-card v2-suggest-empty">' +
                    '<div class="v2-suggest-kicker">' + escapeHtml(t('v2.suggestTitle')) + '</div>' +
                    '<p class="v2-suggest-empty-txt">' + escapeHtml(t('v2.suggestEmpty')) + '</p>' +
                '</div>';
            return;
        }
        // 主推 = 用户已选的 focus（本月主打）；若未选或已选 code 失效则回退到最弱
        const focusCode = v2Data.focus;
        const focusObj = focusCode ? V2_CATS.find(x => x.code === focusCode) : null;
        const focus = focusObj || rank[0].c;
        // 副推 = 排除 focus 后最弱的 2 项
        const others = rank.filter(x => x.c.code !== focus.code).slice(0, 2);
        const isFocus = !!focusObj;
        let html =
            '<div class="v2-suggest-card">' +
                '<div class="v2-suggest-kicker">' + escapeHtml(t('v2.suggestTitle')) + '</div>' +
                '<div class="v2-suggest-focus">' +
                    '<span class="v2-suggest-cat" style="--pc:' + v2CatVar(focus.code) + '">' + focus.short + '</span>' +
                    '<div class="v2-suggest-focus-body">' +
                        '<div class="v2-suggest-focus-name">' + escapeHtml(t('v2.badge.' + focus.code)) + '</div>' +
                        '<div class="v2-suggest-focus-desc">' + escapeHtml(t('v2.suggestWeak', { name: focus.short })) + '</div>' +
                    '</div>' +
                    (isFocus
                        ? '<button type="button" class="v2-suggest-btn is-done" disabled>' + escapeHtml(t('v2.suggestDone')) + '</button>'
                        : '<button type="button" class="v2-suggest-btn" onclick="v2SetFocus(\'' + focus.code + '\')">' + escapeHtml(t('v2.suggestSet')) + '</button>') +
                '</div>';
        if (others.length) {
            html +=
                '<div class="v2-suggest-divider"></div>' +
                '<div class="v2-suggest-sub">' + escapeHtml(t('v2.suggestStrengthen')) + '</div>' +
                '<div class="v2-suggest-list">' +
                    others.map(o =>
                        '<div class="v2-suggest-item"><span class="v2-suggest-dot" style="--pc:' + v2CatVar(o.c.code) + '"></span>' +
                        '<span>' + o.c.short + ' · ' + escapeHtml(t('v2.badge.' + o.c.code)) + '</span></div>'
                    ).join('') +
                '</div>';
        }
        html += '</div>';
        el.innerHTML = html;
    } catch (e) {
        console.warn('renderV2Suggestions 渲染失败:', e);
        el.innerHTML = '<div class="v2-suggest-card v2-suggest-empty"><div class="v2-suggest-kicker">' + escapeHtml(t('v2.suggestTitle')) + '</div><p class="v2-suggest-empty-txt">—</p></div>';
    }
}

// ── 成长愿望列表 ──
function renderV2Wishes() {
    const el = document.getElementById('v2-wish-list');
    if (!el || !v2Data) return;
    const wishes = v2Data.wishes || [];
    if (!wishes.length) {
        el.innerHTML = '<div class="v2-empty">' + escapeHtml(t('v2.emptyWishes')) + '</div>';
        return;
    }
    el.innerHTML = wishes.map(w => {
        const c = V2_CATS.find(x => x.code === w.category) || V2_CATS[0];
        const achieved = w.status === 'achieved';
        const isExp = w.wish_type === 'experience';
        const pct = achieved ? 100 : (w.progress || 0);
        const stageKey = ({ building: 'stageBuilding', stable: 'stageStable', internalizing: 'stageInternalizing' })[w.stage] || 'stageBuilding';
        const stageTag = achieved
            ? '<span class="v2-tag v2-tag--achieved">' + escapeHtml(t('v2.achieved')) + '</span>'
            : '<span class="v2-tag v2-tag--stage">' + escapeHtml(t('v2.' + stageKey)) + (isExp ? '' : ' · ' + (w.streak || 0) + '/' + (w.persistence_days || 0)) + '</span>';
        const starsTag = '<span class="v2-tag">★ ' + w.stars + '</span>';
        const priceTag = isExp && !achieved ? '<span class="v2-tag v2-tag--warn">' + escapeHtml(t('v2.pointsTarget', { points: w.points_target })) + '</span>' : '';
        const actions = [];
        if (!achieved) {
            if (!isExp) {
                // 打卡/补卡已移到首页「今日打卡」，目标页仅做目标管理
                if (w.internalized) {
                    actions.push('<button type="button" class="v2-complete-btn" onclick="v2ExitProtocol(' + w.id + ')">' + escapeHtml(t('v2.exitProtocol')) + '</button>');
                }
            } else {
                actions.push('<button type="button" class="v2-complete-btn" onclick="v2CompleteWish(' + w.id + ')">' + escapeHtml(t('v2.completeWish')) + '</button>');
            }
        }
        actions.push('<button type="button" class="v2-del-btn" title="' + escapeHtml(t('common.delete')) + '" onclick="v2DeleteWish(' + w.id + ')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>');
        return '<div class="v2-wish-card ' + (achieved ? 'is-achieved' : '') + '" style="--pc:' + v2CatVar(c.code) + ';--pc-soft:' + v2CatSoftVar(c.code) + '">' +
            '<div class="v2-wish-top">' +
                '<div class="v2-wish-cat">' + c.short + '</div>' +
                '<div class="v2-wish-main">' +
                    '<div class="v2-wish-title">' + escapeHtml(w.title) + '</div>' +
                    (w.description ? '<div class="v2-wish-desc">' + escapeHtml(w.description) + '</div>' : '') +
                    '<div class="v2-wish-meta">' + starsTag + priceTag + stageTag + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="v2-progress">' +
                '<div class="v2-progress-track"><div class="v2-progress-fill" style="width:' + pct + '%"></div></div>' +
                '<span class="v2-progress-pct">' + pct + '%</span>' +
            '</div>' +
            '<div class="v2-wish-actions">' + actions.join('') + '</div>' +
        '</div>';
    }).join('');
}

// ── 打卡 + 退出协议 ──
// 积分引擎：把服务端返回的加分结果同步到本地积分显示
const V2_PTS_UNIT = () => (getLanguage() === 'en' ? ' pts' : ' 分');
function applyPointsResult(res) {
    if (res && typeof res.current_points === 'number') {
        currentPoints = res.current_points;
        totalPoints = res.total_points;
        updatePointsDisplay();
    }
}

async function v2Checkin(id, date = null, note = '') {
    try {
        const res = await api.addCheckin(id, date, note);
        const isMakeup = !!date && date !== calendarDateKey(new Date());
        const wish = ((v2Data && v2Data.wishes) || []).find(w => String(w.id) === String(id));
        if (res.internalized && confirm(t('v2.exitProtocolConfirm'))) {
            const done = await api.completeWish(id);
            applyPointsResult(done);
            showCelebrate(wish, done);
            await loadV2Data();
        } else {
            applyPointsResult(res);
            showCheckinRitual(wish, res, isMakeup);
            await loadV2Data(true);
        }
    } catch (e) {
        const dupeMsg = date ? t('v2.makeupDupe') : t('v2.checkinDupe');
        const msg = (e && e.message && /already checked/i.test(e.message)) ? dupeMsg : ((e && (e.error || e.message)) || t('common.error'));
        showTemporaryMessage(msg, 'error');
        await loadV2Data(true);
    }
}

// ── 打卡仪式卡：连续天数 / 距达成 / 鼓励 ──
function closeRitualModal() {
    const m = document.getElementById('ritual-modal');
    if (m) m.style.display = 'none';
}
function showCheckinRitual(wish, res, isMakeup) {
    const m = document.getElementById('ritual-modal');
    if (!m || !wish) { showTemporaryMessage(t('v2.checkinDone'), 'success'); return; }
    const streak = (res && typeof res.streak === 'number') ? res.streak : (wish.streak || 0);
    const days = Number(wish.persistence_days) || 0;
    const remain = Math.max(0, days - streak);
    const pts = (res && res.points_awarded) || 5;
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('ritual-wish', wish.title || '');
    set('ritual-streak', t('v2.ritualStreak', { n: streak }));
    set('ritual-pts', remain > 0 ? t('v2.ritualRemain', { n: remain, pts }) : t('v2.ritualReached', { pts }));
    set('ritual-msg', t(isMakeup ? 'v2.ritualMakeupMsg' : (remain > 0 ? 'v2.ritualMsg' : 'v2.ritualDoneMsg')));
    m.style.display = 'flex';
}

// ── 达成庆祝：目标达成 + 分享海报 ──
function closeCelebrateModal() {
    const m = document.getElementById('celebrate-modal');
    if (m) m.style.display = 'none';
}
function celebrateShare() {
    closeCelebrateModal();
    openPosterModal();
}
function showCelebrate(wish, res) {
    const m = document.getElementById('celebrate-modal');
    if (!m || !wish) { showTemporaryMessage(t('v2.achieved'), 'success'); return; }
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('celebrate-wish', wish.title || '');
    set('celebrate-pts', t('v2.celebratePts', { pts: (res && res.points_awarded) || 0 }));
    m.style.display = 'flex';
    track('wish_celebrate', { wish_id: wish.id });
}

// ── 补打卡：给最近 7 天内漏掉的日期补记 ──
let makeupWishId = null;
let makeupCheckedDates = [];

async function openMakeupCheckin(id) {
    const wishes = (v2Data && v2Data.wishes) || [];
    const wish = wishes.find(w => w.id === id);
    makeupWishId = id;
    makeupCheckedDates = [];

    const nameEl = document.getElementById('makeup-wish-name');
    if (nameEl && wish) nameEl.textContent = wish.title;
    const noteEl = document.getElementById('makeup-note');
    if (noteEl) noteEl.value = '';

    const today = new Date();
    const max = calendarDateKey(today);
    const min = calendarDateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
    const dateEl = document.getElementById('makeup-date');
    const btn = document.getElementById('makeup-confirm-btn');
    if (dateEl) { dateEl.min = min; dateEl.max = max; dateEl.value = ''; dateEl.disabled = true; }
    if (btn) btn.disabled = true;
    const hintEl = document.getElementById('makeup-hint');
    if (hintEl) hintEl.textContent = t('v2.makeupRange', { min, max });

    const modal = document.getElementById('makeup-modal');
    if (modal) modal.style.display = 'flex';

    try {
        const res = await api.getCheckins(id);
        makeupCheckedDates = (res && Array.isArray(res.checkins)) ? res.checkins.map(c => c.checkin_date) : [];
    } catch (e) { /* 拉取失败不影响补卡，重复日期由后端兜底 */ }
    if (dateEl) dateEl.disabled = false;
    if (btn) btn.disabled = false;
}

function closeMakeupModal() {
    const modal = document.getElementById('makeup-modal');
    if (modal) modal.style.display = 'none';
}

async function confirmMakeupCheckin() {
    if (!makeupWishId) return;
    const dateEl = document.getElementById('makeup-date');
    const noteEl = document.getElementById('makeup-note');
    const date = dateEl ? dateEl.value : '';
    if (!date) { showTemporaryMessage(t('v2.makeupPickDate'), 'error'); return; }
    if (makeupCheckedDates.indexOf(date) >= 0) { showTemporaryMessage(t('v2.makeupDupe'), 'error'); return; }
    closeMakeupModal();
    await v2Checkin(makeupWishId, date, noteEl ? noteEl.value : '');
}

// 撤卡仪式：习惯已内化，把打卡位让给下一个目标
async function v2ExitProtocol(id) {
    if (!confirm(t('v2.exitProtocolConfirm'))) return;
    try {
        const res = await api.completeWish(id);
        applyPointsResult(res);
        const wish = ((v2Data && v2Data.wishes) || []).find(w => String(w.id) === String(id));
        showCelebrate(wish, res);
        await loadV2Data();
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

async function v2CompleteWish(id) {
    if (!confirm(t('v2.completeWishConfirm'))) return;
    try {
        const res = await api.completeWish(id);
        applyPointsResult(res);
        const wish = ((v2Data && v2Data.wishes) || []).find(w => String(w.id) === String(id));
        showCelebrate(wish, res);
        await loadV2Data();
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

async function v2DeleteWish(id) {
    if (!confirm(t('common.confirm') + '?')) return;
    try {
        await api.deleteWish(id);
        await loadV2Data();
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

// ── 愿望表单 + 努力定价预览（与后端 v2StarsFor 同规则） ──
function updateV2StarsPreview() {
    const typeEl = document.getElementById('v2-wish-type');
    const daysEl = document.getElementById('v2-wish-days');
    const coefEl = document.getElementById('v2-wish-coef');
    const out = document.getElementById('v2-stars-preview-text');
    if (!typeEl || !out) return;
    const type = typeEl.value;
    const days = Math.max(0, parseInt(daysEl ? daysEl.value : '0', 10) || 0);
    const coef = parseFloat(coefEl ? coefEl.value : '1') || 1;
    const min = { experience: 1, persistence: 3, challenge: 5 }[type];
    const max = { experience: 2, persistence: 5, challenge: 10 }[type];
    const stars = days > 0 ? Math.max(min, Math.min(max, Math.round(days * coef))) : min;
    let txt = '★'.repeat(Math.min(stars, 10)) + '☆'.repeat(Math.max(0, 10 - stars));
    if (type === 'experience') txt += ' · ' + (stars * 20) + (getLanguage() === 'en' ? ' pts' : ' 分');
    out.textContent = txt;

    // 渐进式表单：坚持/挑战型才需要填目标天数，自动展开高级项；体验型收起
    const adv = document.getElementById('v2-advanced');
    if (adv && !adv.dataset.manual) {
        if (type === 'experience') adv.setAttribute('hidden', '');
        else adv.removeAttribute('hidden');
    }
}

// 首次进入全人成长展示三步引导，关闭后不再出现
function maybeShowV2Guide() {
    try { if (localStorage.getItem('v2_guide_seen')) return; } catch (e) {}
    const el = document.getElementById('v2-guide');
    if (el) el.hidden = false;
}
function v2GuideDismiss() {
    const el = document.getElementById('v2-guide');
    if (el) el.hidden = true;
    try { localStorage.setItem('v2_guide_seen', '1'); } catch (e) {}
}

// 首次登录引导：关闭后不再出现
const ONBOARD_KEY = 'sr_onboarded';
function maybeShowOnboarding() {
    try { if (localStorage.getItem(ONBOARD_KEY)) return; } catch (e) {}
    const el = document.getElementById('onboarding-modal');
    if (el) el.style.display = 'flex';
}
function dismissOnboarding() {
    const el = document.getElementById('onboarding-modal');
    if (el) el.style.display = 'none';
    try { localStorage.setItem(ONBOARD_KEY, '1'); } catch (e) {}
    track('onboarding_dismiss');
}

// 帮助面板：全人体系说明 + 积分规则 + 教育专栏入口
function openHelpPanel() {
    const el = document.getElementById('help-modal');
    if (el) el.style.display = 'flex';
    track('open_help');
}
function closeHelpPanel() {
    const el = document.getElementById('help-modal');
    if (el) el.style.display = 'none';
}

// 教育专栏：列出已有 SEO 文章 + 占位卡
function renderEduColumn() {
    const el = document.getElementById('edu-cards');
    if (!el) return;
    const articles = [
        { title: t('home.eduArt1Title'), sub: t('home.eduArt1Sub'), url: 'seo-guide-star-chart.html' },
        { title: t('home.eduArt2Title'), sub: t('home.eduArt2Sub'), url: 'seo-habit-building.html' },
        { title: t('home.eduArt3Title'), sub: t('home.eduArt3Sub'), url: 'seo-reward-ideas.html' }
    ];
    let html = articles.map(a =>
        '<a class="edu-card" href="' + a.url + '" target="_blank" rel="noopener">' +
            '<span class="edu-card-tag">' + escapeHtml(t('home.eduReadMore')) + '</span>' +
            '<h4 class="edu-card-title">' + escapeHtml(a.title) + '</h4>' +
            '<p class="edu-card-sub">' + escapeHtml(a.sub) + '</p>' +
            '<span class="edu-card-more">' + escapeHtml(t('home.eduReadMore')) + ' →</span>' +
        '</a>'
    ).join('');
    html += '<div class="edu-card edu-card--soon"><span class="edu-card-tag">' + escapeHtml(t('home.eduComingSoon')) + '</span>' +
        '<h4 class="edu-card-title">…</h4><p class="edu-card-sub">' + escapeHtml(t('home.eduComingSoon')) + '</p></div>';
    el.innerHTML = html;
}
// 高级选项（目标天数 / 难度）手动展开/收起
function toggleV2Advanced() {
    const el = document.getElementById('v2-advanced');
    if (!el) return;
    const willOpen = el.hasAttribute('hidden');
    if (willOpen) { el.removeAttribute('hidden'); el.dataset.manual = '1'; }
    else { el.setAttribute('hidden', ''); el.dataset.manual = '1'; }
    const btn = document.getElementById('v2-adv-toggle');
    if (btn) btn.textContent = t(willOpen ? 'v2.advToggleHide' : 'v2.advToggle');
}
// 素养图鉴：8 大方向含义展开/收起（首页成长总览）
function toggleV2Legend() {
    const el = document.getElementById('v2-legend');
    if (!el) return;
    const willOpen = el.hasAttribute('hidden');
    if (willOpen) el.removeAttribute('hidden');
    else el.setAttribute('hidden', '');
    const chev = document.getElementById('v2-legend-chev');
    if (chev) chev.textContent = willOpen ? '▾' : '▸';
}

async function addV2Wish() {
    const titleEl = document.getElementById('v2-wish-name');
    const title = titleEl.value.trim();
    if (!title) { alert(t('common.enterGiftName')); titleEl.focus(); return; }
    try {
        await api.addWish({
            title: title,
            category: document.getElementById('v2-wish-category').value,
            wish_type: document.getElementById('v2-wish-type').value,
            persistence_days: parseInt(document.getElementById('v2-wish-days').value, 10) || 0,
            difficulty_coef: parseFloat(document.getElementById('v2-wish-coef').value) || 1,
            description: document.getElementById('v2-wish-desc').value.trim()
        });
        showTemporaryMessage(t('common.addGiftSuccess', { name: title }), 'success');
        titleEl.value = '';
        document.getElementById('v2-wish-desc').value = '';
        document.getElementById('v2-wish-days').value = '';
        await loadV2Data();
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

// ── 角色徽章墙 ──
function renderV2Badges() {
    const el = document.getElementById('v2-badge-wall');
    if (!el || !v2Data) return;
    const badges = v2Data.badges || {};
    // 8 枚素养徽章已在玫瑰图（成长总览）呈现，此处徽章墙仅展示里程碑 + 好友之星
    const order = ['rose_all_rounder', 'rose_persist_21', 'invite_friend'];
    // 新解锁检测仍需覆盖全部徽章，保证解锁 +20 分提示照常弹出
    const allCodes = V2_CATS.map(c => 'rose_' + c.code).concat(['rose_all_rounder', 'rose_persist_21', 'invite_friend']);

    // 新解锁检测（首次渲染不算「新」）
    const nowUnlocked = {};
    allCodes.forEach(code => { if (badges[code] && badges[code].unlocked) nowUnlocked[code] = true; });
    const newOnes = v2PrevUnlocked ? allCodes.filter(code => nowUnlocked[code] && !v2PrevUnlocked[code]) : [];
    if (newOnes.length) {
        const names = newOnes.map(code => {
            const cat = code.replace('rose_', '');
            return code === 'rose_all_rounder' ? t('v2.badgeAllRounder') : (code === 'rose_persist_21' ? t('v2.badgePersist21') : (code === 'invite_friend' ? t('v2.badgeInviteFriend') : t('v2.badge.' + cat)));
        });
        showTemporaryMessage(t('v2.badgeNew') + ': ' + names.join('、') + ' · +' + (newOnes.length * 20) + V2_PTS_UNIT(), 'success');
        // 徽章解锁奖励已由服务端入账，刷新积分显示
        api.getProfile().then(p => {
            if (p && typeof p.current_points === 'number') {
                currentPoints = p.current_points;
                totalPoints = p.total_points;
                updatePointsDisplay();
            }
        }).catch(() => {});
    }
    v2PrevUnlocked = nowUnlocked;

    el.innerHTML = order.map(code => {
        const info = badges[code] || { unlocked: false };
        const cat = code.replace('rose_', '');
        const isAR = code === 'rose_all_rounder';
        const isP21 = code === 'rose_persist_21';
        const isInvite = code === 'invite_friend';
        const pcVar = isAR ? 'var(--cat-all-rounder)' : (isInvite ? 'var(--brand)' : v2CatVar(cat));
        const pcSoft = isAR ? 'var(--cat-all-rounder-soft)' : (isInvite ? 'var(--brand-soft)' : v2CatSoftVar(cat));
        const name = isAR ? t('v2.badgeAllRounder') : (isP21 ? t('v2.badgePersist21') : (isInvite ? t('v2.badgeInviteFriend') : t('v2.badge.' + cat)));
        const desc = isAR ? t('v2.allRounderDesc') : (isP21 ? '' : (isInvite ? t('v2.badgeInviteDesc') : t('v2.badgeDesc.' + cat)));
        const icon = isAR ? V2_BADGE_SVGS.all_rounder : (isP21 ? V2_BADGE_SVGS.persist_21 : (isInvite ? V2_BADGE_SVGS.invite_friend : (V2_BADGE_SVGS[cat] || V2_BADGE_SVGS.self_drive)));
        const isNew = newOnes.indexOf(code) !== -1;
        // 进度环：未解锁时若后端给了 progress/target，渲染半透 SVG 进度环
        const progress = typeof info.progress === 'number' ? Math.max(0, info.progress) : 0;
        const target = typeof info.target === 'number' && info.target > 0 ? info.target : 0;
        const showRing = !info.unlocked && target > 0;
        const pct = showRing ? Math.min(1, progress / target) : 0;
        const RING_R = 22, RING_C = 2 * Math.PI * RING_R;
        const dash = (pct * RING_C).toFixed(2);
        const ringHtml = showRing
            ? '<svg class="v2-badge-ring" viewBox="0 0 52 52" aria-hidden="true">' +
                '<circle class="v2-badge-ring-bg" cx="26" cy="26" r="' + RING_R + '"></circle>' +
                '<circle class="v2-badge-ring-fg" cx="26" cy="26" r="' + RING_R + '" ' +
                    'stroke-dasharray="' + dash + ' ' + RING_C.toFixed(2) + '" ' +
                    'style="--pc:' + pcVar + '"></circle>' +
              '</svg>'
            : '';
        const progressText = showRing ? progress + '/' + target : '';
        return '<div class="v2-badge ' + (info.unlocked ? '' : 'is-locked') + ' ' + (isNew ? 'is-new' : '') + '" style="--pc:' + pcVar + ';--pc-soft:' + pcSoft + '">' +
            '<div class="v2-badge-ico-wrap">' +
                '<div class="v2-badge-ico">' + icon + '</div>' +
                ringHtml +
            '</div>' +
            '<div class="v2-badge-name">' + escapeHtml(name) + '</div>' +
            '<div class="v2-badge-desc">' + (desc ? escapeHtml(desc) : '&nbsp;') + '</div>' +
            (progressText ? '<div class="v2-badge-progress">' + progressText + '</div>' : '') +
        '</div>';
    }).join('');
}

// ── 每周成长指标 + 成长报告 ──
function renderV2Indicators() {
    const el = document.getElementById('v2-indicator-grid');
    if (!el || !v2Data) return;
    const levels = [['sprout', 'v2.levelSprout'], ['growing', 'v2.levelGrowing'], ['bloom', 'v2.levelBloom']];
    const saved = {};
    (v2Data.indicators || []).forEach(i => { saved[i.category] = i.level; });
    el.innerHTML = V2_CATS.map(c => {
        const cur = saved[c.code];
        const lvls = levels.map(function (lv) {
            return '<button type="button" class="v2-ind-level ' + lv[0] + ' ' + (cur === lv[0] ? 'is-on' : '') + '" onclick="v2SetIndicator(\'' + c.code + '\',\'' + lv[0] + '\')">' + escapeHtml(t(lv[1])) + '</button>';
        }).join('');
        return '<div class="v2-ind-row" style="--pc:' + v2CatVar(c.code) + ';--pc-soft:' + v2CatSoftVar(c.code) + '">' +
            '<div class="v2-ind-cat">' + c.short + '</div>' +
            '<div class="v2-ind-name">' + escapeHtml(t('v2.badge.' + c.code)) + '</div>' +
            '<div class="v2-ind-levels">' + lvls + '</div>' +
        '</div>';
    }).join('');
}

async function v2SetIndicator(cat, level) {
    try {
        await api.addGrowthIndicator(cat, level);
        showTemporaryMessage(t('v2.indicatorSaved'), 'success');
        v2Data = await api.getV2Overview();
        renderV2Indicators();
        renderV2Report();
    } catch (e) {
        showTemporaryMessage((e && (e.error || e.message)) || t('common.error'), 'error');
    }
}

function renderV2Report() {
    const el = document.getElementById('v2-report');
    if (!el || !v2Data) return;
    const inds = v2Data.indicators || [];
    const tip = '<div class="v2-report-tip">' + escapeHtml(t('v2.reportTip')) + '</div>';
    if (!inds.length) {
        el.innerHTML = '<div>' + escapeHtml(t('v2.reportEmpty')) + '</div>' + tip;
        return;
    }
    const bloom = inds.filter(i => i.level === 'bloom');
    const growing = inds.filter(i => i.level === 'growing');
    const bloomTxt = bloom.length ? bloom.map(i => escapeHtml(t('v2.badge.' + i.category))).join('、') : escapeHtml(t('v2.reportNone'));
    const growTxt = growing.length ? growing.map(i => escapeHtml(t('v2.badge.' + i.category))).join('、') : escapeHtml(t('v2.reportNone'));
    el.innerHTML = '<div><b>' + escapeHtml(t('v2.reportTitle')) + '</b></div>' +
        '<div>' + escapeHtml(t('v2.reportBloom')) + bloomTxt + '</div>' +
        '<div>' + escapeHtml(t('v2.reportGrowing')) + growTxt + '</div>' + tip;
}

// ── 模块卡迷你统计 ──
function updateV2ModuleStat() {
    // 首页成长总览统计（原 #stat-v2 已随模块卡移除）
    if (!v2Data) return;
    // 成长成就模块卡：已解锁角色徽章数
    const sA = document.getElementById('stat-ach');
    if (sA && v2Data.badges) {
        const n = Object.values(v2Data.badges).filter(b => b && b.unlocked).length;
        sA.innerHTML = STAT_ICO.star + n + '/11';
    }
}
