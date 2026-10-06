#!/usr/bin/env node
// 「理念留内部、界面不呈现」验收：首页与记一笔里不该出现 素养/全人/8 维度/花瓣/全能/本月主打 等字样；
// 推荐算法照旧在代码里跑（按 8 个方向挑最近练得少的），但界面上只出现「今天可以记这些」+ 行为名。
// 真浏览器 + 本地新代码（request interception），API 与登录态走线上。
// 用法: NODE_PATH=~/.workbuddy/binaries/node/workspace/node_modules node scripts/verify_home_clean.js [--dump]
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const R = 'https://stellar.gaocaihk.com';
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'shots');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DUMP = process.argv.includes('--dump');

let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  ✔ ' + m); };
const bad = (m, extra) => { fail++; console.log('  ✘ ' + m + (extra ? ' → ' + extra : '')); };

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
const BAN = ['素养', '全人', '维度', '花瓣', '八瓣', '全能', '本月主打', '玫瑰', '方向'];

async function nodeApi(action, body, token) {
  const r = await fetch(R + '/api/index.php?action=' + encodeURIComponent(action), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok) return { __status: r.status, __error: (j && j.error) || r.statusText };
  return j || { __status: r.status };
}

async function setupDemo() {
  const email = `sr.demo.clean.${Date.now()}@example.com`;
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
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    let u; try { u = new URL(req.url()); } catch (e) { return req.continue(); }
    if (u.origin === R) {
      const ext = path.extname(u.pathname).toLowerCase();
      const local = path.join(REPO, u.pathname.replace(/^\//, ''));
      if (MIME[ext] && fs.existsSync(local)) return req.respond({ status: 200, contentType: MIME[ext], body: fs.readFileSync(local) });
    }
    return req.continue();
  });

  await page.goto(R + '/login.html', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.evaluate((t, id, em) => {
    try { localStorage.setItem('auth_token', t); localStorage.setItem('user_id', String(id || '')); localStorage.setItem('user_email', em); } catch (e) {}
  }, demo.token, demo.userId, demo.email);
  // 2026-10-06 起已登录访问 /index.html 会默认跳大花页（kid.html），
  // 验收管理端必须显式带 ?manage=1 才停在这页
  await page.goto(R + '/index.html?manage=1', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(2000);
  await page.evaluate(() => {
    const b = document.querySelector('.onboarding-dismiss') || document.querySelector('#onboarding-modal .ob-skip');
    if (b) b.click();
    const ov = document.getElementById('onboarding-modal'); if (ov) ov.style.display = 'none';
  });
  await sleep(2500);

  const text = await page.evaluate(() => (document.querySelector('.app-content') || document.body).innerText);
  if (DUMP) console.log('\n---- 首页可见文本 ----\n' + text + '\n----------------------\n');

  console.log('\n[1] 首页不出现「全人 / 素养 / 8 维度」字样');
  const hit = BAN.filter(w => text.includes(w));
  hit.length === 0 ? ok('首页可见文本没有违禁词') : bad('首页出现违禁词', hit.join('、'));

  console.log('\n[2] 记一笔：方向下拉藏起来，只剩行为名');
  // 「记一笔」卡片在首页是收起的（更多 → 记一笔），先展开再验可见性
  await page.evaluate(() => { const b = document.getElementById('hq-behavior'); if (b) b.click(); });
  await sleep(1200);
  const qb = await page.evaluate(() => {
    const sel = document.getElementById('qb-cat');
    const box = document.getElementById('qb-suggest');
    const chips = box ? [...box.querySelectorAll('.qbs-chip')].map(c => c.textContent.trim()) : [];
    const label = box ? (box.querySelector('.qbs-label') || {}).textContent || '' : '';
    return {
      catHidden: !!(sel && getComputedStyle(sel).display === 'none'),
      chips,
      label: (label || '').trim(),
      visibleChips: box ? [...box.querySelectorAll('.qbs-chip')].filter(c => c.offsetParent !== null).length : 0,
    };
  });
  qb.catHidden ? ok('八方向下拉已隐藏（方向只留在隐藏字段里）') : bad('#qb-cat 仍在界面上');
  qb.chips.length > 0 ? ok(`推荐条「${qb.label}」：${qb.chips.join(' / ')}`) : bad('推荐条没渲染出 chip');
  qb.label && !qb.label.includes('home.') ? ok('推荐条文案已翻译（没漏 raw key）') : bad('推荐条露出未翻译的 key', qb.label);
  const chipHit = qb.chips.concat([qb.label]).join(' ').match(new RegExp('[' + '素养全人维度花瓣全能方向' + ']'));
  chipHit ? bad('推荐条文案里还有方向词', chipHit[0]) : ok('推荐条文案只有行为名');
  qb.visibleChips === qb.chips.length ? ok(`${qb.visibleChips} 个 chip 都可见`) : bad('chip 被隐藏', `${qb.visibleChips}/${qb.chips.length}`);

  console.log('\n[3] 点推荐 chip → 填进输入框');
  const filled = await page.evaluate(() => {
    const c = document.querySelector('#qb-suggest .qbs-chip');
    if (!c) return null;
    c.click();
    const d = document.getElementById('qb-desc');
    const cat = document.getElementById('qb-cat');
    return { name: d ? d.value : '', cat: cat ? cat.value : '' };
  });
  filled && filled.name ? ok(`点 chip 后输入框 = ${filled.name}（内部方向字段 = ${filled.cat}）`) : bad('chip 没填进输入框');
  await page.screenshot({ path: path.join(OUT, 'home-clean-390.png'), fullPage: true });

  console.log('\n[4] 目标页（成长目标）也不该出现方向字样');
  await page.evaluate(() => { const m = document.getElementById('gifts-module'); if (m) showModule('gifts-module'); });
  await sleep(1500);
  const goalText = await page.evaluate(() => (document.getElementById('gifts-module') || document.body).innerText);
  if (DUMP) console.log('\n---- 目标页可见文本 ----\n' + goalText + '\n----------------------\n');
  const hit2 = BAN.filter(w => goalText.includes(w));
  hit2.length === 0 ? ok('目标页没有违禁词') : bad('目标页出现违禁词', hit2.join('、'));

  console.log('\n[5] 成就页：里程碑副标题去掉「瓣/全能」说法');
  await page.evaluate(() => { const m = document.getElementById('achievements-module'); if (m) showModule('achievements-module'); });
  await sleep(1500);
  const achText = await page.evaluate(() => (document.getElementById('achievements-module') || document.body).innerText);
  // 「全能小星星」是孩子收的贴纸名，不是理念说明，允许留着；理念词一个都不许有
  const ACHV_BAN = BAN.filter(w => w !== '全能');
  const hit3 = ACHV_BAN.filter(w => achText.includes(w));
  hit3.length === 0 ? ok('成就页没有违禁词') : bad('成就页出现违禁词', hit3.join('、'));
  await page.screenshot({ path: path.join(OUT, 'achievements-clean-390.png'), fullPage: true });

  console.log('\n[6] 帮助面板不再讲全人体系');
  await page.evaluate(() => { const m = document.getElementById('points-module'); if (m) showModule('points-module'); });
  await sleep(600);
  const opened = await page.evaluate(() => {
    const b = document.getElementById('help-btn') || document.querySelector('[onclick="openHelpPanel()"]');
    if (!b) return false;
    b.click(); return true;
  });
  if (opened) {
    await sleep(700);
    const helpText = await page.evaluate(() => { const m = document.getElementById('help-modal'); return m ? m.innerText : ''; });
    const hit4 = BAN.filter(w => helpText.includes(w));
    hit4.length === 0 ? ok('帮助面板没有违禁词') : bad('帮助面板仍有违禁词', hit4.join('、'));
  } else {
    ok('本页没有帮助按钮入口（跳过）');
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(async (e) => { console.error('运行失败:', e); process.exit(2); });
