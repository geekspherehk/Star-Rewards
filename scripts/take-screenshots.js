// 全站 UI 截图脚本（puppeteer-core + 系统 Chrome）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = require('path');
const fs = require('fs');

const OUT = '/Users/work/code/Star-Rewards/screenshots';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const OWNER = { email: 'sr.test.owner.1786462308@example.com', pass: 'TestPass123!' };
const SW = { email: 'sr.test.sw.1786462415@example.com', pass: 'TestPass123!' };

fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: true });
  console.log('shot:', name);
}

async function login(page, account) {
  await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 800));
  try {
    await page.waitForSelector('#login-email', { timeout: 10000 });
  } catch (e) {
    // 偶发触发 Hostinger 人机挑战 → 重试一次
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('#login-email', { timeout: 15000 });
  }
  await page.type('#login-email', account.email);
  await page.type('#login-password', account.pass);
  await page.evaluate(() => handleSignIn());
  await new Promise(r => setTimeout(r, 4500));
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', `--user-agent=${UA}`, '--disable-blink-features=AutomationControlled', `--user-data-dir=/tmp/sr-chrome-${Date.now()}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking'],
    defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 2 }
  });

  // ── 1. 未登录状态 ──
  const page1 = await browser.newPage();
  await page1.setUserAgent(UA);
  await page1.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 1200));
  await shot(page1, '01-login.png');
  await page1.evaluate(() => toggleAuthForm('register'));
  await new Promise(r => setTimeout(r, 800));
  await shot(page1, '02-register.png');
  // 邀请链接直达登录页 → 邀请码预填
  await page1.goto(BASE + '/login.html?invite=23GWPG', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 1000));
  await page1.evaluate(() => toggleAuthForm('register'));
  await new Promise(r => setTimeout(r, 800));
  await shot(page1, '03-register-prefilled.png');

  // 行为模板页（未登录可看）
  await page1.goto(BASE + '/behavior-templates.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 1500));
  await shot(page1, '04-templates-zh.png');

  // ── 2. owner 登录（有数据：家庭/兑换/徽章） ──
  const page2 = await browser.newPage();
  await page2.setUserAgent(UA);
  await login(page2, OWNER);
  await new Promise(r => setTimeout(r, 1500));
  await shot(page2, '10-home.png');

  // 首页模块 → 分享海报（P0：乱码验证点）
  await page2.evaluate(() => openPosterModal());
  await new Promise(r => setTimeout(r, 2500)); // 等徽章 SVG 图加载
  await shot(page2, '11-poster.png');
  await page2.evaluate(() => closePosterModal());

  // 愿望清单
  await page2.evaluate(() => showModule('gifts-module'));
  await new Promise(r => setTimeout(r, 1200));
  await shot(page2, '12-gifts.png');

  // 成长日历
  await page2.evaluate(() => showModule('diary-module'));
  await new Promise(r => setTimeout(r, 1200));
  await shot(page2, '13-diary.png');

  // 成长纪念册
  await page2.evaluate(() => showModule('growth-module'));
  await new Promise(r => setTimeout(r, 1200));
  await shot(page2, '14-growth.png');

  // 家庭弹窗
  await page2.evaluate(() => openFamilyModal());
  await new Promise(r => setTimeout(r, 1200));
  await shot(page2, '15-family.png');
  await page2.evaluate(() => closeFamilyModal());

  // ── 3. 移动端（375×667）首页 ──
  const page3 = await browser.newPage();
  await page3.setUserAgent(UA);
  await page3.setViewport({ width: 375, height: 667, deviceScaleFactor: 2 });
  await login(page3, OWNER);
  await new Promise(r => setTimeout(r, 1500));
  await shot(page3, '20-home-mobile.png');
  await page3.evaluate(() => showModule('gifts-module'));
  await new Promise(r => setTimeout(r, 1000));
  await shot(page3, '21-gifts-mobile.png');

  // ── 4. SW 账号（有成长记录） ──
  const page4 = await browser.newPage();
  await page4.setUserAgent(UA);
  await login(page4, SW);
  await new Promise(r => setTimeout(r, 1500));
  await page4.evaluate(() => showModule('growth-module'));
  await new Promise(r => setTimeout(r, 1200));
  await shot(page4, '30-growth-rich.png');

  await browser.close();
  console.log('DONE');
})().catch(e => { console.error('ERR', e); process.exit(1); });
