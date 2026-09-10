// 独立复核画板是否真的建出来（不依赖创建脚本的返回值）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const URLS = [
  `https://www.pinterest.com/${USER}/_created/`,
  `https://www.pinterest.com/${USER}/boards/`,
  `https://www.pinterest.com/${USER}/`,
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = await browser.newPage();
  for (const u of URLS) {
    console.log('\n===== ' + u + ' =====');
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(5000);
      const info = await page.evaluate(() => ({
        url: location.href,
        text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 700),
      }));
      console.log('落地:', info.url);
      console.log('文字:', info.text);
    } catch (e) { console.log('ERR:', e.message); }
  }
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
