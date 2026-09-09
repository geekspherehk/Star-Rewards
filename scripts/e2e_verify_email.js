// 邮箱验证 E2E（真实浏览器，系统 Chrome）
// Phase 1: 注册新邮箱 -> 首页验证横幅可见 + email_verified=false + resend 可用
// Phase 2: （中间由 python 注入已知 token）已登录用户点击验证链接 -> 横幅消失 + email_verified=true
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const UD = process.env.QA_UD;
const EMAIL = process.env.QA_EMAIL;
const PASS = process.env.QA_PASS;
const TOKEN = process.env.QA_TOKEN;
const PHASE = process.env.QA_PHASE || '1';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir: UD,
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--user-agent=${UA}`, '--window-size=430,900'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900, isMobile: true });
  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

  if (PHASE === '1') {
    // 注册新邮箱
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#register-email', { timeout: 15000 });
    await page.type('#register-email', EMAIL);
    await page.type('#register-password', PASS);
    await page.click('#register-form button[onclick^="handleSignUp"]');
    // 等待自动跳转到首页
    await page.waitForFunction(() => location.pathname.endsWith('index.html'), { timeout: 20000 });
    await sleep(2500);

    // 横幅可见？
    const bannerVisible = await page.evaluate(() => {
      const b = document.getElementById('verify-banner');
      if (!b) return 'NO_BANNER_ELEMENT';
      return getComputedStyle(b).display !== 'none' && b.offsetParent !== null;
    });
    // getProfile 返回的 email_verified？
    const ev = await page.evaluate(async () => {
      try { const p = await api.getProfile(); return p.email_verified; } catch (e) { return 'ERR:' + e.message; }
    });
    // resend 接口？
    let resend = 'skip';
    try {
      const r = await page.evaluate(async (email) => {
        const resp = await api.resendVerification(email);
        return resp && resp.ok ? 'ok' : JSON.stringify(resp);
      }, EMAIL);
      resend = r;
    } catch (e) { resend = 'ERR:' + e.message; }

    console.log(`[${ts}] PHASE1 bannerVisible=${bannerVisible} email_verified=${ev} resend=${resend}`);
    await page.screenshot({ path: `${UD}/phase1-banner.png` });
  } else {
    // Phase 2: 已登录（从 Phase1 的 user-data-dir 继承 token），访问验证链接
    await page.goto(`${BASE}/login.html?verify=${TOKEN}`, { waitUntil: 'networkidle2', timeout: 45000 });
    // initAuth 在 ?verify 场景不跳转；handleVerifyEmail 应执行
    await sleep(4000);
    const verifyMsg = await page.evaluate(() => {
      const el = document.getElementById('verify-msg') || document.querySelector('.verify-msg');
      return el ? el.textContent : 'NO_VERIFY_MSG';
    });
    // 回到首页，确认横幅消失
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(2500);
    const bannerHidden = await page.evaluate(() => {
      const b = document.getElementById('verify-banner');
      if (!b) return 'NO_BANNER_ELEMENT';
      return getComputedStyle(b).display === 'none' || b.offsetParent === null;
    });
    const ev2 = await page.evaluate(async () => {
      try { const p = await api.getProfile(); return p.email_verified; } catch (e) { return 'ERR:' + e.message; }
    });
    console.log(`[${ts}] PHASE2 verifyMsg="${verifyMsg}" bannerHidden=${bannerHidden} email_verified=${ev2}`);
    await page.screenshot({ path: `${UD}/phase2-verified.png` });
  }

  if (logs.length) console.log('--- browser logs ---\n' + logs.slice(-25).join('\n'));
  await browser.close();
})().catch(e => { console.error('E2E ERROR:', e.message); process.exit(1); });
