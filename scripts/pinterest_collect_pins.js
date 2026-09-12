// 从数据层拿 Pin ID：拦截 Pinterest 的 API 响应 + 扫描页内嵌 JSON
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const OUT = '/tmp/pin-urls.json';
const log = (...a) => console.log('[collect]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function extractIds(text) {
  const out = new Set();
  // 形如 "id":"1234567890123456789" 或 "pin_id":"..."
  const re = /"(?:id|pin_id|entityId)"\s*:\s*"(\d{15,20})"/g;
  let m;
  while ((m = re.exec(text))) out.add(m[1]);
  return out;
}

async function probeLoggedIn(browser) {
  const p = await browser.newPage();
  try {
    await p.goto('https://www.pinterest.com/' + USER + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    const url = p.url(); const txt = await p.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
    return url.includes(USER) && !/log in|sign up|join pinterest/i.test(txt);
  } catch (e) { return false; } finally { try { await p.close(); } catch (e) {} }
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,1400'],
  });
  try {
    if (!(await probeLoggedIn(browser))) { console.error('NEED_LOGIN'); process.exit(10); }
    const page = await browser.newPage();
    page.setDefaultTimeout(40000);

    const allIds = new Set();
    page.on('response', async (res) => {
      try {
        const url = res.url();
        if (!/pinterest\.com\/(resource|graphql|_api)/.test(url)) return;
        const ct = (res.headers()['content-type'] || '');
        if (!/json/.test(ct)) return;
        const txt = await res.text();
        for (const id of extractIds(txt)) allIds.add(id);
      } catch (e) {}
    });

    log('打开 _saved …');
    await page.goto('https://www.pinterest.com/' + USER + '/_saved/', { waitUntil: 'networkidle2', timeout: 45000 });
    await sleep(12000);

    // 扫描页内嵌 JSON script
    const embedded = await page.evaluate(() => {
      const found = [];
      for (const s of document.querySelectorAll('script')) {
        const t = s.textContent || '';
        if (t.length > 200 && /"id"\s*:\s*"\d{15,20}"/.test(t)) found.push(t.slice(0, 400000));
      }
      return found.join('\n');
    });
    for (const id of extractIds(embedded)) allIds.add(id);

    const ids = Array.from(allIds);
    log('总捕获 Pin ID:', ids.length);
    ids.forEach((id, i) => log('  [' + i + ']', 'https://www.pinterest.com/pin/' + id + '/'));
    fs.writeFileSync(OUT, JSON.stringify(ids.map(id => 'https://www.pinterest.com/pin/' + id + '/'), null, 2));
    console.log('DONE ids=' + ids.length);
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
