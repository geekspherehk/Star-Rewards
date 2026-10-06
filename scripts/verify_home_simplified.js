#!/usr/bin/env node
// 首页简化验收：一进来只看见「三个数 + 打卡格子 + 三个出口」，其余收进「更多」抽屉。
// 线上真实浏览器 + 本地新代码（request interception 把新文件喂进去，API/登录态仍走线上），
// 否则只看线上 = 看旧版，本地打开 = 打不了线上 API（Origin 空会被 501 拒）。
// 用法: NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node scripts/verify_home_simplified.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const R = 'https://stellar.gaocaihk.com';
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✔ ' + m); };
const bad = (m, extra) => { fail++; console.log('  ✘ ' + m + (extra ? ' → ' + extra : '')); };

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function nodeApi(action, body, token) {
  const r = await fetch(R + '/api/index.php?action=' + encodeURIComponent(action), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  let json = null;
  try { json = await r.json(); } catch (e) {}
  if (!r.ok) return { __status: r.status, __error: (json && json.error) || r.statusText };
  return json || { __status: r.status };
}

async function setupDemo() {
  const email = `sr.demo.home.${Date.now()}@example.com`;
  const reg = await nodeApi('register', { email, password: 'TestPass123!', consent: true });
  if (!reg.token) throw new Error('register 无 token: ' + JSON.stringify(reg).slice(0, 200));
  await nodeApi('add_wish', { category: 'self_drive', title: '自己刷牙', wish_type: 'persistence', persistence_days: 30 }, reg.token);
  return { token: reg.token, email, userId: reg.user && reg.user.id };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const demo = await setupDemo();
  console.log('演示账号:', demo.email);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  try { const c = await page.createCDPSession(); await c.send('Network.setBypassServiceWorker', { bypass: true }); } catch (e) {}

  // 关键：index/style/script/csv 用本地新版本，其余（api、图片、字体）照常走线上
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    let u;
    try { u = new URL(req.url()); } catch (e) { return req.continue(); }
    if (u.origin === R) {
      const ext = path.extname(u.pathname).toLowerCase();
      const local = path.join(REPO, u.pathname.replace(/^\//, ''));
      if (MIME[ext] && fs.existsSync(local)) {
        return req.respond({ status: 200, contentType: MIME[ext], body: fs.readFileSync(local) });
      }
    }
    return req.continue();
  });

  // 先落一个同源页注入登录态，再进首页；否则未登录会被重定向到 login.html，evaluate 时 context 被销毁
  await page.goto(R + '/login.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate((t, id, em) => {
    try {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_id', String(id || ''));
      localStorage.setItem('user_email', em);
    } catch (e) {}
  }, demo.token, demo.userId, demo.email);
  // 2026-10-06 起已登录访问 /index.html 会默认跳大花页（kid.html），
  // 验收管理端必须显式带 ?manage=1 才停在这页
  await page.goto(R + '/index.html?manage=1', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);

  // 首启引导是全屏遮罩，会挡住真实点击
  await page.evaluate(() => {
    const b = document.querySelector('.onboarding-dismiss') || document.querySelector('#onboarding-modal .ob-skip');
    if (b) b.click();
    const ov = document.getElementById('onboarding-modal'); if (ov) ov.style.display = 'none';
  });
  await sleep(2500);

  const vis = (id) => page.evaluate((i) => {
    const el = document.getElementById(i);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return { shown: r.height > 4 && s.display !== 'none' && s.visibility !== 'hidden', h: Math.round(r.height) };
  }, id);

  console.log('\n[1] 首页默认只该看见打卡');
  for (const id of ['points-display', 'weekly-section', 'home-quick']) {
    const v = await vis(id);
    v && v.shown ? ok(`${id} 在首页`) : bad(`${id} 没显示`, JSON.stringify(v));
  }
  for (const id of ['report-section', 'kid-setup-card', 'quick-behavior-card', 'edu-column', 'reminder-bar', 'push-toggle-row', 'home-focus-banner', 'activation-checklist']) {
    const v = await vis(id);
    (!v || !v.shown) ? ok(`${id} 已收起`) : bad(`${id} 不该占首页`, JSON.stringify(v));
  }
  const cells = await page.evaluate(() => {
    const g = document.getElementById('weekly-grid');
    return g ? { cls: g.className, n: g.querySelectorAll('.mc-cell, .wk-cell, [class*=cell]').length } : null;
  });
  cells && cells.n > 0 ? ok(`月历格子 ${cells.n} 个（${cells.cls}）`) : bad('月历没渲染出格子', JSON.stringify(cells));

  const cardVisible = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.module-card')].filter((c) => getComputedStyle(c).display !== 'none');
    return cs.map((c) => (c.querySelector('h3') || {}).textContent || '?');
  });
  cardVisible.length === 2 && cardVisible.includes('打卡') && cardVisible.includes('更多')
    ? ok('导航只剩「打卡 + 更多」: ' + cardVisible.join(' / '))
    : bad('导航卡片不对', JSON.stringify(cardVisible));
  await page.screenshot({ path: path.join(OUT, 'home-simplified-390.png'), fullPage: true });

  console.log('\n[2] 更多抽屉');
  // 用真实鼠标点：能点开才算家长点得到（evaluate().click() 会绕过遮挡，容易假绿）
  await page.evaluate(() => { const b = document.getElementById('hq-more'); if (b.scrollIntoView) b.scrollIntoView({ block: 'center' }); });
  await sleep(400);
  const box = await page.evaluate(() => {
    const b = document.getElementById('hq-more');
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: top ? top.tagName + '.' + (top.className || '') : 'null', self: !!(top && (top === b || b.contains(top))) };
  });
  console.log('  · 按钮中心最上层元素: ' + box.hit + ' / 命中自己: ' + box.self);
  await page.mouse.click(box.x, box.y);
  await sleep(500);
  const sheet = await page.evaluate(() => {
    const s = document.getElementById('home-more-sheet');
    return s ? { shown: getComputedStyle(s).display !== 'none', items: s.querySelectorAll('.hs-item').length } : null;
  });
  sheet && sheet.shown && sheet.items === 8 ? ok(`抽屉弹出，${sheet.items} 项`) : bad('抽屉不对（应为 8 项）', JSON.stringify(sheet));
  // 家长点名删掉的四项不能再出现（记一笔在首页 pill，打卡/提醒/装大花暂不需要）
  const banned = await page.evaluate(() => {
    const s = document.getElementById('home-more-sheet');
    if (!s) return [];
    const want = ['记一笔', '打卡提醒', '给娃装大花', '每日提醒时间'];
    const labels = [...s.querySelectorAll('.hs-item b')].map((b) => b.textContent.trim());
    return want.filter((w) => labels.includes(w));
  });
  banned.length === 0 ? ok('已移除：记一笔 / 打卡提醒 / 给娃装大花 / 每日提醒时间') : bad('抽屉里还有', banned.join(' / '));
  await page.screenshot({ path: path.join(OUT, 'home-more-sheet-390.png') });

  console.log('\n[3] 抽屉里的东西真能打开');
  await page.evaluate(() => {
    const it = [...document.querySelectorAll('.hs-item')].find((b) => b.getAttribute('data-target') === 'report-section');
    if (it) it.click();
  });
  await sleep(1600);
  const rep = await vis('report-section');
  rep && rep.shown ? ok('「成长月报」打开了') : bad('月报没打开', JSON.stringify(rep));
  const repStat = await page.evaluate(() => {
    const s = document.getElementById('rp-stats');
    return s ? s.innerText.trim().length : 0;
  });
  repStat > 0 ? ok(`月报内容已渲染（${repStat} 字）`) : bad('月报内容空');
  await page.screenshot({ path: path.join(OUT, 'home-report-390.png'), fullPage: true });

  await page.evaluate(() => { const b = document.getElementById('hq-behavior'); if (b) b.click(); });
  await sleep(1200);
  const qb = await vis('quick-behavior-card');
  qb && qb.shown ? ok('「记一笔」展开') : bad('记一笔没展开', JSON.stringify(qb));

  await page.evaluate(() => {
    const it = [...document.querySelectorAll('.hs-item')].find((b) => b.getAttribute('data-module') === 'gifts-module');
    if (it) it.click();
  });
  await sleep(1500);
  const mod = await page.evaluate(() => ({
    gifts: document.getElementById('gifts-module')?.classList.contains('active'),
    points: document.getElementById('points-module')?.classList.contains('active'),
  }));
  mod.gifts && !mod.points ? ok('抽屉能切到「目标」模块') : bad('切模块失败', JSON.stringify(mod));

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  console.log('演示账号已建（跑完 cleanup_qa_accounts.py 清掉）');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('跑挂了:', e.message); process.exit(1); });
