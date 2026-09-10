// 完成 Pinterest 域名认领
// 页面：https://www.pinterest.com/settings/claim/
// 表单（点 Websites 的 Claim 后出现）：
//   #domain-verification-input  (type=url, placeholder "Enter your website")
//   #metatag / #filename / #dnstxt 三种方式，我们用 metatag
//   提交按钮文案是 "Claim your website"（不是 Verify！）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const OUT = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-claim.json';
const SITE = 'https://stellar.gaocaihk.com';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[claim]', ...a);

async function realClickByText(page, words) {
  const handles = await page.$$('button, div[role="button"], a');
  for (const h of handles) {
    const info = await h.evaluate(el => ({
      t: (el.innerText || '').trim().toLowerCase(),
      disabled: el.disabled === true,
    })).catch(() => null);
    if (!info || info.disabled) continue;
    if (words.some(w => info.t === w || info.t.startsWith(w))) {
      try { await h.click(); return info.t; } catch (e) {}
    }
  }
  return null;
}

(async () => {
  const out = { site: SITE, startedAt: new Date().toISOString() };
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();

  await page.goto('https://www.pinterest.com/settings/claim/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(4500);

  // 1) 点 Websites 旁的 Claim 展开表单
  const opened = await realClickByText(page, ['claim']);
  log('展开表单:', opened);
  await sleep(4000);

  // 2) 选 metatag 方式（我们就是往 index.html 里加的 meta 标签）
  const mt = await page.$('#metatag');
  if (mt) { await mt.click(); log('已选 metatag 方式'); }
  await sleep(1000);

  // 3) 填网址
  const inp = await page.$('#domain-verification-input');
  if (!inp) {
    out.error = '找不到 #domain-verification-input';
    log('❌', out.error);
    fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
    await browser.close();
    return;
  }
  await inp.click();
  await page.keyboard.type(SITE, { delay: 30 });
  await sleep(1200);
  const typedVal = await page.evaluate(() => (document.querySelector('#domain-verification-input') || {}).value);
  log('已填网址:', typedVal);

  // 4) 提交（按钮文案 "Claim your website"）
  const submitted = await realClickByText(page, ['claim your website']);
  log('点击提交:', submitted);
  await sleep(9000);

  const info = await page.evaluate(() => ({
    url: location.href,
    text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 1200),
  }));
  log('提交后 url:', info.url);
  log('提交后 text:', info.text);
  await page.screenshot({ path: '/tmp/pin-claim-final.png' });

  const ok = /verified|success|congratulations|已验证|claimed/i.test(info.text);
  out.submitted = submitted;
  out.verified = ok;
  out.finalText = info.text.slice(0, 600);
  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  log(ok ? '✅ 域名认领成功' : '⚠️ 未识别到成功字样，请人工确认（截图 /tmp/pin-claim-final.png）');
  log('浏览器保持 60 秒…');
  await sleep(60000);
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
