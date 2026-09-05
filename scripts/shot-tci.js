const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-tci-${Date.now()}`]
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
  await page.evaluate(() => {
    const ob = document.getElementById('onboarding-modal');
    if (ob && ob.style.display !== 'none') ob.style.display = 'none';
    const iv = document.getElementById('push-invite');
    if (iv) iv.style.display = 'none';
    if (typeof v2Data === 'object' && v2Data) {
      v2Data.wishes = (v2Data.wishes || []).concat([
        { id: 801, title: '每天自主完成作业并检查一遍', category: 'self_drive', status: 'active', streak: 12, today_checked: false },
        { id: 802, title: '每周存 10 元零花钱', category: 'money', status: 'active', streak: 4, today_checked: true },
        { id: 803, title: '睡前阅读 20 分钟', category: 'health', status: 'active', streak: 7, today_checked: false },
        { id: 804, title: '对家人说一句感谢的话', category: 'empathy', status: 'active', streak: 2, today_checked: false }
      ]);
      if (typeof renderHomeCheckin === 'function') renderHomeCheckin();
    }
  });
  await sleep(800);
  // metrics: row structure
  const m = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.today-checkin-row')];
    return rows.map(r => {
      const top = r.querySelector('.tci-top');
      const act = r.querySelector('.tci-actions');
      const title = r.querySelector('.tci-title');
      const btn = r.querySelector('.v2-checkin-btn');
      const rr = r.getBoundingClientRect();
      return {
        rowW: Math.round(rr.width),
        rowH: Math.round(rr.height),
        twoRows: top && act ? Math.round(act.getBoundingClientRect().top) > Math.round(top.getBoundingClientRect().bottom) - 2 : false,
        titleW: title ? Math.round(title.getBoundingClientRect().width) : 0,
        btnText: btn ? btn.textContent.trim() : '',
        btnUnderTitle: btn && title ? btn.getBoundingClientRect().top > title.getBoundingClientRect().bottom - 2 : false
      };
    });
  });
  console.log('DESKTOP:', JSON.stringify(m));
  const card = await page.$('#today-checkin .today-checkin-list') || await page.$('#today-checkin');
  if (card) await card.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/tci-two-row-desktop.png' });
  // mobile
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(800);
  const mm = await page.evaluate(() => {
    return [...document.querySelectorAll('.today-checkin-row')].map(r => {
      const rr = r.getBoundingClientRect();
      const btn = r.querySelector('.v2-checkin-btn');
      const makeup = r.querySelector('.tci-makeup');
      return {
        rowW: Math.round(rr.width),
        rowH: Math.round(rr.height),
        btnW: btn ? Math.round(btn.getBoundingClientRect().width) : 0,
        makeupIconOnly: makeup ? getComputedStyle(makeup.querySelector('.tmi-text')).display === 'none' : null,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
  });
  console.log('MOBILE:', JSON.stringify(mm));
  if (card) await card.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/tci-two-row-mobile.png' });
  await page.evaluate(async () => { try { await api.deleteAccount(); } catch (e) {} });
  await browser.close();
})();
