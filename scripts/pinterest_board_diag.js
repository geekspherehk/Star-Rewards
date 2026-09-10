// 诊断建板弹窗的 DOM 结构：找出弹窗容器选择器 + 提交按钮的真实定位方式
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
  await sleep(4000);

  // 打开 Create 菜单 → 选 Board
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, div[role="button"], a'));
    for (const el of els) {
      const a = (el.getAttribute('aria-label') || '').toLowerCase();
      const t = (el.innerText || '').trim().toLowerCase();
      if (a.includes('pin or a board') || t === 'create') { el.click(); return; }
    }
  });
  await sleep(3000);
  await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll('button, div[role="button"], a, [role="menuitem"]'));
    for (const el of els) {
      const t = (el.innerText || '').trim().toLowerCase();
      const a = (el.getAttribute('aria-label') || '').toLowerCase();
      if (a.includes('pin or a board')) continue;
      if (t === 'board' || a.includes('create board')) { el.click(); return; }
    }
  });
  await sleep(3500);

  // 填名
  const typed = await page.evaluate(() => {
    for (const inp of Array.from(document.querySelectorAll('input'))) {
      const s = [inp.placeholder || '', inp.getAttribute('aria-label') || '', inp.name || '', inp.id || ''].join(' ').toLowerCase();
      if (/name|board|title/.test(s)) { inp.focus(); return true; }
    }
    return false;
  });
  console.log('[diag] 填名成功:', typed);
  await page.keyboard.type('DIAG TEST BOARD', { delay: 30 });
  await sleep(1500);

  // 关键：把弹窗容器信息 + 所有按钮的位置关系打出来
  const info = await page.evaluate(() => {
    const isInModal = (el) => !!el.closest('[role="dialog"],[aria-modal="true"],[data-test-id*="modal"],[data-test-id*="Modal"]');

    const modalCandidates = Array.from(document.querySelectorAll('[role="dialog"],[aria-modal="true"],[data-test-id*="modal"],[data-test-id*="Modal"]'))
      .map(el => ({
        tag: el.tagName,
        role: el.getAttribute('role'),
        ariaModal: el.getAttribute('aria-modal'),
        testId: el.getAttribute('data-test-id'),
        cls: (el.className || '').toString().slice(0, 80),
      }));

    const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'))
      .map(el => ({
        text: (el.innerText || '').trim().slice(0, 30),
        aria: (el.getAttribute('aria-label') || '').trim().slice(0, 40),
        testId: el.getAttribute('data-test-id'),
        inModal: isInModal(el),
      }))
      .filter(b => (b.text || b.aria));

    // 视觉上位于弹窗右下的红色按钮（按 rect 找）
    const rects = Array.from(document.querySelectorAll('button, div[role="button"]'))
      .map(el => {
        const r = el.getBoundingClientRect();
        return { text: (el.innerText || '').trim().slice(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter(b => b.text && b.w > 60 && b.h > 40 && b.x > 500 && b.y > 450);

    return { modalCandidates, buttons, bottomRightButtons: rects };
  });

  console.log('[diag] 弹窗容器候选:', JSON.stringify(info.modalCandidates, null, 1));
  console.log('[diag] 所有按钮:', JSON.stringify(info.buttons, null, 1));
  console.log('[diag] 右下角按钮(可能是提交):', JSON.stringify(info.bottomRightButtons, null, 1));

  await page.screenshot({ path: '/tmp/pin-board-diag.png' });
  console.log('[diag] 截图: /tmp/pin-board-diag.png');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
