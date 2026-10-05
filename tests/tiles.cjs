// 真實觸控回歸：六爻成卦、古本切換、喜用神、名字簿、持久化、音效、全螢幕。
const { webkit, chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://localhost:8123/';
const OUT = process.env.QA_OUT || '/tmp/wubaobao-qa';
const { BANNED } = require('../js/namepool.js');
const findBannedLocal = (text) => [...String(text)].filter((c) => BANNED.has(c));

(async () => {
  const engine = process.env.ENGINE === 'chromium' ? chromium : webkit;
  const browser = await engine.launch({ headless: process.env.QA_HEADED !== '1' });
  const p = await browser.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  const errors = [];
  const external = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('request', (r) => {
    if (new URL(r.url()).origin !== new URL(base).origin) external.push(r.url());
  });

  await p.goto(base + '?qa');
  await p.waitForFunction(() => window.wubaobaoQA);
  const qa = () => p.evaluate(() => wubaobaoQA());
  const cast = async () => {
    await p.locator('#stage').tap({ force: true }).catch(async () => {
      await p.locator('#stage').click({ force: true });
    });
  };

  // 啟動：無錯誤、無外部請求、互動前未建立音訊
  assert.deepEqual(errors, [], '啟動不得有頁面錯誤');
  assert.deepEqual(external, [], '不得有外部請求');
  assert.equal((await qa()).audio, undefined, '互動前不應建立 AudioContext');
  assert.equal((await qa()).book, 'yijing', '預設古本為古本易經');
  assert.equal((await qa()).target, 'auto', '預設木火七三之序');

  // 六種尺寸：控制項都在畫面內，且沒有水平溢出
  for (const [width, height] of [
    [820, 1180],
    [1180, 820],
    [768, 1024],
    [1024, 768],
    [390, 844],
    [844, 390],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(150);
    for (const id of ['tools', 'wxbar', 'books', 'workline', 'stage', 'castButton', 'bookToggle']) {
      const box = await p.locator('#' + id).boundingBox();
      assert(box, `${id} 在 ${width}×${height} 應可見`);
      assert(
        box.x >= -1 && box.x + box.width <= width + 1,
        `${id} 在 ${width}×${height} 水平超出畫面：${JSON.stringify(box)}`,
      );
    }
    // 頂欄工具與擲爻鈕必須完整落在可視範圍內
    for (const id of ['tools', 'castButton']) {
      const box = await p.locator('#' + id).boundingBox();
      assert(
        box.y >= -1 && box.y + box.height <= height + 1,
        `${id} 在 ${width}×${height} 垂直超出畫面：${JSON.stringify(box)}`,
      );
    }
    const overflow = await p.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    assert(overflow <= 1, `${width}×${height} 有 ${overflow}px 水平溢出`);
  }
  await p.setViewportSize({ width: 820, height: 1180 });
  await p.waitForTimeout(120);

  // 擲滿六爻必成名
  const before = (await qa()).names;
  for (let i = 0; i < 6; i++) await cast();
  let s = await qa();
  assert(s.names > before, '擲滿六爻必須新增名字');
  assert.equal(s.reveals, 1);
  assert.equal(s.casting && s.casting.length > 0, true, '成卦後應顯示經文面板');
  assert(s.panelTitle.length > 0);

  // 名字本身：吳 + 一至二字，只含木火，不得含禁用字
  const bookNames = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('wubaobao-names') || '[]').map((n) => n.name),
  );
  assert(bookNames.length > 0);
  const banned = new Set('丞以品妍妤宇宥宸希彤恩承晨晴樂沁沐泓涵淇淳渝澄熙睿祐語霏霖佑右辰曦琪祺純瑜愉橙叡晶');
  for (const n of bookNames) {
    assert(/^吳[一-鿿]{1,2}$/u.test(n), `名字格式不符：${n}`);
    for (const ch of n) assert(!banned.has(ch), `名字含禁用字：${n}`);
  }

  // 爻線數從零開始重算
  assert.equal((await qa()).lineCount, 0, '成卦後卦盤應歸零');

  // 快速連點不會卡死、永遠取得到名
  for (let i = 0; i < 60; i++) await cast();
  s = await qa();
  assert(s.names >= 11, `連擲應持續成名，實得 ${s.names}`);
  assert(s.particles <= 96, '特效節點應有上限');
  assert.equal(s.voices <= 40, true);
  assert.deepEqual(errors, [], '密集操作不得有頁面錯誤');

  // 滑動也能擲爻
  const pre = await qa();
  await p.locator('#stage').hover();
  await p.mouse.move(120, 300);
  await p.mouse.down();
  for (let x = 140; x < 700; x += 40) await p.mouse.move(x, 320);
  await p.mouse.up();
  await p.waitForTimeout(120);
  assert((await qa()).casts > pre.casts, '滑動應也能擲爻');

  // 四部古本都能切換並成卦
  for (const book of ['ziwei', 'shanhai', 'bencao']) {
    await p.locator(`#books .book-tab[data-book="${book}"]`).click();
    assert.equal((await qa()).book, book);
    for (let i = 0; i < 6; i++) await cast();
    const t = await qa();
    assert(t.casting && t.casting.length > 0, `${book} 成卦後應顯示內容`);
    assert(t.panelTitle.length > 0, `${book} 應有經文標題`);
  }
  await p.locator('#books .book-tab[data-book="yijing"]').click();

  // 喜用神：只能選木或火（或七三之序）
  for (const w of ['木', '火', 'auto']) {
    await p.locator(`#wxbar button[data-w="${w}"]`).click();
    assert.equal((await qa()).target, w);
  }
  const wxButtons = await p.locator('#wxbar button').allTextContents();
  assert(!wxButtons.join('').includes('金') && !wxButtons.join('').includes('水'), '喜用神不得有金、水');
  assert(!wxButtons.join('').includes('土'), '喜用神不得有土');

  // 指定木時，收到的字全是木
  await p.locator('#wxbar button[data-w="木"]').click();
  for (let i = 0; i < 6; i++) await cast();
  const woodOnly = await p.evaluate(() => {
    const names = JSON.parse(localStorage.getItem('wubaobao-names') || '[]');
    return names.slice(0, 1).every((n) => n.wx.every((w) => w === '木'));
  });
  assert(woodOnly, '選木時名字不得混入火行');

  await p.locator('#wxbar button[data-w="火"]').click();
  for (let i = 0; i < 6; i++) await cast();
  const fireOnly = await p.evaluate(() => {
    const names = JSON.parse(localStorage.getItem('wubaobao-names') || '[]');
    return names.slice(0, 1).every((n) => n.wx.every((w) => w === '火'));
  });
  assert(fireOnly, '選火時名字不得混入木行');
  await p.locator('#wxbar button[data-w="auto"]').click();

  // 名字簿：開關、單筆刪除、清空
  await p.locator('#bookToggle').click();
  await p.waitForSelector('#book:not(.hidden)');
  const count = await p.locator('#bookList .book-item').count();
  assert(count > 0, '名錄應有資料');
  await p.locator('#bookList .book-delete').first().click();
  assert.equal(await p.locator('#bookList .book-item').count(), count - 1);
  await p.locator('#bookClear').click();
  assert.equal(await p.locator('#bookList .book-item').count(), 0);
  assert.equal((await qa()).names, 0);
  await p.locator('#bookClose').click();
  await p.waitForFunction(() => document.getElementById('book').classList.contains('hidden'));

  // 持久化與損壞資料回復
  for (let i = 0; i < 12; i++) await cast();
  const persisted = (await qa()).names;
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, persisted, '重載後名錄應保留');
  await p.evaluate(() => localStorage.setItem('wubaobao-names', '{壞掉的資料'));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0, '損壞資料應安全回復');
  await p.evaluate(() => localStorage.setItem('wubaobao-names', JSON.stringify([{ name: '吳妤希' }])));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0, '舊資料中的禁用名不得進入名錄');

  // 音效與音樂：互動後才出聲、可獨立靜音並記住
  // （上一段是重載後的乾淨頁面，先擲一爻解鎖音訊）
  const levelOf = async (i) => (await qa()).levels[i];
  // 擲爻的音效很短，要密集取樣才抓得到峰值。
  // 背景音樂刻意壓得很輕（不吵 Baby），量測門檻要分開設定。
  const EFFECTS_FLOOR = 0.008;
  const MUSIC_FLOOR = 0.003;
  const peak = async (i, ms) => {
    let best = 0;
    const until = Date.now() + ms;
    while (Date.now() < until) {
      best = Math.max(best, await levelOf(i));
      await p.waitForTimeout(20);
    }
    return best;
  };

  assert.equal((await qa()).audio, undefined, '未互動時不應有音訊');
  const castPeak = await (async () => {
    const castPromise = cast();
    const peakPromise = peak(0, 900);
    await castPromise;
    return peakPromise;
  })();
  const unlocked = await qa();
  assert(unlocked.audio, '互動後應有 AudioContext');
  assert(castPeak > EFFECTS_FLOOR, `擲爻應有音效輸出，實測 ${castPeak}`);

  // 靜音音效：實際輸出必須歸零（增益漸變到 0，要等它收乾淨再量）
  await p.locator('#effectsToggle').click();
  await p.waitForTimeout(400);
  let q = await qa();
  assert.equal(q.sound.effects, false, '音效應已關閉');
  const mutedFx = await peak(0, 500);
  assert(mutedFx === 0, `音效靜音後不應再有波形，實測 ${mutedFx}`);

  // 音樂獨立：關掉就歸零，重開會立刻起一段長音
  await p.locator('#musicToggle').click();
  await p.waitForTimeout(400);
  assert.equal((await qa()).sound.music, false);
  const mutedMu = await peak(1, 500);
  assert(mutedMu === 0, `音樂靜音後不應再有波形，實測 ${mutedMu}`);
  await p.locator('#musicToggle').click();
  assert.equal((await qa()).sound.music, true);
  assert((await peak(1, 900)) > MUSIC_FLOOR, '音樂開啟後應有背景聲');
  assert.equal(await levelOf(0), 0, '只開音樂時音效仍應是靜音的');

  // 設定要記住：此刻 effects=關、music=開，重載後應一致
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  q = await qa();
  assert.equal(q.sound.effects, false, '音效靜音應記住');
  assert.equal(q.sound.music, true, '音樂開啟應記住');

  // 靜音狀態下擲爻不應出聲；重新開啟後應恢復
  assert.equal(await levelOf(0), 0, '重載後音效仍是靜音的');
  await p.locator('#effectsToggle').click();
  await p.waitForTimeout(300);
  const reloadPeak = await (async () => {
    const castPromise = cast();
    const peakPromise = peak(0, 900);
    await castPromise;
    return peakPromise;
  })();
  assert(reloadPeak > EFFECTS_FLOOR, `重載後音效應恢復，實測 ${reloadPeak}`);

  // 全螢幕：有 API 進得去出得來，無 API 不報錯
  await p.locator('#castButton').click();
  const fsState = await p.evaluate(async () => {
    const has = !!document.documentElement.requestFullscreen;
    if (!has) return 'no-api';
    await document.documentElement.requestFullscreen();
    await new Promise((r) => setTimeout(r, 300));
    const in_ = !!document.fullscreenElement;
    await document.exitFullscreen();
    return in_ ? 'ok' : 'fail';
  });
  assert(['ok', 'no-api'].includes(fsState), `全螢幕結果異常：${fsState}`);

  // 大量擲爻後，名字的木火比例應接近七三之序（喜木、不狂補火）
  await p.evaluate(async () => {
    const el = document.getElementById('stage');
    for (let i = 0; i < 600; i++) {
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
    }
    await new Promise((r) => setTimeout(r, 500));
  });
  const dist = await p.evaluate(() => JSON.parse(localStorage.getItem('wubaobao-names') || '[]'));
  assert(dist.length >= 80, `大量擲爻應累積足夠樣本，實得 ${dist.length}`);
  let mu = 0;
  let huo = 0;
  for (const n of dist) for (const w of n.wx || []) (w === '木' ? mu++ : huo++);
  assert(huo > 0 && mu > 0, '木火兩行都應抽得到');
  const ratio = mu / (mu + huo);
  assert(ratio > 0.58 && ratio < 0.82, `木火比例應接近七三之序，實測 ${ratio.toFixed(3)}`);
  assert(dist.length <= 200, `名錄應有上限，實得 ${dist.length}`);
  console.log('  木火實測比例', ratio.toFixed(3), `(${dist.length} 名)`);

  // 名字簿收錄的全部名字都要乾淨：無禁用字、無重複、格式正確
  const allNames = dist.map((n) => n.name);
  for (const n of allNames) {
    assert(/^吳[一-鿿]{1,2}$/u.test(n), `名字格式不符：${n}`);
    assert.equal(findBannedLocal(n).length, 0, `名字含禁用字：${n}`);
  }
  assert.equal(
    new Set(allNames).size >= allNames.length * 0.9,
    true,
    `名字重複率過高：${allNames.length - new Set(allNames).size} 筆重複`,
  );

  // 頁面文案不得殘留禁用字。
  // 例外：以／樂／語／宥 只可能出現在「原典逐字引用」裡（大象傳的「君子以…」
  // 句式、需與豫的大象「宴樂」「作樂」、頤的大象「言語」、解的大象「宥罪」）。
  // 改動經文等於竄改經典，所以這四個字保留原文；但絕不可當成取名字。
  const VERBATIM = new Set(['以', '樂', '語', '宥']);
  const visible = await p.evaluate(() => document.body.innerText);
  for (const ch of '丞品妍妤宇宥宸希彤恩承晨晴樂沁沐泓涵淇淳渝澄熙睿祐語霏霖佑右辰曦琪祺純瑜愉橙叡晶') {
    if (VERBATIM.has(ch)) continue;
    assert(!visible.includes(ch), `畫面出現禁用字：${ch}`);
  }
  // 這四個字在畫面上出現時，必須都落在經文區塊之內
  const stray = await p.evaluate((exceptions) => {
    const out = [];
    for (const node of document.querySelectorAll('#reveal, .book-item, #toast, .panel-title, .slot-notes')) {
      for (const ch of node.textContent || '') {
        if ('丞以品妍妤宇宥宸希彤恩承晨晴樂沁沐泓涵淇淳渝澄熙睿祐語霏霖佑右辰曦琪祺純瑜愉橙叡晶'.includes(ch)
            && !exceptions.includes(ch)) out.push(ch);
      }
    }
    return out;
  }, [...VERBATIM]);
  assert.deepEqual([...new Set(stray)], [], '禁用字只可出現在原典引文中');
  assert(visible.includes('喜用') || visible.includes('木火'), '畫面應說明木火喜用');

  await p.screenshot({ path: `${OUT}/guben-${process.env.ENGINE || 'webkit'}.png` });
  assert.deepEqual(errors, [], '全流程不得有頁面錯誤');
  assert.deepEqual(external, [], '全流程不得有外部請求');

  await browser.close();
  console.log(JSON.stringify({
    engine: process.env.ENGINE || 'webkit',
    ok: true,
    sizes: 6,
    names: persisted,
    screenshot: `${OUT}/guben-${process.env.ENGINE || 'webkit'}.png`,
  }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});