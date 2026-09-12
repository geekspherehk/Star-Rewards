// 从看板页点开第一张 Pin，读详情页（标题 / 描述 / 目标链接）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = 'ujpu7859';
const log = (...a) => console.log('[detail]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1100'],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(`https://www.pinterest.com/${USER}/kids-reward-chart-ideas/`, { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(8000);
    await page.screenshot({ path: '/tmp/detail-0-board.png' });

    // 真实鼠标点击第一张 Pin 卡片（图上坐标约 140,580）
    log('点击第一张 Pin…');
    await page.mouse.click(140, 580);
    await sleep(8000);
    await page.screenshot({ path: '/tmp/detail-1-pin.png' });
    const url = page.url();
    log('当前 URL:', url);
    const text = await page.evaluate(() => document.body ? document.body.innerText : '');
    fs.writeFileSync('/tmp/detail-pin.txt', text);
    log('--- 详情页可读文本（前 2000 字）---');
    console.log(text.slice(0, 2000));
    // 找本站外链
    const out = await page.evaluate(() => Array.from(document.querySelectorAll('a[href*="gaocaihk"]')).map(a => a.href));
    log('本站外链:', JSON.stringify(Array.from(new Set(out))));
    console.log('DONE');
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
