const puppeteer = require('puppeteer-core');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', `--user-data-dir=/tmp/pup-lp-${Date.now()}`]
  });
  const page = await browser.newPage();
  await page.setUserAgent(UA);
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto(BASE + '/landing.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(1500);
  const zh = await page.evaluate(() => ({
    title: document.querySelector('h1')?.textContent,
    steps: [...document.querySelectorAll('.lp-step b')].map(e => e.textContent),
    faqCount: document.querySelectorAll('.lp-faq details').length,
    freeBanner: document.querySelector('.lp-free p')?.textContent,
    i18nLeak: document.body.innerHTML.includes('data-i18n="land.') === false
  }));
  console.log('ZH:', JSON.stringify(zh));
  await page.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/landing-zh-desktop.png', fullPage: true });
  // EN
  await page.evaluate(() => setLanguage('en'));
  await sleep(600);
  const en = await page.evaluate(() => ({
    title: document.querySelector('h1')?.textContent,
    freeBanner: document.querySelector('.lp-free p')?.textContent
  }));
  console.log('EN:', JSON.stringify(en));
  await page.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/landing-en-desktop.png', fullPage: true });
  // MOBILE zh
  await page.evaluate(() => setLanguage('zh'));
  await sleep(400);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await sleep(600);
  const mob = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  console.log('MOBILE:', JSON.stringify(mob));
  await page.screenshot({ path: '/Users/work/code/Star-Rewards/screenshots/landing-zh-mobile.png', fullPage: true });
  await browser.close();
})();
