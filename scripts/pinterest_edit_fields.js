// dump 编辑弹窗的输入字段（Title / Website / Description 的真实选择器）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const log = (...a) => console.log('[fields]', ...a);
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
    await sleep(8000);
    const more = (await page.$$('[aria-label="More actions"]'))[0];
    await more.click(); await sleep(3000);
    for (const h of await page.$$('div,button,span')) {
      const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
      if (t === 'Edit Pin' || t === 'Edit') { await h.click(); break; }
    }
    await sleep(6000);
    await page.screenshot({ path: '/tmp/edit-fields.png' });

    const fields = await page.evaluate(() => {
      const out = [];
      const all = Array.from(document.querySelectorAll('input, textarea'));
      for (const el of all) {
        // 找最近的文本标签：向上找容器，取其中非输入的元素文本
        let label = '';
        let node = el, hops = 0;
        while (node && hops < 5 && !label) {
          node = node.parentElement; hops++;
          if (!node) break;
          for (const c of node.children) {
            if (c.contains(el)) continue;
            const t = (c.innerText || '').trim();
            if (t && t.length < 30) { label = t; break; }
          }
        }
        out.push({
          tag: el.tagName, id: el.id || '', name: el.name || '', type: el.type || '',
          placeholder: el.placeholder || '', aria: el.getAttribute('aria-label') || '',
          value: (el.value || '').slice(0, 40), nearLabel: label,
        });
      }
      return out;
    });
    log('共', fields.length, '个字段：');
    fields.forEach((f, i) => log(`  [${i}]`, JSON.stringify(f)));
    fs.writeFileSync('/tmp/edit-fields.json', JSON.stringify(fields, null, 2));
    console.log('DONE');
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
