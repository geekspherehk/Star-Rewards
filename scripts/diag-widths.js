const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-diag-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 1600, deviceScaleFactor: 2 });
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1500);
  await page.evaluate(() => toggleAuthForm('register'));
  await sleep(400);
  await page.waitForSelector('#register-email', { visible: true, timeout: 15000 });
  await page.type('#register-email', email);
  await page.type('#register-password', 'TestPass123!');
  await page.evaluate(() => handleSignUp());
  await sleep(5000);
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(3000);
  await page.evaluate(() => { if (typeof showModule === 'function') showModule('achievements-module'); });
  await sleep(1200);
  await page.evaluate(() => {
    const ob = document.getElementById('onboarding-modal');
    if (ob && ob.style.display !== 'none') ob.style.display = 'none';
    const iv = document.getElementById('push-invite');
    if (iv) iv.style.display = 'none';
  });
  await sleep(600);
  const diag = await page.evaluate(() => {
    function info(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { sel, left: Math.round(r.left), width: Math.round(r.width), display: cs.display, maxWidth: cs.maxWidth, justifyItems: cs.justifyItems, alignItems: cs.alignItems };
    }
    return [
      info('#achievements-module'),
      info('#achievements-module .calendar-card'),
      info('#achievements-module .weekly-card'),
      info('#achievements-module .growth-overview'),
      info('#achievements-module .ach-v2-wall'),
      info('#achievements-module .v2-badge-wall'),
      info('#achievements-module .ach-stats'),
      info('#achievements-module .redeem-summary')
    ];
  });
  console.log(JSON.stringify(diag, null, 2));
  await page.evaluate(async () => { try { await api.deleteAccount(); } catch (e) {} });
  await browser.close();
})();
