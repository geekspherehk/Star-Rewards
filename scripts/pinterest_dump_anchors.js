const puppeteer = require('puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const log = (...a) => console.log('[dump]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function findChrome() {
  for (const c of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']) if (fs.existsSync(c)) return c;
  return null;
}
async function probeLoggedIn(browser) {
  const p = await browser.newPage();
  await p.goto('https://www.pinterest.com/' + USER + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  const url = p.url(); const txt = await p.evaluate(() => document.body.innerText).catch(() => '');
  await p.close();
  return !/log in|sign up|join/i.test(txt) && url.includes(USER);
}
(async () => {
  const exe = findChrome(); if (!exe) process.exit(2);
  const browser = await puppeteer.launch({ executablePath: exe, headless: false, userDataDir: PROFILE, args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1400'] });
  try {
    if (!(await probeLoggedIn(browser))) { console.error('NEED_LOGIN'); process.exit(10); }
    const page = await browser.newPage();
    await page.goto('https://www.pinterest.com/' + USER + '/_saved/', { waitUntil: 'networkidle2', timeout: 40000 });
    await sleep(5000);
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 2000)); await sleep(1500); }
    await sleep(2000);
    const data = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a'));
      const hrefs = anchors.map(a => a.getAttribute('href') || '').filter(Boolean);
      // 统计含 pin 的
      const pinHrefs = hrefs.filter(h => /pin/i.test(h));
      return { totalAnchors: anchors.length, totalHrefs: hrefs.length, sampleHrefs: hrefs.slice(0, 30), pinHrefsSample: pinHrefs.slice(0, 20), pinHrefsCount: pinHrefs.length };
    });
    log('totalAnchors=' + data.totalAnchors, 'totalHrefs=' + data.totalHrefs, 'pinHrefsCount=' + data.pinHrefsCount);
    log('--- sample hrefs ---'); data.sampleHrefs.forEach(h => log('  ', h));
    log('--- pin hrefs sample ---'); data.pinHrefsSample.forEach(h => log('  ', h));
    fs.writeFileSync('/tmp/pin-anchors.json', JSON.stringify(data, null, 2));
    console.log('DONE');
    await sleep(1500);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
