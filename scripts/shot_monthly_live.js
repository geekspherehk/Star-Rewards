#!/usr/bin/env node
// 线上真实环境截图：直接访问 https://stellar.gaocaihk.com，用临时的 sr.demo.* 账号 + 整月 mock 数据渲染月历/海报
// 用于部署后向用户展示线上真实效果。临时账号用后删除（sr.demo 为白名单前缀，不污染运营看板）。
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const R = 'https://stellar.gaocaihk.com';
const OUT = path.join(__dirname, '..', 'shots');
const WIDTH = parseInt(process.argv.find(a => /^\d+$/.test(a)) || '900', 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function nodeApi(action, body, token) {
  const r = await fetch(R + '/api/index.php?action=' + action, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  return r.json();
}

async function setupDemo() {
  const email = `sr.demo.live.${Date.now()}@example.com`;
  const reg = await nodeApi('register', { email, password: 'TestPass123!', consent: true });
  const token = reg.token;
  if (!token) throw new Error('register 无 token: ' + JSON.stringify(reg));
  // 5 个愿望（月初创建，延长到整月）
  const cats = ['self_drive', 'aesthetics', 'planning', 'health', 'resilience'];
  const names = ['早晚刷牙', '阅读 20 分钟', '自己整理书包', '9 点前上床睡觉', '喝足 6 杯水'];
  const wishes = [];
  for (let i = 0; i < cats.length; i++) {
    const w = await nodeApi('add_wish', { category: cats[i], title: names[i], wish_type: 'persistence', persistence_days: 30 }, token);
    wishes.push(w);
  }
  return { token, email, wishes, names };
}

async function injectMock(page, names) {
  return page.evaluate((names) => {
    const cats = ['self_drive', 'aesthetics', 'planning', 'health', 'resilience'];
    const wishes = names.map((t, i) => ({ id: 'w' + (i + 1), title: t, category: cats[i], status: 'active', created_at: '2026-09-01 08:00:00' }));
    const now = new Date(); const y = now.getFullYear(), m = now.getMonth(), todayD = now.getDate();
    const pad = n => String(n).padStart(2, '0');
    const ck = [];
    for (let day = 1; day <= todayD; day++) {
      let n;
      if (day % 7 === 0) n = 0;
      else if (day === todayD) n = 2;
      else if (day % 3 === 0) n = 3;
      else n = 5;
      for (let k = 0; k < n; k++) ck.push({ wish_id: 'w' + (k + 1), checkin_date: `${y}-${pad(m + 1)}-${pad(day)}`, wish_title: names[k] });
    }
    if (typeof v2Data !== 'undefined' && v2Data) v2Data.wishes = wishes;
    if (typeof checkins !== 'undefined') checkins = ck;
    if (typeof renderWeeklyModule === 'function') renderWeeklyModule();
    return { wishes: wishes.length, ck: ck.length };
  }, names);
}

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const demo = await setupDemo();
  console.log('临时账号:', demo.email, '愿望:', demo.wishes.length);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: 1500, deviceScaleFactor: 2 });

  // 写 token（先访问同源 login 页建立 origin localStorage）
  await page.goto(R + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await page.evaluate((t, e) => { localStorage.setItem('auth_token', t); localStorage.setItem('user_email', e); }, demo.token, demo.email);
  // 清 SW，避免 cache-first 拿旧资源
  await page.evaluate(async () => { try { const rs = await navigator.serviceWorker.getRegistrations(); for (const r of rs) await r.unregister(); } catch (e) {} });

  await page.goto(R + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(4000);

  const mock = await injectMock(page, demo.names);
  console.log('mock 注入:', JSON.stringify(mock));
  await sleep(800);

  const mInfo = await page.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.mc-cell'));
    const counts = {};
    cells.forEach(c => { const k = Array.from(c.classList).find(x => x.startsWith('is-') && x !== 'is-click'); if (k) counts[k] = (counts[k] || 0) + 1; });
    return { cells: cells.length, counts, stat: (document.getElementById('stat-weekly') || {}).textContent };
  });
  console.log('月历(线上):', JSON.stringify(mInfo));

  await page.evaluate(() => {
    ['activation-progress-bar', 'welcome-banner', 'home-focus-banner', 'activation-checklist']
      .forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
    const el = document.getElementById('weekly-section');
    if (el) el.scrollIntoView({ block: 'start' });
  });
  await sleep(600);
  const p1 = path.join(OUT, `live-monthly-module-${WIDTH}.png`);
  await (await page.$('#weekly-section')).screenshot({ path: p1 });
  console.log('截图:', p1);

  // 日详情
  const todayClicked = await page.evaluate(() => { const t = document.querySelector('.mc-cell.is-today'); if (!t) return false; t.click(); return true; });
  await sleep(900);
  if (todayClicked) {
    const p2 = path.join(OUT, `live-monthly-day-detail-${WIDTH}.png`);
    await page.screenshot({ path: p2 });
    console.log('日详情截图:', p2);
    await page.evaluate(() => { if (typeof closeDayDetail === 'function') closeDayDetail(); });
  }

  // 海报（整月）
  await page.evaluate(() => { if (typeof openWeeklyPoster === 'function') openWeeklyPoster(); });
  await sleep(2600);
  const posterInfo = await page.evaluate(() => {
    const cv = document.getElementById('weekly-poster-canvas');
    const m = document.getElementById('weekly-poster-modal');
    return { hasCanvas: !!cv, w: cv ? cv.width : 0, h: cv ? cv.height : 0, modalVisible: !!m && getComputedStyle(m).display !== 'none' };
  });
  console.log('海报(线上):', JSON.stringify(posterInfo));
  const p3 = path.join(OUT, `live-monthly-poster-${WIDTH}.png`);
  await (await page.$('#weekly-poster-canvas')).screenshot({ path: p3 });
  console.log('海报截图:', p3);
  await page.evaluate(() => { if (typeof closeWeeklyPoster === 'function') closeWeeklyPoster(); });

  // 移动端截图（同一账号）
  await page.setViewport({ width: 390, height: 1700, deviceScaleFactor: 2 });
  await sleep(500);
  await injectMock(page, demo.names);
  await sleep(800);
  await page.evaluate(() => { const el = document.getElementById('weekly-section'); if (el) el.scrollIntoView({ block: 'start' }); });
  await sleep(600);
  const p4 = path.join(OUT, `live-monthly-module-390.png`);
  await (await page.$('#weekly-section')).screenshot({ path: p4 });
  console.log('移动端截图:', p4);

  await browser.close();

  // 清理临时账号
  const del = await nodeApi('delete_account', { confirm: 'DELETE' }, demo.token);
  console.log('清理临时账号:', JSON.stringify(del));
  console.log('DONE');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
