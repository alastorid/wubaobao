// 執行：NODE_PATH=/tmp/wubaobao-qa/node_modules node tests/browser.cjs [網址]
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8123/';
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const out = process.env.QA_OUTPUT || '/tmp/wubaobao-qa';
(async () => {
  const browser = await engine.launch({headless: !process.env.QA_HEADED});
  const context = await browser.newContext({viewport:{width:1366,height:900}});
  // 在測試層旁接靜音分析器，量測真正合成的輸出波形。
  await context.addInitScript(() => {
    window.audioMeters = [];
    const original = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function(destination, ...args) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        const silent = this.context.createGain(); silent.gain.value = 0;
        original.call(this, analyser); original.call(analyser, silent); original.call(silent, destination);
        window.audioMeters.push(analyser);
      }
      return original.call(this, destination, ...args);
    };
    window.audioPeak = () => Math.max(0, ...audioMeters.map(a => { const data = new Float32Array(a.fftSize); a.getFloatTimeDomainData(data); return Math.max(...data.map(Math.abs)); }));
  });
  const page = await context.newPage(); const errors=[]; const external=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  page.on('request',r=>{if(new URL(r.url()).origin !== new URL(base).origin)external.push(r.url())});
  const qa = () => page.evaluate(()=>window.wubaobaoQA());
  await page.goto(base+'?qa'); await page.waitForFunction(()=>window.wubaobaoQA);
  assert.equal(await page.locator('canvas').count(),1);
  assert.equal((await qa()).audio,undefined);
  const count=(await qa()).names;
  for(let i=0;i<10;i++)await page.mouse.click(30,450);
  assert.equal((await qa()).names,count+1);
  assert.match(await page.locator('#revealName').textContent(),/^吳.{1,2}$/u);
  await page.waitForTimeout(100);
  assert.equal((await qa()).audio,'running');
  assert(await page.evaluate(()=>audioPeak()) > .00001, '音訊輸出有波形');
  // 揭曉期間持續敲擊仍然得到下一個名字。
  for(let i=0;i<10;i++)await page.mouse.click(30,450);
  assert.equal((await qa()).names,count+2);
  await page.screenshot({path:out+'/reveal-verified.png'});
  await page.waitForTimeout(4750);
  assert(await page.locator('#reveal').evaluate(e=>e.classList.contains('hidden')));
  const before=await qa();
  const bubble=before.bubbles.find(b=>b.y>260&&b.y<650&&b.x>120&&b.x<1200);
  assert(bubble);
  await page.mouse.move(bubble.x-45,bubble.y); await page.mouse.down();
  await page.mouse.move(bubble.x+45,bubble.y,{steps:4});await page.mouse.up();
  const after=await qa(); assert(after.pops>before.pops); assert(after.caught.length>0); assert(after.energy>before.energy);
  for (const w of ['金','木','水','火','土']) {
    await page.locator(`[data-w="${w}"]`).click();
    const n=(await qa()).names;
    for(let i=0;i<10;i++)await page.mouse.click(30,450);
    assert((await qa()).names>n);
    const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('wubaobao-names'))[0]);
    assert(record.wx.every(e=>e===w));
  }
  await page.locator('#effectsToggle').click(); await page.locator('#musicToggle').click();
  await page.waitForTimeout(400); assert((await qa()).gains.every(v=>v<.0001));
  assert(await page.evaluate(()=>audioPeak()) < .0001);
  await page.reload();await page.waitForFunction(()=>window.wubaobaoQA);
  assert.deepEqual((await qa()).sound,{effects:false,music:false});
  assert.equal((await qa()).audio,undefined);
  await page.mouse.click(30,450);await page.waitForTimeout(200);
  assert((await qa()).gains.every(v=>v<.0001));
  await page.locator('#effectsToggle').click(); await page.mouse.click(30,450); await page.waitForTimeout(30);
  assert(await page.evaluate(()=>audioPeak()) > .00001);
  assert((await qa()).gains[1]<.0001);
  // 名字簿舊資料、單筆刪除與清空。
  await page.evaluate(()=>localStorage.setItem('wubaobao-names',JSON.stringify([{name:'吳安',chars:['安'],wx:['土'],tags:'會意',ts:1}])));
  await page.reload();await page.waitForFunction(()=>window.wubaobaoQA);
  assert.equal((await qa()).names,1);await page.locator('#bookToggle').click();
  assert.equal(await page.locator('.nm').textContent(),'吳安');await page.locator('.book-delete').click();assert.equal((await qa()).names,0);
  await page.locator('#bookToggle').click();
  if(process.env.ENGINE !== 'webkit') {
    await page.locator('#fullscreenToggle').click();await page.waitForFunction(()=>document.fullscreenElement);
    await page.locator('#fullscreenToggle').click();await page.waitForFunction(()=>!document.fullscreenElement);
  }
  await page.evaluate(()=>Object.defineProperty(document.documentElement,'requestFullscreen',{value:undefined,configurable:true}));
  await page.locator('#fullscreenToggle').click();assert(await page.locator('#toast').isVisible());
  for(const size of [{width:390,height:844},{width:820,height:1180},{width:1180,height:820},{width:844,height:390}]) {
    await page.setViewportSize(size);await page.waitForTimeout(200);
    for(const id of ['tools','wxbar','bookToggle','workline']) {
      const r=await page.locator('#'+id).boundingBox();assert(r.x>=0&&r.y>=0&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,`${id} 超出 ${size.width}×${size.height}`);
    }
    await page.screenshot({path:out+`/layout-${size.width}-${process.env.ENGINE||'chromium'}.png`});
  }
  // 大量輸入後資源仍受上限控制。
  await page.setViewportSize({width:1366,height:900});
  for(let i=0;i<150;i++) await page.mouse.click(30,450);
  const stress=await qa();assert(stress.particles<=700);assert(stress.voices<=48);assert(stress.textures<=485);
  await page.locator('#bookToggle').click();await page.locator('#bookClear').click();assert.equal((await qa()).names,0);
  await page.locator('#bookToggle').click();
  await page.evaluate(()=>localStorage.setItem('wubaobao-names','{}'));await page.reload();await page.waitForFunction(()=>window.wubaobaoQA);assert.equal((await qa()).names,0);
  const fps=await page.evaluate(()=>new Promise(resolve=>{const frames=[];let last=performance.now();const end=last+10000;function frame(t){frames.push(t-last);last=t;if(t<end)requestAnimationFrame(frame);else{frames.sort((a,b)=>a-b);resolve({fps:1000/(frames.reduce((a,b)=>a+b,0)/frames.length),p95ms:frames[Math.floor(frames.length*.95)]})}}requestAnimationFrame(frame)}));
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log(JSON.stringify({url:base,engine:process.env.ENGINE||'chromium',checks:'boot, ten taps, reveal input, swipe, five elements, waveform, independent mute, persistence, CRUD, fullscreen/fallback, four layouts, stress, corrupt storage',fps,gpu:await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown'}),stress:{particles:stress.particles,voices:stress.voices,textures:stress.textures,drawCalls:stress.drawCalls},errors,external},null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
