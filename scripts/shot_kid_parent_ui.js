// 家长端新 UI 离线视觉验收：真实 style.css + 真实 index.html 里抠出来的两个 section，
// 喂一份假月报数据，用 puppeteer 在 390/900 两个宽度各截一张。
// 不登录、不碰生产数据（月报数据在本地算完直接塞页面，不走 API）。
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 从父标签开始，按 div/section 深度平衡抠出一段
function sliceBalanced(src, startIdx, tag) {
    let depth = 0;
    for (let i = startIdx; i < src.length; i++) {
        if (src.startsWith('<' + tag, i)) {
            const selfClose = src.startsWith('/>', src.indexOf('>', i));
            if (!selfClose) depth++;
        } else if (src.startsWith('</' + tag + '>', i)) {
            depth--;
            if (depth === 0) return src.slice(startIdx, i + tag.length + 3);
        } else if (src.startsWith('<' + tag + ' ', i)) {
            const end = src.indexOf('>', i);
            if (!src.startsWith('/>', end)) depth++;
        }
    }
    return '';
}

function grabById(html, id) {
    const re = new RegExp('<(section|div)[^>]*id="' + id + '"');
    const m = html.match(re);
    if (!m) return '';
    return sliceBalanced(html, m.index, m[1]);
}

const indexHtml = read('index.html');
const scriptSrc = read('script.js');
const reportBlock = grabById(indexHtml, 'report-section');
const kidBlock = grabById(indexHtml, 'kid-setup-card');
if (!reportBlock || !kidBlock) {
    console.error('✘ 抠不出 report-section / kid-setup-card，index.html 结构变了');
    process.exit(1);
}

// 抽真实的 renderReport（含 RP_WD）
const fnStart = scriptSrc.indexOf('const RP_WD');
const fnEnd = scriptSrc.indexOf('async function loadReport');
const renderSrc = scriptSrc.slice(fnStart, fnEnd);
if (fnStart < 0 || fnEnd < 0) { console.error('✘ 抽不到 renderReport'); process.exit(1); }

const ref = new Date();
const ym = ref.getFullYear() + '-' + String(ref.getMonth() + 1).padStart(2, '0');
const prev = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
const ymPrev = prev.getFullYear() + '-' + String(prev.getMonth() + 1).padStart(2, '0');

function fakeReport(month) {
    return {
    success: true,
    month: month,
    total_checkins: 23,
    active_days: 18,
    days: [
        { date: month + '-02', count: 2 }, { date: month + '-03', count: 1 },
        { date: month + '-05', count: 3 }, { date: month + '-06', count: 2 },
        { date: month + '-07', count: 1 }, { date: month + '-08', count: 2 },
        { date: month + '-09', count: 1 }, { date: month + '-12', count: 1 },
        { date: month + '-13', count: 2 }, { date: month + '-15', count: 1 },
        { date: month + '-16', count: 1 }, { date: month + '-17', count: 2 },
        { date: month + '-18', count: 1 }, { date: month + '-19', count: 3 },
        { date: month + '-20', count: 2 }, { date: month + '-21', count: 1 },
        { date: month + '-22', count: 1 }, { date: month + '-23', count: 2 }
    ],
    wishes: [
        { id: 1, title: '自己穿鞋', internalized: true, streak_now: 21 },
        { id: 2, title: '收好书包', internalized: true, streak_now: 14 },
        { id: 3, title: '睡前刷牙', internalized: false, streak_now: 5 },
        { id: 4, title: '吃完饭收碗', internalized: false, streak_now: 2 }
    ],
    redeemed: [
        { id: 4, name: '周末去公园', points: 40, redeem_date: month + '-16' },
        { id: 7, name: '一本新图画书', points: 60, redeem_date: month + '-25' }
    ],
    voice: [
        { content: '我今天自己穿鞋，妈妈都没有骂我', recorded_on: month + '-21' },
        { content: '我最喜欢去公园了', recorded_on: month + '-16' }
    ]
};
}

const page = `<!DOCTYPE html>
<html lang="zh-Hant"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>家长端新 UI 验收</title>
<link rel="stylesheet" href="${path.join(ROOT, 'style.css')}">
</head>
<body>
<main class="container">
${reportBlock}
${kidBlock}
</main>
<script>
${renderSrc}
renderReport(${JSON.stringify(fakeReport(ym))});
document.getElementById('rp-month').value = '${ym}';
document.getElementById('ks-url').value = 'https://stellar.gaocaihk.com/kid.html?k=9f2c1b7a4e8d6350ac21ff7b3e9d4a10c8b52e7d61af0934b7e5c2d18a6f40b9';
window.__rendered = true;
</script>
</body></html>`;

const tmp = path.join(os.tmpdir(), 'star-kid-parent-ui.html');
fs.writeFileSync(tmp, page);

(async () => {
    const puppeteer = require(path.join(process.env.HOME, '.workbuddy/binaries/node/workspace/node_modules/puppeteer-core'));
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: 'new',
        args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none'],
    });
    const errors = [];
    for (const width of [390, 900]) {
        const pageObj = await browser.newPage();
        pageObj.on('pageerror', (e) => errors.push(String(e.message)));
        await pageObj.setViewport({ width, height: 1400, deviceScaleFactor: 2 });
        await pageObj.goto('file://' + tmp, { waitUntil: 'networkidle0' });
        const rendered = await pageObj.evaluate(() => !!window.__rendered);
        // 两张：本月（不该再出现月历，首页已有）+ 翻到上个月（才画出月历）
        for (const suffix of ['', '-lastm']) {
            if (suffix) {
                await pageObj.evaluate((m, data) => {
                    document.getElementById('rp-month').value = m;
                    renderReport(data);
                }, ymPrev, fakeReport(ymPrev));
            }
            const out = path.join(ROOT, 'prototypes', 'kid-parent-ui-' + width + suffix + '.png');
            await pageObj.screenshot({ path: out, fullPage: true });
            console.log((rendered ? '✔' : '✘') + ' 宽度 ' + width + (suffix ? '(上个月)' : '(本月)') + ' → ' + path.relative(ROOT, out));
        }
        await pageObj.close();
    }
    await browser.close();
    if (errors.length) console.log('✘ JS 报错:', errors.join(' | '));
    else console.log('✔ 无 JS 报错');
})();
