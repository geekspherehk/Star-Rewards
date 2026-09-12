// 最终复核：逐个打开 Pin 的编辑弹窗，读 #TitleField / #WebsiteField（读完点 Cancel，绝不保存）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[verify]', ...a);

// 默认复核全部 7 张；也可用命令行参数只验指定 ID
let IDS = process.argv.slice(2).filter(a => /^\d+$/.test(a));
if (!IDS.length) IDS = [
  '1123155594603213558', '1123155594603213618', '1123155594603213504',
  '1123155594603213455', '1123155594603213409', '1123155594603213276',
  '1123155594603213176',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1100'],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);
    let ok = 0;
    for (const id of IDS) {
      try {
        await page.goto('https://www.pinterest.com/pin/' + id + '/', { waitUntil: 'networkidle2', timeout: 60000 });
        await sleep(9000);
        // 详情页外链（Pinterest 会给目标链接自动加 utm_source=Pinterest）
        const outbound = await page.evaluate(() =>
          Array.from(new Set(Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => /gaocaihk/.test(h)))));
        const more = (await page.$$('[aria-label="More actions"]'))[0];
        if (!more) { log('pin/' + id, '⚠️ 找不到 More actions'); continue; }
        await more.click(); await sleep(2800);
        let opened = false;
        for (const h of await page.$$('div,button,span')) {
          const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
          if (t === 'Edit Pin' || t === 'Edit') { await h.click(); opened = true; break; }
        }
        if (!opened) { log('pin/' + id, '⚠️ 打不开编辑弹窗'); continue; }
        // 轮询等弹窗字段出现
        for (let i = 0; i < 20; i++) { if (await page.evaluate(() => !!document.getElementById('WebsiteField'))) break; await sleep(1000); }
        await sleep(1200);
        const v = await page.evaluate(() => {
          const g = i => { const e = document.getElementById(i); return e ? (e.value || '') : ''; };
          return { t: g('TitleField'), w: g('WebsiteField') };
        });
        const good = !!v.t && /gaocaihk\.com\/.+\.html/.test(v.w);
        if (good) ok++;
        log('pin/' + id, good ? '✅' : '❌',
          '\n      标题:', JSON.stringify(v.t),
          '\n      链接:', JSON.stringify(v.w),
          '\n      详情页外链:', JSON.stringify(outbound));
        // 关闭弹窗：点 Cancel（不要点 Save，避免误改）
        for (const h of await page.$$('[role="dialog"] button, [role="dialog"] [role="button"]')) {
          const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
          if (t === 'Cancel') { try { await h.click(); } catch (e) {} break; }
        }
        await sleep(1800);
      } catch (e) { log('pin/' + id, '异常:', e.message); }
    }
    console.log('DONE total=' + IDS.length + ' ok=' + ok);
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
