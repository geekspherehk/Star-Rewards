// 线上效果留档：本周打卡模块（站内周表 + AI 海报）
//
// 做法：临时账号 → 建 5 个不同素养的愿望 → 回填 created_at 到 8 天前
//       → 用 add_checkin 造出「已打/漏卡/今日」混合 → 截图周表与海报弹窗
//       → 用完即删账号（--keep 可保留）
//
// 用法：
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//     node scripts/shot_weekly_module.js [--width 900] [--keep]
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.SR_BASE || 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WIDTH = parseInt(argOf('--width', '900'), 10);
const KEEP = argv.includes('--keep');

const OUT = path.join(__dirname, '..', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));

// 本周（周日→周六）里的打卡计划：wish 索引 → 相对天数（0=今天）
const WISHES = [
  { category: 'self_drive', title: '早晚刷牙', days: [1, 2] },
  { category: 'aesthetics', title: '阅读 20 分钟', days: [1, 0] },
  { category: 'planning', title: '自己整理书包', days: [] },
  { category: 'health', title: '9 点前上床睡觉', days: [0] },
  { category: 'resilience', title: '喝足 6 杯水', days: [1] },
];

const ts = Math.floor(Date.now() / 1000);

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-weekly-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: ud,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [];
  let email = null;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: 1400, deviceScaleFactor: 2 });
    await page.setUserAgent(UA);

    // ---- 注册临时账号 ----
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });
    await sleep(600);
    email = `sr.demo.weekly.${ts}@example.com`;
    let reg = null;
    for (let i = 0; i < 4 && !reg; i++) {
      try {
        reg = await page.evaluate(async (e) => (await fetch('/api/index.php?action=register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: e, password: 'TestPass123!', consent: true }),
        })).json(), email);
      } catch (err) { await sleep(1200); }
    }
    if (!reg || !reg.token) throw new Error('注册失败: ' + JSON.stringify(reg));
    await page.evaluate((t, e) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_email', e);
    }, reg.token, email);

    // ---- 建愿望 + 造打卡 ----
    const prep = await page.evaluate(async (wishes) => {
      const tk = localStorage.getItem('auth_token');
      const call = async (action, body) => (await fetch('/api/index.php?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
        body: JSON.stringify(body || {}),
      })).json();
      const d = (off) => { const x = new Date(); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); };

      const out = [];
      for (const w of wishes) {
        const wish = await call('add_wish', {
          category: w.category, title: w.title,
          wish_type: 'persistence', persistence_days: 30,
        });
        if (!wish || !wish.id) { out.push({ title: w.title, error: JSON.stringify(wish).slice(0, 120) }); continue; }
        const ck = [];
        for (const off of w.days) {
          const r = await call('add_checkin', { wish_id: wish.id, date: d(off) });
          ck.push({ off, ok: !!(r && (r.success || r.checkin_id)) });
        }
        out.push({ title: w.title, id: wish.id, ck });
      }
      return out;
    }, WISHES);
    console.log('建愿望:', JSON.stringify(prep));

    // 把 created_at 往前挪 8 天，让本周出现「漏卡」（否则建立前的日子算 before，不显漏卡）
    const py = path.join(os.homedir(), '.workbuddy/binaries/python/envs/default/bin/python');
    try {
      console.log(execFileSync(py, [path.join(__dirname, 'dev_backdate_wish.py'), email, '8'], { encoding: 'utf8' }).trim());
    } catch (e) { console.log('⚠ 回填 created_at 失败:', String(e.message).slice(0, 200)); }

    // ---- 打开首页 → 切到「本周打卡」模块 ----
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(5000);
    await page.evaluate(() => {
      const m = document.getElementById('onboarding-modal');
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      if (m) m.style.display = 'none';
      document.querySelectorAll('.onboarding-modal, .help-overlay').forEach(e => e.remove());
    });
    await page.evaluate(() => {
      if (typeof showModule === 'function') showModule('points-module');
      if (typeof renderWeeklyModule === 'function') renderWeeklyModule();
    });
    await sleep(1200);

    const gridInfo = await page.evaluate(() => {
      const g = document.getElementById('weekly-grid');
      const cells = Array.from(document.querySelectorAll('.wk-cell'));
      const counts = {};
      cells.forEach(c => { const k = Array.from(c.classList).find(x => x.startsWith('is-')); counts[k] = (counts[k] || 0) + 1; });
      return { rows: g ? g.children.length : 0, cells: cells.length, counts };
    });
    console.log('周表:', JSON.stringify(gridInfo));

    await page.evaluate(() => {
      const el = document.getElementById('weekly-section');
      if (el) el.scrollIntoView({ block: 'start' });
    });
    await sleep(600);
    const mod = await page.$('#weekly-section');
    const p1 = path.join(OUT, `weekly-live-module-${WIDTH}.png`);
    await mod.screenshot({ path: p1 });
    shots.push(p1);

    // ---- 打开海报弹窗 ----
    await page.evaluate(() => { if (typeof openWeeklyPoster === 'function') openWeeklyPoster(); });
    await sleep(2600);
    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('weekly-poster-modal');
      return !!m && getComputedStyle(m).display !== 'none';
    });
    if (modalVisible) {
      const p2 = path.join(OUT, `weekly-live-poster-${WIDTH}.png`);
      await page.screenshot({ path: p2 });
      shots.push(p2);
      const cvData = await page.evaluate(() => document.getElementById('weekly-poster-canvas').toDataURL('image/png'));
      const p2b = path.join(OUT, 'weekly-live-poster-canvas.png');
      fs.writeFileSync(p2b, Buffer.from(cvData.split(',')[1], 'base64'));
      shots.push(p2b);
      const tip = await page.evaluate(() => (document.getElementById('weekly-poster-tip') || {}).textContent);
      console.log('海报提示:', (tip || '').trim());
    } else {
      console.log('⚠ 海报弹窗未打开');
    }

    // ---- 清理 ----
    if (!KEEP) {
      const del = await page.evaluate(async () => {
        const tk = localStorage.getItem('auth_token');
        return (await fetch('/api/index.php?action=delete_account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
          body: JSON.stringify({ confirm: 'DELETE' }),
        })).json();
      });
      console.log('清理临时账号:', JSON.stringify(del));
    } else {
      console.log('--keep：临时账号保留', email);
    }
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }

  console.log('\n截图:');
  shots.forEach(s => console.log('  ' + s));
})().catch(e => { console.error('✘ 失败:', e.message); process.exit(1); });
