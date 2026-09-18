// 所有聲音即場合成；只在主動觸控後建立音訊，不下載任何素材。
export class SoundGarden {
  constructor() {
    this.settings = { effects: true, music: true };
    try { Object.assign(this.settings, JSON.parse(localStorage.getItem('wubaobao-sound') || '{}')); } catch {}
    this.ctx = null;
    this.last = {};
    this.voices = 0;
    document.addEventListener('pointerdown', () => this.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) { this.ctx.suspend().catch(() => {}); }
      else this.unlock();
    });
    for (const kind of ['effects', 'music']) {
      const button = document.getElementById(kind + 'Toggle');
      button.addEventListener('click', () => {
        this.settings[kind] = !this.settings[kind];
        try { localStorage.setItem('wubaobao-sound', JSON.stringify(this.settings)); } catch {}
        this.update();
        if (kind === 'music' && this.settings.music) this.ambient();
      });
    }
    this.update();
  }
  update() {
    for (const kind of ['effects', 'music']) {
      const enabled = !!this.settings[kind];
      const button = document.getElementById(kind + 'Toggle');
      button.setAttribute('aria-pressed', String(enabled));
      button.title = button.ariaLabel = `${enabled ? '關閉' : '開啟'}${kind === 'effects' ? '音效' : '音樂'}`;
      button.querySelector('span').textContent = `${kind === 'effects' ? '音效' : '音樂'}${enabled ? '' : '關'} `;
      if (this.ctx) this[kind].gain.setTargetAtTime(enabled ? (kind === 'music' ? .13 : .38) : 0, this.ctx.currentTime, .025);
    }
  }
  unlock() {
    try {
      if (!this.ctx) {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) return;
        this.ctx = new Context();
        for (const kind of ['effects', 'music']) {
          this[kind] = this.ctx.createGain();
          this[kind].gain.value = 0;
          this[kind].connect(this.ctx.destination);
        }
        this.update();
        this.ambient();
        this.timer = setInterval(() => this.ambient(), 8000);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch { /* 無音訊裝置時，遊戲繼續。 */ }
  }
  note(freq, delay = 0, duration = .2, volume = .12, type = 'sine', bus = 'effects', endFreq = freq) {
    if (!this.ctx || this.ctx.state === 'closed' || this.voices >= 48) return;
    const time = this.ctx.currentTime + delay;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, time);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, time + duration);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(volume, time + .015);
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(envelope).connect(this[bus]);
    this.voices++;
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); this.voices--; };
    oscillator.start(time);
    oscillator.stop(time + duration + .02);
  }
  play(event, level = 0) {
    if (!this.ctx || !this.settings.effects) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[event] ?? -1) < .07) return;
    this.last[event] = now;
    if (event === 'tap') this.note(520, 0, .14, .22, 'sine', 'effects', 150);
    if (event === 'pop') { this.note(1000, 0, .085, .18, 'triangle', 'effects', 180); }
    if (event === 'rise') this.note(523 * 2 ** (Math.floor(level * 8) / 12), 0, .3, .1);
    if (event === 'reveal') {
      [262, 330, 392, 523].forEach((f, i) => this.note(f, i * .13, .55, .10, 'triangle'));
      [1047, 784].forEach((f, i) => this.note(f, .6 + i * .22, .9, .14));
    }
    if (event === 'celebrate') [659, 784, 1047, 1319].forEach((f, i) => this.note(f, .45 + i * .12, .65, .10));
  }
  ambient() {
    if (!this.ctx || document.hidden || !this.settings.music) return;
    [262, 330, 392, 330].forEach((f, i) => {
      this.note(f / 2, i * 2, 3.5, .09, 'sine', 'music');
      this.note(f, i * 2 + .6, 2.8, .035, 'sine', 'music');
    });
  }
}
