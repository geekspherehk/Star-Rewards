// 极简快照：打开页面 → 等加载 → 存可读文本 + 截图（不抓 DOM 结构，靠"读界面"判断）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = 'ujpu7859';
const log = (...a) => console.log('[snap]', ...a);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1200'],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);

    const targets = [
      ['board-kids', `https://www.pinterest.com/${USER}/kids-reward-chart-ideas/`],
      ['saved', `https://www.pinterest.com/${USER}/_saved/`],
    ];

    for (const [name, url] of targets) {
      log('打开', name, url);
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      } catch (e) { log('  goto 警告:', e.message); }
      await sleep(9000);
      const text = await page.evaluate(() => document.body ? document.body.innerText : '').catch(() => '(读取失败)');
      await page.screenshot({ path: `/tmp/snap-${name}.png` }).catch(() => {});
      fs.writeFileSync(`/tmp/snap-${name}.txt`, text);
      log('--- ' + name + ' 可读文本（前 1500 字）---');
      console.log(text.slice(0, 1500));
      log('--- 截图: /tmp/snap-' + name + '.png ---\n');
    }
    console.log('DONE');
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
