// 真實觸控回歸：六爻成卦、古本切換、喜用神、名字簿、持久化、音效、全螢幕。
const { webkit, chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://localhost:8123/';
const OUT = process.env.QA_OUT || '/tmp/wubaobao-qa';
const { BANNED, TABOO_CODES } = require('../js/namepool.js');
// 名字必須同時避開使用者指定的禁用字與取名忌字。
// 只查 BANNED 會漏掉 TABOO，而 TABOO 才是擋「死」「物」「劫」那一類的。
const findBannedLocal = (text) => [...String(text)]
  .filter((c) => BANNED.has(c) || TABOO_CODES.has(c));

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

  // 每一部古本都能切換並成卦（清單由頁面上的分頁推導）
  const books = await p.locator('#books .book-tab').evaluateAll((els) =>
    els.map((e) => e.dataset.book),
  );
  assert(books.length >= 4, `古本分頁應有四部以上，實得 ${books.length}`);
  for (const book of books) {
    await p.locator(`#books .book-tab[data-book="${book}"]`).click();
    assert.equal((await qa()).book, book);
    for (let i = 0; i < 6; i++) await cast();
    const t = await qa();
    assert(t.casting && t.casting.length > 0, `${book} 成卦後應顯示內容`);
    assert(t.panelTitle.length > 0, `${book} 應有經文標題`);
    assert(
      (await p.locator('#panelBody dd').count()) > 0,
      `${book} 經文面板應有內容`,
    );
  }
  // 卦檯角落的硃砂印要跟著古本換
  const seals = await p.locator('#books .book-tab').evaluateAll((els) =>
    els.map((e) => e.querySelector('b').textContent),
  );
  const stageSeal = await p.locator('#stage').getAttribute('data-seal');
  assert(seals.includes(stageSeal), `卦檯印文應是某一部古本，實得 ${stageSeal}`);
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

  // 複製列：名單有資料時才出現
  await p.waitForSelector('#bookActions:not(.hidden)');
  assert.equal(await p.locator('#bookActions .book-action').count(), 3, '應有三種複製格式');

  // 三種格式都要寫進剪貼簿，且內容合理。
  // WebKit 不支援 clipboard 權限授權，所以兩條路都攔下來：
  // navigator.clipboard.writeText 與 document.execCommand('copy')。
  // 這樣不管引擎走哪條 fallback，寫進去的內容都驗得到。
  await p.evaluate(() => {
    window.__clip = [];
    const native = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (navigator.clipboard) {
      navigator.clipboard.writeText = async (t) => {
        window.__clip.push(t);
        return native ? native(t) : undefined;
      };
    }
    const exec = document.execCommand?.bind(document);
    document.execCommand = (cmd, ...rest) => {
      if (cmd === 'copy') {
        const el = document.activeElement;
        window.__clip.push(el && 'value' in el ? el.value : '');
        return true;
      }
      return exec ? exec(cmd, ...rest) : false;
    };
  });
  const clip = async (sel) => {
    await p.locator(sel).click();
    await p.waitForTimeout(250);
    return p.evaluate(() => window.__clip.pop());
  };
  const clipNames = await clip('#copyNames');
  const clipDetail = await clip('#copyDetail');
  const clipAll = await clip('#copyAll');
  for (const [label, text] of [['只複製名字', clipNames], ['含出處', clipDetail], ['全部', clipAll]]) {
    assert(typeof text === 'string' && text.length > 0, `${label} 應寫入非空內容`);
  }

  const records = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('wubaobao-names') || '[]'),
  );
  const stored = records.map((n) => n.name);
  // 只複製名字：每行一個，順序與名錄一致
  assert.deepEqual(clipNames.split('\n'), stored, '只複製名字應與名錄完全一致');
  // 含出處：每個名字都要出現，且帶得出處與寓意
  for (const n of stored) assert(clipDetail.includes(n), `含出處應包含 ${n}`);
  assert(clipDetail.includes('畫'), '含出處應有筆畫');
  // 出處必須是真的在複製內容裡，不是靠「古本」兩個字蒙混。
  //
  // 原本這裡只斷言 clipDetail 含有「古本」二字，等於只要畫面上隨便出現
  // 「古本」就算過，無法證明出處有被複製進去。改成逐筆比對 cites。
  for (const rec of records) {
    for (const cite of rec.cites || []) {
      assert(clipDetail.includes(cite), `含出處應含該筆的出處「${cite}」（${rec.name}）`);
    }
  }
  // 全部：序號與五行
  assert(clipAll.includes('五行：'), '全部格式應有五行');
  assert(/1\. 吳/.test(clipAll), '全部格式應有序號');
  assert(clipAll.length >= clipDetail.length, '全部格式不該比含出處短');
  console.log('  複製格式', { names: clipNames.length, detail: clipDetail.length, all: clipAll.length });

  // 單筆複製
  await p.locator('#bookList .book-copy').first().click();
  await p.waitForTimeout(250);
  const one = await p.evaluate(() => window.__clip.pop());
  assert(one.startsWith(stored[0]), `單筆複製應是 ${stored[0]}，實得「${one.slice(0, 12)}」`);
  assert(one.includes('畫'), '單筆複製應含筆畫');

  await p.locator('#bookList .book-delete').first().click();
  assert.equal(await p.locator('#bookList .book-item').count(), count - 1);
  await p.locator('#bookClear').click();
  assert.equal(await p.locator('#bookList .book-item').count(), 0);
  assert.equal((await qa()).names, 0);
  // 名單清空後複製列要收起來，避免按了沒反應
  assert(
    await p.locator('#bookActions').evaluate((e) => e.classList.contains('hidden')),
    '名單清空後複製列應隱藏',
  );
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
  // 禁用字筆：name 與 chars 都完整，會通過結構檢查，
  // 必須靠禁用字過濾擋下——否則這條測試只是被結構檢查擋掉而假通過。
  await p.evaluate(() => localStorage.setItem('wubaobao-names', JSON.stringify([
    { name: '吳妤希', chars: ['妤', '希'], wx: ['木', '木'], strokes: [6, 7], cites: ['a', 'b'], meanings: ['m', 'n'] },
  ])));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0, '舊資料中的禁用名不得進入名錄');

  // 忌字筆：字不在 BANNED 裡，但在 TABOO 裡（例如「物」）。
  // 這一筆專門驗證「只擋禁用字」是不夠的。
  await p.evaluate(() => localStorage.setItem('wubaobao-names', JSON.stringify([
    { name: '吳若物', chars: ['若', '物'], wx: ['木', '木'], strokes: [8, 8], cites: ['a', 'b'], meanings: ['m', 'n'] },
  ])));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0, '舊資料中的取名忌字不得進入名錄');

  // 夾帶筆：name 乾淨，但 chars 裡藏了忌字。只查 name 會漏掉。
  await p.evaluate(() => localStorage.setItem('wubaobao-names', JSON.stringify([
    { name: '吳若芷', chars: ['若', '妤'], wx: ['木', '木'], strokes: [8, 6], cites: ['a', 'b'], meanings: ['m', 'n'] },
  ])));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0, 'chars 裡夾帶的禁用字不得進入名錄');

  // 舊格式（wx 為物件、strokes 為單值、cites 較短）必須被安全升級，不能讓頁面壞掉
  await p.evaluate(() => localStorage.setItem('wubaobao-names', JSON.stringify([
    { name: '吳若芷', chars: ['若', '芷'], wx: { 木: 2 }, strokes: '88', cites: ['a'], meanings: ['m', 'n'] },
  ])));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.deepEqual(errors, [], '舊格式名錄不得造成頁面錯誤');
  assert.equal((await qa()).names, 1, '舊格式名錄應被安全升級後保留');

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
    assert.equal(findBannedLocal(n).length, 0, `名字含禁用或忌字：${n}`);
  }
  // chars 也要查：只查 name 會讓夾帶在 chars 裡的忌字漏過
  for (const rec of dist) {
    for (const ch of rec.chars || []) {
      assert.equal(findBannedLocal(ch).length, 0, `chars 含禁用或忌字：${ch}`);
    }
  }
  // 重複率門檻：字庫清理忌字後只剩 147 字（可用 136），
  // 組合空間遠小於清理前，所以門檻必須按實際空間重算，
  // 否則這條斷言會變成「強迫抽籤變魔法」的假驗證。
  //
  // 實際計算：200 次抽名，單字名佔 15%（30 次）、兩字名佔 85%（170 次）。
  //   單字木名 21 次 / 116 種 → 期望重複 1.8
  //   單字火名  9 次 /  20 種 → 期望重複 1.9
  //   兩字名  170 次 / 18360 種 → 期望重複 0.8
  // 合計期望約 4.5 筆，容許 12 筆（2.6 倍）當上限。
  const dupes = allNames.length - new Set(allNames).size;
  assert(dupes <= 12, `名字重複率過高：${dupes} 筆重複（200 次抽名的期望約 4.5 筆）`);

  // 開著名錄時，揭曉卡不該蓋住名單
  for (let i = 0; i < 3; i++) await cast();
  await p.locator('#bookToggle').click();
  await p.waitForSelector('#book:not(.hidden)');
  const stacked = await p.evaluate(() => {
    const b = document.getElementById('book').getBoundingClientRect();
    const r = document.getElementById('reveal').getBoundingClientRect();
    // 取名錄中第一列的中心點，看它是不是被揭曉卡蓋住
    const row = document.querySelector('#bookList .book-item');
    const hit = row ? document.elementFromPoint(
      (row.getBoundingClientRect().left + row.getBoundingClientRect().right) / 2,
      (row.getBoundingClientRect().top + row.getBoundingClientRect().bottom) / 2,
    ) : null;
    return { revealZ: getComputedStyle(document.getElementById('reveal')).zIndex, hitInsideRow: !!hit?.closest('#bookList') };
  });
  assert(Number(stacked.revealZ) < 60, `開名錄時揭曉卡應退到後面，z-index 實得 ${stacked.revealZ}`);
  assert(stacked.hitInsideRow, '開名錄時名單應該點得到，不被揭曉卡蓋住');
  await p.locator('#bookClose').click();
  await p.waitForFunction(() => document.getElementById('book').classList.contains('hidden'));

  // ── 狀態訊息不得蓋住名錄按鈕 ──────────────────────────
  //
  // 這是實測出來的真缺陷：toast 原本是 position: fixed 貼在底部，
  // 320×568 / 360×640 / 390×844 三種手機尺寸下都正好壓在「名錄」按鈕上——
  // 剛複製完想再點開名錄，卻被自己剛跳出來的訊息擋住。
  // 現在 toast 與 poolNote 共用同一列，必須確認兩件事：
  //   1. toast 顯示時不會與名錄按鈕重疊
  //   2. toast 顯示時不會把頁面推出視窗高度（那樣等於看不見）
  const toastFits = await p.evaluate(() => {
    const t = document.getElementById('toast');
    const n = document.getElementById('poolNote');
    const out = [];
    // 用實際會出現的最長訊息測，避免只測短字串而漏掉會折行的情況
    for (const msg of [
      '已換到 古本神農本草 · 本草收載之藥名索引',
      '已複製 87 個含出處到剪貼簿',
      '已複製 3 個名字到剪貼簿',
      '這個瀏覽器不允許自動複製，請手動選取',
    ]) {
      n.classList.add('hidden');
      t.textContent = msg;
      t.classList.remove('hidden');
      const tb = t.getBoundingClientRect();
      const bb = document.getElementById('bookToggle').getBoundingClientRect();
      const overlap = !(bb.right <= tb.left || bb.left >= tb.right
        || bb.bottom <= tb.top || bb.top >= tb.bottom);
      out.push({
        msg,
        position: getComputedStyle(t).position,
        overlap,
        belowFold: tb.bottom > window.innerHeight + 1,
      });
    }
    n.classList.remove('hidden');
    t.classList.add('hidden');
    return out;
  });
  for (const r of toastFits) {
    assert(!r.overlap, `狀態訊息蓋住名錄按鈕：「${r.msg}」`);
    assert(!r.belowFold, `狀態訊息被推出視窗，看不見：「${r.msg}」`);
    assert(r.position !== 'fixed', `狀態訊息不該用 fixed 覆蓋版面（實得 ${r.position}）`);
  }

  // ── 在姓的輸入欄打字不該順便擲爻 ──────────────────────
  //
  // 鍵盤擲爻綁在 document 的 keydown 上。原本只排除 button，
  // 加上可輸入的姓之後，輸入「陳」會同時擲一爻——使用者根本不知道自己做了什麼。
  const beforeTyping = (await qa()).lineCount;
  await p.locator('#surnameInput').fill('');
  await p.locator('#surnameInput').type('陳', { delay: 40 });
  const afterTyping = await qa();
  assert.equal(afterTyping.lineCount, beforeTyping,
    `在姓欄輸入一個字不該擲爻（${beforeTyping} → ${afterTyping.lineCount}）`);
  assert.equal(afterTyping.surname, '陳', `姓應該被設成「陳」，實得「${afterTyping.surname}」`);

  // 但焦點不在輸入欄時，鍵盤仍然要能擲爻（無障礙操作不能壞掉）。
  // 注意不能直接拿 afterTyping.lineCount 當基準：點擊 body 本身也會擲一爻，
  // 若刚好擲滿六爻就會成卦歸零，數字反而變小，量不出差異。
  // 所以基準要在按鍵之前才取。
  await p.locator('body').click({ position: { x: 5, y: 5 } });
  const beforeKey = (await qa()).lineCount;
  await p.keyboard.press('KeyA');
  const afterKey = (await qa()).lineCount;
  assert(afterKey === 1 || afterKey > beforeKey,
    `焦點不在輸入欄時按鍵應擲爻（擲前 ${beforeKey} 爻，擲後 ${afterKey} 爻）`);

  // 姓換成陳之後產生的名字，姓也要跟著換
  const recNames = await p.evaluate(() =>
    JSON.parse(localStorage.getItem('wubaobao-names') || '[]').map((n) => n.name));
  for (const n of recNames) {
    assert(/^(吳|陳)[一-鿿]{1,2}$/u.test(n), `換姓後名字的姓應一併更新：${n}`);
  }
  await p.evaluate(() => localStorage.removeItem('wubaobao-surname'));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);

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