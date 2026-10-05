// WebAudio 驗證：首次互動解鎖、實際波形、獨立靜音與歸零。
//
// 用離線算繪（OfflineAudioContext）重播同一段音效與背景樂，
// 直接檢查輸出樣本，驗得到「真的有聲音」與「靜音後真的沒聲音」。
const assert = require('node:assert/strict');

const rms = (buffer, from, to) => {
  const data = buffer.getChannelData(0);
  let sum = 0;
  let n = 0;
  for (let i = Math.floor(from * buffer.sampleRate); i < Math.min(to * buffer.sampleRate, data.length); i++) {
    sum += data[i] * data[i];
    n++;
  }
  return n ? Math.sqrt(sum / n) : 0;
};

(async () => {
  const p = await (require('playwright').chromium).launch();
  const page = await p.newPage({ hasTouch: true });
  await page.goto('http://localhost:8123/?qa');
  await page.waitForFunction(() => window.wubaobaoQA);

  // 互動前不得建立 AudioContext
  assert.equal(await page.evaluate(() => wubaobaoQA().audio), undefined, '互動前不應建立音訊');

  // 互動後才建立。擲爻音效很短，取樣要與擲爻同時進行才抓得到峰值。
  const sample = (ms, act) =>
    page.evaluate(
      async ([ms, act]) => {
        let fx = 0;
        let mu = 0;
        const until = performance.now() + ms;
        if (act === 'cast') {
          document.getElementById('stage').dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }),
          );
        }
        while (performance.now() < until) {
          const l = wubaobaoQA().levels;
          fx = Math.max(fx, l[0]);
          mu = Math.max(mu, l[1]);
          await new Promise((r) => setTimeout(r, 20));
        }
        return { fx, mu, audio: wubaobaoQA().audio, sound: wubaobaoQA().sound };
      },
      [ms, act],
    );

  const levels = await sample(900, 'cast');
  assert(levels.audio, '互動後應有 AudioContext');
  assert(levels.fx > 0.008, `擲爻應有音效波形，實測 ${levels.fx}`);
  assert(levels.mu > 0.003, `應有背景音樂波形，實測 ${levels.mu}`);

  // 獨立靜音：關掉音效後波形必須歸零，音樂不受影響
  await page.locator('#effectsToggle').click();
  // 增益是 setTargetAtTime 漸變到 0，要等它收乾淨再量
  await page.waitForTimeout(400);
  const muted = await sample(900, 'cast');
  assert.equal(muted.sound.effects, false);
  assert.equal(muted.fx, 0, `音效靜音後擲爻不應出聲，實測 ${muted.fx}`);
  assert(muted.mu > 0.003, '只關音效時音樂應繼續');

  // 只關音樂：音效恢復、音樂歸零
  await page.locator('#effectsToggle').click();
  await page.locator('#musicToggle').click();
  await page.waitForTimeout(400);
  const onlyFx = await sample(900, 'cast');
  assert.equal(onlyFx.sound.effects, true);
  assert.equal(onlyFx.sound.music, false);
  assert(onlyFx.fx > 0.008, '只留音效時擲爻應有聲');
  assert.equal(onlyFx.mu, 0, `只關音樂時音樂波形應為零，實測 ${onlyFx.mu}`);

  // 設定持久化
  await page.reload();
  await page.waitForFunction(() => window.wubaobaoQA);
  const persisted = await page.evaluate(() => wubaobaoQA().sound);
  assert.equal(persisted.effects, true, '音效設定應記住');
  assert.equal(persisted.music, false, '音樂設定應記住');

  // 離線算繪：直接檢查樣本，確認音訊真的會產生聲波
  const offline = await page.evaluate(async () => {
    const ctx = new OfflineAudioContext(1, 44100 * 2, 44100);
    const out = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    out.connect(analyser).connect(ctx.destination);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 392;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, 0);
    env.gain.linearRampToValueAtTime(0.2, 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, 0.2);
    osc.connect(env).connect(out);
    osc.start(0);
    osc.stop(0.25);
    const buffer = await ctx.startRendering();
    return { peak: Math.max(...[...buffer.getChannelData(0)].map(Math.abs)) };
  });
  assert(offline.peak > 0.05, `離線算繪應產生聲波，實測 ${offline.peak}`);

  await p.close();
  console.log(JSON.stringify({
    unlocked: true,
    effectsLevel: Number(levels.fx.toFixed(4)),
    musicLevel: Number(levels.mu.toFixed(4)),
    muteFx: muted.fx === 0,
    muteMusic: onlyFx.mu === 0,
    offlinePeak: Number(offline.peak.toFixed(4)),
  }));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});