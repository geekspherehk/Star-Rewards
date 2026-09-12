// 打开 Pinterest Pin Builder，dump 所有 input 的真实属性，
// 确认「目标链接」输入框的选择器，判断已发布的 Pin 是否真的填了链接。
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const OUT = '/tmp/pinbuilder-inspect.json';

const log = (...a) => console.log('[inspect]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return null;
}

async function probeLoggedIn(browser) {
  const p = await browser.newPage();
  await p.goto('https://www.pinterest.com/' + USER + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);
  const url = p.url();
  const txt = await p.evaluate(() => document.body.innerText).catch(() => '');
  await p.close();
  const loggedIn = !/log in|sign up|join/i.test(txt) && !/pinterest\.com\/?(?:\?|$)/.test(url) && url.includes(USER);
  return loggedIn;
}

(async () => {
  const exe = findChrome();
  if (!exe) { console.error('NO_CHROME'); process.exit(2); }
  const browser = await puppeteer.launch({
    executablePath: exe, headless: false,
    userDataDir: PROFILE,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1400'],
  });
  try {
    if (!(await probeLoggedIn(browser))) { console.error('NEED_LOGIN'); process.exit(10); }
    log('已登录，打开 Pin Builder…');

    const page = await browser.newPage();
    await page.goto('https://www.pinterest.com/pin-builder/', { waitUntil: 'networkidle2', timeout: 40000 });
    await sleep(6000);

    // 关掉可能的新手引导
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      for (const b of btns) {
        const t = (b.innerText || '').trim().toLowerCase();
        if (t === 'got it' || t === 'next' || t === 'close' || t === 'x') { try { b.click(); } catch (e) {} }
      }
    });
    await sleep(2000);

    const inputs = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('input, textarea')) {
        out.push({
          tag: el.tagName,
          name: el.getAttribute('name') || '',
          id: el.id || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          placeholder: el.getAttribute('placeholder') || '',
          type: el.type || '',
          autocomplete: el.getAttribute('autocomplete') || '',
        });
      }
      return out;
    });
    log('找到', inputs.length, '个输入控件：');
    inputs.forEach((i, n) => log(`  [${n}]`, JSON.stringify(i)));

    // 专门筛出像「链接」的
    const linkish = inputs.filter(i =>
      /link|url|destination|website/i.test([i.name, i.id, i.ariaLabel, i.placeholder].join(' ')));
    log('疑似链接输入框:', linkish.length);
    linkish.forEach(i => log('   LINK>', JSON.stringify(i)));

    await page.screenshot({ path: '/tmp/pinbuilder-inspect.png' });
    fs.writeFileSync(OUT, JSON.stringify({ inputs, linkish }, null, 2));
    console.log('DONE inputs=' + inputs.length + ' linkish=' + linkish.length);
    await sleep(2000);
  } finally {
    await browser.close();
  }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
