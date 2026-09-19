// 线上回归：bootstrap 首屏聚合接口 + initializeApp 幂等守卫
//  1) 正向：首页首屏只打 1 个 bootstrap（原来逐请求 + 3 次重复初始化 = 27 个），且渲染正常
//  2) 反向：故意让 bootstrap 返回 500，页面必须自动回落逐请求并照常渲染（不退化）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const OUT = path.join(__dirname, '..', 'screenshots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-boot-'));
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', userDataDir: profile,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
  await page.setUserAgent(UA);

  // 旁路 Service Worker：sw.js 对 fetch 走 cache-first 代理，经它转发的 API 请求
  // 不会出现在 page 的 request 事件里（会漏统计）。SW 对被测逻辑是透明的，
  // 这里绕开它才能数准首屏到底发了几个请求。
  try {
    const cdp = await page.createCDPSession();
    await cdp.send('Network.enable');
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    console.log('已旁路 Service Worker（CDP）');
  } catch (e) {
    console.log('CDP 旁路 SW 失败，改用运行时注销:', e.message);
  }

  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 200)));
  page.on('console', m => { const t = m.text(); if (t.includes('跳过重复调用')) console.log('[guard]', t); });

  // 请求按「导航周期」分桶：每次主 frame 导航开启新一轮，避免把登录页/重定向的
  // 请求混进首屏统计（这个项目踩过重复导航导致请求量翻倍的坑）
  let navSeq = 0;
  const navLog = [];
  page.on('framenavigated', f => {
    if (f !== page.mainFrame()) return;
    navSeq++;
    navLog.push({ n: navSeq, url: f.url() });
    console.log('[nav] #' + navSeq, f.url());
  });
  let calls = [];
  page.on('request', req => {
    const u = req.url();
    if (u.includes('/api/index.php')) {
      calls.push({ a: (u.split('action=')[1] || '').split('&')[0], nav: navSeq });
    }
  });

  // 等页面稳定：连续 1.5s 没有新导航、也没有新 API 请求
  const waitSettled = async (ms = 1500, max = 25000) => {
    const t0 = Date.now();
    let lastLen = calls.length, lastNav = navSeq, lastChange = Date.now();
    while (Date.now() - t0 < max) {
      await sleep(300);
      if (calls.length !== lastLen || navSeq !== lastNav) {
        lastLen = calls.length; lastNav = navSeq; lastChange = Date.now();
      } else if (Date.now() - lastChange >= ms) return true;
    }
    return false;
  };
  const lastPeriod = () => calls.filter(c => c.nav === navSeq).map(c => c.a);
  const periodCount = () => calls.filter(c => c.nav === navSeq).length;
  const navsInPeriod = () => navLog.filter(n => n.n === navSeq).length;

  let pass = true;
  const check = (label, cond, extra = '') => {
    console.log((cond ? '✅ ' : '❌ ') + label + (extra ? '  ' + extra : ''));
    if (!cond) pass = false;
  };

  // 页面健康度快照：积分有值 + 记录卡在 + 8 个素养分类 + V2 成长之花已渲染
  const snapshot = () => page.evaluate(() => {
    const txt = id => { const el = document.getElementById(id); return el ? el.textContent.trim() : null; };
    return {
      points: txt('current-points'),
      hasQuickAdd: !!document.getElementById('qb-desc'),
      catCount: document.querySelectorAll('#qb-cat option').length,
      v2Rendered: !!document.querySelector('.v2-flower, #v2-flower, .flower-wrap'),
      bodyLen: document.body.innerText.trim().length,
    };
  });

  try {
    // ── 准备账号（临时账号，用完即删）──────────────────────
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#login-email', { timeout: 20000 });

    const email = 'sr.boot.' + Math.floor(Date.now() / 1000) + '@example.com';
    const passwd = 'TestPass123!';
    const reg = await page.evaluate(async (e, p) => {
      try {
        const res = await fetch('/api/index.php?action=register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password: p, consent: true }) });
        return await res.json();
      } catch (err) { return { error: String(err) }; }
    }, email, passwd);
    const token = reg && reg.token;
    console.log('临时账号:', email, token ? '(已注册)' : JSON.stringify(reg).slice(0, 160));
    if (!token) throw new Error('注册失败，无法继续');

    await page.evaluate((t, e) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_email', e);
    }, token, email);
    // 清掉 Service Worker，让每轮都走真实网络（避免 SW 缓存干扰请求统计）
    await page.evaluate(async () => {
      if (navigator.serviceWorker) {
        const rs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(rs.map(r => r.unregister()));
      }
      if (window.caches) { const ks = await caches.keys(); await Promise.all(ks.map(k => caches.delete(k))); }
    });

    // ── 正向：首屏请求数与渲染 ──────────────────────────
    console.log('\n───── 正向：首屏加载 ─────');
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await waitSettled();
    await sleep(2000);

    const bootCalls = lastPeriod().filter(a => a === 'bootstrap').length;
    const total = periodCount();
    const distinct = [...new Set(lastPeriod())];
    console.log('末次导航周期 API 请求(' + total + '):', JSON.stringify(lastPeriod()));
    check('initializeApp 只跑一次（无重复导航）', navsInPeriod() === 1, '导航数=' + navsInPeriod());
    check('首屏打到 bootstrap 聚合接口', bootCalls === 1, '次数=' + bootCalls);
    check('首屏 API 请求数 <= 4（修复前 27）', total <= 4, '实际=' + total);
    check('不再逐个拉取 profile/behaviors/gifts', !distinct.includes('getProfile') && !distinct.includes('getBehaviors') && !distinct.includes('getGifts'), '实际=' + JSON.stringify(distinct));

    const snap = await snapshot();
    console.log('渲染快照:', JSON.stringify(snap));
    check('积分已渲染', snap.points !== null && snap.points !== '', '值=' + snap.points);
    check('记录卡存在', snap.hasQuickAdd);
    check('8 个素养分类已渲染', snap.catCount === 8, '实际=' + snap.catCount);
    check('V2 成长之花已渲染', snap.v2Rendered);
    check('无 JS 运行时错误', pageErrors.length === 0, pageErrors.join(' | '));

    await page.screenshot({ path: path.join(OUT, 'bootstrap-ok.png') });

    // ── 反向：聚合接口故障时必须回退且不退化 ─────────────
    console.log('\n───── 反向：bootstrap 返回 500 ─────');
    await page.setRequestInterception(true);
    page.on('request', req => {
      if (req.url().includes('action=bootstrap')) {
        req.respond({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'simulated outage' }) });
      } else {
        req.continue();
      }
    });

    pageErrors.length = 0;
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 });
    await waitSettled();
    await sleep(2000);

    const fbPeriod = lastPeriod();
    console.log('回退场景 API 请求(' + fbPeriod.length + '):', JSON.stringify(fbPeriod));
    check('已回落到逐请求路径', fbPeriod.includes('getProfile') && fbPeriod.includes('getBehaviors'), '实际=' + JSON.stringify([...new Set(fbPeriod)]));

    const snap2 = await snapshot();
    console.log('回退渲染快照:', JSON.stringify(snap2));
    check('回退后积分仍正常渲染', snap2.points !== null && snap2.points !== '', '值=' + snap2.points);
    check('回退后记录卡仍存在', snap2.hasQuickAdd);
    check('回退后 V2 仍渲染', snap2.v2Rendered);
    check('回退后无未捕获 JS 错误', pageErrors.length === 0, pageErrors.join(' | '));

    await page.screenshot({ path: path.join(OUT, 'bootstrap-fallback.png') });

    console.log('\n' + (pass ? '✅ 全部通过' : '❌ 存在失败项'));

    // ── 自清理 ────────────────────────────────────────
    const del = await fetch(`${BASE}/api/index.php?action=delete_account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ confirm: 'DELETE' }),
    }).then(r => r.json()).catch(e => ({ error: String(e) }));
    console.log('临时账号清理:', email, JSON.stringify(del));
  } finally {
    await browser.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
  process.exit(pass ? 0 : 1);
})();
