// 线上回归：首页「记录一次行为」是否真的加分并写入 dimension
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ACCOUNT = { email: 'sr.test.owner.1786462308@example.com', pass: 'TestPass123!' };
const OUT = path.join(__dirname, '..', 'screenshots');
const DESC = 'E2E验证·自主记录积分';

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-e2e-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir: profile,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
  await page.setUserAgent(UA);

  try {
    page.on('console', m => { if (m.type() === 'error') console.log('[console]', m.text().slice(0, 200)); });
    await page.goto(BASE + '/login.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });

    // 测试账号可能已被清理 → 先试登录，失败则自动注册一个新的一次性账号
    const tryLogin = async (email, pass) => {
      const r = await page.evaluate(async (e, p) => {
        try { const res = await fetch('/api/index.php?action=login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p }) }); return await res.json(); }
        catch (err) { return { error: String(err) }; }
      }, email, pass);
      if (r && r.token) { await page.evaluate((t, em) => { localStorage.setItem('auth_token', t); localStorage.setItem('user_email', em); }, r.token, email); return true; }
      console.log('登录失败:', email, JSON.stringify(r).slice(0, 120));
      return false;
    };

    let email = ACCOUNT.email, pass = ACCOUNT.pass, token = null, tempAccount = false;
    if (!await tryLogin(email, pass)) {
      email = 'sr.e2e.' + Math.floor(Date.now() / 1000) + '@example.com';
      pass = 'TestPass123!';
      const reg = await page.evaluate(async (e, p) => {
        try { const res = await fetch('/api/index.php?action=register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p, consent: true }) }); return await res.json(); }
        catch (err) { return { error: String(err) }; }
      }, email, pass);
      console.log('注册新测试账号:', email, JSON.stringify(reg).slice(0, 120));
      token = reg && reg.token;
      tempAccount = true;
      if (!await tryLogin(email, pass)) throw new Error('自动注册后仍无法登录');
    }
    console.log('使用账号:', email);

    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3000);
    console.log('首页 URL:', page.url(), '| 有 #qb-desc:', await page.evaluate(() => !!document.getElementById('qb-desc')));
    if (!(await page.evaluate(() => !!document.getElementById('qb-desc')))) {
      await page.screenshot({ path: path.join(OUT, 'e2e-debug.png'), fullPage: false });
      throw new Error('未进入首页（可能未登录成功）');
    }
    await sleep(2500);

    // 新账号会弹新手引导遮罩（.onboarding-modal, z-index 1000）；这里只做环境清理，
    // 用 JS 直接关闭，确保随后对被测按钮用的是「真实鼠标点击」而不是 JS 触发
    const obState = await page.evaluate(() => {
      const ob = document.getElementById('onboarding-modal');
      const before = ob ? getComputedStyle(ob).display : 'none';
      if (typeof dismissOnboarding === 'function') dismissOnboarding();
      if (ob) ob.style.display = 'none';
      return { before, after: ob ? getComputedStyle(ob).display : 'none' };
    });
    console.log('新手引导弹窗 display:', JSON.stringify(obState));
    await sleep(800);

    const before = await page.$eval('#current-points', el => el.textContent.trim());
    console.log('积分 before:', before, '| 分类下拉项数:', await page.$$eval('#qb-cat option', o => o.length));

    await page.click('#qb-desc');
    await page.type('#qb-desc', DESC);
    await page.$eval('#qb-pts', el => { el.value = ''; });
    await page.type('#qb-pts', '3');

    const apiCalls = [];
    const onResp = async r => {
      const u = r.url();
      if (u.includes('/api/index.php')) {
        let body = '';
        try { body = (await r.text()).slice(0, 200); } catch (e) { }
        apiCalls.push({ action: (u.split('action=')[1] || '').split('&')[0], status: r.status(), body });
      }
    };
    page.on('response', onResp);
    page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));

    const btn = await page.$('.qb-save');
    await page.evaluate(() => document.querySelector('.qb-save').scrollIntoView({ block: 'center' }));
    await sleep(600);
    const box = await btn.boundingBox();
    const hit = await page.evaluate(b => {
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return el ? el.tagName + '.' + el.className + '#' + el.id : 'null';
    }, box);
    console.log('按钮位置:', JSON.stringify(box), '| 该点命中元素:', hit);
    if (!(hit && hit.includes('qb-save'))) {
      const stack = await page.evaluate(b => {
        const stack = document.elementsFromPoint(b.x + b.width / 2, b.y + b.height / 2);
        return stack.slice(0, 6).map(el => {
          const cs = getComputedStyle(el);
          return el.tagName + '.' + String(el.className).slice(0, 30) + ' pos=' + cs.position + ' z=' + cs.zIndex + ' rect=' + JSON.stringify(el.getBoundingClientRect()).slice(0, 90);
        });
      }, box);
      console.log('遮挡栈:', JSON.stringify(stack, null, 1));
    }
    if (hit && hit.includes('qb-save')) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      console.log('点击方式: 真实鼠标');
    } else {
      await btn.evaluate(el => el.click());
      console.log('点击方式: JS 兜底（按钮被遮挡）');
    }

    // 轮询抓提示（toast 会自动消失）
    let toast = null;
    for (let i = 0; i < 25; i++) {
      const t = await page.evaluate(() => {
        const el = document.querySelector('.temporary-message');
        return el ? { text: el.textContent.trim(), cls: el.className } : null;
      });
      if (t) { toast = t; break; }
      await sleep(200);
    }
    await sleep(1500);
    page.off('response', onResp);
    console.log('API 调用:', JSON.stringify(apiCalls));

    const after = await page.$eval('#current-points', el => el.textContent.trim());

    const latest = await page.evaluate(async () => {
      try {
        const rows = await api.getBehaviors();
        const list = Array.isArray(rows) ? rows : [];
        const hit = list.find(r => (r.description || '').includes('E2E验证'));
        return hit ? { description: hit.description, points: hit.points, dimension: hit.dimension, ts: hit.timestamp } : { none: true, count: list.length };
      } catch (e) { return { error: e.message }; }
    });

    await page.screenshot({ path: path.join(OUT, 'e2e-quick-add-fixed.png'), fullPage: false });

    console.log(JSON.stringify({ before, after, toast, latest }, null, 2));

    // 自清理：本次自动注册的临时账号用完即删（delete_account 级联清掉家庭/档案/行为记录/埋点）
    if (tempAccount && token) {
      const del = await fetch(`${BASE}/api/index.php?action=delete_account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: 'DELETE' }),
      }).then(r => r.json()).catch(e => ({ error: String(e) }));
      console.log('临时账号清理:', email, JSON.stringify(del));
    }
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})();
