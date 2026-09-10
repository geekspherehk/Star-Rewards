// Pinterest 自动发 Pin：从 assets/pins/pins.json 队列取下一条未发布的，用持久化登录态发布
// 用法: node scripts/pinterest_post.js            → 发下一条
//       node scripts/pinterest_post.js --dry-run  → 只检查登录态和队列，不发布
// 退出码: 0=成功或无可发  2=需要登录(NEED_LOGIN)  1=发布失败
//
// 要点：
//  1. 登录态必须用探针页真实校验（只看 _auth cookie 会假阳性）
//  2. 画板不存在时在下拉里选「Create <板名>」顺手新建
//  3. 发布后去 _created 页独立复核，不拿点击当成功
const fs = require('fs');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const QUEUE = '/Users/work/code/Star-Rewards/assets/pins/pins.json';
const USER = process.argv[2] || 'ujpu7859';
const DRY = process.argv.includes('--dry-run');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[post]', ...a);

// 真实登录校验：加载受保护页，确认没被弹回首页
async function probeLoggedIn(browser) {
  let p;
  try {
    p = await browser.newPage();
    await p.goto('https://www.pinterest.com/settings/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    const onSettings = /pinterest\.com\/settings/.test(p.url());
    const text = await p.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 3000));
    const loggedOut = /Join Pinterest for free|Log in to discover more ideas|Sign up/i.test(text);
    return onSettings && !loggedOut;
  } catch (e) { return false; }
  finally { try { if (p) await p.close(); } catch (e) {} }
}

async function realClickByText(page, words) {
  const handles = await page.$$('button, div[role="button"], a, [role="menuitem"], li');
  for (const h of handles) {
    const info = await h.evaluate(el => ({
      t: (el.innerText || '').trim().toLowerCase(),
      disabled: el.disabled === true,
    })).catch(() => null);
    if (!info || info.disabled) continue;
    if (words.some(w => info.t === w || info.t.startsWith(w))) {
      try { await h.click(); return info.t; } catch (e) {}
    }
  }
  return null;
}

// 关闭 Pin Builder 的新手引导弹窗（"Great Pins made easy" 1 of 4）
// 不关掉它会盖住整页，后面所有点击都打空（踩过：日志显示"已点击发布"但实际没发出去）
async function dismissTour(page) {
  for (let i = 0; i < 6; i++) {
    const closed = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, div[role="button"], [aria-label]'));
      for (const el of els) {
        const a = (el.getAttribute('aria-label') || '').trim().toLowerCase();
        const t = (el.innerText || '').trim().toLowerCase();
        if (a === 'close' || a.includes('dismiss') || a.includes('close') || t === 'close' || t === '×') {
          el.click(); return true;
        }
      }
      return false;
    });
    if (closed) { log('已关闭引导弹窗'); return true; }

    // 兜底：走完引导（点 Next）
    const next = await realClickByText(page, ['next', 'got it', 'done']);
    if (!next) break;
    await sleep(1200);
  }
  // 最后再试一次 Escape
  try { await page.keyboard.press('Escape'); } catch (e) {}
  return false;
}

(async () => {
  const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  const item = queue.find(q => !q.posted);
  if (!item) { console.log('QUEUE_EMPTY: 所有 Pin 已发布。'); process.exit(0); }

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  page.setDefaultTimeout(30000);
  fs.mkdirSync('/tmp/pinshots', { recursive: true });
  const shot = n => page.screenshot({ path: `/tmp/pinshots/${n}.png` }).catch(() => {});

  // 1) 真实登录校验
  if (!(await probeLoggedIn(browser))) {
    console.log('NEED_LOGIN: 未检测到真实登录态。请先跑 scripts/pinterest_login.js');
    await browser.close(); process.exit(2);
  }
  if (DRY) { console.log(`DRY_RUN: 登录态 OK，下一条待发: ${item.file} → 板「${item.board}」`); await browser.close(); process.exit(0); }

  // 2) 打开 Pin 创建器并上传图片
  await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(5000);
  const fileInput = await page.$('input[type="file"]');
  if (!fileInput) {
    await shot('fail-no-file-input');
    await page.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 600)).then(t => log('页面文字:', t));
    console.log('POST_FAIL: 找不到上传入口');
    await browser.close(); process.exit(1);
  }
  await fileInput.uploadFile(item.file);
  log('图片已上传:', item.file);
  await sleep(8000);
  await shot('01-uploaded');

  // 关键：先关掉新手引导弹窗，否则后面所有点击都被它挡住
  await dismissTour(page);
  await sleep(1500);
  await shot('01b-after-dismiss');

  // 3) 填标题
  for (const sel of ['input[name="title"]', 'input[aria-label*="Title"]', 'input[id="title"]', '#pin-title']) {
    const el = await page.$(sel);
    if (el) { await el.click({ clickCount: 3 }); await el.type(String(item.pin_title || item.title), { delay: 20 }); log('已填标题'); break; }
  }

  // 4) 填描述
  for (const sel of ['textarea[name="description"]', 'textarea[aria-label*="Description"]', 'div[contenteditable="true"]']) {
    const el = await page.$(sel);
    if (el) { await el.click(); await el.type(String(item.description || ''), { delay: 15 }); log('已填描述'); break; }
  }

  // 5) 填目标链接
  for (const sel of ['input[name="link"]', 'input[aria-label*="link" i]', 'input[placeholder*="link" i]']) {
    const el = await page.$(sel);
    if (el) { await el.click(); await el.type(item.url, { delay: 15 }); log('已填链接'); break; }
  }

  // 6) 选画板（不存在则新建）
  const boardHandlers = [
    '[data-test-id="board-dropdown"]',
    '[data-test-id="board-dropdown-select-button"]',
    'div[aria-label*="board" i]',
  ];
  let opened = false;
  for (const sel of boardHandlers) {
    const el = await page.$(sel);
    if (el) { try { await el.click(); opened = true; log('打开画板下拉:', sel); break; } catch (e) {} }
  }
  if (!opened) { opened = !!(await realClickByText(page, ['select a board', 'board'])); log('兜底打开下拉:', opened); }
  await sleep(2000);

  if (opened) {
    await sleep(1500);

    // A. 下拉里已有同名画板 → 直接选
    let chosen = await page.evaluate((name) => {
      const els = Array.from(document.querySelectorAll('div,li,button,[role="option"],[role="menuitem"]'));
      for (const el of els) {
        const t = (el.innerText || '').trim().toLowerCase();
        if (t.length > 40) continue;              // 只看短文案，排除整页大容器
        if (t === name.toLowerCase()) { el.click(); return t; }
      }
      return null;
    }, item.board);
    log('选已有画板:', chosen);

    if (!chosen) {
      await page.keyboard.type(item.board, { delay: 40 });
      await sleep(2500);
      await shot('02-board-typed');

      // B. 点「create board」——必须短文案精确匹配（曾因 t.includes 匹配到整页容器）
      chosen = await page.evaluate((name) => {
        const els = Array.from(document.querySelectorAll('div,li,button,[role="option"],[role="menuitem"]'));
        for (const el of els) {
          const t = (el.innerText || '').trim().toLowerCase();
          if (t.length > 40) continue;
          if (t === 'create board' || (t.startsWith('create') && t.includes(name.toLowerCase()))) {
            el.click(); return t;
          }
        }
        return null;
      }, item.board);
      log('新建画板:', chosen);

      // C. 兜底：键盘选第一项
      if (!chosen) { await page.keyboard.press('ArrowDown'); await sleep(600); await page.keyboard.press('Enter'); log('键盘兜底选择'); }
    }
    await sleep(2000);
  }

  await shot('03-before-publish');

  // 7) 发布
  let published = false;
  for (const sel of ['button[data-test-id="board-dropdown-save-button"]', 'button[data-test-id="pin-builder-publish"]']) {
    const b = await page.$(sel);
    if (b) { try { await b.click(); published = true; log('点击发布:', sel); break; } catch (e) {} }
  }
  if (!published) { const t = await realClickByText(page, ['publish', 'save']); published = !!t; log('兜底发布:', t); }
  await sleep(8000);
  await shot('04-after-publish');

  // 8) 独立复核：去「已保存」页看板名是否真的出现
  //    注意不能查 /_created/ —— 那个 tab 只显示 board 卡片轮廓、不含板名文本（踩过，导致误判失败）
  await page.goto(`https://www.pinterest.com/${USER}/_saved/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(5500);
  const verified = await page.evaluate((n) =>
    (document.body ? document.body.innerText : '').toLowerCase().includes(n.toLowerCase()), item.board);
  await shot('05-verify');
  log('复核画板是否出现:', verified ? '✅' : '⚠️ 未出现');

  if (published && verified) {
    item.posted = true; item.posted_at = new Date().toISOString();
    fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2));
    const left = queue.filter(q => !q.posted).length;
    console.log(`POST_OK: ${item.file} 已发布到「${item.board}」。剩余待发 ${left} 条。`);
    await browser.close(); process.exit(0);
  }
  console.log(`POST_FAIL: published=${published} verified=${verified}。截图 /tmp/pinshots/`);
  await browser.close(); process.exit(1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
