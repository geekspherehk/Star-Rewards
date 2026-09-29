const puppeteer = require('/Users/xuversa/.workbuddy/binaries/node/workspace/node_modules/puppeteer-core');
const http = require('http'); const fs = require('fs'); const path = require('path'); const os = require('os');
const ROOT = '/Users/work/code/Star-Rewards';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
  if (req.url.startsWith('/api/')) { res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({success:true})); return; }
  let u = req.url.split('?')[0]; if (u === '/') u = '/index.html';
  const fp = path.join(ROOT, u);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) { res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'text/plain'}); res.end(fs.readFileSync(fp)); }
  else { res.writeHead(404); res.end('nf'); }
});
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  await new Promise(r=>server.listen(8161,r));
  const ud = fs.mkdtempSync(path.join(os.tmpdir(),'sr-v-'));
  const b = await puppeteer.launch({executablePath:CHROME, headless:'new', userDataDir:ud, args:['--no-sandbox','--disable-dev-shm-usage']});
  const page = await b.newPage();
  const errs = [];
  page.on('pageerror', e=>errs.push('PAGEERR: '+e.message));
  page.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
  await page.goto('http://localhost:8161/index.html',{waitUntil:'networkidle2',timeout:60000});
  await sleep(2000);
  const info = await page.evaluate(()=>{
    const section = document.getElementById('weekly-section');
    const push = document.getElementById('push-toggle-row');
    return {
      todayCheckinExists: !!document.getElementById('today-checkin'),
      todayCheckinListExists: !!document.getElementById('today-checkin-list'),
      weeklyExists: !!section,
      pushInsideWeekly: !!(section && push && section.contains(push)),
      pushExists: !!push,
      weeklyHasTodayBtn: !!(section && section.querySelector('[onclick^="openCheckinConfirm"]'))
    };
  });
  // 过滤与本次改动无关的 API 缺失报错
  const relevant = errs.filter(e => /today-checkin|renderHomeCheckin|renderCheckinDots|is not defined/i.test(e) && !/api is not defined/i.test(e));
  console.log(JSON.stringify(info,null,2));
  console.log('RELEVANT_ERRORS:', JSON.stringify(relevant));
  await b.close().catch(()=>{}); fs.rmSync(ud,{recursive:true,force:true}); server.close();
})();
