#!/usr/bin/env node
// 离线自检：用真实 script.js / style.css / i18n.js / utils.js 渲染「本周打卡」
// 的站内周表与 AI 海报（模拟数据，无需登录、不碰线上数据）。
//
// 原理：页面必须放在仓库根目录，script.js 里的 assets/weekly/... 相对路径才能解析；
//       故脚本运行时生成临时页 weekly_selfcheck.html，跑完即删（避免 dev 文件落进 web 根）。
//
// 用法：
//   cd <repo>
//   python3 -m http.server 8137 &
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//     node scripts/shot_weekly_selfcheck.js
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const PORT = process.env.PORT || '8137';
const TMP = path.join(ROOT, 'weekly_selfcheck.html');
const URL = `http://localhost:${PORT}/weekly_selfcheck.html`;

const PAGE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="style.css?v=999">
<style>body{background:#F4F5F9;margin:0;padding:16px;}
#weekly-module{display:block !important;}
#weekly-poster-canvas{max-width:520px;height:auto;box-shadow:0 6px 20px rgba(0,0,0,.15);}
</style>
</head>
<body>
  <div id="weekly-module" class="module-content">
    <div class="weekly-wrap">
      <div class="weekly-hero"></div>
      <div class="weekly-card">
        <div class="weekly-head">
          <div>
            <h2 class="weekly-title" id="weekly-title"></h2>
            <p class="weekly-range" id="weekly-range"></p>
          </div>
          <div class="weekly-actions">
            <button type="button" class="primary-btn" id="weekly-export-btn"><span>导出本周海报</span></button>
          </div>
        </div>
        <div class="weekly-legend" id="weekly-legend"></div>
        <div class="weekly-grid" id="weekly-grid"></div>
        <p class="weekly-empty" id="weekly-empty" style="display:none;"></p>
      </div>
      <span class="weekly-wm" aria-hidden="true">STELLAR ♡</span>
    </div>
  </div>

  <div id="weekly-poster-modal" class="modal-overlay" style="display:block;position:static;background:none;">
    <div class="modal-content weekly-poster-content" style="margin:0 auto;">
      <div class="weekly-poster-preview">
        <canvas id="weekly-poster-canvas" width="1024" height="1536"></canvas>
      </div>
      <p class="weekly-poster-tip" id="weekly-poster-tip"></p>
    </div>
  </div>

<script src="qrcode-generator.js"></script>
<script src="i18n.js?v=999"></script>
<script src="utils.js?v=999"></script>
<script src="script.js?v=999"></script>
<script>
  function _setup() {
    currentLanguage = 'zh';
    getLanguage = function () { return 'zh-CN'; };
    getSelectedProfile = function () { return { name: '小明' }; };
    v2Data = { wishes: [
      { id: '1', title: '早晚刷牙', category: 'self_drive', status: 'active', created_at: '2026-01-01' },
      { id: '2', title: '阅读 20 分钟', category: 'aesthetics', status: 'active', created_at: '2026-01-01' },
      { id: '3', title: '自己整理书包', category: 'planning', status: 'active', created_at: '2026-09-20' },
      { id: '4', title: '9 点前上床睡觉', category: 'health', status: 'active', created_at: '2026-01-01' },
      { id: '5', title: '喝足 6 杯水', category: 'resilience', status: 'active', created_at: '2026-01-01' }
    ] };
    checkins = [
      { wish_id: '1', checkin_date: '2026-09-27' },
      { wish_id: '1', checkin_date: '2026-09-25' },
      { wish_id: '2', checkin_date: '2026-09-26' },
      { wish_id: '3', checkin_date: '2026-09-24' },
      { wish_id: '5', checkin_date: '2026-09-27' }
    ];
  }
  window.__renderGrid = function () { _setup(); renderWeeklyModule(); return document.getElementById('weekly-grid').children.length; };
  window.__renderPoster = function () {
    _setup();
    return loadWeeklyAssets().then(function () {
      var data = weeklyPosterData(false);
      drawWeeklyPoster(document.getElementById('weekly-poster-canvas'), data);
      return { done: data.done, total: data.total, rows: data.rows.length };
    });
  };
</script>
</body>
</html>
`;

function findChrome() {
  const cands = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('找不到 Chrome');
}

(async () => {
  fs.writeFileSync(TMP, PAGE);
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  try {
    const page = await browser.newPage();
    const errs = [];
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

    const VW = parseInt(process.env.WEEKLY_W || '900', 10);
    const SUF = VW === 900 ? '' : ('-' + VW);
    await page.setViewport({ width: VW, height: 1620, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0' });

    const outDir = path.join(ROOT, 'shots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const gridRows = await page.evaluate(() => window.__renderGrid());
    console.log('grid rows', gridRows);
    const mod = await page.$('#weekly-module');
    await mod.screenshot({ path: path.join(outDir, 'weekly_grid_selfcheck' + SUF + '.png') });

    const res = await page.evaluate(() => window.__renderPoster());
    console.log('poster', JSON.stringify(res));
    const dataUrl = await page.evaluate(() => document.getElementById('weekly-poster-canvas').toDataURL('image/png'));
    fs.writeFileSync(path.join(outDir, 'weekly_poster_selfcheck.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

    console.log(errs.length ? ('ERRORS:\n' + errs.join('\n')) : 'no console errors');
  } finally {
    await browser.close().catch(() => {});
    try { fs.unlinkSync(TMP); } catch (e) {}
  }
})();
