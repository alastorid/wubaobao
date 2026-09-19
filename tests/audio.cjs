const { webkit } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await webkit.launch();
  const p = await browser.newPage();
  await p.addInitScript(() => {
    window.audioMeters = [];
    const original = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (destination, ...args) {
      if (destination instanceof AudioDestinationNode) {
        const analyser = this.context.createAnalyser();
        const silent = this.context.createGain();
        silent.gain.value = 0;
        original.call(this, analyser);
        original.call(analyser, silent);
        original.call(silent, destination);
        audioMeters.push(analyser);
      }
      return original.call(this, destination, ...args);
    };
    window.audioPeak = () =>
      Math.max(
        0,
        ...audioMeters.map((a) => {
          const data = new Float32Array(a.fftSize);
          a.getFloatTimeDomainData(data);
          return Math.max(...data.map(Math.abs));
        }),
      );
  });
  await p.goto((process.argv[2] || "http://localhost:8123/") + "?qa");
  await p.waitForFunction(() => window.wubaobaoQA);
  assert.equal(await p.evaluate(() => wubaobaoQA().audio), undefined);
  await p.mouse.click(3, 200);
  await p.waitForTimeout(60);
  assert((await p.evaluate(() => audioPeak())) > 0.00001);
  await p.locator("#effectsToggle").click();
  await p.locator("#musicToggle").click();
  await p.waitForTimeout(250);
  assert((await p.evaluate(() => audioPeak())) < 0.0001);
  assert.deepEqual(await p.evaluate(() => wubaobaoQA().sound), {
    effects: false,
    music: false,
  });
  await p.locator("#effectsToggle").click();
  await p.mouse.click(3, 200);
  await p.waitForTimeout(40);
  assert((await p.evaluate(() => audioPeak())) > 0.00001);
  assert.equal(await p.evaluate(() => wubaobaoQA().sound.music), false);
  console.log(
    "Audio: gesture unlock, waveform, independent mute and silence passed",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
