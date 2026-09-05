const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const email = `sr.emb.${Date.now()}@example.com`;
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-v9c-${Date.now()}`]
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
    if (typeof v2Data === 'object' && v2Data) {
      v2Data.badges = v2Data.badges || {};
      ['self_drive', 'planning', 'health', 'money', 'empathy'].forEach(c => { v2Data.badges['rose_' + c] = { unlocked: true }; });
      if (typeof renderV2Badges === 'function') renderV2Badges();
    }
  });
  await sleep(800);
  const layout = await page.evaluate(() => {
    const out = { groups: [] };
    document.querySelectorAll('.bdg-group').forEach(g => {
      const label = g.querySelector('.bdg-group-label')?.textContent;
      const gr = g.getBoundingClientRect();
      const rows = new Set();
      g.querySelectorAll('.bdg').forEach(b => rows.add(Math.round(b.getBoundingClientRect().top)));
      out.groups.push({ label, left: Math.round(gr.left), width: Math.round(gr.width), medalRows: rows.size });
    });
    const gs = document.querySelector('.bdg-groups');
    out.groupsWidth = Math.round(gs.getBoundingClientRect().width);
    out.groupsCols = getComputedStyle(gs).gridTemplateColumns;
    return out;
  });
  console.log(JSON.stringify(layout, null, 2));
  await page.evaluate(async () => { try { await api.deleteAccount(); } catch (e) {} });
  await browser.close();
})();
