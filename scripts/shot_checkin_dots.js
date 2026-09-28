// 线上效果留档：首页「近 7 天点阵」+ 补卡弹窗（日期芯片）
//
// 做法：临时账号 → 建一个坚持型愿望 → 用 add_checkin 补出「打了/漏了」混合的近 7 天
//       → 截图首页点阵区域与补卡弹窗 → 用完即删账号（--keep 可保留）
//
// 用法：
//   NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules \
//     node scripts/shot_checkin_dots.js [--width 430] [--keep]
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const os = require('os');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = process.env.SR_BASE || 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const WIDTH = parseInt(argOf('--width', '430'), 10);
const KEEP = argv.includes('--keep');

const OUT = path.join(__dirname, '..', 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now() / 1000);

// 近 7 天窗口里指定哪几天已打卡（0 = 今天）
const CHECKED_OFFSETS = [5, 4, 2];

function dayKey(offset) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

(async () => {
  const ud = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-shotdot-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: ud,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [];
  let email = null, token = null;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: WIDTH, height: 1000, deviceScaleFactor: 2 });
    await page.setUserAgent(UA);

    // ---- 注册临时账号 ----
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });
    await sleep(600);
    email = `sr.shotdot.${ts}@example.com`;
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
    token = reg.token;
    await page.evaluate((t, e) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_email', e);
    }, token, email);

    // ---- 建愿望 + 造打卡记录 ----
    const prep = await page.evaluate(async (checked) => {
      const tk = localStorage.getItem('auth_token');
      const call = async (action, body) => (await fetch('/api/index.php?action=' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tk },
        body: JSON.stringify(body || {}),
      })).json();

      const wish = await call('add_wish', {
        category: 'self_drive', title: '每天自己整理书包',
        wish_type: 'persistence', persistence_days: 7,
      });
      if (!wish || !wish.id) return { error: 'add_wish: ' + JSON.stringify(wish) };

      const d = (off) => { const x = new Date(); x.setDate(x.getDate() - off); return x.toISOString().slice(0, 10); };
      const results = [];
      for (const off of checked) {
        const r = await call('add_checkin', { wish_id: wish.id, date: d(off) });
        results.push({ off, ok: !!(r && (r.success || r.checkin_id)), r });
      }
      return { wishId: wish.id, results };
    }, CHECKED_OFFSETS);
    if (prep.error) throw new Error(prep.error);
    console.log('愿望 id =', prep.wishId, '打卡:', JSON.stringify(prep.results.map(r => ({ off: r.off, ok: r.ok }))));

    // 点阵把「目标建立之前」的日子标成 before（不算漏卡）。当天建的愿望看不到漏卡点，
    // 所以把 created_at 往前挪 8 天，才能演示出琥珀色漏卡。
    const { execFileSync } = require('child_process');
    const py = path.join(os.homedir(), '.workbuddy/binaries/python/envs/default/bin/python');
    try {
      console.log(execFileSync(py, [path.join(__dirname, 'dev_backdate_wish.py'), email, '8'], { encoding: 'utf8' }).trim());
    } catch (e) { console.log('⚠ 回填 created_at 失败:', String(e.message).slice(0, 200)); }

    // ---- 首页截图 ----
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(5000);
    await page.evaluate(() => {
      const m = document.getElementById('onboarding-modal');
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      if (m) m.style.display = 'none';
      document.querySelectorAll('.onboarding-modal, .help-overlay').forEach(e => e.remove());
    });
    await sleep(600);

    const row = await page.$('.ci-dots-row');
    if (!row) throw new Error('首页没渲染出 .ci-dots-row（点阵未出现）');
    await page.evaluate(() => {
      const el = document.querySelector('.ci-dots-row');
      (el.closest('.tci-item, .tci-row, li, .card, .v2-wish-card') || el.parentElement)
        .scrollIntoView({ block: 'center' });
    });
    await sleep(600);
    const p1 = path.join(OUT, `checkin-dots-home-${WIDTH}.png`);
    const p1b = path.join(OUT, `checkin-dots-full-${WIDTH}.png`);
    const dotsHtml = await page.evaluate(() => {
      const dots = Array.from(document.querySelectorAll('.ci-dots .ci-dot'));
      return dots.map(d => Array.from(d.classList).join(' ')).join(' | ');
    });
    console.log('点阵状态:', dotsHtml);
    // 截「目标卡片」整块（含标题/点阵/按钮），再补一张整页
    await page.screenshot({ path: p1 });
    await page.screenshot({ path: p1b, fullPage: true });
    shots.push(p1, p1b);

    // ---- 点「补 x/x」打开补卡弹窗 ----
    const clicked = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('.tci-makeup'));
      const b = btns[0];
      if (!b) return null;
      b.scrollIntoView({ block: 'center' });
      b.click();
      return b.textContent.trim();
    });
    if (!clicked) console.log('⚠ 首页没有出现补卡按钮（可能没有漏卡）');
    else console.log('点击的补卡按钮文案:', clicked);
    await sleep(1200);

    const modalVisible = await page.evaluate(() => {
      const m = document.getElementById('makeup-modal');
      return !!m && getComputedStyle(m).display !== 'none';
    });
    if (modalVisible) {
      const mp = path.join(OUT, `checkin-makeup-modal-${WIDTH}.png`);
      await page.screenshot({ path: mp });
      shots.push(mp);
      // 选中一个漏卡日期，看确认按钮文案变化
      const picked = await page.evaluate(() => {
        const d = document.querySelector('.mk-day.is-missed');
        if (d) { d.click(); return d.textContent.trim(); }
        return null;
      });
      await sleep(500);
      const btnText = await page.evaluate(() => (document.getElementById('makeup-confirm-btn') || {}).textContent);
      console.log('选中漏卡日期:', picked, '| 确认按钮:', (btnText || '').trim());
      const mp2 = path.join(OUT, `checkin-makeup-picked-${WIDTH}.png`);
      await page.screenshot({ path: mp2 });
      shots.push(mp2);
    } else {
      console.log('⚠ 补卡弹窗未打开');
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
