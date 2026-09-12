// Logged-OUT public view: find a real /pin/ anchor, open it, read destination link.
const puppeteer = require('puppeteer-core');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const USER = process.argv[2] || 'ujpu7859';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const TMP = '/tmp/pinterest-public-' + Date.now();

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: TMP,
    args: ['--no-sandbox', '--window-size=1280,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`https://www.pinterest.com/${USER}/`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(6000);
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 1000)); await sleep(1200); }

  const pinHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/pin/"]');
    return a ? a.getAttribute('href') : null;
  });
  console.log('PUBLIC pin href:', pinHref);
  if (!pinHref) {
    // dump any pin-like hrefs
    const all = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).filter(h => /pin/i.test(h)).slice(0, 5));
    console.log('pin-like hrefs:', JSON.stringify(all));
    await browser.close(); process.exit(1);
  }

  await page.goto('https://www.pinterest.com' + pinHref, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(6000);

  const detail = await page.evaluate(() => {
    const outs = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (/^https?:\/\//.test(h) && !/pinterest\.com/.test(h)) outs.push(h);
    });
    let visit = null;
    document.querySelectorAll('a,button').forEach(el => {
      const t = (el.innerText || '').trim().toLowerCase();
      if (t === 'visit' || t === 'more info' || t.startsWith('visit ')) visit = el.getAttribute('href') || el.innerText.trim();
    });
    return { outs: [...new Set(outs)], visit, url: location.href };
  });
  console.log('DETAIL URL:', detail.url);
  console.log('OUTBOUND (destination):', JSON.stringify(detail.outs, null, 2));
  console.log('VISIT:', detail.visit);
  console.log('🔓 kept open');
  await new Promise(() => {});
})().catch(e => { console.error('💥', e.message); process.exit(1); });
