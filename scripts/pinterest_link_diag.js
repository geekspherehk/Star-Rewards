// 诊断 _saved 页真实链接结构：dump 所有含 pin / 外链的 a 标签
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,1000'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  await page.goto(`https://www.pinterest.com/${USER}/_saved/`, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(5000);
  for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 1200)); await sleep(1000); }

  const dump = await page.evaluate(() => {
    const pins = [], outs = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (/\/pin\//.test(h)) pins.push(h);
      if (/http/.test(h) && !/pinterest\.com/.test(h)) outs.push(h);
    });
    return { pinCount: pins.length, pins: [...new Set(pins)].slice(0, 4), outs: [...new Set(outs)] };
  });
  console.log('Pin 链接数:', dump.pinCount);
  console.log('示例 Pin 链接:', JSON.stringify(dump.pins, null, 2));
  console.log('外链:', JSON.stringify(dump.outs, null, 2));
  console.log('🔓 保持打开');
  await new Promise(() => {});
}
main().catch(e => { console.error('💥', e.message); process.exit(1); });
