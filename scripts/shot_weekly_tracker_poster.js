#!/usr/bin/env node
/**
 * 截取「本周打卡表海报合成器」原型，用于视觉自检。
 * 用法: NODE_PATH=... node scripts/shot_weekly_tracker_poster.js
 */
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'file://' + path.join(ROOT, 'prototypes', 'weekly-tracker-poster.html');
const OUT = path.join(ROOT, 'shots');

function findChrome() {
  const cands = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  throw new Error('找不到 Chrome');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: findChrome(),
    headless: 'new',
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));

  await page.setViewport({ width: 1280, height: 1100, deviceScaleFactor: 2 });
  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await page.waitForFunction("document.body.dataset.ready === '1'", { timeout: 15000 });

  const shot = async (name, sel) => {
    const el = sel ? await page.$(sel) : null;
    await (el || page).screenshot({ path: path.join(OUT, name) });
    console.log('  ->', name);
  };

  // 1) 整页（含控制面板）
  await shot('poster-studio.png');

  // 2) 导出canvas真实像素（不带页面缩放）
  const grab = async (name) => {
    const data = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data.split(',')[1], 'base64'));
    console.log('  ->', name);
  };

  // 3) C 升级底图 · 中文 · 金色
  await grab('poster-export-a.png');

  // 4) C 底图 + 英文 + 靛蓝星
  await page.evaluate(() => {
    document.querySelector('#segLang button[data-v="en"]').click();
    document.querySelector('#segStar button[data-v="brand"]').click();
    document.getElementById('nameInput').value = 'Mia';
    document.getElementById('nameInput').dispatchEvent(new Event('input'));
  });
  await new Promise((r) => setTimeout(r, 600));
  await grab('poster-export-b-en.png');

  // 5) B 旧底图（保留对照）
  await page.evaluate(() => {
    document.querySelector('#segBg button[data-v="B"]').click();
    document.querySelector('#segLang button[data-v="zh"]').click();
    document.querySelector('#segStar button[data-v="gold"]').click();
    document.getElementById('nameInput').value = '小明';
    document.getElementById('nameInput').dispatchEvent(new Event('input'));
  });
  await new Promise((r) => setTimeout(r, 600));
  await grab('poster-export-oldb.png');

  // 6) 空白模板（免登录引流版）· C 底图
  await page.evaluate(() => {
    document.querySelector('#segBg button[data-v="C"]').click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const blankData = await page.evaluate(() => {
    const r = draw(Object.assign({}, state, { blank: true }));
    return { data: document.getElementById('cv').toDataURL('image/png'), stat: r };
  });
  fs.writeFileSync(path.join(OUT, 'poster-export-blank.png'),
    Buffer.from(blankData.data.split(',')[1], 'base64'));
  console.log('  -> poster-export-blank.png', JSON.stringify(blankData.stat));

  // 7) 手机端整页
  await page.evaluate(() => render());
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 2 });
  await new Promise((r) => setTimeout(r, 400));
  await shot('poster-mobile.png');

  console.log(errs.length ? '控制台错误:\n' + errs.join('\n') : '控制台零报错');
  await browser.close();
})();
