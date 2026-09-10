// 用智能体邮箱 ujpu7859@agent.qq.com 自主注册 Pinterest Business 账号
// 流程：填注册表单 → 走完商家引导 → 真实校验登录态 → 存凭据
// 遇到验证码会暂停并等你手动过（浏览器可见窗口）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PROFILE = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-profile';
const CREDS = '/Users/work/code/Star-Rewards/.workbuddy/pinterest-credentials.json';

const EMAIL = 'ujpu7859@agent.qq.com';
const PASSWORD = 'StarRw2026#Pin9';
const BIRTHDAY = '05/14/1985';      // 展示用
const BIRTHDAY_ISO = '1985-05-14';  // input[type=date] 需要 ISO
const BIZ_NAME = 'Star Rewards';
const WEBSITE = 'https://stellar.gaocaihk.com';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log('[register]', ...a);

// ---------- 真实登录校验 ----------
async function probeLoggedIn(browser) {
  let p;
  try {
    p = await browser.newPage();
    await p.goto('https://www.pinterest.com/settings/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500);
    const onSettings = /pinterest\.com\/settings/.test(p.url());
    const text = await p.evaluate(() => (document.body ? document.body.innerText : '').slice(0, 3000));
    const loggedOut = /Join Pinterest for free|Log in to discover more ideas|Sign up/i.test(text);
    return onSettings && !loggedOut;
  } catch (e) { return false; }
  finally { try { if (p) await p.close(); } catch (e) {} }
}

async function safeDump(page, label) {
  try {
    const info = await page.evaluate(() => ({
      url: location.href,
      inputs: Array.from(document.querySelectorAll('input')).slice(0, 12).map(i => ({
        type: i.type, name: i.name, ph: i.placeholder, id: i.id,
      })),
      buttons: Array.from(document.querySelectorAll('button')).map(b => (b.innerText || '').trim()).filter(Boolean).slice(0, 12),
      captcha: /captcha|recaptcha|verify you|press and hold/i.test(document.body ? document.body.innerText : ''),
      text: (document.body ? document.body.innerText : '').replace(/\s+/g, ' ').slice(0, 600),
    }));
    log(`--- ${label} ---`);
    log('url:', info.url);
    log('captcha:', info.captcha);
    log('buttons:', JSON.stringify(info.buttons));
    log('text:', info.text);
    return info;
  } catch (e) { log(`dump(${label}) 失败:`, e.message); return null; }
}

async function safeShot(page, name) {
  try { await page.screenshot({ path: `/tmp/pin-reg-${name}.png` }); } catch (e) { log('截图失败:', e.message); }
}

async function fillByHint(page, hints, value) {
  const idx = await page.evaluate((hints) => {
    const inputs = Array.from(document.querySelectorAll('input'));
    for (let i = 0; i < inputs.length; i++) {
      const s = [
        inputs[i].placeholder || '', inputs[i].getAttribute('aria-label') || '',
        inputs[i].name || '', inputs[i].id || '', inputs[i].type || '',
      ].join(' ').toLowerCase();
      if (hints.some(h => s.includes(h))) return i;
    }
    return -1;
  }, hints);
  if (idx < 0) return false;
  const inputs = await page.$$('input');
  if (!inputs[idx]) return false;
  await inputs[idx].click();
  await inputs[idx].type(value, { delay: 25 });
  return true;
}

// input[type=date] 必须用 JS 设值（React 受控组件，需要原生 setter + 事件）
async function fillDateInput(page, iso) {
  return await page.evaluate((iso) => {
    const el = document.querySelector('input[type="date"], input#birthdate, input[name="birthdate"]');
    if (!el) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, iso);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return true;
  }, iso);
}

// exclude：排除 "Skip to content" 这类无障碍链接（误点会导致页面跳转/frame detach）
async function clickByText(page, words, exclude = ['skip to content']) {
  return await page.evaluate((words, exclude) => {
    const els = Array.from(document.querySelectorAll('button, a, div[role="button"], input[type="submit"]'));
    for (const el of els) {
      const t = (el.innerText || el.textContent || el.value || '').trim().toLowerCase();
      if (!t) continue;
      if (exclude.some(x => t.includes(x))) continue;
      if (words.some(w => t === w || t.startsWith(w))) { el.click(); return t; }
    }
    return null;
  }, words, exclude);
}

// ---------- 主流程 ----------
(async () => {
  const out = { email: EMAIL, startedAt: new Date().toISOString() };

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: false, userDataDir: PROFILE,
    args: ['--no-sandbox', '--window-size=1280,950'],
  });
  let page = (await browser.pages())[0] || await browser.newPage();

  if (await probeLoggedIn(browser)) {
    log('✅ 已处于登录态，无需注册。');
    out.alreadyLoggedIn = true;
    out.loggedIn = true;
    fs.writeFileSync(CREDS, JSON.stringify(out, null, 2));
    await browser.close();
    return;
  }

  log('打开商家注册页…');
  await page.goto('https://www.pinterest.com/business/create/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(3500);
  await safeDump(page, '注册表单');

  await fillByHint(page, ['email'], EMAIL);   log('填邮箱: ok');
  await fillByHint(page, ['password'], PASSWORD); log('填密码: ok');
  const okDate = await fillDateInput(page, BIRTHDAY_ISO);
  log('填生日:', okDate ? 'ok' : '失败', BIRTHDAY_ISO);

  const dateVal = await page.evaluate(() => {
    const el = document.querySelector('input[type="date"], input#birthdate');
    return el ? el.value : null;
  });
  log('生日字段回读:', dateVal);

  const clicked = await clickByText(page, ['create account', 'sign up', 'continue', 'get started']);
  log('点击提交:', clicked);
  await sleep(8000);

  // 引导流程
  for (let step = 0; step < 10; step++) {
    if (await probeLoggedIn(browser)) { log('✅ 已登录，跳出引导。'); break; }

    // frame detach 后重建 page
    try { await page.evaluate(() => 1); }
    catch (e) { log('页面已失效，重建…'); page = await browser.newPage(); }

    const info = await safeDump(page, `引导 step${step}`);
    await safeShot(page, `step${step}`);

    if (info && info.captcha) {
      log('⚠️ 检测到人机验证。请在浏览器窗口手动完成，最多等 10 分钟…');
      for (let w = 0; w < 120; w++) {
        await sleep(5000);
        if (await probeLoggedIn(browser)) { log('✅ 验证通过，已登录。'); break; }
      }
      break;
    }

    await fillByHint(page, ['business name', 'business'], BIZ_NAME);
    await fillByHint(page, ['website', 'site url', 'url'], WEBSITE);

    const next = await clickByText(page, ['next', 'continue', 'done', 'finish', 'save', 'skip']);
    log(`step${step} 点击:`, next);
    if (!next) { log('无可点按钮，停止引导循环。'); break; }
    await sleep(4500);
  }

  const loggedIn = await probeLoggedIn(browser);
  out.loggedIn = loggedIn;
  out.password = PASSWORD;
  out.birthday = BIRTHDAY;
  out.businessName = BIZ_NAME;
  out.website = WEBSITE;
  out.finishedAt = new Date().toISOString();
  fs.writeFileSync(CREDS, JSON.stringify(out, null, 2));

  log('=====================================');
  log('登录态:', loggedIn ? '✅ 已登录' : '❌ 未登录');
  log('账号:', EMAIL, ' 密码:', PASSWORD);
  log('凭据:', CREDS);
  log('=====================================');
  log('浏览器保持打开 90 秒供检查…');
  await sleep(90000);
  await browser.close();
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
