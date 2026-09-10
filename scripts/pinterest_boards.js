// 建 Pinterest 画板（用户名 ujpu7859）
// 关键教训：Pinterest 是 React 应用，DOM 上的 el.click() 对弹窗提交按钮不可靠，
//           必须用 puppeteer 真实鼠标点击（page.click / elementHandle.click）。
//           弹窗提交按钮选择器： [data-test-id="board-form-submit-button"]
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

// 用真实鼠标点击第一个匹配文案的元素（React 才认）
async function realClick(page, words, skipAria = []) {
  const handles = await page.$$('button, div[role="button"], a, [role="menuitem"]');
  for (const h of handles) {
    const info = await h.evaluate(el => ({
      t: (el.innerText || '').trim().toLowerCase(),
      a: (el.getAttribute('aria-label') || '').trim().toLowerCase(),
    })).catch(() => null);
    if (!info || (!info.t && !info.a)) continue;
    if (skipAria.some(x => info.a.includes(x))) continue;
    if (words.some(w => info.t === w || info.t.startsWith(w) || info.a.includes(w))) {
      try { await h.click(); return info.t || info.a; } catch (e) { /* 元素不可点则跳过 */ }
    }
  }
  return null;
}

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

      const has = await page.evaluate((n) =>
        (document.body ? document.body.innerText : '').toLowerCase().includes(n.toLowerCase()), name);
      if (has) { log('已存在，跳过:', name); created.push(name + ' (已存在)'); continue; }

      // 1) 顶部 Create 菜单（真实点击）
      let ok = false;
      const createBtn = await page.$('[aria-label="Create a Pin or a board"]');
      if (createBtn) { await createBtn.click(); ok = true; }
      if (!ok) { failed.push({ board: name, why: '找不到 Create 入口' }); continue; }
      await sleep(3000);

      // 2) 菜单里选 Board（真实点击，且不要点回入口）
      const picked = await realClick(page, ['board'], ['pin or a board']);
      if (!picked) { failed.push({ board: name, why: '菜单里找不到 Board' }); continue; }
      await sleep(3500);

      // 3) 填名
      const input = await page.$('[role="dialog"] input, [aria-modal="true"] input');
      if (!input) { failed.push({ board: name, why: '弹窗内找不到输入框' }); continue; }
      await input.click();
      await page.keyboard.type(name, { delay: 30 });
      await sleep(1200);

      // 4) 真实点击提交按钮（test-id 最稳）
      const submit = await page.$('[data-test-id="board-form-submit-button"]')
        || await page.$('[role="dialog"] button[type="submit"]');
      if (!submit) { failed.push({ board: name, why: '找不到提交按钮' }); continue; }
      await submit.click();
      log('已点击提交');
      await sleep(6000);

      // 5) 独立复核
      await page.goto(`https://www.pinterest.com/${USER}/_created/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await sleep(5000);
      const really = await page.evaluate((n) =>
        (document.body ? document.body.innerText : '').toLowerCase().includes(n.toLowerCase()), name);
      if (really) { created.push(name); log('✅ 复核通过:', name); }
      else { failed.push({ board: name, why: '已提交但复核未出现' }); log('⚠️ 复核失败:', name); }

    } catch (e) {
      log('本轮异常:', e.message);
      failed.push({ board: name, why: '异常: ' + e.message });
      try { await page.close(); } catch (e2) {}
      try { page = await browser.newPage(); } catch (e3) { break; }
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
