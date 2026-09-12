// 修复已发布但缺「标题 + 目标链接」的 Pin：编辑补全
// 用法: node scripts/pinterest_fix_links.js [--limit N]
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const QUEUE = '/Users/work/code/Star-Rewards/assets/pins/pins.json';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const USER = 'ujpu7859';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[fix]', ...a);

const limitArg = process.argv.indexOf('--limit');
const LIMIT = limitArg > -1 ? parseInt(process.argv[limitArg + 1], 10) : 99;
const onlyArg = process.argv.indexOf('--only');
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null;

const norm = s => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

// 幂等填写：先清空再输入（否则重复跑会把值叠加成双份 —— 踩过）
// 注意：Meta+A 在这些受控输入框里实测无效（值会叠加），改用 focus+select，并回读确认清空
async function setField(page, sel, value) {
  const el = await page.$(sel);
  if (!el) return false;
  await el.click();
  await el.evaluate(e => { e.focus(); e.select(); }).catch(() => {});
  await page.keyboard.press('Backspace');
  await sleep(350);
  const cleared = await page.evaluate(s => { const e = document.querySelector(s); return e ? e.value === '' : false; }, sel);
  if (!cleared) {
    await page.evaluate(s => {
      const e = document.querySelector(s);
      const proto = e.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, '');
      e.dispatchEvent(new Event('input', { bubbles: true }));
    }, sel);
    await sleep(350);
  }
  await el.type(value, { delay: 15 });
  return true;
}

async function probeLoggedIn(browser) {
  const p = await browser.newPage();
  try {
    await p.goto('https://www.pinterest.com/settings/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    return /settings/.test(p.url()) && !/Join Pinterest|Log in to discover/i.test(await p.evaluate(() => document.body ? document.body.innerText : ''));
  } catch (e) { return false; } finally { try { await p.close(); } catch (e) {} }
}

// 从 Pin 详情页读出描述（"Description" 标签后的第一行）
function extractDescription(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const i = lines.findIndex(l => l === 'Description' || l === '描述');
  if (i > -1 && lines[i + 1]) return lines[i + 1];
  return '';
}

(async () => {
  const queue = JSON.parse(fs.readFileSync(QUEUE, 'utf8'));
  const ids = JSON.parse(fs.readFileSync('/tmp/pin-urls.json', 'utf8'))
    .filter(u => !ONLY || u.includes(ONLY));

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1400,1100'],
  });
  try {
    if (!(await probeLoggedIn(browser))) { console.error('NEED_LOGIN'); process.exit(10); }
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    fs.mkdirSync('/tmp/fixshots', { recursive: true });
    const shot = n => page.screenshot({ path: `/tmp/fixshots/${n}.png` }).catch(() => {});

    let done = 0, skipped = 0;
    for (const pinUrl of ids) {
      if (done >= LIMIT) break;
      const id = pinUrl.match(/\/pin\/(\w+)/)[1];
      try {
        await page.goto(pinUrl, { waitUntil: 'networkidle2', timeout: 45000 });
        await sleep(8000);
        const text = await page.evaluate(() => document.body ? document.body.innerText : '');
        // 非本人 Pin 会直接跳到别人的 pin 页；描述匹配不到就跳过
        const desc = extractDescription(text);
        const item = queue.find(q => desc && norm(q.description) && norm(desc).startsWith(norm(q.description).slice(0, 25)));
        if (!item) { log('pin/' + id, '→ 无法匹配 queue（非本人 Pin），跳过 | 描述:', JSON.stringify(desc.slice(0, 50))); skipped++; continue; }
        log('pin/' + id, '→ 匹配:', JSON.stringify(item.pin_title || item.title));

        // 打开「More actions」菜单（Pin 的 ...）
        const more = (await page.$$('[aria-label="More actions"]'))[0];
        if (!more) { log('   ⚠️ 找不到 More actions，跳过'); skipped++; continue; }
        await more.click();
        await sleep(3000);
        await shot('menu-' + id);

        // 点 Edit Pin
        let opened = false;
        for (const h of await page.$$('div,button,span')) {
          const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
          if (t === 'Edit Pin' || t === 'Edit') { await h.click(); opened = true; break; }
        }
        if (!opened) { log('   ⚠️ 找不到 Edit Pin，跳过'); skipped++; continue; }
        await sleep(7000);
        await shot('form-' + id);

        // 填标题（编辑弹窗真实 id：#TitleField）—— 幂等清空后重填
        const wantTitle = String(item.pin_title || item.title);
        if (await setField(page, '#TitleField', wantTitle)) log('   已填标题');
        else log('   ⚠️ 找不到 #TitleField');

        // 填目标链接（编辑弹窗真实 id：#WebsiteField —— 标签就叫 "Website"）
        if (!(await setField(page, '#WebsiteField', item.url))) { log('   ⚠️ 找不到 #WebsiteField，跳过'); skipped++; continue; }
        log('   已填链接:', item.url);

        // 回读校验（不能凭"输入没报错"就当成功）
        const rb = await page.evaluate(() => {
          const g = id => { const e = document.getElementById(id); return e ? (e.value || '') : ''; };
          return { t: g('TitleField'), l: g('WebsiteField') };
        });
        log('   回读 → 标题:', JSON.stringify(rb.t), '| 链接:', JSON.stringify(rb.l));
        // 严格相等校验：只"包含"不够 —— 叠加成双份时也包含旧值，必须完全一致
        if (norm(rb.l) !== norm(item.url)) { log('   ❌ 链接值与预期不符（可能叠加），跳过保存'); skipped++; continue; }
        if (norm(rb.t) !== norm(wantTitle)) { log('   ❌ 标题值与预期不符，跳过保存'); skipped++; continue; }

        // 保存 —— ⚠️ 必须限定在编辑弹窗内！
        // 踩过：Pin 详情页本身也有一个文案为 "Save" 的按钮（保存到画板，inDialog=false），
        // 不限作用域就会先点到它 → 弹窗没提交、改动全部丢失，而日志却报"已保存"
        let saved = false;
        for (const h of await page.$$('[role="dialog"] button, [role="dialog"] [role="button"]')) {
          const t = await h.evaluate(el => (el.innerText || '').trim()).catch(() => null);
          if (t === 'Save') { try { await h.click(); saved = true; break; } catch (e) {} }
        }
        if (!saved) {
          // 兜底：按坐标点弹窗右下角的 Save（实测位置约 708,524）
          log('   ⚠️ 弹窗内 Save 未命中，改用坐标点击');
          await page.mouse.click(708, 524); saved = true;
        }
        await sleep(6000);
        // 成功信号：编辑弹窗关闭（#WebsiteField 消失）
        const dialogClosed = await page.evaluate(() => !document.getElementById('WebsiteField'));
        await shot('saved-' + id);
        log('   ' + (saved && dialogClosed ? '✅ 已保存（弹窗已关闭）' : '⚠️ 保存后弹窗未关闭，可能失败'));
        done++;
      } catch (e) {
        log('pin/' + id, '异常:', e.message);
        skipped++;
      }
    }
    console.log('DONE edited=' + done + ' skipped=' + skipped);
    await sleep(1000);
  } finally { await browser.close(); }
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
