const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = 'https://stellar.gaocaihk.com';
const OUT = 'screenshots';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// 真实桌面 Chrome UA，绕过 Hostinger 403 人机挑战
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    // 1) 游客直接访问根域名（清掉登录态）——应被重定向到 landing.html
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setUserAgent(UA);
    await page.goto(BASE + '/?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
    const url1 = page.url();
    console.log('游客访问根域名后 URL =', url1);
    await page.screenshot({ path: `${OUT}/root-visitor-landing.png`, fullPage: false });

    // 2) landing 产品页关键元素截图（hero + CTA）
    const page2 = await ctx.newPage();
    await page2.setUserAgent(UA);
    await page2.goto(BASE + '/landing.html?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1200));
    await page2.screenshot({ path: `${OUT}/landing-product-page.png`, fullPage: false });

    console.log('截图完成');
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await browser.close();
  }
})();
