// Pinterest 自动发 Pin：从 assets/pins/pins.json 队列取下一条未发布的，用持久化登录态发布
// 用法: node scripts/pinterest_post.js            → 发下一条
//       node scripts/pinterest_post.js --dry-run  → 只检查登录态和队列，不发布
// 退出码: 0=成功或无可发  2=需要登录(NEED_LOGIN)  1=发布失败
const fs = require('fs');
const path = require('path');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const QUEUE = '/Users/work/code/Star-Rewards/assets/pins/pins.json';
const DRY = process.argv.includes('--dry-run');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  const item = queue.find(q => !q.posted);
  if (!item) { console.log('QUEUE_EMPTY: 所有 Pin 已发布。请先扩展 generate_pins.js 的 PINS 列表并重新生成。'); process.exit(0); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  page.setDefaultTimeout(30000);

  // 1) 登录态检查
  await page.goto('https://www.pinterest.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3000);
  const cookies = await page.cookies('https://www.pinterest.com');
  if (!cookies.some(c => c.name === '_auth')) {
    console.log('NEED_LOGIN: 未检测到 Pinterest 登录态。请先运行 scripts/pinterest_login.js 登录一次。');
    await browser.close(); process.exit(2);
  }
  if (DRY) { console.log(`DRY_RUN: 登录态 OK，下一条待发: ${item.file}`); await browser.close(); process.exit(0); }

  // 2) 打开 Pin 创建器
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(4000);
  fs.mkdirSync('/tmp/pinshots', { recursive: true });
  const shot = n => page.screenshot({ path: `/tmp/pinshots/${n}.png` }).catch(() => {});

  // 3) 上传图片（input[type=file]）
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) { await shot('fail-no-file-input'); console.log('POST_FAIL: 找不到上传入口（界面可能已改版），截图在 /tmp/pinshots/fail-no-file-input.png'); await browser.close(); process.exit(1); }
  await fileInput.uploadFile(item.file);
  console.log('图片已上传，等待处理…');
  await sleep(6000);

  // 4) 填标题（title 输入框）
  try {
    const titleSel = ['input[name="title"]', 'input[aria-label*="Title"]', 'input[id="title"]'];
    for (const sel of titleSel) {
      const el = await page.$(sel);
      if (el) { await el.click({ clickCount: 3 }); await el.type(String(item.pin_title || item.title), { delay: 20 }); break; }
    }
  } catch (e) { console.log('WARN 填标题失败:', e.message); }

  // 5) 填描述
  try {
    const descSel = ['textarea[name="description"]', 'textarea[aria-label*="Description"]', 'div[contenteditable="true"]'];
    for (const sel of descSel) {
      const el = await page.$(sel);
      if (el) { await el.click(); await el.type(String(item.description || ''), { delay: 15 }); break; }
    }
  } catch (e) { console.log('WARN 填描述失败:', e.message); }

  // 6) 目标链接
  try {
    const linkSel = ['input[name="link"]', 'input[aria-label*="link" i]', 'input[placeholder*="link" i]'];
    for (const sel of linkSel) {
      const el = await page.$(sel);
      if (el) { await el.click(); await el.type(item.url, { delay: 15 }); break; }
    }
  } catch (e) { console.log('WARN 填链接失败:', e.message); }

  // 7) 选 Board
  try {
    await page.click('div[data-test-id="board-dropdown"]');
    await sleep(1200);
    await page.keyboard.type(item.board, { delay: 40 });
    await sleep(1500);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await sleep(1000);
  } catch (e) { console.log('WARN 选 Board 失败:', e.message); }

  await shot('before-publish');

  // 8) 发布
  let published = false;
  for (const sel of ['button[data-test-id="board-dropdown-save-button"]', 'button[data-test-id="pin-builder-publish"]']) {
    try { const b = await page.$(sel); if (b) { await b.click(); published = true; break; } } catch (e) {}
  }
  if (!published) {
    try { // 兜底：找文字为 Publish 的按钮
      const btns = await page.$$('button');
      for (const b of btns) {
        const t = (await b.evaluate(el => el.textContent || '')).trim();
        if (/^publish$/i.test(t)) { await b.click(); published = true; break; }
      }
    } catch (e) {}
  }
  await sleep(6000);
  await shot('after-publish');

  if (published) {
    item.posted = true; item.posted_at = new Date().toISOString();
    fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2));
    const left = queue.filter(q => !q.posted).length;
    console.log(`POST_OK: ${item.file} 已发布。剩余待发 ${left} 条。`);
  } else {
    console.log('POST_FAIL: 未找到发布按钮，截图在 /tmp/pinshots/before-publish.png（请人工检查界面变化）。');
  }
  await browser.close();
  process.exit(published ? 0 : 1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
