// 建 Pinterest 画板（用户名 ujpu7859）
// 每个板独立 try/catch：Pinterest 点击常触发导航导致 frame detach，单个失败不影响其他
// 每个板建完都去 _created 页独立复核，不拿「点击成功」当成功
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const OUT = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-boards.json';

const USER = process.argv[2] || 'ujpu7859';
const BOARDS = [
  'Kids Reward Chart Ideas',
  'Star Chart for Kids',
  'Habit Building for Children',
  'Chore Chart & Responsibility',
  'Parenting Reward Ideas',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[boards]', ...a);
const SCOPE = '[role="dialog"], div[aria-modal="true"]';

(async () => {
  const out = { user: USER, startedAt: new Date().toISOString() };
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  let page = (await browser.pages())[0] || await browser.newPage();
  const created = [];
  const failed = [];

  for (let i = 0; i < BOARDS.length; i++) {
    const name = BOARDS[i];
    log(`--- 建板 ${i + 1}/${BOARDS.length}: ${name} ---`);
    try {
      await page.goto(`https://www.pinterest.com/${USER}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(4000);

      // 已存在则跳过
      const has = await page.evaluate((n) =>
        (document.body ? document.body.innerText : '').toLowerCase().includes(n.toLowerCase()), name);
      if (has) { log('已存在，跳过:', name); created.push(name + ' (已存在)'); continue; }

      // 1) 点顶部 Create（aria: Create a Pin or a board）
      const opened = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, div[role="button"], a'));
        for (const el of els) {
          const a = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          const t = (el.innerText || '').trim().toLowerCase();
          if (a.includes('pin or a board') || t === 'create') { el.click(); return t || a; }
        }
        return null;
      });
      if (!opened) { failed.push({ board: name, why: '找不到 Create 入口' }); continue; }
      await sleep(3000);

      // 2) 菜单里选 Board
      const picked = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('button, div[role="button"], a, [role="menuitem"]'));
        for (const el of els) {
          const t = (el.innerText || '').trim().toLowerCase();
          const a = (el.getAttribute('aria-label') || '').trim().toLowerCase();
          if (a.includes('pin or a board')) continue;
          if (t === 'board' || t.includes('create board') || a.includes('create board')) { el.click(); return t || a; }
        }
        return null;
      });
      if (!picked) { failed.push({ board: name, why: '菜单里找不到 Board' }); continue; }
      await sleep(3500);

      // 3) 弹窗内填名（必须限定作用域，否则点到顶部导航的 Create）
      const typed = await page.evaluate((SCOPE) => {
        const roots = Array.from(document.querySelectorAll(SCOPE));
        const scope = roots.length ? roots[roots.length - 1] : document;
        for (const inp of Array.from(scope.querySelectorAll('input, textarea'))) {
          const s = [inp.placeholder || '', inp.getAttribute('aria-label') || '',
                     inp.name || '', inp.id || ''].join(' ').toLowerCase();
          if (/board|name|title/.test(s)) { inp.focus(); return true; }
        }
        return false;
      }, SCOPE);
      if (!typed) { failed.push({ board: name, why: '弹窗内找不到名称输入框' }); continue; }
      await page.keyboard.type(name, { delay: 35 });
      await sleep(1200);

      // 4) 弹窗内提交
      const done = await page.evaluate((SCOPE) => {
        const roots = Array.from(document.querySelectorAll(SCOPE));
        const scope = roots.length ? roots[roots.length - 1] : document;
        for (const el of Array.from(scope.querySelectorAll('button, div[role="button"]'))) {
          const t = (el.innerText || '').trim().toLowerCase();
          if (t === 'create' || t === 'done' || t === 'save' || t === 'create board') { el.click(); return t; }
        }
        return null;
      }, SCOPE);
      if (!done) { failed.push({ board: name, why: '弹窗内找不到提交按钮' }); continue; }
      await sleep(4500);

      // 5) 独立复核
      await page.goto(`https://www.pinterest.com/${USER}/_created/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(4000);
      const really = await page.evaluate((n) =>
        (document.body ? document.body.innerText : '').toLowerCase().includes(n.toLowerCase()), name);
      if (really) { created.push(name); log('✅ 复核通过:', name); }
      else { failed.push({ board: name, why: '已提交但复核未出现' }); log('⚠️ 复核失败:', name); }

    } catch (e) {
      log('本轮异常:', e.message);
      failed.push({ board: name, why: '异常: ' + e.message });
      try { await page.close(); } catch (e2) {}
      try { page = await browser.newPage(); } catch (e3) { log('重建页面失败'); break; }
    }
  }

  out.created = created;
  out.failed = failed;
  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  log('=========================');
  log('成功:', JSON.stringify(created));
  log('失败:', JSON.stringify(failed));
  log('=========================');
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
