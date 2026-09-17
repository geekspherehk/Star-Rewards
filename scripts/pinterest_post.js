// Pinterest 自动发 Pin：从 assets/pins/pins.json 队列取下一条未发布的，用持久化登录态发布
// 用法: node scripts/pinterest_post.js            → 发下一条
//       node scripts/pinterest_post.js --dry-run  → 只检查登录态和队列，不发布
// 退出码: 0=成功或无可发  2=需要登录(NEED_LOGIN)  1=发布失败
//
// 要点：
//  1. 登录态必须用探针页真实校验（只看 _auth cookie 会假阳性）
//  2. 画板不存在时在下拉里选「Create <板名>」顺手新建
//  3. 发布后按「Pin 自身」复核（拿 pin id → 读该 Pin 的真实画板/链接）
//     ⚠️ 不可用「整页搜板名」复核：只要该画板存在就必然命中，发错画板也会假阳性（2026-09-13 实证）
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

// 采集某画板首页的 pin id → alt 映射（用独立标签页，避免打断 pin-builder 草稿）
// 用于发布前后做差集：新增的 pin 就是刚发的
async function collectBoardPins(browser, boardUrl) {
  const p = await browser.newPage();
  try {
    await p.setDefaultTimeout(60000);
    await p.goto(boardUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(6000);
    await p.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5)).catch(() => {});
    await sleep(2500);
    const data = await p.evaluate(() => {
      const map = {};
      // 画板名：第一个不是站点 logo("Pinterest") 的 h1；抓不到也不影响判定
      const h1s = Array.from(document.querySelectorAll('h1'))
        .map(e => (e.innerText || '').trim())
        .filter(t => t && t.toLowerCase() !== 'pinterest');
      for (const a of document.querySelectorAll('a[href*="/pin/"]')) {
        const mm = (a.getAttribute('href') || '').match(/\/pin\/(\d{15,20})/);
        if (!mm) continue;
        const img = a.querySelector('img');
        if (!(mm[1] in map)) map[mm[1]] = img ? (img.alt || '') : '';
      }
      return { map, title: h1s[0] || null };
    });
    return data;
  } catch (e) {
    log('采集画板失败:', boardUrl, e.message);
    return { map: {}, title: null };
  } finally { try { await p.close(); } catch (e) {} }
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
  //    ⚠️ 真实结构是 TEXTAREA 且 id 为动态 UUID：textarea#pin-draft-title-<uuid>，placeholder "Add your title"
  //    曾用 input[name="title"] 等选择器 —— <input> 永远匹配不到 <textarea>，标题被静默跳过
  let titleOK = false;
  for (const sel of ['textarea[id^="pin-draft-title"]', 'textarea[placeholder*="Add your title" i]']) {
    const el = await page.$(sel);
    if (el) { await el.click({ clickCount: 3 }); await el.type(String(item.pin_title || item.title), { delay: 20 }); titleOK = true; log('已填标题'); break; }
  }
  if (!titleOK) log('⚠️ 标题框未找到');

  // 4) 填描述（上传图片后才出现，同为动态 id 的 textarea）
  let descOK = false;
  for (const sel of ['textarea[id^="pin-draft-description"]', 'textarea[placeholder*="description" i]', 'div[contenteditable="true"]']) {
    const el = await page.$(sel);
    if (el) { await el.click(); await el.type(String(item.description || ''), { delay: 12 }); descOK = true; log('已填描述'); break; }
  }
  if (!descOK) log('⚠️ 描述框未找到');

  // 5) 填目标链接 —— 全流程最关键的一步（用户流量的唯一入口）
  //    ⚠️ 真实结构：textarea#pin-draft-link-<uuid>，placeholder "Add a destination link"
  //    曾用 input[name="link"]/input[aria-label*=link] —— 全部匹配不到 textarea，链接被静默跳过，
  //    导致发出的 Pin 只有「已认领域名」的署名、没有可点击的落地页链接
  let linkOK = false;
  for (const sel of ['textarea[id^="pin-draft-link"]', 'textarea[placeholder*="destination link" i]']) {
    const el = await page.$(sel);
    if (el) { await el.click(); await el.type(item.url, { delay: 15 }); linkOK = true; log('已填链接:', item.url); break; }
  }
  if (!linkOK) { log('❌ 找不到链接输入框(textarea#pin-draft-link)，中止'); await shot('fail-no-link-input'); await browser.close(); process.exit(1); }

  // 5b) 回读校验：把框里的实际值读出来，确认链接真的进去了（不能只凭 type 没抛错就认为成功）
  const readback = await page.evaluate(() => {
    const t = (s) => { const e = document.querySelector(s); return e ? (e.value || e.innerText || '') : ''; };
    return { title: t('textarea[id^="pin-draft-title"]'), link: t('textarea[id^="pin-draft-link"]') };
  });
  log('回读 → 标题:', JSON.stringify(readback.title.slice(0, 50)), '| 链接:', JSON.stringify(readback.link));
  if (!/gaocaihk\.com/.test(readback.link)) {
    log('❌ 链接未生效（框内为空或非本站域名），中止发布');
    await shot('fail-link-empty'); await browser.close(); process.exit(1);
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

  let chosenHref = null;   // 选中的画板 href（用于发布后按板复核），需在 if(opened) 外声明
  if (opened) {
    await sleep(1500);

    // A. 下拉里已有同名画板 → 直接选（顺带抓该画板的 href，用于发布后按板复核）
    //    ⚠️ 必须用「真实鼠标点击」。Pinterest 是 React SPA，el.click()（JS 触发）常静默无效
    async function clickByExactText(name) {
      const handles = await page.$$('div,li,button,[role="option"],[role="menuitem"],a');
      for (const h of handles) {
        const info = await h.evaluate(el => ({
          t: (el.innerText || '').trim(),
          href: el.getAttribute('href') || (el.closest('a') ? el.closest('a').getAttribute('href') : null),
        })).catch(() => null);
        if (!info) continue;
        if (info.t.length > 40) continue;              // 只看短文案，排除整页大容器
        if (info.t.toLowerCase() === name.toLowerCase()) {
          try {
            await h.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});
            await sleep(250);
            await h.click();                            // 真实鼠标点击
            return info;
          } catch (e) {}
        }
      }
      return null;
    }
    const chosenObj = await clickByExactText(item.board);
    const chosen = chosenObj ? chosenObj.t : null;
    if (chosenObj && chosenObj.href) chosenHref = chosenObj.href;
    log('选已有画板(真实点击):', chosen, '| href:', chosenHref);

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
  //    先挂网络监听：抓「创建 Pin」接口返回的 pin id（DOM 拿不到时靠它兜底）
  const createdPinIds = new Set();
  const onResp = async (res) => {
    try {
      const u = res.url();
      if (!/pinterest\.com\/(resource|graphql|_api)/.test(u)) return;
      if (!/PinResource/i.test(u)) return;
      const ct = res.headers()['content-type'] || '';
      if (!/json/.test(ct)) return;
      const t = await res.text();
      const re = /"(?:id|pin_id)"\s*:\s*"(\d{15,20})"/g;
      let m; while ((m = re.exec(t))) createdPinIds.add(m[1]);
    } catch (e) {}
  };
  page.on('response', onResp);

  // 发布前先确认画板真的被选上了（否则点了发布也白点）
  const boardSelTxt = await page.evaluate(() => {
    const b = document.querySelector('[data-test-id="board-dropdown-select-button"], [data-test-id="board-dropdown"]');
    return b ? (b.innerText || '').trim() : null;
  });
  log('发布前画板选择器文本:', JSON.stringify(boardSelTxt));

  // 6b) 发布前快照：目标画板当前的 pin id 集合（用独立标签页，不打断草稿）
  const slugifyBoard = n => String(n).toLowerCase().replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const boardSlug = (chosenHref && ((chosenHref.match(/^\/([^\/?#]+)\/([^\/?#]+)/) || [])[2])) || slugifyBoard(item.board);
  const boardUrl = `https://www.pinterest.com/${USER}/${boardSlug}/`;
  log('目标画板 URL:', boardUrl);
  const beforeSnap = await collectBoardPins(browser, boardUrl);
  const beforeIds = new Set(Object.keys(beforeSnap.map));
  log('发布前该板 pin 数:', beforeIds.size, '| 板名:', JSON.stringify(beforeSnap.title));

  let published = false;
  for (const sel of ['button[data-test-id="board-dropdown-save-button"]', 'button[data-test-id="pin-builder-publish"]']) {
    const b = await page.$(sel);
    if (!b) continue;
    const dis = await b.evaluate(el => el.disabled === true || el.getAttribute('aria-disabled') === 'true').catch(() => false);
    if (dis) { log('⚠️ 发布按钮处于 disabled:', sel); continue; }
    try {
      await b.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => {});
      await sleep(250);
      await b.click(); published = true; log('点击发布:', sel); break;
    } catch (e) {}
  }
  if (!published) { const t = await realClickByText(page, ['publish', 'save']); published = !!t; log('兜底发布:', t); }
  await sleep(9000);
  await shot('04-after-publish');
  page.off('response', onResp);

  // 发布后诊断：URL 是否跳转、页面上有没有报错文案（便于定位"点了没反应"）
  log('发布后 URL:', page.url());
  const postState = await page.evaluate(() => {
    const body = document.body ? document.body.innerText : '';
    const err = body.match(/(Please select a board|Something went wrong|Try again|couldn't|failed|required)/i);
    const dialog = document.querySelector('[role="dialog"]');
    return { errHint: err ? err[0] : null, hasDialog: !!dialog, dialogText: dialog ? (dialog.innerText || '').slice(0, 300) : null };
  });
  log('发布后状态:', JSON.stringify(postState));

  // 8) 独立复核：按「画板差集」判定 —— 不猜 pin id、不搜整页文本
  //    ⚠️ 旧做法去 /_saved/ 搜「板名字符串是否出现在页面」：只要该画板存在，板名必然出现，
  //       发到错误画板也会报成功（2026-09-13 实证的假阳性）。
  //    ⚠️ 也不要试图从 create 响应里猜 pin id：该响应含 board/user 等多个 id，
  //       实测取第一个会拿到**非 pin** 的 id，导致复核永远失败（2026-09-17 实证）。
  //    ⚠️ Pin 详情页不可用：会被未完成的 business 引导弹窗劫持、跳 /?show_error=true。
  //    可靠做法：发布前后各采集一次目标画板首页的 pin id，**新增的那个就是刚发的**。

  // 8a) 发布后快照 + 差集
  const norm = s => String(s || '').trim().toLowerCase();
  const afterSnap = await collectBoardPins(browser, boardUrl);
  const newIds = Object.keys(afterSnap.map).filter(id => !beforeIds.has(id));
  const newPinId = newIds[0] || null;
  const newAlt = newPinId ? afterSnap.map[newPinId] : null;
  const nameOk = !afterSnap.title || norm(afterSnap.title) === norm(item.board);
  const titleOk = !newAlt || !item.pin_title || newAlt.toLowerCase().includes(String(item.pin_title).toLowerCase());
  // 判据：① 期望画板出现「新增」pin（这一步能抓到"发错板"）② 新 pin 标题与预期一致
  // 画板名文本仅作参考：站点 logo 等元素会污染 h1，不作阻断条件
  const pinOk = published && newIds.length > 0 && titleOk;
  await shot('05-after');

  log('发布后该板 pin 数:', Object.keys(afterSnap.map).length, '| 新增:', newIds.length, JSON.stringify(newIds));
  log('复核 → 画板名一致?', nameOk ? '✅' : '❌', JSON.stringify(afterSnap.title),
      '| 新 pin 标题一致?', titleOk ? '✅' : '⚠️', JSON.stringify(newAlt));

  if (pinOk) {
    item.posted = true; item.posted_at = new Date().toISOString();
    if (newPinId) item.pin_id = newPinId;
    fs.writeFileSync(QUEUE, JSON.stringify(queue, null, 2));
    const left = queue.filter(q => !q.posted).length;
    console.log(`POST_OK: ${item.file} 已发布到「${afterSnap.title}」(pin ${newPinId})。剩余待发 ${left} 条。`);
    await browser.close(); process.exit(0);
  }
  const why = !published ? '发布动作未成功'
    : (newIds.length === 0 ? '目标画板没有新增 pin（没发出去，或发到了别的板）'
                           : '新 pin 标题与预期不一致');
  console.log(`POST_FAIL: ${why} | published=${published} 新增=${newIds.length} 复核画板=${JSON.stringify(afterSnap.title)} 期望=${JSON.stringify(item.board)}。截图 /tmp/pinshots/`);
  console.log('⚠️ POST_FAIL ≠ 一定没发出去：请先人工核对画板；若已发出请手动把该条标记 posted，避免重发造成重复。');
  await browser.close(); process.exit(1);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
