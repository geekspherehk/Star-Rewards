// 诊断：找出 Pinterest 当前「认领网站 / Claim」页面的真实入口与 p:domain_verify 标签
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const URLS = [
  'https://www.pinterest.com/settings/claimed-accounts/',
  'https://www.pinterest.com/settings/claim/',
  'https://www.pinterest.com/business/claim/',
  'https://www.pinterest.com/settings/',
  'https://business.pinterest.com/settings/',
  'https://www.pinterest.com/settings/account-settings/',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1000'],
  });
  const page = await browser.newPage();
  for (let i = 0; i < URLS.length; i++) {
    const u = URLS[i];
    console.log('\n===== ' + u + ' =====');
    try {
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(4500);
      const info = await page.evaluate(() => ({
        url: location.href,
        title: document.title,
        hasClaimText: /claim/i.test(document.body ? document.body.innerText : ''),
        claimLinks: Array.from(document.querySelectorAll('a'))
          .map(a => a.getAttribute('href'))
          .filter(h => h && /claim/i.test(h)).slice(0, 20),
        metaVerify: (document.querySelector('meta[name="p:domain_verify"]') || {}).content || null,
        snippet: ((document.body ? document.body.innerText : '') || '').replace(/\s+/g, ' ').slice(0, 1200),
      }));
      console.log('landed    :', info.url);
      console.log('title     :', info.title);
      console.log('hasClaim  :', info.hasClaimText);
      console.log('metaVerify:', info.metaVerify);
      console.log('claimLinks:', JSON.stringify(info.claimLinks));
      console.log('snippet   :', info.snippet);
      await page.screenshot({ path: `/tmp/pin-claim-${i}.png` });
    } catch (e) {
      console.log('ERR:', e.message);
    }
  }
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
