// 真實觸控驗證：球的中心與 hit-test 一致；金球鎖字；iPad 轉向後仍可精準選字。
const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://localhost:8123/';
(async () => {
  const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
  const browser = await engine.launch({headless: !process.env.QA_HEADED});
  const page = await browser.newPage({viewport:{width:820,height:1180},deviceScaleFactor:2,hasTouch:true,isMobile:process.env.ENGINE==='webkit'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const response = await page.goto(base+'?qa'); assert.equal(response.status(),200);
  await page.waitForFunction(()=>window.wubaobaoQA);
  const qa=()=>page.evaluate(()=>wubaobaoQA());
  for (const size of [{width:820,height:1180},{width:1180,height:820},{width:768,height:1024},{width:1024,height:768},{width:390,height:844},{width:844,height:390}]) {
    await page.setViewportSize(size); await page.waitForTimeout(450);
    await page.locator('[data-w="auto"]').tap();
    const state=await qa(); assert(state.balls.length>=24 && state.balls.length<=210);
    assert.equal(new Set(state.balls.map(b=>b.layer)).size, 3, '必須有三層');
    assert(state.balls.some(b=>!b.visible), '上層球會遮住下層球');
    const rect=await page.locator('#stage canvas').boundingBox();
    const inBounds=b=>b.x-b.radius>=rect.x-1&&b.x+b.radius<=rect.x+rect.width+1&&b.y-b.radius>=rect.y-1&&b.y+b.radius<=rect.y+rect.height+1;
    assert(state.balls.every(inBounds), `球不得跑出邊框 ${size.width}`);
    // 動態氣流會持續移動球；選最上層球，避免截圖與觸控之間被另一層遮住。
    const normal=state.balls.find(b=>b.layer===2 && !b.gold && b.visible);
    await page.touchscreen.tap(normal.x,normal.y);
    const after=await qa();
    assert(after.selections>state.selections);
    // 可能剛好滿格，檢查本輪字或剛揭曉的名字，兩者都必須遵從實際觸碰。
    const selected=after.caught.includes(normal.c)||await page.locator('#revealName').evaluate((e,c)=>e.textContent.includes(c),normal.c);
    assert(selected,`觸控 ${normal.c} 不得選成別字 ${size.width}`);
    const beforeGold = await qa();
    const gold=beforeGold.balls.find(b=>b.gold && b.visible);
    await page.touchscreen.tap(gold.x,gold.y);
    let goldState=await qa();
    assert(goldState.goldSelections>state.goldSelections);
    assert.equal(Math.round(goldState.energy - beforeGold.energy + (goldState.reveals - beforeGold.reveals) * 100), 35, '金球額外 25 點，加上每摸 10 點');
    if(goldState.goldChoice) {
      assert.equal(goldState.goldChoice,gold.c); assert.equal(goldState.caught[0],gold.c);
      const count=goldState.names;
      for(let i=0;i<10&&(await qa()).names===count;i++)await page.touchscreen.tap(8,100);
    }
    assert((await page.locator('#revealName').textContent()).includes(gold.c), '金球字必須入名');
    for(const id of ['tools','workline','goldHint','wxbar','bookToggle']) {
      const r=await page.locator('#'+id).boundingBox();
      assert(r.x>=0&&r.y>=0&&r.x+r.width<=size.width+1&&r.y+r.height<=size.height+1,`${id} 必須在安全區`);
    }
    // 顯示普通球池截圖，避免揭曉卡遮住球的圓形與對齊。
    await page.waitForTimeout(4700);
    await page.screenshot({path:`/tmp/wubaobao-qa/ballpit-${size.width}-${process.env.ENGINE||'chromium'}.png`});
  }
  await page.setViewportSize({width:820,height:1180});await page.waitForTimeout(100);
  for(const w of ['金','木','水','火','土']) {
    await page.locator(`[data-w="${w}"]`).tap();
    let q=await qa();assert(q.balls.filter(b=>b.gold).every(b=>b.w===w));
    const gold=q.balls.find(b=>b.gold && b.visible);await page.touchscreen.tap(gold.x,gold.y);
    q=await qa();const count=q.names;
    if(q.goldChoice) for(let i=0;i<10&&(await qa()).names===count;i++)await page.touchscreen.tap(8,100);
    const last=await page.evaluate(()=>JSON.parse(localStorage.getItem('wubaobao-names'))[0]);
    assert(last.chars.includes(gold.c));assert(last.wx.every(e=>e===w));
    await page.waitForTimeout(850);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({url:base,engine:process.env.ENGINE||'chromium',sizes:6,checks:'球池邊界、正確選字、金球加成與鎖字、五行金球、橫直轉向、安全區',errors}));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
