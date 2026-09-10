// Pinterest 起号一条龙
// 流程：开真实 Chrome（持久化 profile）→ 你在窗口里注册/登录一次 → 之后全自动：
//   1. 从 Settings > Claimed accounts 读出 p:domain_verify 标签
//   2. 自动写进 index.html 的 <head>
//   3. 自动建 5 个关键词画板（已存在的跳过）
// 登录之后的步骤全部自动完成，不需要人工复制粘贴任何代码。
//
// 注意：登录检测必须用「探针页真实加载」而不是只看 _auth cookie —— cookie 会过期残留，
// 只查 cookie 会产生假阳性（踩过：profile 里有过期 _auth，脚本以为已登录，实际全被弹回首页）。
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const INDEX = '/Users/work/code/Star-Rewards/index.html';
const RESULT = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-onboard.json';
const SITE = 'https://stellar.gaocaihk.com';

const BOARDS = [
  'Kids Reward Chart Ideas',
  'Star Chart for Kids',
  'Habit Building for Children',
  'Chore Chart & Responsibility',
  'Parenting Reward Ideas',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[onboard]', ...a);

// ---------- 登录态：用独立探针页真实校验，不打断主窗口 ----------
async function probeLoggedIn(browser) {
  let p;
  try {
    p = await browser.newPage();
    await p.goto('https://www.pinterest.com/settings/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    const url = p.url();
    const onSettings = /pinterest\.com\/settings/.test(url);
    const text = await p.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 3000));
    const looksLoggedOut = /Join Pinterest for free|Log in to discover more ideas|Sign up/i.test(text);
    return onSettings && !looksLoggedOut;
  } catch (e) {
    return false;
  } finally {
    try { if (p) await p.close(); } catch (e) {}
  }
}

function browserAlive(browser) {
  try { return typeof browser.isConnected === 'function' ? browser.isConnected() : true; }
  catch (e) { return false; }
}

async function waitForLogin(browser, minutes = 20) {
  const rounds = minutes * 12; // 每 5 秒一轮
  for (let i = 0; i < rounds; i++) {
    // 浏览器被关掉时 newPage() 会挂死而不是抛错，必须主动探测，否则整个脚本假死
    if (!browserAlive(browser)) { log('浏览器已关闭，停止等待。'); return false; }
    if (await probeLoggedIn(browser)) return true;
    if (i % 12 === 0 && i > 0) log(`已等待 ${Math.round(i * 5 / 60)} 分钟…仍未检测到真实登录态`);
    await sleep(5000);
  }
  return false;
}

// ---------- 读取 domain_verify 标签 ----------
async function tryClickClaim(page) {
  try {
    return await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('button, a, div[role="button"], span[role="button"]'));
      for (const el of els) {
        const t = (el.innerText || el.textContent || '').trim().toLowerCase();
        if (t === 'claim' || t === 'claim website' || t.startsWith('claim')) { el.click(); return true; }
      }
      return false;
    });
  } catch (e) { return false; }
}

async function scrapeTag(page) {
  try {
    return await page.evaluate(() => {
      const m = document.querySelector('meta[name="p:domain_verify"]');
      if (m) return m.getAttribute('content');
      const html = document.documentElement.outerHTML || '';
      const idx = html.indexOf('p:domain_verify');
      if (idx === -1) return null;
      const seg = html.slice(Math.max(0, idx - 300), idx + 600);
      const cm = seg.match(/content\s*=\s*["']([^"']{8,})["']/);
      if (cm) return cm[1].trim();
      const hm = seg.match(/([a-f0-9]{24,})/i);
      if (hm) return hm[1];
      return null;
    });
  } catch (e) { return null; }
}

async function extractDomainTag(browser) {
  const urls = [
    'https://www.pinterest.com/settings/claimed-accounts/',
    'https://www.pinterest.com/settings/claim/',
    'https://www.pinterest.com/settings/',
  ];
  for (const url of urls) {
    let page;
    try {
      log('尝试页面:', url);
      page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(3500);

      let tag = await scrapeTag(page);
      if (tag) { await page.close(); return tag; }

      const clicked = await tryClickClaim(page);
      if (clicked) {
        log('已点击 Claim，等待代码出现…');
        await sleep(4000);
        tag = await scrapeTag(page);
        if (tag) { await page.close(); return tag; }
        await tryClickClaim(page);
        await sleep(4000);
        tag = await scrapeTag(page);
        if (tag) { await page.close(); return tag; }
      }
      await page.close();
    } catch (e) {
      log('页面异常，继续下一个:', e.message);
      try { if (page) await page.close(); } catch (e2) {}
    }
  }
  return null;
}

// ---------- 写入 index.html ----------
function injectMeta(content) {
  let html = fs.readFileSync(INDEX, 'utf8');
  html = html.replace(/\s*<meta\s+name=["']p:domain_verify["'][^>]*>/gi, '');
  const tag = `    <meta name="p:domain_verify" content="${content}"/>`;
  if (!html.includes('</head>')) throw new Error('index.html 里没找到 </head>');
  html = html.replace('</head>', () => tag + '\n</head>');
  fs.writeFileSync(INDEX, html, 'utf8');
  return tag.trim();
}

// ---------- 画板 ----------
async function getUsername(browser) {
  let page;
  try {
    page = await browser.newPage();
    await page.goto('https://www.pinterest.com/settings/', { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(3000);
    const u = await page.evaluate(() => {
      const el = document.querySelector('meta[name="pinterestapp:username"], [data-test-id="username"]');
      if (el) return el.getAttribute('content') || el.innerText;
      const m = (document.documentElement.outerHTML || '').match(/pinterest\.com\/([A-Za-z0-9_]{3,30})\/?["']/);
      return m ? m[1] : null;
    });
    await page.close();
    return u;
  } catch (e) {
    try { if (page) await page.close(); } catch (e2) {}
    return null;
  }
}

async function existingBoards(browser, user) {
  let page;
  try {
    page = await browser.newPage();
    await page.goto(`https://www.pinterest.com/${user}/boards/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(3500);
    const names = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href*="/boards/"], [data-test-id="board-name"]'))
        .map(e => (e.innerText || e.textContent || '').trim())
        .filter(Boolean)
    );
    await page.close();
    return names;
  } catch (e) {
    try { if (page) await page.close(); } catch (e2) {}
    return [];
  }
}

async function createOneBoard(page, name) {
  const opened = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, a, div[role="button"]'));
    for (const el of els) {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').trim().toLowerCase();
      if (t === 'create board' || aria.includes('create board') || t === 'create') { el.click(); return true; }
    }
    return false;
  });
  if (!opened) return { ok: false, why: '找不到 Create board 按钮' };
  await sleep(2500);

  const typed = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (const inp of inputs) {
      const ph = (inp.getAttribute('placeholder') || '').toLowerCase();
      const al = (inp.getAttribute('aria-label') || '').toLowerCase();
      if (ph.includes('name') || al.includes('name') || ph.includes('board') || al.includes('board')) {
        inp.focus();
        return true;
      }
    }
    return false;
  });
  if (!typed) return { ok: false, why: '找不到画板名称输入框' };

  await page.keyboard.type(name, { delay: 40 });
  await sleep(800);

  const submitted = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, div[role="button"]'));
    for (const el of els) {
      const t = (el.innerText || el.textContent || '').trim().toLowerCase();
      if (t === 'create' || t === 'done' || t === 'save') { el.click(); return true; }
    }
    return false;
  });
  if (!submitted) return { ok: false, why: '找不到 Create/Done 提交按钮' };

  await sleep(3000);
  return { ok: true };
}

// ---------- 主流程 ----------
(async () => {
  const out = { startedAt: new Date().toISOString(), site: SITE };

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,900'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();

  // 真实校验：已登录就直接干，否则停在注册页等你
  if (await probeLoggedIn(browser)) {
    log('✅ 检测到真实登录态，直接进入自动流程。');
    out.loginOk = true;
  } else {
    log('==============================================');
    log('请在弹出的 Chrome 窗口里完成注册/登录（约 3-5 分钟）。');
    log('  - 地址：pinterest.com/business/create/');
    log('  - 用你的邮箱注册，去邮箱点验证链接');
    log('  - 能进主页之后，脚本会自动接管剩下的所有步骤');
    log('==============================================');
    await page.goto('https://www.pinterest.com/business/create/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    const ok = await waitForLogin(browser, 20);
    out.loginOk = ok;
    if (!ok) {
      fs.writeFileSync(RESULT, JSON.stringify(out, null, 2));
      log('⏰ 20 分钟内没检测到登录。窗口保持打开，你登录完重跑本脚本即可。');
      return;
    }
    log('✅ 登录成功，开始自动接管…');
  }

  // 1) 取标签
  log('读取 p:domain_verify 标签…');
  const tag = await extractDomainTag(browser);
  if (tag) {
    out.domainVerify = tag;
    log('✅ 拿到标签:', tag);
    const written = injectMeta(tag);
    out.injectedInto = 'index.html';
    out.injectedLine = written;
    log('✅ 已写入 index.html:');
    log('   ' + written);
    log('   ⚠️ 需要部署到服务器才生效（等你批准）。');
  } else {
    out.domainVerify = null;
    log('⚠️ 没能自动读到标签（Pinterest 页面结构可能变了）。');
    log('   请手动打开 Settings → Claimed accounts → Websites → Claim，把代码里的 content 值发我。');
  }

  // 2) 建画板
  const user = await getUsername(browser);
  out.username = user;
  if (user) {
    log('用户名:', user);
    const have = await existingBoards(browser, user);
    out.existingBoards = have.slice(0, 40);
    const created = [];
    const failed = [];
    for (const b of BOARDS) {
      if (have.some(h => h.toLowerCase().includes(b.toLowerCase().slice(0, 12)))) {
        log('画板已存在，跳过:', b);
        continue;
      }
      const r = await createOneBoard(page, b);
      if (r.ok) { created.push(b); log('✅ 建板成功:', b); }
      else { failed.push({ board: b, why: r.why }); log('⚠️ 建板失败:', b, '→', r.why); }
      await sleep(1500);
    }
    out.boardsCreated = created;
    out.boardsFailed = failed;
  } else {
    out.boardsCreated = [];
    out.boardsFailed = BOARDS.map(b => ({ board: b, why: '拿不到用户名' }));
    log('⚠️ 拿不到用户名，跳过建板。');
  }

  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(RESULT, JSON.stringify(out, null, 2));
  log('结果已写入:', RESULT);
  log('全部自动步骤执行完毕，浏览器将关闭。');
  await browser.close();
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
