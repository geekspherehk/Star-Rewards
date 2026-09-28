const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FILE = 'file://' + path.resolve(__dirname, '..', 'prototypes', 'weekly-tracker-v2.html');
const OUT = path.resolve(__dirname, '..', 'shots');

(async () => {
  if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--font-render-hinting=none']
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

  await page.setViewport({ width: 1000, height: 1200, deviceScaleFactor: 2 });
  await page.goto(FILE, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));

  // 站内视图 + 点一个漏卡格子
  await page.screenshot({ path: path.join(OUT, 'tracker-app.png'), fullPage: true });

  const before = await page.$eval('#cntDone', el => el.textContent);
  const missCell = await page.$('.cell.miss[data-hit]');
  if (missCell) {
    await missCell.click();
    await new Promise(r => setTimeout(r, 500));
  }
  const after = await page.$eval('#cntDone', el => el.textContent);
  await page.screenshot({ path: path.join(OUT, 'tracker-app-after-checkin.png'), fullPage: true });

  // 下载中心
  await page.click('[data-tab="b"]');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: path.join(OUT, 'tracker-download.png'), fullPage: true });

  // 校验 canvas 不是空白
  const canvasInfo = await page.evaluate(() => {
    const out = {};
    [['cvMine', 'mine'], ['cvBlank', 'blank'], ['cvPreset', 'preset']].forEach(([id, k]) => {
      const c = document.getElementById(id);
      const h = Math.max(1, c.height), w = Math.max(1, c.width);
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, w, h).data;
      let nonWhite = 0;
      for (let i = 0; i < d.length; i += 4 * 97) {
        if (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245) nonWhite++;
      }
      out[k] = { attrW: c.width, attrH: c.height, nonWhiteSamples: nonWhite };
    });
    return out;
  });

  // 移动端视图
  await page.click('[data-tab="a"]');
  await page.setViewport({ width: 390, height: 900, deviceScaleFactor: 3 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: path.join(OUT, 'tracker-mobile.png'), fullPage: true });

  console.log('今天之前计数:', before, '-> 点漏卡后:', after);
  console.log('canvas 采样:', JSON.stringify(canvasInfo));
  console.log('错误:', errs.length ? errs : '无');

  await browser.close();
})();
