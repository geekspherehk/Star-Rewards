// 打印打卡表 -> PNG / PDF 截图（puppeteer-core + 本机 Chrome）
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const ROOT = path.resolve(__dirname, '..');
const SRC = 'file://' + path.join(ROOT, 'print/reward-chart.html');
const OUT = path.join(ROOT, 'assets/print/reward-chart.png');
const PDF = path.join(ROOT, 'assets/print/reward-chart.pdf');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page.goto(SRC, { waitUntil: 'networkidle0' });
  await page.evaluateHandle('document.fonts.ready');
  await new Promise(r => setTimeout(r, 600));

  // 截图与打印前隐藏工具条
  await page.addStyleTag({ content: '.no-print{display:none !important}' });
  await new Promise(r => setTimeout(r, 200));

  const sheet = await page.$('.sheet');
  await sheet.screenshot({ path: OUT });

  await page.pdf({
    path: PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });

  await browser.close();
  console.log('PNG', fs.statSync(OUT).size, 'bytes');
  console.log('PDF', fs.statSync(PDF).size, 'bytes');
})();
