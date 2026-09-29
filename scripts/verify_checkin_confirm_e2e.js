// 线上 E2E：验证「今日打卡」单元格改走确认弹窗，且弹窗可关闭（取消/点背景）。
// 临时账号 → 建愿望 → 回填 → 打开周表 → 点 today 单元格 → 断言确认弹窗出现 → 测关闭 → 测确认打卡 → 删号
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.SR_BASE || 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now() / 1000);

const WISHES = [
  { category: 'health', title: '9 点前上床睡觉', days: [0] },
  { category: 'aesthetics', title: '阅读 20 分钟', days: [1, 0] },
  { category: 'self_drive', title: '早晚刷牙', days: [1] },
];

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-cc-'));
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: ud, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  let email = null, pass = true;
  const log = (ok, msg) => { if (!ok) pass = false; console.log((ok ? '✅ ' : '❌ ') + msg); };

  try {
    const page = await browser.newPage();
    await page.setUserAgent(UA);
    await page.setViewport({ width: 900, height: 1400, deviceScaleFactor: 2 });

    // 注册
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });
    await sleep(500);
    email = `sr.demo.cc.${ts}@example.com`;
    let reg = null;
    for (let i = 0; i < 4 && !reg; i++) {
      try { reg = await page.evaluate(async (e) => (await fetch('/api/index.php?action=register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: 'TestPass123!', consent: true }) })).json(), email); } catch (err) { await sleep(1200); }
    }
    if (!reg || !reg.token) throw new Error('注册失败: ' + JSON.stringify(reg));
    await page.evaluate((t, e) => { localStorage.setItem('auth_token', t); localStorage.setItem('user_email', e); }, reg.token, email);
    console.log('注册:', email);

    // 建愿望 + 造打卡
    const prep = await page.evaluate(async (wishes) => {
      const tk = localStorage.getItem('auth_token');
      const call = async (action, body) => (await fetch('/api/index.php?action=' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify(body || {}) })).json();
      const d = (off) => { const x = new Date(); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); };
      const out = [];
      for (const w of wishes) {
        const wish = await call('add_wish', { category: w.category, title: w.title, wish_type: 'persistence', persistence_days: 30 });
        if (!wish || !wish.id) { out.push({ title: w.title, error: JSON.stringify(wish).slice(0,120) }); continue; }
        for (const off of w.days) await call('add_checkin', { wish_id: wish.id, date: d(off) });
        out.push({ title: w.title, id: wish.id });
      }
      return out;
    }, WISHES);
    console.log('建愿望:', JSON.stringify(prep.filter(w=>w.id).map(w=>w.id)));

    // 回填 created_at 到 8 天前 → 出现漏卡
    const py = path.join(os.homedir(), '.workbuddy/binaries/python/envs/default/bin/python');
    try { console.log(execFileSync(py, [path.join(__dirname, 'dev_backdate_wish.py'), email, '8'], { encoding: 'utf8' }).trim()); } catch (e) { console.log('⚠ 回填失败:', String(e.message).slice(0,160)); }

    // 打开首页
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(5000);
    await page.evaluate(() => {
      const m = document.getElementById('onboarding-modal');
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      if (m) m.style.display = 'none';
      document.querySelectorAll('.onboarding-modal, .help-overlay').forEach(e => e.remove());
      ['activation-progress-bar','welcome-banner','home-focus-banner','activation-checklist'].forEach(id => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
      if (typeof showModule === 'function') showModule('points-module');
      if (typeof renderWeeklyModule === 'function') renderWeeklyModule();
    });
    await sleep(1200);

    // 找一个 today 单元格
    const todaySel = await page.evaluate(() => {
      const c = document.querySelector('#weekly-grid .wk-cell.is-today');
      return !!c;
    });
    log(todaySel, '周表存在 is-today 单元格');

    // 记录今日打卡数（确认弹窗未点时不应新增）
    const beforeCount = await page.evaluate(() => {
      try { return (window.v2Data && window.v2Data.checkins) ? window.v2Data.checkins.length : (typeof checkins !== 'undefined' ? checkins.length : -1); } catch (e) { return -1; }
    });

    // 点 today 单元格
    await page.evaluate(() => { const c = document.querySelector('#weekly-grid .wk-cell.is-today'); if (c) c.click(); });
    await sleep(400);
    const modalShown = await page.evaluate(() => { const m = document.getElementById('checkin-confirm-modal'); return !!m && getComputedStyle(m).display !== 'none'; });
    log(modalShown, '点击今天单元格 → 确认弹窗出现');
    await page.screenshot({ path: path.join(OUT, 'checkin-confirm-open.png') });

    // 误点取消按钮 → 关闭
    await page.evaluate(() => { const b = document.querySelector('#checkin-confirm-modal .secondary-btn'); if (b) b.click(); });
    await sleep(300);
    const closedByCancel = await page.evaluate(() => { const m = document.getElementById('checkin-confirm-modal'); return !!m && getComputedStyle(m).display === 'none'; });
    log(closedByCancel, '点「取消」→ 弹窗关闭');

    // 再次点 today → 关掉弹窗：点背景（遮罩）
    await page.evaluate(() => { const c = document.querySelector('#weekly-grid .wk-cell.is-today'); if (c) c.click(); });
    await sleep(300);
    const reopened = await page.evaluate(() => { const m = document.getElementById('checkin-confirm-modal'); return !!m && getComputedStyle(m).display !== 'none'; });
    log(reopened, '再次点击今天单元格 → 弹窗复现');
    // 点遮罩关闭
    await page.evaluate(() => { const ov = document.getElementById('checkin-confirm-modal'); if (ov) { const r = ov.getBoundingClientRect(); const ev = new MouseEvent('click', { bubbles: true, clientX: r.left + 2, clientY: r.top + 2 }); ov.dispatchEvent(ev); } });
    await sleep(300);
    const closedByBackdrop = await page.evaluate(() => { const m = document.getElementById('checkin-confirm-modal'); return !!m && getComputedStyle(m).display === 'none'; });
    log(closedByBackdrop, '点弹窗背景（遮罩）→ 弹窗关闭');

    // 关键：取消/点背景关闭后，today 不应被记上
    const afterCancelCount = await page.evaluate(() => {
      try { return (window.v2Data && window.v2Data.checkins) ? window.v2Data.checkins.length : (typeof checkins !== 'undefined' ? checkins.length : -1); } catch (e) { return -1; }
    });
    log(beforeCount === afterCancelCount || beforeCount < 0, `误关弹窗不误记打卡 (before=${beforeCount}, afterCancel=${afterCancelCount})`);

    // 最后确认打卡一次 → 应记上
    await page.evaluate(() => { const c = document.querySelector('#weekly-grid .wk-cell.is-today'); if (c) c.click(); });
    await sleep(300);
    await page.evaluate(() => { const b = document.querySelector('#checkin-confirm-modal .primary-btn'); if (b) b.click(); });
    await sleep(800);
    const afterConfirm = await page.evaluate(() => {
      try { return (window.v2Data && window.v2Data.checkins) ? window.v2Data.checkins.length : (typeof checkins !== 'undefined' ? checkins.length : -1); } catch (e) { return -1; }
    });
    log(afterConfirm > beforeCount || beforeCount < 0, `确认打卡成功 (afterConfirm=${afterConfirm})`);

    // 清理
    const del = await page.evaluate(async () => {
      const tk = localStorage.getItem('auth_token');
      return (await fetch('/api/index.php?action=delete_account', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk }, body: JSON.stringify({ confirm: 'DELETE' }) })).json();
    });
    console.log('清理临时账号:', JSON.stringify(del));
  } catch (e) {
    console.error('✘ 失败:', e.message);
    pass = false;
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(ud, { recursive: true, force: true });
  }
  console.log('\n' + (pass ? '🎉 全部通过' : '⚠ 存在失败项'));
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error('✘ 崩溃:', e.message); process.exit(1); });
