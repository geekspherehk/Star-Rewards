#!/usr/bin/env node
// 线上真实环境验收：stellar.gaocaihk.com 已部署的孩子端大花页 + 家长端月报。
// 真实浏览器走完整链路：家长生成长链接 → 娃用链接打开大花页 → 娃自己按花 → 家长端月报看到星星。
// 临时账号 sr.demo.kid.*@example.com 跑完即删（不污染运营看板）。
// 用法: node scripts/verify_kid_live.js
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const R = 'https://stellar.gaocaihk.com';
const OUT = path.join(__dirname, '..', 'shots');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✔ ' + m); };
const bad = (m, extra) => { fail++; console.log('  ✘ ' + m + (extra ? ' → ' + extra : '')); };

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
  const email = `sr.demo.kid.${Date.now()}@example.com`;
  const reg = await nodeApi('register', { email, password: 'TestPass123!', consent: true });
  if (!reg.token) throw new Error('register 无 token: ' + JSON.stringify(reg).slice(0, 200));
  const cats = ['self_drive', 'aesthetics', 'health', 'planning'];
  const names = ['自己刷牙', '自己整理书包', '9 点前上床', '喝足六杯水'];
  const wishes = [];
  for (let i = 0; i < cats.length; i++) {
    const w = await nodeApi('add_wish', { category: cats[i], title: names[i], wish_type: 'persistence', persistence_days: 30 }, reg.token);
    if (w && w.success !== false) wishes.push(w);
  }
  const gift = await nodeApi('add_gift', { name: '去公园玩', points: 30 }, reg.token);
  return { token: reg.token, email, wishes: wishes.length, gift: gift && gift.success !== false };
}

async function bypassSW(page) {
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
  } catch (e) {}
}

// 首启引导是全屏遮罩，真实鼠标点会被它吃掉（新账号必弹）。先按「开始旅程」关掉。
async function dismissOnboarding(page) {
  await page.evaluate(() => {
    const b = document.querySelector('.onboarding-dismiss') || document.querySelector('#onboarding-modal .ob-skip');
    if (b) b.click();
    const ov = document.getElementById('onboarding-modal');
    if (ov) ov.style.display = 'none';
  });
  await sleep(600);
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const demo = await setupDemo();
  console.log('临时家长账号:', demo.email, '| 愿望:', demo.wishes, '| 礼物:', demo.gift);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ── A. 家长端：真实浏览器登录 → 生成长链接 ────────────────────
  console.log('\n== A. 家长端（真实浏览器）==');
  const parent = await browser.newPage();
  await parent.setViewport({ width: 900, height: 1000 });
  await bypassSW(parent);
  await parent.goto(R + '/login.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await parent.evaluate((tk) => {
    localStorage.setItem('auth_token', tk);
    localStorage.setItem('auth_token_expiry', String(Date.now() + 86400000 * 30));
    localStorage.removeItem('kid_token');
  }, demo.token);
  await parent.goto(R + '/index.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2500);

  const landed = await parent.evaluate(() => ({
    url: location.pathname,
    report: !!document.getElementById('report-section'),
    setup: !!document.getElementById('kid-setup-card'),
    setupShown: (() => { const c = document.getElementById('kid-setup-card'); return c && getComputedStyle(c).display !== 'none'; })(),
    reportShown: (() => { const c = document.getElementById('report-section'); return c && getComputedStyle(c).display !== 'none'; })(),
    rpStats: (document.getElementById('rp-stats') || {}).textContent || '',
  }));
  landed.url === '/index.html' ? ok('家长登录落回产品页（' + landed.url + '）') : bad('家长端落点异常', landed.url);
  landed.report && landed.reportShown ? ok('成长月报区块可见') : bad('成长月报区块没渲染出来');
  landed.setup && landed.setupShown ? ok('大花卡可见') : bad('大花卡没渲染出来');
  landed.rpStats.trim() ? ok('月报已自动织出统计：' + landed.rpStats.replace(/\s+/g, ' ').trim().slice(0, 60)) : bad('月报统计为空');
  const calHidden = await parent.evaluate(() => {
    const c = document.getElementById('rp-cal');
    return c ? c.hasAttribute('hidden') && getComputedStyle(c).display === 'none' : 'MISSING';
  });
  calHidden === true
    ? ok('本月月历已藏住（首页就是整月日历，不重复画）')
    : bad('本月月历没藏住', String(calHidden) + '（.rp-cal 盖掉 [hidden] 的老坑，或历史月才该显）');

  // 首启引导挡着，先关掉再点（真实鼠标链路）
  await dismissOnboarding(parent);

  // 点「生成一个链接」→ 真实点击链路
  await parent.click('#ks-gen');
  await sleep(3000);
  const link = await parent.evaluate(() => document.getElementById('ks-url').value || '');
  if (/kid\.html\?k=[0-9a-f]{64}$/.test(link)) ok('长链接生成成功');
  else bad('长链接没生成出来', link.slice(0, 60) || '(空)');

  await parent.screenshot({ path: path.join(OUT, 'live-kid-parent-900.png'), fullPage: true });

  // ── B. 娃端：一次性链接换会话 → 自己按花 ──────────────────────
  console.log('\n== B. 娃端（真实浏览器，无登录）==');
  const code = link.split('?k=')[1];
  const kid = await browser.newPage();
  await kid.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await bypassSW(kid);
  await kid.goto(R + '/kid.html?k=' + code, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2500);

  const kidState = await kid.evaluate(() => ({
    appShown: !document.getElementById('app').hasAttribute('hidden'),
    bootMsg: (document.getElementById('bootMsg') || {}).textContent || '',
    points: (document.getElementById('points') || {}).textContent || '',
    flowers: document.querySelectorAll('#flowers .kid-flower').length,
    firstLit: !!document.querySelector('#flowers .kid-flower.lit'),
    hasUrl: /[?&]k=/.test(location.search),
    bootHidden: (() => { const b = document.getElementById('boot'); return !!b && b.hasAttribute('hidden') && getComputedStyle(b).display === 'none'; })(),
  }));
  kidState.appShown ? ok('长链接换会话成功，大花页打开') : bad('大花页没打开', kidState.bootMsg);
  kidState.flowers >= 4 ? ok('今日花渲染 ' + kidState.flowers + ' 朵') : bad('今日花数量不对', String(kidState.flowers));
  !kidState.hasUrl ? ok('URL 里的一次性码已抹掉') : bad('一次性码还留在地址栏');
  kidState.bootHidden ? ok('「正在打开…」的 loading 态已收掉')
    : bad('loading 态没收掉，页面底部挂着「正在打开…」（.kid-go 盖掉 [hidden] 的老坑）');
  await kid.screenshot({ path: path.join(OUT, 'live-kid-page-390.png'), fullPage: true });

  const before = parseInt(kidState.points, 10) || 0;
  // 娃自己按第一朵花
  await kid.click('#flowers .kid-flower');
  await sleep(2500);
  const afterPress = await kid.evaluate(() => ({
    points: (document.getElementById('points') || {}).textContent || '',
    lit: document.querySelectorAll('#flowers .kid-flower.lit').length,
    msg: (document.getElementById('msg') || {}).textContent || '',
    msgClass: (document.getElementById('msg') || {}).className || '',
  }));
  const after = parseInt(afterPress.points, 10) || 0;
  after === before + 5 ? ok('娃自己按花 → 积分 ' + before + ' → ' + after + '（打卡 +5）')
    : bad('按花后积分不对', before + ' → ' + after);
  afterPress.lit >= 1 ? ok('已亮的花上色了（' + afterPress.lit + ' 朵）') : bad('按完没出现已亮状态');
  await kid.screenshot({ path: path.join(OUT, 'live-kid-lit-390.png'), fullPage: true });

  // 说一句：只进 child_voice，不给分
  await kid.type('#say', '我今天自己刷牙了');
  await kid.click('#sayBtn');
  await sleep(2000);
  const sayState = await kid.evaluate(() => ({
    points: (document.getElementById('points') || {}).textContent || '',
    msg: (document.getElementById('msg') || {}).textContent || '',
  }));
  parseInt(sayState.points, 10) === after ? ok('「说一句」不给星星（仍 ' + sayState.points + '）') : bad('说一句乱加分');
  sayState.msg ? ok('说一句有反馈：' + sayState.msg) : bad('说一句没反馈');

  // ── C. 权限门：娃拿自己 token 打家长接口必须 403 ────────────────
  console.log('\n== C. 权限门 ==');
  const kidToken = await kid.evaluate(() => localStorage.getItem('kid_token') || '');
  if (!kidToken) { bad('没拿到 kid token，跳过权限门'); }
  else {
    const rep = await nodeApi('monthly_report', { month: new Date().toISOString().slice(0, 7) }, kidToken);
    const blocked = rep && rep.__status === 403 || (rep && rep.error === 'Not allowed');
    blocked ? ok('娃 token 打家长月报被挡（403）') : bad('权限门漏了！', JSON.stringify(rep).slice(0, 120));

    const st = await nodeApi('kid_status', {}, kidToken);
    st && st.success ? ok('娃 token 打 kid_status 正常') : bad('kid_status 打不通', JSON.stringify(st).slice(0, 120));
  }

  // ── D. 重新生成 = 旧平板当场打不开 ───────────────────────────
  console.log('\n== D. 重新生成长链接 ==');
  await parent.bringToFront();
  await dismissOnboarding(parent);
  await parent.click('#ks-gen');
  await sleep(3000);
  const link2 = await parent.evaluate(() => document.getElementById('ks-url').value || '');
  if (/k=[0-9a-f]{64}$/.test(link2) && link2 !== link) ok('新链接已生成（旧链接作废）');
  else bad('重新生成没出新链接', link2.slice(0, 40));

  const old = await browser.newPage();
  await bypassSW(old);
  await old.goto(R + '/kid.html?k=' + code, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2500);
  const oldState = await old.evaluate(() => ({
    appShown: !document.getElementById('app').hasAttribute('hidden'),
    bootMsg: (document.getElementById('bootMsg') || {}).textContent || '',
  }));
  !oldState.appShown ? ok('旧链接已作废，旧平板打开被挡：' + oldState.bootMsg) : bad('旧链接还能开！');
  await old.close();

  // 家长端再截一次（月报里应能看到刚攒的星星）
  await parent.reload({ waitUntil: 'networkidle2' });
  await sleep(2500);
  await parent.screenshot({ path: path.join(OUT, 'live-kid-parent-report-900.png'), fullPage: true });

  await browser.close();
  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  console.log('临时账号（待清理）:', demo.email);
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('✘ 脚本炸了:', e.message); process.exit(1); });
