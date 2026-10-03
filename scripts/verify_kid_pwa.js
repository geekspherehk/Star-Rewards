#!/usr/bin/env node
// 孩子端「能装到桌面吗」的运行时验收（不建号、不发数据，只读线上）。
// Chrome 的 PWA 可安装判定是浏览器运行时做的：manifest + SW + 图标 + HTTPS 三样齐才在
// ⋮ 菜单里出现「安装应用」。curl 只能看文件在不在，必须真开浏览器看 SW 有没有装上。
// 用法: node scripts/verify_kid_pwa.js
const puppeteer = require('puppeteer-core');

const R = 'https://stellar.gaocaihk.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = m => { pass++; console.log('  ✔ ' + m); };
const bad = (m, x) => { fail++; console.log('  ✘ ' + m + (x ? ' → ' + x : '')); };

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });

  // 这一次不能 bypass SW：要的就是 SW 真的装上
  await page.goto(R + '/kid.html', { waitUntil: 'networkidle2', timeout: 45000 });
  await sleep(3000);

  console.log('\n== A. 孩子端 PWA 可安装性（真实浏览器）==');
  // SW 刚注册时可能还在 installing，要等它进 active（Chrome 判定可安装看的是 active）
  let info = null;
  for (let i = 0; i < 12 && (!info || !info.active.length); i++) {
    info = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const one = r => ({
        script: (r.active || r.installing || r.waiting || {}).scriptURL || '',
        scope: r.scope || '',
        state: (r.installing && 'installing') || (r.waiting && 'waiting') || (r.active && 'active') || '?',
      });
      const mLink = document.querySelector('link[rel="manifest"]');
      return {
        https: location.protocol === 'https:',
        regs: regs.length,
        active: regs.filter(r => r.active).map(one),
        any: regs.map(one),
        manifest: mLink ? new URL(mLink.href, location.href).pathname : null,
      };
    });
    if (!info.active.length) await sleep(1500);
  }
  info.https ? ok('站点是 HTTPS') : bad('站点不是 HTTPS', info.https);
  info.regs > 0 ? ok(`Service Worker 已注册（${info.regs} 条）`) : bad('Service Worker 没注册');
  const hit = (info.active || []).find(a => /sw\.js/.test(a.script || ''));
  hit ? ok(`SW active: ${hit.script} scope=${hit.scope}`) : bad('没有 active 的 sw.js registration', JSON.stringify(info.any));
  info.manifest === '/manifest-kid.json' ? ok('manifest-kid.json 已挂在页面上') : bad('manifest 链接不对', info.manifest);

  // manifest 内容（图标 / display / start_url）决定图标长什么样、点开是不是全屏
  const mf = await page.evaluate(async () => {
    try { return await (await fetch('/manifest-kid.json', { cache: 'no-store' })).json(); } catch (e) { return null; }
  });
  if (!mf) { bad('manifest 取不到'); }
  else {
    mf.display === 'standalone' ? ok('display=standalone（装完没有地址栏）') : bad('display 不是 standalone', mf.display);
    const sizes = (mf.icons || []).map(i => i.sizes).join(',');
    /192x192/.test(sizes) && /512x512/.test(sizes) ? ok('图标有 192 + 512') : bad('图标缺 192/512', sizes);
    (mf.icons || []).some(i => /maskable/.test(i.purpose || '')) ? ok('有 maskable 图标（安卓不会白边）') : bad('缺 maskable 图标');
    ok('应用名: ' + (mf.short_name || mf.name));
  }

  await page.screenshot({ path: require('path').join(__dirname, '..', 'shots', 'live-kid-pwa.png') });
  await browser.close();
  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  process.exit(fail ? 1 : 0);
})();
