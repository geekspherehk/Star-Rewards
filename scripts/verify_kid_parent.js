#!/usr/bin/env node
// 大花页统一入口验收（2026-10-06 起：家长打开网站默认也进 kid.html，里面点「家长管理」才进管理端）。
// 线上真实浏览器 + 本地新代码（request interception 喂本地静态文件；api/index.php 走线上，.php 不喂）。
// 注意：后端 requireKid 放行家长 token 的改动**必须先部署**，否则第 2/3 项会红。
// 用法: NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node scripts/verify_kid_parent.js
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const R = 'https://stellar.gaocaihk.com';
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✔ ' + m); };
const bad = (m, e) => { fail++; console.log('  ✘ ' + m + (e ? ' → ' + e : '')); };

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
  const email = `sr.demo.kidp.${Date.now()}@example.com`;
  const reg = await nodeApi('register', { email, password: 'TestPass123!', consent: true });
  if (!reg.token) throw new Error('register 无 token: ' + JSON.stringify(reg).slice(0, 200));
  await nodeApi('add_wish', { category: 'self_drive', title: '自己刷牙', wish_type: 'persistence', persistence_days: 30 }, reg.token);
  await nodeApi('addBehavior', { description: '自己整理书包', points: 3 }, reg.token);
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
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    let u; try { u = new URL(req.url()); } catch (e) { return req.continue(); }
    if (u.origin === R) {
      const ext = path.extname(u.pathname).toLowerCase();
      const local = path.join(REPO, u.pathname.replace(/^\//, ''));
      if (MIME[ext] && fs.existsSync(local)) {
        return req.respond({ status: 200, contentType: MIME[ext], body: fs.readFileSync(local) });
      }
    }
    return req.continue();
  });

  await page.goto(R + '/login.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate((t, id, em) => {
    try {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_id', String(id || ''));
      localStorage.setItem('user_email', em);
      localStorage.removeItem('kid_token');
    } catch (e) {}
  }, demo.token, demo.userId, demo.email);

  console.log('\n[1] 家长打开网站默认进大花页');
  await page.goto(R + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2500);
  /\/kid\.html$/.test(page.url()) ? ok('自动跳到 ' + page.url()) : bad('没跳大花页', page.url());

  console.log('\n[2] 大花页用家长登录态渲染（后端已放行）');
  const st = await page.evaluate(() => ({
    appShown: (() => { const e = document.getElementById('app'); return e ? !e.hidden : false; })(),
    flowers: document.querySelectorAll('.kid-flower').length,
    parentBar: (() => { const e = document.getElementById('parentBar'); return e ? !e.hidden : false; })(),
    loginBtn: !!document.querySelector('.kid-login'),
    msg: (document.getElementById('bootMsg') || {}).textContent || ''
  }));
  st.appShown ? ok('大花页已渲染') : bad('没渲染', JSON.stringify(st));
  st.flowers > 0 ? ok(`花朵 ${st.flowers} 朵`) : bad('没有花朵', JSON.stringify(st));
  st.parentBar ? ok('底部出现「家长管理」') : bad('家长入口没出现', JSON.stringify(st));
  !st.loginBtn ? ok('没有误报「请大人先登录」') : bad('又回到要登录/要链接了', st.msg);
  const names = await page.evaluate(() => ({
    title: document.title,
    head: (document.getElementById('childName') || {}).textContent || '',
    sep: (document.querySelector('.kid-sep--today') || {}).textContent || '',
    body: (document.body.innerText || '').replace(/\s+/g, ' '),
  }));
  names.title === '今天' && names.head === '今天' ? ok('页面叫「今天」') : bad('命名不对', JSON.stringify(names));
  names.sep === '今天要做的' ? ok('有「今天要做的」小标题') : bad('缺小标题', names.sep);
  const oldWords = ['大花', '亮一朵', '点花', '花卡'].filter((w) => names.body.includes(w));
  oldWords.length === 0 ? ok('没有旧叫法（大花/亮一朵/点花）') : bad('还有旧叫法', oldWords.join('/'));
  const bar2 = await page.evaluate(() => ({
    addOne: !!document.getElementById('kidAddOne'),
    parent: !!document.getElementById('kidParent'),
  }));
  bar2.addOne && bar2.parent ? ok('底部两个按钮：记一笔 / 家长管理') : bad('底部按钮不全', JSON.stringify(bar2));
  await page.screenshot({ path: path.join(OUT, 'kid-as-parent-390.png') });

  console.log('\n[3] 家长在大花页按花也记得上分');
  const before = await page.evaluate(() => parseInt((document.getElementById('points') || {}).textContent || '0', 10));
  const lit = await page.evaluate(async () => {
    const el = document.querySelector('.kid-flower:not(.lit)');
    if (!el) return { none: true };
    el.click();
    await new Promise((r) => setTimeout(r, 1600));
    return { points: parseInt((document.getElementById('points') || {}).textContent || '0', 10), lit: el.classList.contains('lit') };
  });
  lit.none ? bad('没有可点亮的花') : (lit.lit ? ok('花点亮了') : bad('花没点亮', JSON.stringify(lit)));
  !lit.none && lit.points > before ? ok(`分数 ${before} → ${lit.points}`) : bad('分数没涨', JSON.stringify(lit));

  console.log('\n[3b] 家长在第一屏直接记一笔（不必跳页）');
  const qaRes = await page.evaluate(async () => {
    const before = parseInt((document.getElementById('points') || {}).textContent || '0', 10);
    document.getElementById('kidAddOne').click();
    await new Promise((r) => setTimeout(r, 300));
    const row = document.getElementById('quickRow');
    if (!row || row.hidden) return { opened: false };
    document.getElementById('qaDesc').value = '验收：自己收拾了书包';
    document.getElementById('qaSave').click();
    await new Promise((r) => setTimeout(r, 1800));
    return { opened: true, before, after: parseInt((document.getElementById('points') || {}).textContent || '0', 10), msg: (document.getElementById('msg') || {}).textContent || '' };
  });
  qaRes.opened ? ok('记一行打开了') : bad('记一行没打开', JSON.stringify(qaRes));
  qaRes.opened && qaRes.after > qaRes.before ? ok(`记一笔加分 ${qaRes.before} → ${qaRes.after}（${qaRes.msg}）`) : bad('记一笔没加分', JSON.stringify(qaRes));
  await page.screenshot({ path: path.join(OUT, 'kid-quick-390.png') });

  console.log('\n[4] 「家长管理」进管理端并停住');
  await page.evaluate(() => { const b = document.getElementById('kidParent'); if (b) b.scrollIntoView({ block: 'center' }); });
  await sleep(400);
  const box = await page.evaluate(() => {
    const b = document.getElementById('kidParent');
    const r = b.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, self: !!(top && (top === b || b.contains(top))), hit: top ? top.tagName + '.' + (top.className || '') : 'null' };
  });
  console.log('  · 按钮中心最上层元素: ' + box.hit + ' / 命中自己: ' + box.self);
  await page.mouse.click(box.x, box.y);
  await sleep(3000);
  /index\.html\?manage=1$/.test(page.url()) ? ok('进了管理端 ' + page.url()) : bad('没进管理端', page.url());
  const onIndex = await page.evaluate(() => ({
    pts: !!document.getElementById('points-display'),
    more: !!document.getElementById('hq-more'),
  }));
  onIndex.pts && onIndex.more ? ok('管理端正常（打卡 + 更多）') : bad('管理端没渲染', JSON.stringify(onIndex));
  await page.screenshot({ path: path.join(OUT, 'manage-from-kid-390.png') });

  console.log('\n[5] 管理首页顶部有「今天」出口，能一步回大花页');
  const navBox = await page.evaluate(() => {
    const card = document.querySelector('.module-card--today');
    if (!card) return { none: true };
    card.scrollIntoView({ block: 'center' });
    const r = card.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + 24);
    return { x: r.left + r.width / 2, y: r.top + 24, self: !!(top && (top === card || card.contains(top))), label: (card.querySelector('h3') || {}).textContent };
  });
  navBox.none ? bad('管理首页没有「今天」卡') : ok(`「今天」卡在导航区（${navBox.label}）`);
  if (!navBox.none) {
    await page.mouse.click(navBox.x, navBox.y);
    await sleep(2500);
    /\/kid\.html$/.test(page.url()) ? ok('点「今天」回到 ' + page.url()) : bad('没回到大花页', page.url());
  }

  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  console.log('演示账号已建（跑完 cleanup_qa_accounts.py --confirm 清掉）');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
