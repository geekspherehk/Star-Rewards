// 本地离线验证：首页「近 7 天打卡点阵」+ 补卡弹窗「日期芯片」
//
// 做法：从 script.js 里**抽取真实函数源码**（不是重写一份），在无头浏览器里配合真实
// utils.js / i18n.js / style.css 跑渲染，再用 mock 的 v2Data + checkins 覆盖三种场景：
//   ① 连续打卡（今天还没打）
//   ② 有漏卡（昨天、3 天前漏了）
//   ③ 最近 7 天全勤
// 断言点阵状态序列、补卡按钮文案（必须写明补哪一天）、芯片可点性。
//
// 用法：NODE_PATH=<workspace>/node_modules node scripts/verify_checkin_ui.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'screenshots');
const CSS = path.join(ROOT, 'style.css');
const SHOT = path.join(OUT, 'checkin-dots-local.png');

// ── 从 script.js 抽取函数 / 常量源码（大括号配对）──
function sliceJs(src, startIndex, openChar = '{', closeChar = '}') {
    let i = src.indexOf(openChar, startIndex);
    let depth = 0;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === openChar) depth++;
        else if (c === closeChar) { depth--; if (depth === 0) return src.slice(startIndex, i + 1); }
    }
    throw new Error('未找到配对括号');
}
function extract(src, patterns) {
    const out = [];
    for (const p of patterns) {
        const re = Array.isArray(p) ? p[0] : p;
        const m = re.exec(src);
        if (!m) throw new Error('抽取失败: ' + re);
        out.push(Array.isArray(p) ? sliceJs(src, m.index, p[1], p[2]) : sliceJs(src, m.index));
    }
    return out.join('\n\n');
}

const scriptSrc = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const extracted = extract(scriptSrc, [
    [/^const V2_CATS = /m, '[', ']'],
    /^function catShort\(/m,
    /^function v2CatVar\(/m,
    /^function v2CatSoftVar\(/m,
    /^function calendarDateKey\(/m,
    /^function checkinLast7Days\(/m,
    /^function shortDayLabel\(/m,
    /^function renderCheckinDots\(/m,
    /^function renderHomeCheckin\(/m,
    /^function renderMakeupDays\(/m,
    /^function pickMakeupDate\(/m,
]);

const HTML = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="file://${CSS}">
</head><body style="margin:0;background:var(--bg);padding:12px">
<div class="today-checkin" id="today-checkin">
  <div class="v2-section-head">
    <h3 class="section-title section-title--icon"><span>今日打卡</span></h3>
    <p class="v2-sub">每天完成一个小目标 · 打卡一次 +5 分</p>
  </div>
  <div id="today-checkin-list" class="today-checkin-list"></div>
</div>
<div id="makeup-modal" class="modal-overlay" style="display:none;position:static">
  <div class="modal-content makeup-content">
    <h3>补打卡</h3>
    <div class="form-group"><label>目标</label><div class="makeup-wish-name" id="makeup-wish-name"></div></div>
    <div class="form-group"><label>要补哪一天？</label>
      <div class="makeup-days" id="makeup-days"></div>
      <p class="makeup-hint" id="makeup-hint"></p>
    </div>
    <div class="form-group"><label>备注（可选）</label><input type="text" id="makeup-note"></div>
    <div class="modal-actions">
      <button class="primary-btn" id="makeup-confirm-btn"></button>
      <button class="secondary-btn">取消</button>
    </div>
  </div>
</div>
</body></html>`;

const tmpHtml = path.join(require('os').tmpdir(), 'sr_checkin_ui.html');
fs.writeFileSync(tmpHtml, HTML);

const dayKey = offset => {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

(async () => {
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: ['--no-sandbox', '--allow-file-access-from-files'],
    });
    let pass = true;
    const check = (label, cond, extra = '') => {
        console.log((cond ? '✅ ' : '❌ ') + label + (extra ? '  → ' + extra : ''));
        if (!cond) pass = false;
    };

    for (const W of [430, 375]) {
        const page = await browser.newPage();
        await page.setViewport({ width: W, height: 900, deviceScaleFactor: 2 });
        page.on('pageerror', e => { console.log('❌ 页面异常:', e.message); pass = false; });
        await page.goto('file://' + tmpHtml, { waitUntil: 'load' });
        await page.addScriptTag({ path: path.join(ROOT, 'utils.js') });
        await page.addScriptTag({ path: path.join(ROOT, 'i18n.js') });
        await page.addScriptTag({ content: extracted });

        const report = await page.evaluate((createdDaysAgo, createdDaysAgo2) => {
            // 三个目标，覆盖三种场景
            window.v2Data = {
                wishes: [
                    { id: 1, title: '每天读 10 分钟', category: 'self_drive', status: 'active', wish_type: 'habit', streak: 4, created_at: createdDaysAgo + ' 08:00:00' },
                    { id: 2, title: '自己整理书包', category: 'planning', status: 'active', wish_type: 'habit', streak: 2, created_at: createdDaysAgo2 + ' 08:00:00' },
                    { id: 3, title: '每天跳绳 100 下', category: 'health', status: 'active', wish_type: 'habit', streak: 7, created_at: createdDaysAgo + ' 08:00:00' },
                ],
            };
            // 目标 1：前 6 天里漏了「昨天」 → 点阵应有 1 个漏卡
            // 目标 2：只漏了 3 天前 → 1 个漏卡
            // 目标 3：最近 7 天全勤 → 无漏卡、不显示补卡按钮
            window.checkins = [];
            const push = (wishId, key) => window.checkins.push({ wish_id: wishId, checkin_date: key });
            return { createdDaysAgo, createdDaysAgo2, pushSrc: '' };
        }, dayKey(10), dayKey(5));

        await page.evaluate((keys) => {
            const push = (wishId, key) => window.checkins.push({ wish_id: wishId, checkin_date: key });
            // 目标 1：前 6 天中 5 天打卡（漏 keys[1] = 昨天）
            [0, 2, 3, 4, 5, 6].filter(i => i !== 1).forEach(i => push(1, keys[i]));
            // 目标 2：漏 3 天前；今天还没打（点阵末位应为 today 待打卡）
            [1, 2, 4, 5, 6].forEach(i => push(2, keys[i]));
            // 目标 3：全勤（7 天全打）
            [0, 1, 2, 3, 4, 5, 6].forEach(i => push(3, keys[i]));
            renderHomeCheckin();
        }, Array.from({ length: 7 }, (_, i) => dayKey(i)));

        await new Promise(r => setTimeout(r, 300));

        const dom = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('.today-checkin-row'));
            return rows.map(r => ({
                title: r.querySelector('.tci-title').textContent,
                dots: Array.from(r.querySelectorAll('.ci-dot')).map(d => {
                    const cls = Array.from(d.classList).find(c => c.startsWith('is-'));
                    return cls.replace('is-', '') + (d.tagName === 'BUTTON' ? '(可点)' : '');
                }),
                dotW: Math.round(r.querySelector('.ci-dot').getBoundingClientRect().width),
                dotH: Math.round(r.querySelector('.ci-dot').getBoundingClientRect().height),
                makeupText: r.querySelector('.tci-makeup') ? r.querySelector('.tci-makeup').textContent.trim() : null,
                makeupW: r.querySelector('.tci-makeup') ? Math.round(r.querySelector('.tci-makeup').getBoundingClientRect().width) : null,
                edges: Array.from(r.querySelectorAll('.ci-edge')).map(e => e.textContent.trim()),
                dotsRowW: Math.round(r.querySelector('.ci-dots-row').getBoundingClientRect().width),
                cardW: Math.round(r.getBoundingClientRect().width),
            }));
        });

        console.log('\n===== 视口 ' + W + 'px =====');
        dom.forEach(d => console.log('  ' + d.title + ' | 点阵[' + d.dots.join(' ') + '] ' + d.dotW + '×' + d.dotH + ' | 补卡按钮=' + JSON.stringify(d.makeupText) + ' w=' + d.makeupW));

        check(`[${W}] 目标1 昨天漏卡 → 点阵含 1 个 missed 且可点`, (dom[0].dots.join(' ').match(/missed\(可点\)/g) || []).length === 1);
        check(`[${W}] 目标1 补卡按钮写明日期`, /补\s*\d+\/\d+/.test(dom[0].makeupText || ''), dom[0].makeupText);
        check(`[${W}] 目标3 全勤 → 无 missed、无补卡按钮`, !dom[2].dots.includes('missed') && dom[2].makeupText === null);
        const d2 = dom[1].dots.join(' ');
        check(`[${W}] 目标2 今天未打卡 → 点阵末位 today、且漏卡 1 天可点`, d2.endsWith('today') && (d2.match(/missed\(可点\)/g) || []).length === 1, d2);

        // 点阵不能撑爆：宽度应为 18px（被全局 button{width:100%} 撑大就会明显变宽）
        check(`[${W}] 点阵圆点宽度 = 18px（未被全局 button 规则撑大）`, dom[0].dotW === 18 && dom[0].dotH === 18, dom[0].dotW + '×' + dom[0].dotH);
        // 补卡按钮不能满宽（行宽约 280-380）
        check(`[${W}] 补卡按钮未满宽（< 160px）`, dom[0].makeupW !== null && dom[0].makeupW < 160, String(dom[0].makeupW));
        // 点阵两侧标注「近 7 天 … 今天」，否则看不出哪个点是今天；且不能溢出行宽
        const edgeOk = dom.every(d => d.edges.length === 2 && d.edges[0] === '近 7 天' && d.edges[1] === '今天');
        check(`[${W}] 点阵有时间轴标注（近 7 天 → 今天）`, edgeOk, JSON.stringify(dom[0].edges));
        check(`[${W}] 点阵行不溢出卡片`, dom.every(d => d.dotsRowW <= d.cardW), dom.map(d => d.dotsRowW + '/' + d.cardW).join(' '));

        // 弹窗芯片
        const chips = await page.evaluate((keys) => {
            document.getElementById('makeup-modal').style.display = 'block';   // 弹窗可见才能测到宽度
            window.makeupCheckedDates = [keys[0], keys[2], keys[3]];
            window.makeupSelectedDate = '';
            window.makeupWishId = 1;
            const wish = window.v2Data.wishes[0];
            renderMakeupDays(wish);
            const before = Array.from(document.querySelectorAll('#makeup-days .mk-day')).map(c => ({
                cls: Array.from(c.classList).filter(x => x.startsWith('is-')).join(' '),
                tag: c.tagName,
                text: c.textContent.trim(),
                w: Math.round(c.getBoundingClientRect().width),
            }));
            const btnBefore = document.getElementById('makeup-confirm-btn');
            const stateBefore = { disabled: btnBefore.disabled, text: btnBefore.textContent.trim() };
            const hintBefore = document.getElementById('makeup-hint').textContent.trim();
            // 模拟点选漏掉的那天
            pickMakeupDate(keys[1]);
            const btnAfter = document.getElementById('makeup-confirm-btn');
            const selected = document.querySelector('#makeup-days .mk-day.is-selected');
            return {
                before,
                stateBefore,
                hintBefore,
                after: { disabled: btnAfter.disabled, text: btnAfter.textContent.trim(), selectedText: selected ? selected.textContent.trim() : null },
                gridW: Math.round(document.getElementById('makeup-days').getBoundingClientRect().width),
            };
        }, Array.from({ length: 7 }, (_, i) => dayKey(i)));

        console.log('  芯片: ' + chips.before.map(c => '[' + c.text.replace(/\s+/g, '·') + ' ' + c.cls + ' ' + c.tag + ' ' + c.w + 'px]').join(' '));
        console.log('  提示: ' + chips.hintBefore);
        console.log('  按钮: 未选=' + JSON.stringify(chips.stateBefore) + ' → 选中后=' + JSON.stringify(chips.after));

        check(`[${W}] 芯片 7 个，已打卡的不可点（span）、漏的可点（button）`,
            chips.before.length === 7 && chips.before.filter(c => c.tag === 'BUTTON').length === 4);
        check(`[${W}] 未选日期时确认按钮禁用`, chips.stateBefore.disabled === true);
        check(`[${W}] 提示写明漏了哪几天`, /漏了 4 天/.test(chips.hintBefore) && chips.hintBefore.includes('9/18'), chips.hintBefore);
        check(`[${W}] 选中后按钮文案带上日期`, chips.after.disabled === false && /补\s*\d+\/\d+/.test(chips.after.text), chips.after.text);
        check(`[${W}] 选中态正确落在漏掉的那天`, chips.after.selectedText !== null);
        check(`[${W}] 芯片尺寸正常（4 列布局，每格 40~120px）`, chips.before.every(c => c.w > 40 && c.w < 120), chips.before.map(c => c.w).join('/'));

        if (W === 430) {
            fs.mkdirSync(OUT, { recursive: true });
            await new Promise(r => setTimeout(r, 200));
            await page.screenshot({ path: SHOT, fullPage: true });
        }
        await page.close();
    }

    await browser.close();
    console.log('\n' + (pass ? '全部通过' : '存在失败'));
    process.exit(pass ? 0 : 1);
})();
