// 精确诊断：Create 下拉菜单里 Board 项到底是什么标签/文案
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const USER = process.argv[2] || 'ujpu7859';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  const page = (await browser.pages())[0] || await browser.newPage();
  await page.goto(`https://www.pinterest.com/${USER}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await sleep(4500);

  const createBtn = await page.$('[aria-label="Create a Pin or a board"]');
  console.log('[diag] 找到 Create 按钮:', !!createBtn);
  if (createBtn) await createBtn.click();
  await sleep(3500);
  await page.screenshot({ path: '/tmp/pin-menu-open.png' });

  const info = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const boardish = all
      .filter(el => {
        const t = (el.innerText || '').trim().toLowerCase();
        return t === 'board' || t === 'create board' || /^board$/.test(t);
      })
      .map(el => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName, role: el.getAttribute('role'),
          testId: el.getAttribute('data-test-id'),
          aria: el.getAttribute('aria-label'),
          cls: (el.className || '').toString().slice(0, 60),
          rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
          childCount: el.children.length,
        };
      });

    const menus = Array.from(document.querySelectorAll('[role="menu"],[role="listbox"],[aria-haspopup="true"],[data-test-id*="dropdown"]'))
      .map(el => ({
        tag: el.tagName, role: el.getAttribute('role'), testId: el.getAttribute('data-test-id'),
        items: Array.from(el.querySelectorAll('div,button,a,li')).slice(0, 12)
          .map(c => (c.innerText || '').trim().slice(0, 25)).filter(Boolean),
      }));

    const clickableBelow = Array.from(document.querySelectorAll('div,button,a'))
      .filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.x > 600 && r.y > 100;
      })
      .slice(0, 40)
      .map(el => ({ tag: el.tagName, text: (el.innerText || '').trim().slice(0, 25), cls: (el.className || '').toString().slice(0, 40) }));

    return { boardish, menus, clickableBelow };
  });

  console.log('[diag] 含 "board" 文案的元素:', JSON.stringify(info.boardish, null, 1));
  console.log('[diag] 菜单容器:', JSON.stringify(info.menus, null, 1));
  console.log('[diag] 右侧可点元素:', JSON.stringify(info.clickableBelow, null, 1));
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
