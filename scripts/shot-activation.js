// 激活留存 A 系列截图：注册全新账号（0/4 步）→ 首启引导弹窗 + 激活进度条
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = '/Users/work/code/Star-Rewards/screenshots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

fs.mkdirSync(OUT, { recursive: true });
const email = 'sr.act.' + Date.now() + '@example.com';
const pass = 'TestPass123!';

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot:', name, '->', file);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', `--user-agent=${UA}`, '--disable-blink-features=AutomationControlled', `--user-data-dir=/tmp/sr-act-${Date.now()}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking'],
    defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 2 }
  });

  const page = await browser.newPage();
  await page.setUserAgent(UA);

  // ── 注册全新账号（0/4 激活步）──
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 1200));
  await page.evaluate(() => toggleAuthForm('register'));
  await new Promise(r => setTimeout(r, 600));
  await page.type('#register-email', email);
  await page.type('#register-password', pass);
  await page.evaluate(() => handleSignUp());
  await new Promise(r => setTimeout(r, 4500));

  // ── 进首页（token 已存，自动登录）──
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 3000));
  // 首启引导弹窗应出现（全新浏览器，无 sr_onboarding_done）
  await shot(page, 'act-01-onboarding.png');

  // 关闭引导 → 露出激活进度条 + 清单
  await page.evaluate(() => { const b = document.querySelector('.onboarding-dismiss'); if (b) b.click(); });
  await new Promise(r => setTimeout(r, 1800));
  await shot(page, 'act-02-home-progress.png');

  // 移动端视角
  const m = await browser.newPage();
  await m.setUserAgent(UA);
  await m.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await m.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 2500));
  await shot(m, 'act-03-mobile-home.png');

  await browser.close();
  console.log('DONE account=' + email);
})().catch(e => { console.error('ERR', e); process.exit(1); });
