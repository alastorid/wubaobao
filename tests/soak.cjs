// iPad 尺寸的 WebKit 觸控長跑；非 iPad 實機證明。
const { webkit } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await webkit.launch();
 const page=await browser.newPage({viewport:{width:820,height:1180},deviceScaleFactor:2,hasTouch:true,isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.argv[2]||'http://localhost:8123/')+'?qa');await page.waitForFunction(()=>window.wubaobaoQA);
 await page.locator('#effectsToggle').tap();await page.locator('#musicToggle').tap();
 const duration=Number(process.env.SOAK_MS||120000);
 const frames=page.evaluate(duration=>new Promise(resolve=>{
  const samples=[];let last=performance.now();const end=last+duration;
  function tick(t){samples.push(t-last);last=t;if(t<end)requestAnimationFrame(tick);else{samples.sort((a,b)=>a-b);resolve({fps:1000*samples.length/samples.reduce((a,b)=>a+b,0),p95ms:samples[Math.floor(samples.length*.95)],frames:samples.length})}}
  requestAnimationFrame(tick);
 }),duration);
 const until=Date.now()+duration;let taps=0;
 while(Date.now()<until){await page.touchscreen.tap(60+Math.random()*700,300+Math.random()*480);taps++;await page.waitForTimeout(250)}
 const timing=await frames;
 const q=await page.evaluate(()=>wubaobaoQA());assert(q.names>0);assert(q.particles<=700);assert(q.textures<=517);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine:'WebKit',viewport:'820×1180 @2x',durationMs:duration,taps,timing,names:q.names,pops:q.pops,particles:q.particles,textures:q.textures,pixelRatio:q.pixelRatio,errors},null,2));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
