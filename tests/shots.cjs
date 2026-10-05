// 視覺檢查：抓取各古本、各狀態與各尺寸的畫面，供人工檢視。
const { webkit, chromium } = require('playwright');
const base = process.argv[2] || 'http://localhost:8123/';
const OUT = process.env.QA_OUT || '/tmp/wubaobao-qa';
const engine = process.env.ENGINE === 'chromium' ? chromium : webkit;

(async () => {
  const browser = await engine.launch();
  const shot = async (page, name) => {
    // 等爻線動畫與揭曉動畫收完，畫面才不會拍到中途狀態
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/shot-${name}.png` });
    console.log('shot-' + name);
  };

  // 平板直向：擲到一半
  const p = await browser.newPage({ viewport: { width: 820, height: 1180 }, hasTouch: true });
  await p.goto(base + '?qa');
  await p.waitForFunction(() => window.wubaobaoQA);
  await p.locator('#stage').tap({ force: true });
  await p.locator('#stage').tap({ force: true });
  await p.locator('#stage').tap({ force: true });
  await shot(p, 'ipad-casting3');

  // 擲滿六爻 → 成卦
  for (let i = 0; i < 3; i++) await p.locator('#stage').tap({ force: true });
  await p.waitForTimeout(200);
  await shot(p, 'ipad-hexagram');

  // 各古本
  for (const book of ['ziwei', 'shanhai', 'bencao']) {
    await p.locator(`#books .book-tab[data-book="${book}"]`).click();
    for (let i = 0; i < 6; i++) await p.locator('#stage').tap({ force: true });
    await p.waitForTimeout(150);
    await shot(p, 'ipad-' + book);
  }

  // 名字簿
  await p.locator('#books .book-tab[data-book="yijing"]').click();
  for (let i = 0; i < 12; i++) await p.locator('#stage').tap({ force: true });
  await p.locator('#bookToggle').click();
  await p.waitForTimeout(200);
  await shot(p, 'ipad-book');
  await p.close();

  // 手機直向
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, deviceScaleFactor: 2 });
  await m.goto(base + '?qa');
  await m.waitForFunction(() => window.wubaobaoQA);
  for (let i = 0; i < 4; i++) await m.locator('#stage').tap({ force: true });
  await shot(m, 'phone-casting');
  for (let i = 0; i < 3; i++) await m.locator('#stage').tap({ force: true });
  await m.waitForTimeout(200);
  await shot(m, 'phone-reveal');
  await m.close();

  // 手機橫向
  const l = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  await l.goto(base + '?qa');
  await l.waitForFunction(() => window.wubaobaoQA);
  for (let i = 0; i < 6; i++) await l.locator('#stage').tap({ force: true });
  await l.waitForTimeout(200);
  await shot(l, 'phone-landscape');
  await l.close();

  // 桌面寬螢幕
  const d = await browser.newPage({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  await d.goto(base + '?qa');
  await d.waitForFunction(() => window.wubaobaoQA);
  for (let i = 0; i < 6; i++) await d.locator('#stage').tap({ force: true });
  await d.waitForTimeout(200);
  await shot(d, 'desktop');
  await d.close();

  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});