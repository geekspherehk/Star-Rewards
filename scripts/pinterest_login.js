// Pinterest 登录辅助：打开真实 Chrome 窗口让你手动登录一次，会话持久化到本地 profile
// 登录成功后自动退出（轮询到 _auth cookie 即成功）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('打开 Pinterest 登录窗口…请在窗口内完成登录（会话会保存在本地，之后自动发布复用）');
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,900'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto('https://www.pinterest.com/login/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('等待登录完成（最多 5 分钟）…');
  let ok = false;
  for (let i = 0; i < 100; i++) {
    await sleep(3000);
    try {
      const cookies = await page.cookies('https://www.pinterest.com');
      if (cookies.some(c => c.name === '_auth')) { ok = true; break; }
    } catch (e) {}
    try { if (page.url().includes('/login/')) continue; } catch (e) {}
  }
  if (ok) console.log('✅ 登录成功，会话已保存。窗口即将关闭。');
  else console.log('⚠️ 未检测到登录态（超时）。如果已登录，重跑一次本脚本验证。');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
