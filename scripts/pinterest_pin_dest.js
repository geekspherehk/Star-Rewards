// Decisive test: click into a Pin detail and read its real destination link.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`https://www.pinterest.com/${USER}/_saved/`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(5000);
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 1000)); await sleep(1000); }

  // Find pin elements (Pinterest renders them as divs with data-test-id or role=link)
  const pinInfo = await page.evaluate(() => {
    const cands = [];
    document.querySelectorAll('[data-test-id="pin"], div[role="link"], a[href*="/pin/"]').forEach(el => {
      const href = el.getAttribute('href') || '';
      cands.push({ tag: el.tagName, href, testId: el.getAttribute('data-test-id') });
    });
    return cands.slice(0, 5);
  });
  console.log('PIN ELEMENTS:', JSON.stringify(pinInfo, null, 2));

  // Click the first pin via mouse
  const clicked = await page.evaluate(() => {
    const el = document.querySelector('[data-test-id="pin"]') || document.querySelector('a[href*="/pin/"]') || document.querySelector('div[role="link"]');
    if (!el) return false;
    const r = el.getBoundingClientRect();
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width/2, clientY: r.y + r.height/2 }));
    return true;
  });
  console.log('clicked pin:', clicked);
  await sleep(6000);
  console.log('URL after click:', page.url());

  // On pin detail, extract outbound links + visit button
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
  console.log('DESTINATION LINK (outs):', JSON.stringify(detail.outs, null, 2));
  console.log('VISIT BUTTON:', detail.visit);
  console.log('DETAIL URL:', detail.url);
  console.log('🔓 browser kept open');
  await new Promise(() => {});
}
main().catch(e => { console.error('💥', e.message); process.exit(1); });
