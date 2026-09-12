// dump 编辑弹窗内的按钮：区分「弹窗内的 Save」和「详情页的 Save」
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[save]', ...a);
const ID = process.argv[2] || '1123155594603213558';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1100'],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    await page.goto('https://www.pinterest.com/pin/' + ID + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(9000);
    const more = (await page.$$('[aria-label="More actions"]'))[0];
    await more.click(); await sleep(3000);
    for (const h of await page.$$('div,button,span')) {
      const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
      if (t === 'Edit Pin' || t === 'Edit') { await h.click(); break; }
    }
    for (let i = 0; i < 20; i++) { if (await page.evaluate(() => !!document.getElementById('WebsiteField'))) break; await sleep(1000); }
    await sleep(1500);

    const btns = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('button, [role="button"]')) {
        const text = (b.innerText || '').trim();
        if (!text || text.length > 20) continue;
        const inDialog = !!b.closest('[role="dialog"]');
        const r = b.getBoundingClientRect();
        out.push({ text, inDialog, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), testid: b.getAttribute('data-test-id') || '' });
      }
      return out;
    });
    log('按钮清单（text / inDialog / 位置）:');
    btns.forEach(b => log('  ·', JSON.stringify(b)));
    await page.screenshot({ path: '/tmp/save-probe.png' });
    console.log('DONE');
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
