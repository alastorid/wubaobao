// 真實觸控、合法解題順序與持久化回歸；QA 介面只提供唯讀快照。
const { webkit, chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = process.argv[2] || "http://localhost:8123/";
(async () => {
  const browser = await (
    process.env.ENGINE === "chromium" ? chromium : webkit
  ).launch();
  const p = await browser.newPage({
    viewport: { width: 820, height: 1180 },
    hasTouch: true,
  });
  const errors = [],
    external = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (new URL(r.url()).origin !== new URL(base).origin)
      external.push(r.url());
  });
  await p.goto(base + "?qa");
  await p.waitForFunction(() => window.wubaobaoQA);
  const qa = () => p.evaluate(() => wubaobaoQA());
  assert.equal((await qa()).initialCount, 102);
  assert.equal((await qa()).audio, undefined);
  for (const [width, height] of [
    [820, 1180],
    [1180, 820],
    [768, 1024],
    [1024, 768],
    [390, 844],
    [844, 390],
  ]) {
    await p.setViewportSize({ width, height });
    await p.waitForTimeout(80);
    for (const id of [
      "tools",
      "workline",
      "wxbar",
      "bookToggle",
      "stage",
      "tray",
      "undoButton",
      "shuffleButton",
      "hintButton",
    ]) {
      const r = await p.locator("#" + id).boundingBox();
      assert(
        r.x >= 0 &&
          r.y >= 0 &&
          r.x + r.width <= width + 1 &&
          r.y + r.height <= height + 1,
        id + " bounds " + width,
      );
    }
    const bounds = await p.locator("#board .tile").evaluateAll((es) =>
      es.map((e) => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
    assert(
      bounds.every(
        (r) => r.x >= 0 && r.y >= 0 && r.right <= width && r.bottom <= height,
      ),
    );
    const q = await qa(),
      t = q.tiles.find((t) => t.state === "board" && !t.blocked);
    await p.locator(`[data-id="${t.id}"]`).tap();
    assert.equal((await qa()).selections, q.selections + 1);
    await p.locator("#undoButton").tap();
    assert.equal((await qa()).tray.length, 0);
    await p.screenshot({ path: `/tmp/wubaobao-qa/match-${width}.png` });
  }
  await p.setViewportSize({ width: 820, height: 1180 });
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  for (let i = 0; i < 10; i++) await p.touchscreen.tap(3, 200);
  assert.equal((await qa()).names, 1);
  for (let i = 0; i < 10; i++) await p.touchscreen.tap(3, 200);
  assert.equal((await qa()).names, 2, "揭曉期間也累積");
  // 每一張都按生成時保證的合法順序實際點掉，驗證覆蓋與消除，而非直接改狀態。
  const solution = (await qa()).tiles.sort((a, b) => a.solution - b.solution);
  for (const t of solution) {
    const q = await qa();
    assert(!q.tiles.find((x) => x.id === t.id).blocked);
    await p.locator(`[data-id="${t.id}"]`).tap();
    assert((await qa()).tray.length < 3);
  }
  assert.equal((await qa()).level, 2);
  await p.waitForTimeout(1300);
  assert.equal(
    (await qa()).tiles.filter((t) => t.state === "board").length,
    102,
  );
  const q = await qa();
  await p.locator("#hintButton").tap();
  assert.equal((await qa()).matches, q.matches + 1);
  await p.locator("#shuffleButton").tap();
  assert.equal((await qa()).tray.length, 0);
  for (const w of ["金", "木", "水", "火", "土"]) {
    await p.locator(`[data-w="${w}"]`).tap();
    assert((await qa()).tiles.every((t) => t.w === w));
    const before = (await qa()).names;
    for (let i = 0; i < 10; i++) await p.touchscreen.tap(3, 200);
    assert((await qa()).names > before);
    const last = await p.evaluate(
      () => JSON.parse(localStorage.getItem("wubaobao-names"))[0],
    );
    assert(last.wx.every((v) => v === w));
  }
  await p.locator("#effectsToggle").tap();
  await p.locator("#musicToggle").tap();
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.deepEqual((await qa()).sound, { effects: false, music: false });
  const count = (await qa()).names;
  await p.locator("#bookToggle").tap();
  await p.locator(".book-delete").first().tap();
  assert.equal((await qa()).names, count - 1);
  await p.locator("#bookClear").tap();
  assert.equal((await qa()).names, 0);
  await p.locator("#bookClose").tap();
  await p.evaluate(() => {
    document.documentElement.requestFullscreen = undefined;
  });
  await p.locator("#fullscreenToggle").tap();
  assert((await p.locator("#toast").textContent()).includes("Safari"));
  // 隨機亂摸，滿槽會自行救援；沒有卡住或牌數遺失。
  await p.locator('[data-w="auto"]').tap();
  for (let i = 0; i < 100; i++) {
    const q = await qa();
    const a = q.tiles.filter((t) => t.state === "board" && !t.blocked);
    if (!a.length) {
      await p.waitForTimeout(1300);
      continue;
    }
    const t = a[Math.floor(Math.random() * a.length)];
    await p.locator(`[data-id="${t.id}"]`).tap();
    assert((await qa()).tray.length < 7);
  }
  assert((await qa()).rescues > 0);
  await p.evaluate(() => localStorage.setItem("wubaobao-names", "broken"));
  await p.reload();
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal((await qa()).names, 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
  console.log(
    JSON.stringify({
      url: base,
      engine: process.env.ENGINE || "webkit",
      sizes: 6,
      fullBoardSolution: 102,
      checks:
        "觸控、五層覆蓋、三消、撤回、重排、道具、滿槽救援、通關、五行、持久化、音訊設定、全螢幕 fallback",
      errors,
      external,
    }),
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
