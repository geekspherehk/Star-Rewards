// 逐个打开 Pin 详情页，读出标题 + 指向本站的外链（判断链接是否真的填了）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const IDS = JSON.parse(fs.readFileSync('/tmp/pin-urls.json', 'utf8'));
const log = (...a) => console.log('[check]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function probeLoggedIn(browser) {
  const p = await browser.newPage();
  try {
    await p.goto('https://www.pinterest.com/' + USER + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    const url = p.url(); const txt = await p.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
    return url.includes(USER) && !/log in|sign up|join pinterest/i.test(txt);
  } catch (e) { return false; } finally { try { await p.close(); } catch (e) {} }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,1000'],
  });
  try {
    if (!(await probeLoggedIn(browser))) { console.error('NEED_LOGIN'); process.exit(10); }
    const page = await browser.newPage();
    page.setDefaultTimeout(40000);
    const results = [];

    for (const url of IDS) {
      const id = url.match(/\/pin\/(\w+)/)[1];
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
        await sleep(4500);
        const info = await page.evaluate(() => {
          const text = document.body ? document.body.innerText : '';
          // 所有含 gaocaihk 的真实 href
          const outbound = Array.from(document.querySelectorAll('a[href*="gaocaihk"]')).map(a => a.href);
          // 标题：h1 或 [data-test-id*=title]
          let title = '';
          const h1 = document.querySelector('h1');
          if (h1) title = (h1.innerText || '').trim();
          if (!title) { const t = document.querySelector('[data-test-id*="title" i]'); if (t) title = (t.innerText || '').trim(); }
          // 域名署名（claim 后会出现）
          const hasDomain = /stellar\.gaocaihk\.com/.test(text);
          return { title: title.slice(0, 80), outbound: Array.from(new Set(outbound)), hasDomain };
        });
        results.push({ id, ...info });
        log('pin/' + id, '| 标题:', JSON.stringify(info.title), '| 外链:', info.outbound.length, '| 有域名署名:', info.hasDomain);
        info.outbound.forEach(u => log('      →', u));
      } catch (e) {
        log('pin/' + id, '读取失败:', e.message);
        results.push({ id, error: e.message });
      }
    }
    fs.writeFileSync('/tmp/pin-inspect.json', JSON.stringify(results, null, 2));
    const withLink = results.filter(r => (r.outbound || []).some(u => /gaocaihk/.test(u)));
    console.log('DONE total=' + results.length + ' withOutbound=' + withLink.length);
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
