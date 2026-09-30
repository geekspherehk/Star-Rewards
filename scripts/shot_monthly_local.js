// 本地混合验收：本地静态资源（新代码）+ 线上真实 API（Node 侧直调）
// Node 侧建号/建愿望/造假打卡，puppeteer 仅带 token 渲染并截图，用完删临时账号。
//
// 用法：
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//     node scripts/shot_monthly_local.js [--width 900] [--keep]
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const REMOTE = 'https://stellar.gaocaihk.com';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 10002;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WIDTH = parseInt(argOf('--width', '900'), 10);
const KEEP = argv.includes('--keep');

const OUT = path.join(__dirname, '..', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.php': 'application/json' };

// 简易静态服务器（只服务本地文件，/api 一律不在这里处理）
function startStatic() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(ROOT, p);
      if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

// Node 侧直调线上 API
async function api(action, body, token) {
  const r = await fetch(REMOTE + '/api/index.php?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}

const WISHES = [
  { category: 'self_drive', title: '早晚刷牙', days: [1, 3, 9, 14, 20, 23, 27] },
  { category: 'aesthetics', title: '阅读 20 分钟', days: [0, 2, 8, 15, 22, 28] },
  { category: 'planning', title: '自己整理书包', days: [1, 4, 10, 18, 25] },
  { category: 'health', title: '9 点前上床睡觉', days: [0, 5, 12, 19, 26] },
  { category: 'resilience', title: '喝足 6 杯水', days: [3, 7, 13, 16, 21, 28] },
];

const ts = Math.floor(Date.now() / 1000);

(async () => {
  const srv = await startStatic();
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-ml-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: ud,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [];
  let email = null, token = null;

  try {
    // ---- Node 侧建号 + 造数据 ----
    email = `sr.demo.month.${ts}@example.com`;
    const reg = await api('register', { email, password: 'TestPass123!', consent: true });
    if (!reg || !reg.token) throw new Error('注册失败: ' + JSON.stringify(reg));
    token = reg.token;
    const d = (off) => { const x = new Date(); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); };
    const prep = [];
    for (const w of WISHES) {
      const wish = await api('add_wish', { category: w.category, title: w.title, wish_type: 'persistence', persistence_days: 30 }, token);
      const out = { title: w.title };
      if (!wish || !wish.id) { out.error = JSON.stringify(wish).slice(0, 120); }
      else {
        out.id = wish.id;
        out.ck = [];
        for (const off of w.days) { const r = await api('add_checkin', { wish_id: wish.id, date: d(off) }, token); out.ck.push(!!(r && (r.success || r.checkin_id))); }
      }
      prep.push(out);
    }
    console.log('建愿望:', JSON.stringify(prep));

    // ---- puppeteer：转发 /api 到线上，带 token 渲染 ----
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: 1500, deviceScaleFactor: 2 });
    await page.setUserAgent(UA);
    page.on('console', m => { if (m.type() === 'error') console.log('PAGE-CONSOLE-ERR:', m.text().slice(0, 220)); });
    page.on('pageerror', e => console.log('PAGE-ERROR:', String(e && e.message || e).slice(0, 220)));
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      const u = req.url();
      if (u.includes('/api/index.php')) {
        const fwd = REMOTE + '/api/index.php' + (u.includes('?') ? '?' + u.split('?')[1] : '');
        try {
          const body = req.method() === 'GET' ? undefined : req.postData();
          const r = await fetch(fwd, { method: req.method(), headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body });
          const buf = Buffer.from(await r.arrayBuffer());
          console.log('FWD', fwd.split('?')[1] || '(none)', '->', r.status);
          req.respond({ status: r.status, headers: { 'Content-Type': 'application/json' }, body: buf });
        } catch (e) { req.respond({ status: 502, body: JSON.stringify({ error: String(e.message) }) }); }
      } else { req.continue(); }
    });

    // 先在同源页面写入 token，再进 index，避免未登录被重定向到 landing
    await page.goto(`http://127.0.0.1:${PORT}/landing.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate((t, e) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_email', e);
    }, token, email);
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);
    console.log('url:', page.url());
    console.log('page state:', JSON.stringify(await page.evaluate(() => ({
      token: (localStorage.getItem('auth_token') || '').slice(0, 12),
      hasV2: typeof v2Data !== 'undefined' && !!v2Data,
      wishCount: (typeof v2Data !== 'undefined' && v2Data && v2Data.wishes) ? v2Data.wishes.length : null,
      ckCount: (typeof checkins !== 'undefined' && Array.isArray(checkins)) ? checkins.length : null,
    }))));
    await page.evaluate(() => {
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      ['onboarding-modal', 'activation-progress-bar', 'welcome-banner', 'home-focus-banner', 'activation-checklist']
        .forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      if (typeof showModule === 'function') showModule('points-module');
      if (typeof renderWeeklyModule === 'function') renderWeeklyModule();
    });
    await sleep(1200);

    const info = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('.mc-cell'));
      const counts = {};
      cells.forEach(c => { const k = Array.from(c.classList).find(x => x.startsWith('is-') && x !== 'is-click'); if (k) counts[k] = (counts[k] || 0) + 1; });
      return { cells: cells.length, counts, stat: (document.getElementById('stat-weekly') || {}).textContent };
    });
    console.log('月历:', JSON.stringify(info));

    // --mock：注入整月演示数据（愿望月初创建 + 整月打卡规律），验证 done/part/miss/today 视觉
    if (argv.includes('--mock')) {
      const mock = await page.evaluate(() => {
        const cats = ['self_drive', 'aesthetics', 'planning', 'health', 'resilience'];
        const names = ['早晚刷牙', '阅读 20 分钟', '自己整理书包', '9 点前上床睡觉', '喝足 6 杯水'];
        const wishes = names.map((t, i) => ({ id: 'w' + (i + 1), title: t, category: cats[i], status: 'active', created_at: '2026-09-01 08:00:00' }));
        const now = new Date(); const y = now.getFullYear(), m = now.getMonth(), todayD = now.getDate();
        const pad = n => String(n).padStart(2, '0');
        const ck = [];
        for (let day = 1; day <= todayD; day++) {
          let n;
          if (day % 7 === 0) n = 0;            // 漏卡
          else if (day === todayD) n = 2;      // 今天部分
          else if (day % 3 === 0) n = 3;       // 部分点亮
          else n = 5;                          // 全部点亮
          for (let k = 0; k < n; k++) ck.push({ wish_id: 'w' + (k + 1), checkin_date: `${y}-${pad(m + 1)}-${pad(day)}`, wish_title: names[k] });
        }
        if (typeof v2Data !== 'undefined' && v2Data) v2Data.wishes = wishes;
        if (typeof checkins !== 'undefined') checkins = ck;
        if (typeof renderWeeklyModule === 'function') renderWeeklyModule();
        return { wishes: wishes.length, ck: ck.length };
      });
      console.log('mock 注入:', JSON.stringify(mock));
      await sleep(600);
      const mInfo = await page.evaluate(() => {
        const cells = Array.from(document.querySelectorAll('.mc-cell'));
        const counts = {};
        cells.forEach(c => { const k = Array.from(c.classList).find(x => x.startsWith('is-') && x !== 'is-click'); if (k) counts[k] = (counts[k] || 0) + 1; });
        return { cells: cells.length, counts, stat: (document.getElementById('stat-weekly') || {}).textContent };
      });
      console.log('月历(mock):', JSON.stringify(mInfo));
    }

    await page.evaluate(() => {
      ['activation-progress-bar', 'welcome-banner', 'home-focus-banner', 'activation-checklist']
        .forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
      const el = document.getElementById('weekly-section');
      if (el) el.scrollIntoView({ block: 'start' });
    });
    await sleep(600);
    const p1 = path.join(OUT, `monthly-live-module-${WIDTH}.png`);
    await (await page.$('#weekly-section')).screenshot({ path: p1 });
    shots.push(p1);

    // 点开今天 -> 日详情弹窗
    const todayClicked = await page.evaluate(() => { const t = document.querySelector('.mc-cell.is-today'); if (!t) return false; t.click(); return true; });
    await sleep(900);
    if (todayClicked) {
      const p2 = path.join(OUT, `monthly-day-detail-${WIDTH}.png`);
      await page.screenshot({ path: p2 });
      shots.push(p2);
      const dd = await page.evaluate(() => {
        const m = document.getElementById('day-detail-modal');
        return { visible: !!m && getComputedStyle(m).display !== 'none', title: (document.getElementById('day-detail-title') || {}).textContent, rows: document.querySelectorAll('.dd-row').length };
      });
      console.log('日详情:', JSON.stringify(dd));
      await page.evaluate(() => { if (typeof closeDayDetail === 'function') closeDayDetail(); });
    }

    // ---- 海报（整月日历）----
    await page.evaluate(() => { if (typeof openWeeklyPoster === 'function') openWeeklyPoster(); });
    await sleep(2200);
    const posterInfo = await page.evaluate(() => {
      const cv = document.getElementById('weekly-poster-canvas');
      const m = document.getElementById('weekly-poster-modal');
      return { hasCanvas: !!cv, w: cv && cv.width, h: cv && cv.height, modalVisible: !!m && getComputedStyle(m).display !== 'none', tip: (document.getElementById('weekly-poster-tip') || {}).textContent };
    });
    console.log('海报(整月):', JSON.stringify(posterInfo));
    const dataUrl = await page.evaluate(() => { const cv = document.getElementById('weekly-poster-canvas'); return cv ? cv.toDataURL('image/png') : null; });
    if (dataUrl) { const p3 = path.join(OUT, `monthly-poster-${WIDTH}.png`); fs.writeFileSync(p3, Buffer.from(dataUrl.split(',')[1], 'base64')); shots.push(p3); }
    await page.evaluate(() => { if (typeof closeWeeklyPoster === 'function') closeWeeklyPoster(); });
    await sleep(400);

    // ---- 海报（空白模板 · 整月）----
    await page.evaluate(() => { if (typeof downloadWeeklyBlankPoster === 'function') downloadWeeklyBlankPoster(); });
    await sleep(1800);
    const blankUrl = await page.evaluate(() => { const cv = document.getElementById('weekly-poster-canvas'); return cv ? cv.toDataURL('image/png') : null; });
    if (blankUrl) { const p4 = path.join(OUT, `monthly-poster-blank-${WIDTH}.png`); fs.writeFileSync(p4, Buffer.from(blankUrl.split(',')[1], 'base64')); shots.push(p4); }
    await page.evaluate(() => { if (typeof closeWeeklyPoster === 'function') closeWeeklyPoster(); });

    // ---- 清理临时账号 ----
    if (!KEEP) {
      const del = await api('delete_account', { confirm: 'DELETE' }, token);
      console.log('清理临时账号:', JSON.stringify(del));
    } else { console.log('--keep：临时账号保留', email); }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
    srv.close();
  }

  console.log('\n截图:');
  shots.forEach(s => console.log('  ' + s));
})().catch(e => { console.error('✘ 失败:', e.message); process.exit(1); });
