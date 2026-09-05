const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-em-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 2 });
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
  await sleep(1000);
  await page.evaluate(() => {
    const ob = document.getElementById('onboarding-modal');
    if (ob && ob.style.display !== 'none') ob.style.display = 'none';
    const iv = document.getElementById('push-invite');
    if (iv) iv.style.display = 'none';
  });
  await sleep(400);
  await page.evaluate(() => {
    if (typeof v2Data === 'object' && v2Data) {
      v2Data.wishes = (v2Data.wishes || []).concat([
        { id: 901, title: '每天阅读', wish_type: 'persistence', status: 'active', streak: 12, persistence_days: 21 },
        { id: 902, title: '整理房间', wish_type: 'experience', status: 'achieved', streak: 0 }
      ]);
      v2Data.badges = v2Data.badges || {};
      ['self_drive', 'planning', 'health', 'money', 'empathy'].forEach(c => { v2Data.badges['rose_' + c] = { unlocked: true }; });
      v2Data.badges.rose_all_rounder = { unlocked: false, progress: 4, target: 6 };
      if (typeof redeemedGifts !== 'undefined') redeemedGifts = [{ id: 1 }, { id: 2 }];
      if (typeof renderV2Badges === 'function') renderV2Badges();
    }
  });
  await sleep(900);
  const el = await page.$('.ach-v2-wall');
  if (el) { await el.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/badges-v11.png' }); console.log('shot ok'); }
  const del = await page.evaluate(async () => { try { await api.deleteAccount(); return 'deleted'; } catch (e) { return 'ERR: ' + e.message; } });
  console.log('temp account:', del);
  await browser.close();
})();