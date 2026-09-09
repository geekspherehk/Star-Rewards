// 合规 P2 截图：① 注册页监护人同意勾选 ② 家庭弹窗「删除家庭」按钮（仅 owner）
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const BASE = 'https://stellar.gaocaihk.com';
const UD = process.env.QA_UD, EMAIL = process.env.QA_EMAIL, PASS = process.env.QA_PASS, OUT = process.env.QA_OUT;
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', userDataDir: UD, args: ['--no-sandbox','--disable-setuid-sandbox',`--user-agent=${UA}`,'--window-size=430,950'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 430, height: 950, isMobile: true });
  // ① 登录页注册表单（含监护人同意）
  await page.goto(`${BASE}/login.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('#register-consent', { timeout: 15000 });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/1-register-consent.png` });
  // ② 注册 → 首页 → 家庭弹窗（owner 可见删除家庭）
  await page.type('#register-email', EMAIL);
  await page.type('#register-password', PASS);
  await page.click('#register-consent');
  await page.click('#register-form button[onclick^="handleSignUp"]');
  await page.waitForFunction(() => location.pathname.endsWith('index.html'), { timeout: 20000 }).catch(()=>{});
  await sleep(4000);
  // 新用户首启会弹 onboarding 向导，先关掉再开家庭弹窗
  await page.evaluate(() => { if (typeof dismissOnboarding === 'function') dismissOnboarding(); });
  await sleep(1000);
  await page.evaluate(() => { if (typeof openFamilyModal==='function') openFamilyModal(); });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/2-family-delete-btn.png` });
  console.log('SHOTS_OK');
  await browser.close();
})().catch(e => { console.error('SHOT ERROR:', e.message); process.exit(1); });
