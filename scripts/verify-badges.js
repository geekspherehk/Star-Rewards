const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-vb-${Date.now()}`]
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

  const report = await page.evaluate(() => {
    const wall = document.querySelector('.ach-v2-wall');
    const grid = wall.querySelector('.bdg-grid');
    const badges = [...wall.querySelectorAll('.bdg')];
    const modCard = wall.closest('.module-card') || wall.parentElement;
    const modRect = modCard.getBoundingClientRect();
    const out = { count: badges.length, hasNameLabel: !!wall.querySelector('.bdg-name'), gridCols: 0, rows: 0, tooltips: [], clipping: [] };
    const wallRect = wall.getBoundingClientRect();

    // grid columns
    const tops = badges.map(b => Math.round(b.getBoundingClientRect().top));
    const uniqueTops = [...new Set(tops)];
    out.rows = uniqueTops.length;
    out.gridCols = badges.length / out.rows;

    badges.forEach((b, i) => {
      const tip = b.querySelector('.bdg-tip');
      const medal = b.querySelector('.bdg-medal');
      const tipCs = getComputedStyle(tip);
      const medalCs = getComputedStyle(medal);
      const tipRect = tip.getBoundingClientRect();
      out.tooltips.push({
        i,
        locked: b.classList.contains('is-locked'),
        tipOpacityDefault: tipCs.opacity,
        tipName: tip.querySelector('.bdg-tip-name')?.textContent,
        tipStatus: tip.querySelector('.bdg-tip-status')?.textContent,
        medalFilter: medalCs.filter,
        tipBottomVsWallBottom: Math.round(tipRect.bottom - wallRect.bottom),
        tipLeftVsWallLeft: Math.round(tipRect.left - wallRect.left),
        tipRightVsWallRight: Math.round(tipRect.right - wallRect.right)
      });
    });
    // clipping detection on last row
    const lastRowTops = Math.max(...tops);
    badges.forEach((b, i) => {
      if (Math.round(b.getBoundingClientRect().top) === lastRowTops) {
        const tip = b.querySelector('.bdg-tip');
        const tipRect = tip.getBoundingClientRect();
        if (tipRect.bottom > wallRect.bottom + 1) out.clipping.push({ i, overflowPx: Math.round(tipRect.bottom - wallRect.bottom) });
      }
    });
    out.wallPaddingBottom = getComputedStyle(wall).paddingBottom;
    out.wallRect = { top: Math.round(wallRect.top), bottom: Math.round(wallRect.bottom), left: Math.round(wallRect.left), right: Math.round(wallRect.right) };
    return out;
  });
  console.log(JSON.stringify(report, null, 2));
  await page.evaluate(async () => { try { await api.deleteAccount(); } catch (e) {} });
  await browser.close();
})();
