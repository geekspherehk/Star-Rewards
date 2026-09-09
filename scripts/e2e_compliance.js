// 合规 P2 真实浏览器 E2E（puppeteer-core + 系统 Chrome）
// 进度写入文件，避免被 SIGKILL 时丢失；避免 networkidle2（PWA 永不 idle）
const fs = require('fs');
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const UD = process.env.QA_UD;
const EMAIL = process.env.QA_EMAIL;
const PASS = process.env.QA_PASS;
const PHASE = process.env.QA_PHASE || '1';
const LOG = `${UD}/e2e.log`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function log(s){ fs.appendFileSync(LOG, s + '\n'); }
fs.writeFileSync(LOG, '');

(async () => {
  log(`START phase=${PHASE} email=${EMAIL}`);
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: UD, args: ['--no-sandbox','--disable-setuid-sandbox',`--user-agent=${UA}`,'--window-size=430,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 900, isMobile: true });
  page.on('dialog', async d => { try { await d.accept(); } catch(e){} });
  page.on('pageerror', e => log('[pageerror] ' + e.message));

  if (PHASE === '1') {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#register-email', { timeout: 15000 });
    log('login page loaded');
    // 1) 不勾选同意 → 拦截
    await page.type('#register-email', 'NO' + EMAIL);
    await page.type('#register-password', PASS);
    await page.click('#register-form button[onclick^="handleSignUp"]');
    await sleep(1500);
    const blocked = await page.evaluate(() => document.body.innerText.includes('请先勾选监护人同意') || document.body.innerText.includes('consentRequired'));
    log('consentBlocked=' + blocked);
    // 2) 勾选同意 → 注册成功
    await page.evaluate(() => { document.getElementById('register-email').value=''; document.getElementById('register-password').value=''; });
    await page.type('#register-email', EMAIL);
    await page.type('#register-password', PASS);
    await page.click('#register-consent');
    await page.click('#register-form button[onclick^="handleSignUp"]');
    await page.waitForFunction(() => location.pathname.endsWith('index.html'), { timeout: 20000 }).catch(()=>log('wait index timeout'));
    await sleep(2500);
    const loggedIn = await page.evaluate(() => location.pathname.endsWith('index.html') && !!localStorage.getItem('auth_token'));
    log('registered=' + loggedIn);
    // 3) 分享链接域名
    // 注意：currentFamily 是 let 声明的全局词法绑定，挂在脚本作用域而非 window，
    // 必须用裸标识符读取（window.currentFamily 永远是 undefined）
    await page.waitForFunction(() => typeof currentFamily !== 'undefined' && currentFamily && currentFamily.family && currentFamily.family.invite_link, { timeout: 25000 }).catch(() => log('invite_link wait TIMEOUT'));
    const inviteLink = await page.evaluate(() => (typeof currentFamily !== 'undefined' && currentFamily && currentFamily.family && currentFamily.family.invite_link) || '');
    const linkOk = inviteLink.includes('stellar.gaocaihk.com') && inviteLink.includes('?invite=');
    log('inviteLinkOk=' + linkOk + ' link=' + inviteLink);
    // 4) 导出
    const exportOk = await page.evaluate(() => { try { exportData(); return 'ok'; } catch(e){ return 'ERR:'+e.message; } });
    log('exportOk=' + exportOk);
    // 5) 删除账号
    await page.evaluate(() => deleteMyAccount());
    await sleep(4000);
    const after = await page.evaluate(async () => { try { const p = await api.getProfile(); return 'STILL:'+JSON.stringify(p); } catch(e){ return 'GONE:'+(e.message||e); } });
    log('afterDelete=' + after);
    console.log(`PHASE1 consentBlocked=${blocked} registered=${loggedIn} inviteLinkOk=${linkOk} exportOk=${exportOk} afterDelete=${after}`);
    await page.screenshot({ path: `${UD}/phase1-compliance.png` });
  } else {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#register-email', { timeout: 15000 });
    await page.type('#register-email', EMAIL);
    await page.type('#register-password', PASS);
    await page.click('#register-consent');
    await page.click('#register-form button[onclick^="handleSignUp"]');
    await page.waitForFunction(() => location.pathname.endsWith('index.html'), { timeout: 20000 }).catch(()=>log('wait index timeout'));
    await sleep(2500);
    const famBefore = await page.evaluate(() => (typeof currentFamily !== 'undefined' && currentFamily && currentFamily.family && currentFamily.family.id) || null);
    log('famBefore=' + famBefore);
    await page.evaluate(() => { if (typeof openFamilyModal==='function') openFamilyModal(); });
    await sleep(800);
    const delBtnVisible = await page.evaluate(() => { const b=document.getElementById('family-delete-btn'); return b ? getComputedStyle(b).display!=='none' : false; });
    log('delBtnVisible=' + delBtnVisible);
    await page.evaluate(() => deleteMyFamily());
    await sleep(4000);
    const after = await page.evaluate(async () => { try { const p = await api.getProfile(); return 'PROFILE_OK fam=' + (p.family_id||'null'); } catch(e){ return 'ERR:'+(e.message||e); } });
    log('afterDeleteFamily=' + after);
    console.log(`PHASE2 famBefore=${famBefore} delBtnVisible=${delBtnVisible} after=${after}`);
    await page.screenshot({ path: `${UD}/phase2-familydelete.png` });
  }
  await browser.close();
  log('DONE');
})().catch(e => { log('FATAL: ' + e.message); console.error('E2E ERROR:', e.message); process.exit(1); });
