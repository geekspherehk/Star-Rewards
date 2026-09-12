// 用坐标点击 Pin 详情页左下角「...」，dump 菜单项
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const log = (...a) => console.log('[probe]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PIN = process.argv[2] || '1123155594603213618';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1100'],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto('https://www.pinterest.com/pin/' + PIN + '/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(9000);
    await page.screenshot({ path: '/tmp/edit-0-detail.png' });

    // 记录所有 aria-label，便于精确锁定 Pin 的「...」
    const labels = await page.evaluate(() => Array.from(document.querySelectorAll('[aria-label]')).map(e => e.getAttribute('aria-label')).filter(Boolean).slice(0, 60));
    fs.writeFileSync('/tmp/edit-labels.txt', labels.join('\n'));
    log('页面 aria-label 数:', labels.length);

    log('坐标点击 Pin 的「...」(225,484)');
    await page.mouse.click(225, 484);
    await sleep(3500);
    await page.screenshot({ path: '/tmp/edit-1-menu.png' });

    const items = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[role="menuitem"], [role="dialog"] div, [role="menu"] div, button')) {
        const t = (el.innerText || '').trim();
        if (t && t.length < 40 && !t.includes('\n')) out.push(t);
      }
      return Array.from(new Set(out)).slice(0, 40);
    });
    log('弹出菜单候选项:');
    items.forEach(t => log('   ·', t));
    console.log('DONE');
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
