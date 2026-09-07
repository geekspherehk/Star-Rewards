const puppeteer = require('puppeteer-core');
const fs = require('fs');

const BASE = 'https://stellar.gaocaihk.com';
const OUT = 'assets';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const OWNER = { email: 'sr.demo.showcase@example.com', pass: 'DemoShowcase2026!' };

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
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });

    // 登录
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 15000 });
    await page.type('#login-email', OWNER.email);
    await page.type('#login-password', OWNER.pass);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
      page.click('#login-form button')
    ]);
    await new Promise(r => setTimeout(r, 5000));
    console.log('after login URL =', page.url());

    // 关掉 onboarding 弹窗 + 推送横幅等浮层
    await page.evaluate(() => {
      const clickByText = (sel, re) => {
        const el = [...document.querySelectorAll(sel)].find(e => re.test(e.textContent || ''));
        if (el) { el.click(); return true; }
        return false;
      };
      clickByText('button, .onboarding-dismiss, a', /开始使用|不再提示|Get started|开始旅程/);
      setTimeout(() => clickByText('button, a, .push-dismiss', /以后再说|稍后|Later|开启提醒/) && 0, 600);
    });
    await new Promise(r => setTimeout(r, 1500));
    await page.evaluate(() => {
      const m = document.getElementById('onboarding-modal');
      if (m) m.style.display = 'none';
      const pb = document.querySelector('.push-invite-banner, #push-invite-banner');
      if (pb) pb.style.display = 'none';
    });
    await new Promise(r => setTimeout(r, 500));

    // 1) 成长之花模块（成长总览/八瓣图）——找到模块容器截图
    const shot = await page.evaluate(() => {
      // 依次尝试：成长总览模块 / 首页 rose 图容器
      const cands = ['.growth-overview', '.flower-module', '#growth-overview', '.rose-chart', '.radar-wrap', '.points-module', '#points-module'];
      for (const sel of cands) {
        const el = document.querySelector(sel);
        if (el && el.offsetHeight > 200) return { sel, found: true };
      }
      return { sel: null, found: false };
    });
    console.log('flower module:', JSON.stringify(shot));
    // 稳妥方案：整页首页截图，后面手动裁
    await page.screenshot({ path: `${OUT}/app-home-full.png`, fullPage: false });

    // 切到成长成就页：直接调全局 showModule
    await page.evaluate(() => { if (typeof showModule === 'function') showModule('achievements-module'); });
    await new Promise(r => setTimeout(r, 2500));
    // 隐藏一切固定/底部浮层
    await page.evaluate(() => {
      document.querySelectorAll('body *').forEach(e => {
        const s = getComputedStyle(e);
        if ((s.position === 'fixed' || s.position === 'sticky') && e.offsetHeight > 30 && e.offsetHeight < 200) e.style.display = 'none';
      });
      const topbar = document.querySelector('.app-topbar');
      if (topbar) topbar.style.display = '';
    });
    await page.screenshot({ path: `${OUT}/app-achievements-full.png`, fullPage: false });

    console.log('done');
  } catch (e) {
    console.error('ERR', e.message);
  } finally {
    await browser.close();
  }
})();
