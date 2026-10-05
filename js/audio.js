// 所有聲音即場合成，不下載任何素材，離線與 iPad 都可跑。
// 音色取古琴與古磬：正弦為主、加少量泛音，音量刻意壓低，不吵 Baby。
// 只在使用者主動互動後才建立 AudioContext（行動版 Safari 自動播放限制）。
// 同時發聲的振盪器上限，避免密集擲爻時聲部無限增加。
const MAX_VOICES = 40;

export class SoundGarden {
  constructor() {
    this.settings = { effects: true, music: true };
    try {
      Object.assign(this.settings, JSON.parse(localStorage.getItem('wubaobao-sound') || '{}'));
    } catch {}
    this.ctx = null;
    this.last = {};
    this.voices = 0;
    document.addEventListener('pointerdown', () => this.unlock(), { capture: true });
    document.addEventListener('keydown', () => this.unlock(), { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.unlock();
    });
    for (const kind of ['effects', 'music']) {
      const button = document.getElementById(kind + 'Toggle');
      if (!button) continue;
      button.addEventListener('click', () => {
        this.settings[kind] = !this.settings[kind];
        try {
          localStorage.setItem('wubaobao-sound', JSON.stringify(this.settings));
        } catch {}
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
      if (!button) continue;
      button.setAttribute('aria-pressed', String(enabled));
      button.title = button.ariaLabel = `${enabled ? '關閉' : '開啟'}${kind === 'effects' ? '音效' : '音樂'}`;
      const label = button.querySelector('span');
      if (label) label.textContent = `${kind === 'effects' ? '音效' : '音樂'}${enabled ? '' : '關'}`;
      if (this.ctx && this[kind]) {
        this[kind].gain.setTargetAtTime(
          enabled ? (kind === 'music' ? 0.1 : 0.34) : 0,
          this.ctx.currentTime,
          0.025,
        );
      }
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
          // 每軌各接一個分析節點：直接量測實際輸出。
          // WebKit 的 AudioParam.value 不反映 setTargetAtTime 的排程結果，
          // 只有量波形才驗得到「真的靜音了」。
          const analyser = this.ctx.createAnalyser();
          analyser.fftSize = 256;
          this[kind + 'Analyser'] = analyser;
          this[kind + 'Buffer'] = new Uint8Array(analyser.fftSize);
          this[kind].connect(analyser).connect(this.ctx.destination);
        }
        this.update();
        this.ambient();
        this.timer = setInterval(() => this.ambient(), 9000);
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    } catch {
      /* 沒有音訊輸出時，遊戲照常進行。 */
    }
  }

  // 量測某一軌的實際輸出，0～1。0 代表沒有聲音。
  outputLevel(kind) {
    const analyser = this[kind + 'Analyser'];
    const buffer = this[kind + 'Buffer'];
    if (!analyser || !buffer) return 0;
    analyser.getByteTimeDomainData(buffer);
    let peak = 0;
    for (let i = 0; i < buffer.length; i++) {
      const d = buffer[i] - 128;
      if (d < 0 ? -d > peak : d > peak) peak = Math.abs(d);
    }
    return peak / 128;
  }

  // 古琴式泛音：基頻正弦 + 兩個較弱的倍頻，短促乾淨
  note(freq, delay = 0, duration = 0.2, volume = 0.12, bus = 'effects', harmonic = true) {
    if (!this.ctx || this.ctx.state === 'closed' || this.voices >= MAX_VOICES) return;
    const time = this.ctx.currentTime + delay;
    const mix = this.ctx.createGain();
    mix.gain.value = harmonic ? 0.32 : 1;
    mix.connect(this[bus]);
    for (const [ratio, amp] of harmonic ? [[1, 1], [2, 0.3], [3, 0.12]] : [[1, 1]]) {
      if (this.voices >= MAX_VOICES) break;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * ratio, time);
      env.gain.setValueAtTime(0, time);
      env.gain.linearRampToValueAtTime(volume * amp, time + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      osc.connect(env).connect(mix);
      this.voices++;
      osc.onended = () => {
        osc.disconnect();
        env.disconnect();
        this.voices--;
      };
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }
    setTimeout(() => mix.disconnect(), (delay + duration + 0.1) * 1000);
  }

  play(event, level = 0) {
    if (!this.ctx || !this.settings.effects) return;
    const now = this.ctx.currentTime;
    if (now - (this.last[event] ?? -1) < 0.06) return;
    this.last[event] = now;

    // 擲爻：木魚般的一記短叩
    if (event === 'cast') {
      this.note(392, 0, 0.14, 0.2);
      this.note(784, 0.02, 0.09, 0.07, 'effects', false);
    }
    // 成卦：古磬一響
    if (event === 'hexagram') {
      [523.25, 659.25, 783.99].forEach((f, i) => this.note(f, i * 0.1, 0.9, 0.11));
    }
    // 點一下空白
    if (event === 'tap') this.note(330, 0, 0.12, 0.14);
    // 進度攀爬：音階隨進度上行
    if (event === 'rise') {
      this.note(261.63 * 2 ** (Math.floor(level * 7) / 12), 0, 0.34, 0.09);
    }
    // 取名：小號角般的上行樂句
    if (event === 'reveal') {
      [261.63, 329.63, 392, 523.25].forEach((f, i) => this.note(f, i * 0.12, 0.6, 0.1));
      [1046.5, 783.99, 659.25].forEach((f, i) => this.note(f, 0.58 + i * 0.2, 1, 0.12));
    }
    // 慶祝
    if (event === 'celebrate') {
      [587.33, 739.99, 880, 1174.66].forEach((f, i) => this.note(f, 0.42 + i * 0.11, 0.7, 0.09));
    }
  }

  // 背景氛圍：五聲音階的長音，極低音量重複
  ambient() {
    if (!this.ctx || document.hidden || !this.settings.music) return;
    const scale = [196, 220, 261.63, 293.66, 329.63, 392];
    const base = scale[Math.floor(Math.random() * scale.length)];
    this.note(base, 0, 4.5, 0.075, 'music', false);
    this.note(base * 1.5, 0.9, 3.6, 0.028, 'music', false);
  }
}