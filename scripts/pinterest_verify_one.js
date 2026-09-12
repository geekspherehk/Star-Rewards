// 单张 Pin 深度复核：详情页外链 + 编辑弹窗字段值（都给足等待 + 截图）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[v1]', ...a);
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
    await sleep(10000);
    await page.screenshot({ path: '/tmp/v1-detail.png' });

    // A) 详情页上的本站外链
    const outbound = await page.evaluate(() => {
      const arr = Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => /gaocaihk/.test(h));
      const text = document.body ? document.body.innerText : '';
      return { outbound: Array.from(new Set(arr)), hasVisit: /visit/i.test(text), hasDomain: /stellar\.gaocaihk\.com/.test(text) };
    });
    log('A) 详情页外链:', JSON.stringify(outbound.outbound), '| 含Visit:', outbound.hasVisit, '| 含域名文本:', outbound.hasDomain);

    // B) 打开编辑弹窗，读字段
    const more = (await page.$$('[aria-label="More actions"]'))[0];
    if (!more) { log('B) ⚠️ 找不到 More actions'); }
    else {
      await more.click(); await sleep(3000);
      let opened = false;
      for (const h of await page.$$('div,button,span')) {
        const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
        if (t === 'Edit Pin' || t === 'Edit') { await h.click(); opened = true; break; }
      }
      log('B) 点 Edit Pin:', opened);
      // 轮询等待 #WebsiteField 出现（最多 20s）
      let appeared = false;
      for (let i = 0; i < 20; i++) {
        appeared = await page.evaluate(() => !!document.getElementById('WebsiteField'));
        if (appeared) break;
        await sleep(1000);
      }
      await sleep(1500);
      await page.screenshot({ path: '/tmp/v1-edit.png' });
      const v = await page.evaluate(() => {
        const g = id => { const e = document.getElementById(id); return e ? (e.value || '') : '(无此元素)'; };
        const t = document.querySelector('#TitleField');
        const w = document.querySelector('#WebsiteField');
        return {
          titleShown: !!t, websiteShown: !!w,
          title: g('TitleField'), website: g('WebsiteField'),
          desc: (document.querySelector('div[contenteditable="true"]') || {}).innerText || '',
        };
      });
      log('B) 弹窗出现:', appeared, '| Title框:', v.titleShown, '| Website框:', v.websiteShown);
      log('B) 标题值:', JSON.stringify(v.title));
      log('B) 链接值:', JSON.stringify(v.website));
    }
    console.log('DONE');
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
