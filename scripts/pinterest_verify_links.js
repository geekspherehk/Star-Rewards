// 点进一张 Pin 详情页，读取它的"目的链接"（destination link）到底指向哪
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
  // 滚动加载 Pin 网格
  for (let i = 0; i < 5; i++) { await page.evaluate(() => window.scrollBy(0, 1200)); await sleep(1200); }

  // 取第一张 pin 的链接
  const firstHref = await page.evaluate(() => {
    const a = document.querySelector('a[href*="/pin/"]');
    return a ? a.getAttribute('href') : null;
  });
  console.log('第一张 Pin 链接:', firstHref);
  if (!firstHref) { console.log('❌ 没找到 Pin，退出'); await browser.close(); process.exit(1); }

  await page.goto('https://www.pinterest.com' + firstHref, { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(5000);

  const detail = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href]').forEach(a => {
      const h = a.getAttribute('href') || '';
      if (/http/.test(h) && !/pinterest\.com/.test(h)) out.push(h);
    });
    // 找"访问"/"Visit"按钮
    let visitBtn = null;
    document.querySelectorAll('a,button,div[role="button"]').forEach(el => {
      const t = (el.innerText || '').trim().toLowerCase();
      if (t === 'visit' || t === 'more info' || t.startsWith('visit')) visitBtn = el.getAttribute('href') || el.innerText.trim();
    });
    return {
      outbound: [...new Set(out)],
      visit: visitBtn,
      url: location.href,
      title: (document.querySelector('h1,h2,title') || {}).innerText || document.title,
    };
  });
  console.log('Pin 详情页 URL:', detail.url);
  console.log('标题:', detail.title);
  console.log('Visit 按钮:', detail.visit);
  console.log('外链(目的链接):', JSON.stringify(detail.outbound, null, 2));
  console.log('🔓 浏览器保持打开');
  await new Promise(() => {});
}
main().catch(e => { console.error('💥', e.message); process.exit(1); });
