// 連續觸控量測：在 iPad 尺寸下長時間操作，看有沒有錯誤、記憶體或節點失控。
const { webkit, chromium } = require('playwright');
const assert = require('node:assert/strict');

const base = process.argv[2] || 'http://localhost:8123/';
const duration = Number(process.env.SOAK_MS || 20000);

(async () => {
  const engine = process.env.ENGINE === 'chromium' ? chromium : webkit;
  const browser = await engine.launch();
  const p = await browser.newPage({
    viewport: { width: 820, height: 1180 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + '?qa');
  await p.waitForFunction(() => window.wubaobaoQA);

  await p.evaluate(() => {
    window.__frames = [];
    window.__soakRunning = true;
    const loop = () => {
      if (!window.__soakRunning) return;
      const t = performance.now();
      requestAnimationFrame(() => {
        window.__frames.push(performance.now() - t);
        loop();
      });
    };
    loop();
  });

  const start = Date.now();
  let taps = 0;
  const x = 410;
  while (Date.now() - start < duration) {
    const y = 320 + ((taps * 37) % 480);
    await p.touchscreen.tap(x, y);
    taps++;
    if (taps % 7 === 0) {
      await p.mouse.move(80, y);
      await p.mouse.down();
      for (let k = 100; k < 740; k += 60) await p.mouse.move(k, y + 12);
      await p.mouse.up();
    }
  }
  const frames = await p.evaluate(() => {
    window.__soakRunning = false;
    return window.__frames;
  });

  const q = await p.evaluate(() => wubaobaoQA());
  const sorted = frames.slice(20).sort((a, b) => a - b);
  const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  assert.deepEqual(errors, [], '長時間操作不得有頁面錯誤');
  assert(q.names > 0, '長時間操作應持續成名');
  assert(q.particles <= 96, '特效節點失控');
  assert(q.voices <= 40, '音訊聲部失控');

  await browser.close();
  console.log(
    JSON.stringify({
      engine: process.env.ENGINE || 'webkit',
      ms: Date.now() - start,
      taps,
      names: q.names,
      casts: q.casts,
      avgFrameMs: Number(avg.toFixed(2)),
      p95FrameMs: Number(p95.toFixed(2)),
      particles: q.particles,
      voices: q.voices,
      errors: errors.length,
    }),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});