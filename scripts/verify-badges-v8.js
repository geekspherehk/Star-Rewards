const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-v8-${Date.now()}`]
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
  await sleep(1500);
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

  // 1. section order: 成长总览 (growth-overview) must come BEFORE 徽章 (ach-v2-wall)
  const order = await page.evaluate(() => {
    const ov = document.getElementById('growth-overview');
    const bw = document.querySelector('.ach-v2-wall');
    if (!ov || !bw) return { error: 'missing' };
    const all = [...document.querySelectorAll('#achievements-module > *')].map(n => n.id || n.className.split(' ')[0]);
    return { order: all, flowerTop: ov.getBoundingClientRect().top, badgeTop: bw.getBoundingClientRect().top };
  });
  console.log('SECTION ORDER:', JSON.stringify(order));

  // 2. groups present and labelled
  const groups = await page.evaluate(() => {
    return [...document.querySelectorAll('.ach-v2-wall .bdg-group')].map(g => ({
      label: g.querySelector('.bdg-group-label')?.textContent,
      count: g.querySelector('.bdg-group-count')?.textContent,
      medalCount: g.querySelectorAll('.bdg').length,
      hasCardBg: getComputedStyle(g).backgroundColor,
      borderRadius: getComputedStyle(g).borderRadius
    }));
  });
  console.log('GROUPS:', JSON.stringify(groups, null, 2));

  // 3. medal size sample
  const sizes = await page.evaluate(() => {
    const m = document.querySelector('.ach-v2-wall .bdg-medal');
    if (!m) return null;
    const r = m.getBoundingClientRect();
    const cs = getComputedStyle(m);
    return { w: Math.round(r.width), h: Math.round(r.height), icoW: cs.width };
  });
  console.log('MEDAL SIZE:', JSON.stringify(sizes));

  // 4. tooltip default + hover state
  const tipDefaults = await page.evaluate(() => {
    return [...document.querySelectorAll('.ach-v2-wall .bdg-tip')].map(t => ({
      opacity: getComputedStyle(t).opacity,
      pointer: getComputedStyle(t).pointerEvents
    })).slice(0, 3);
  });
  console.log('TIP DEFAULTS (first 3):', JSON.stringify(tipDefaults));

  // 5. full wall screenshot
  const wall = await page.$('.ach-v2-wall');
  if (wall) await wall.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/badges-v8-grouped.png' });
  console.log('shot ok');

  // 6. hover state for one achieved + one locked
  await page.evaluate(() => {
    const b = document.querySelectorAll('.ach-v2-wall .bdg');
    if (b[0]) b[0].classList.add('is-preview');
    const locked = document.querySelector('.ach-v2-wall .bdg.is-locked');
    if (locked) locked.classList.add('is-preview');
  });
  await sleep(400);
  if (wall) await wall.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/badges-v8-hover.png' });
  console.log('hover shot ok');

  await page.evaluate(async () => { try { await api.deleteAccount(); } catch (e) {} });
  await browser.close();
})();
