// 打开 Pin 详情 + 个人主页并截图留证，浏览器保持打开供用户翻阅
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[proof]', ...a);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1440,1000'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);

  // 1) 一张 Pin 详情页（能看到 Visit / 域名链接）
  await page.goto('https://www.pinterest.com/pin/1123155594603213558/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(10000);
  await page.screenshot({ path: '/tmp/proof-pin-detail.png' });
  const out = await page.evaluate(() => Array.from(new Set(
    Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => /gaocaihk/.test(h)))));
  log('详情页外链:', JSON.stringify(out));

  // 2) 个人主页
  await page.goto('https://www.pinterest.com/ujpu7859/_saved/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(9000);
  await page.screenshot({ path: '/tmp/proof-profile.png' });

  log('浏览器保持打开，供你翻阅。完成。');
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
