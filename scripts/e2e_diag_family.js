// 诊断：注册后 currentFamily / getFamily() 返回结构（定位 invite_link 为空的根因）
const fs = require('fs');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const UD = process.env.QA_UD, EMAIL = process.env.QA_EMAIL, PASS = process.env.QA_PASS;
const LOG = `${UD}/diag.log`;
function log(s){ fs.appendFileSync(LOG, s+'\n'); }
fs.writeFileSync(LOG, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: UD, args: ['--no-sandbox','--disable-setuid-sandbox',`--user-agent=${UA}`,'--window-size=430,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width:430, height:900, isMobile:true });
  page.on('dialog', async d => { try{ await d.accept(); }catch(e){} });
  page.on('pageerror', e => log('[pageerror] '+e.message));
  page.on('console', m => { if (m.type()==='error') log('[console.error] '+m.text()); });

  await page.goto(`${BASE}/login.html`, { waitUntil:'domcontentloaded', timeout:30000 });
  await page.waitForSelector('#register-email', { timeout:15000 });
  await page.type('#register-email', EMAIL);
  await page.type('#register-password', PASS);
  await page.click('#register-consent');
  await page.click('#register-form button[onclick^="handleSignUp"]');
  await page.waitForFunction(() => location.pathname.endsWith('index.html'), { timeout:20000 }).catch(()=>log('nav timeout'));
  await sleep(5000);
  log('URL=' + page.url());

  const state = await page.evaluate(() => ({
    cfType: typeof window.currentFamily,
    cfNull: (window.currentFamily === null),
    cfKeys: (window.currentFamily ? Object.keys(window.currentFamily) : null),
    famInviteLink: (window.currentFamily && window.currentFamily.family) ? window.currentFamily.family.invite_link : 'N/A',
    topInviteLink: (window.currentFamily ? window.currentFamily.invite_link : 'N/A'),
    token: !!localStorage.getItem('auth_token'),
  }));
  log('STATE=' + JSON.stringify(state));

  // 直接调 getFamily 看后端返回
  const gf = await page.evaluate(async () => {
    try { const r = await api.getFamily(); return JSON.stringify(r).slice(0, 600); }
    catch (e) { return 'ERR:' + (e.message||e); }
  });
  log('GETFAMILY=' + gf);
  await browser.close();
  log('DONE');
})().catch(e => { log('FATAL:'+e.message); process.exit(1); });
