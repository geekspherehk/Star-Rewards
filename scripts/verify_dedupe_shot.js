// 线上截图：确认周表是当前唯一打卡入口，打卡提醒开关已归入周表区
// Node 侧直接调 API 建号/建愿望/删号；puppeteer 仅带 token 渲染截图
const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const os = require('os'); const fs = require('fs'); const path = require('path');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'https://stellar.gaocaihk.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = Math.floor(Date.now()/1000);
const email = `sr.demo.dedupe.${ts}@example.com`;
const PWD = 'TestPass123!';

async function api(action, body, token){
  const h = {'Content-Type':'application/json'};
  if(token) h['Authorization']='Bearer '+token;
  const r = await fetch(BASE+'/api/index.php?action='+action,{method:'POST',headers:h,body:JSON.stringify(body||{})});
  return r.json();
}

(async()=>{
  // 1) 注册
  let reg = await api('register',{email,password:PWD,consent:true});
  if(!reg||!reg.token){ console.log('注册失败',JSON.stringify(reg)); return; }
  console.log('注册:',email);
  // 2) 建愿望
  const w = await api('add_wish',{category:'health',title:'早晚刷牙',wish_type:'persistence',persistence_days:30},reg.token);
  console.log('愿望 id:', w&&w.id);

  const ud = fs.mkdtempSync(path.join(os.tmpdir(),'sr-dedupe-'));
  const b = await puppeteer.launch({executablePath:CHROME, headless:'new', userDataDir:ud, args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await b.newPage();
  await page.setViewport({width:900,height:1400,deviceScaleFactor:2});
  await page.goto(BASE+'/login.html',{waitUntil:'networkidle2'});
  await page.evaluate((t,e)=>{localStorage.setItem('auth_token',t);localStorage.setItem('user_email',e);},reg.token,email);
  await page.goto(BASE+'/index.html',{waitUntil:'networkidle2'});
  await sleep(4500);
  await page.evaluate(()=>{
    const m=document.getElementById('onboarding-modal'); if(typeof dismissOnboarding==='function')dismissOnboarding(); if(m)m.style.display='none';
    document.querySelectorAll('.onboarding-modal,.help-overlay').forEach(e=>e.remove());
    ['activation-progress-bar','welcome-banner','home-focus-banner','activation-checklist'].forEach(id=>{const e=document.getElementById(id);if(e)e.style.display='none';});
    if(typeof showModule==='function')showModule('points-module');
    if(typeof renderWeeklyModule==='function')renderWeeklyModule();
  });
  await sleep(1200);
  const el = await page.$('#weekly-section');
  await el.screenshot({path:'shots/dedupe-weekly-only.png'});
  const cnt = await page.evaluate(()=>({
    weeklyTodayCells: document.querySelectorAll('#weekly-grid .wk-cell.is-today.is-click').length,
    topCheckinBtns: document.querySelectorAll('#today-checkin .v2-checkin-btn').length,
    pushInsideWeekly: !!(document.getElementById('weekly-section')&&document.getElementById('push-toggle-row')&&document.getElementById('weekly-section').contains(document.getElementById('push-toggle-row')))
  }));
  console.log('COUNTS', JSON.stringify(cnt));
  await b.close().catch(()=>{}); fs.rmSync(ud,{recursive:true,force:true});
  // 3) 清理
  const del = await api('delete_account',{confirm:'DELETE'},reg.token);
  console.log('清理临时账号:', JSON.stringify(del));
})();
