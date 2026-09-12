// 打开 Pinterest 主页给用户查看已发内容（用已登录 profile，浏览器保持打开）
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const SHOT = '/tmp/pinterest-profile-view.png';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

async function probeLoggedIn(browser) {
  const page = await browser.newPage();
  try {
    await page.goto('https://www.pinterest.com/ujpu7859/_saved/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(4000);
    const url = page.url();
    const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
    const loggedIn = !url.includes('/login') && !/Log in|Sign up/.test(txt);
    await page.close();
    return loggedIn;
  } catch (e) { await page.close().catch(()=>{}); return false; }
}

async function main() {
  const exe = findChrome();
  if (!exe) { console.log('❌ 找不到 Chrome'); process.exit(2); }
  console.log('Chrome:', exe);

  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: false,
    userDataDir: PROFILE,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,900'],
  });

  let loggedIn = await probeLoggedIn(browser);
  if (!loggedIn) {
    console.log('⚠️ 登录态失效，打开登录页，请手动登录…');
    const page = await browser.newPage();
    await page.goto('https://www.pinterest.com/login/', { waitUntil: 'domcontentloaded' });
    // 等用户登录：轮询直到登录成功
    for (let i = 0; i < 60; i++) {
      await sleep(5000);
      const url = page.url();
      const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
      if (!url.includes('/login') && !/Log in|Sign up/.test(txt)) { loggedIn = true; break; }
    }
    if (!loggedIn) { console.log('❌ 等待登录超时'); await browser.close(); process.exit(3); }
    await page.close();
  }

  console.log('✅ 已登录，打开主页…');
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto('https://www.pinterest.com/ujpu7859/_saved/', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(6000);
  await page.screenshot({ path: SHOT, fullPage: false });
  console.log('📸 截图已存:', SHOT);

  // 列出页面上可见的 Pin 标题，方便用户对照
  const titles = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href*="/pin/"]').forEach(a => {
      const t = (a.getAttribute('aria-label') || a.innerText || '').trim();
      if (t) out.push(t.slice(0, 80));
    });
    return [...new Set(out)].slice(0, 20);
  });
  console.log('页面可见 Pin:', JSON.stringify(titles, null, 2));

  console.log('🔓 浏览器保持打开，你可以直接查看。看完关掉窗口即可。');
  // 不调用 browser.close()，保持打开
  await new Promise(() => {}); // 永久挂起
}

main().catch(e => { console.error('💥', e.message); process.exit(1); });
