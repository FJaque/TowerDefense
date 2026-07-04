/* ============================================================
   Audio: música de fondo suave + efectos, todo con Web Audio API
   (sin ficheros externos, funciona offline y en móvil)
   ============================================================ */
(function () {
  const TD = (window.TD = window.TD || {});

  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    muted: false,
    _musicTimer: null,
    _nextBarTime: 0,
    _bar: 0,

    /* Debe llamarse desde un gesto del usuario (click/tap) */
    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.master);
    },

    setMuted(m) {
      this.muted = m;
      if (this.master) {
        this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05);
      }
    },

    /* ---------- Música ---------- */
    startMusic() {
      this.init();
      if (!this.ctx || this._musicTimer) return;
      this._nextBarTime = this.ctx.currentTime + 0.1;
      this._bar = 0;
      this._musicTimer = setInterval(() => this._scheduler(), 200);
    },

    stopMusic() {
      if (this._musicTimer) {
        clearInterval(this._musicTimer);
        this._musicTimer = null;
      }
    },

    _scheduler() {
      if (!this.ctx) return;
      // programa compases con ~0.8s de antelación
      while (this._nextBarTime < this.ctx.currentTime + 0.8) {
        this._scheduleBar(this._nextBarTime, this._bar);
        this._nextBarTime += 2.0; // compás de 2 s (~120 BPM, 4 tiempos)
        this._bar++;
      }
    },

    _scheduleBar(t, bar) {
      // Progresión suave: C - Am - F - G (frecuencias base)
      const chords = [
        [261.63, 329.63, 392.0],   // C
        [220.0, 261.63, 329.63],   // Am
        [174.61, 220.0, 261.63],   // F
        [196.0, 246.94, 293.66],   // G
      ];
      const chord = chords[bar % 4];

      // Colchón armónico (pad) muy suave
      for (const f of chord) {
        this._padNote(f, t, 2.05, 0.028);
      }
      // Bajo redondo
      this._padNote(chord[0] / 2, t, 1.9, 0.045, 'sine');

      // Melodía tipo cajita de música (pentatónica sobre el acorde)
      const penta = [chord[0] * 2, chord[1] * 2, chord[2] * 2, chord[0] * 3, chord[1] * 3];
      const seq = [0, 2, 1, 3, 0, 4, 2, 1];
      for (let i = 0; i < 4; i++) {
        const idx = seq[(bar * 4 + i) % seq.length];
        // deja silencios de vez en cuando para que respire
        if ((bar + i) % 7 === 3) continue;
        this._bellNote(penta[idx], t + i * 0.5, 0.02);
      }
    },

    _padNote(freq, t, dur, vol, type) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = type || 'triangle';
      o.frequency.value = freq;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(vol, t + 0.4);
      gn.gain.setValueAtTime(vol, t + dur - 0.5);
      gn.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(f).connect(gn).connect(this.musicGain);
      o.start(t);
      o.stop(t + dur + 0.05);
    },

    _bellNote(freq, t, vol) {
      const ctx = this.ctx;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(gn).connect(this.musicGain);
      o.start(t);
      o.stop(t + 1);
      // segundo armónico muy tenue para brillo
      const o2 = ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = freq * 2;
      const g2 = ctx.createGain();
      g2.gain.setValueAtTime(vol * 0.3, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o2.connect(g2).connect(this.musicGain);
      o2.start(t);
      o2.stop(t + 0.5);
    },

    /* ---------- Utilidades SFX ---------- */
    _tone(freq, dur, type, vol, slideTo, when) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (when || 0);
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(this.sfxGain);
      o.start(t);
      o.stop(t + dur + 0.02);
    },

    _noise(dur, vol, filterFreq, when) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + (when || 0);
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filterFreq || 1200;
      const gn = ctx.createGain();
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(gn).connect(this.sfxGain);
      src.start(t);
    },

    /* ---------- Efectos concretos ---------- */
    click()   { this._tone(600, 0.06, 'square', 0.04); },
    place()   { this._tone(320, 0.12, 'sine', 0.12, 160); this._noise(0.08, 0.06, 900); },
    shoot()   { this._tone(720, 0.07, 'triangle', 0.05, 320); },
    fire()    { this._noise(0.18, 0.07, 700); },
    spore()   { this._tone(500, 0.1, 'sine', 0.05, 260); },
    spike()   { this._tone(950, 0.06, 'sawtooth', 0.04, 500); },
    hit()     { this._noise(0.05, 0.06, 1500); },
    coin()    { this._tone(880, 0.07, 'sine', 0.07); this._tone(1320, 0.09, 'sine', 0.06, null, 0.06); },
    death()   { this._noise(0.14, 0.09, 500); this._tone(180, 0.18, 'sine', 0.07, 55); },
    lifeLost(){ this._tone(150, 0.35, 'sawtooth', 0.09, 70); this._noise(0.2, 0.06, 400); },
    upgrade() { [440, 554, 659].forEach((f, i) => this._tone(f, 0.12, 'triangle', 0.07, null, i * 0.07)); },
    sell()    { this._tone(1000, 0.08, 'sine', 0.06); this._tone(700, 0.1, 'sine', 0.05, null, 0.07); },
    wave()    { this._tone(220, 0.25, 'sawtooth', 0.05, 260); this._tone(165, 0.3, 'triangle', 0.05, null, 0.1); },
    freeze()  { this._tone(1400, 0.15, 'sine', 0.03, 2000); },
    win()     { [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.25, 'triangle', 0.08, null, i * 0.13)); },
    lose()    { [392, 349, 311, 262].forEach((f, i) => this._tone(f, 0.32, 'triangle', 0.08, null, i * 0.22)); },
  };

  TD.audio = audio;
})();
