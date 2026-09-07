const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = 'https://stellar.gaocaihk.com';
const OUT = 'screenshots';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  try {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setUserAgent(UA);

    // 1) 登录页（含"忘记密码？"链接）
    await page.goto(BASE + '/login.html?cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
    await page.screenshot({ path: `${OUT}/pwd-01-login-forgot-link.png` });

    // 2) 点击"忘记密码？"→ 找回密码表单
    const clicked = await page.evaluate(() => {
      const a = [...document.querySelectorAll('#login-form a')].find(a => /忘记密码|Forgot/i.test(a.textContent));
      if (a) { a.click(); return true; }
      return false;
    });
    await new Promise(r => setTimeout(r, 800));
    console.log('clicked forgot link:', clicked);
    await page.screenshot({ path: `${OUT}/pwd-02-forgot-form.png` });

    // 3) 带 ?reset=TOKEN 直达 → 重置密码表单
    const page2 = await ctx.newPage();
    await page2.setUserAgent(UA);
    await page2.goto(BASE + '/login.html?reset=faketoken0123456789abcdef0123456789abcdef0123456789abcdef0123456789&cb=' + Date.now(), { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 1500));
    await page2.screenshot({ path: `${OUT}/pwd-03-reset-form.png` });

    console.log('截图完成');
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await browser.close();
  }
})();
