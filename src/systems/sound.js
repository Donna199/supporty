// sound.js: every sound in the game, generated in code with the Web Audio API
// (oscillators, noise, filters, envelopes). No audio files.
// - One-shot effects: soft and short (< 0.6 s), at most 4 playing at once.
// - Ambience loops per phase (breeze, manic pulse, rain), crossfaded when the mood changes. No engine hum.
// - In a depressive episode a low-pass filter muffles everything.
// Browsers only allow audio after a click/key on this page, so unlock() is called from a user gesture.
import { CONFIG } from '../config.js';

const S = CONFIG.sound;
const NOTE = { C4: 261.6, E4: 329.6, F4: 349.2, G4: 392, A4: 440, C5: 523.3, E5: 659.3, G5: 784, B5: 987.8, C6: 1046.5, D6: 1174.7, G6: 1568, B6: 1975.5 };

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.voices = 0;
    this.blend = { stable: 1, manic: 0, depressive: 0 };
  }

  get unlocked() { return !!this.ctx && this.ctx.state === 'running'; }

  /** Call from a click / key press on the game page. Safe to call many times. */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._build();
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
    } catch { /* no audio: the game stays silent */ }
  }

  setMuted(on) {
    this.muted = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0 : S.master, this.ctx.currentTime, 0.05);
  }

  // ---------- Graph: sfx + ambience → muffle (low-pass) → master → speakers ----------
  _build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : S.master;
    this.master.connect(c.destination);
    this.muffle = c.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 18000;
    this.muffle.connect(this.master);
    this.sfx = c.createGain();
    this.sfx.gain.value = S.sfx;
    this.sfx.connect(this.muffle);
    this.amb = c.createGain();
    this.amb.gain.value = S.ambience;
    this.amb.connect(this.muffle);
    // Shared noise buffer (2 s of white noise).
    this.noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this._buildAmbience();
    this.setBlend(this.blend, 'stable', true);
  }

  _noise(loop = false) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = loop;
    return n;
  }

  _buildAmbience() {
    const c = this.ctx, A = S.layers;
    // Breeze: band-passed noise (stable).
    const breeze = this._noise(true);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 700;
    bp.Q.value = 0.6;
    this.breezeGain = c.createGain();
    this.breezeGain.gain.value = 0;
    breeze.connect(bp).connect(this.breezeGain).connect(this.amb);
    // Manic pulse: a soft triangle note switched on and off by a fast square LFO.
    const pulse = c.createOscillator();
    pulse.type = 'triangle';
    pulse.frequency.value = 220;
    const chop = c.createGain();
    chop.gain.value = 0.5;
    const chopLfo = c.createOscillator();
    chopLfo.type = 'square';
    chopLfo.frequency.value = 6;
    const chopDepth = c.createGain();
    chopDepth.gain.value = 0.5;
    chopLfo.connect(chopDepth).connect(chop.gain);
    this.pulseGain = c.createGain();
    this.pulseGain.gain.value = 0;
    pulse.connect(chop).connect(this.pulseGain).connect(this.amb);
    // Rain: high-ish filtered noise (depressive), plus random soft droplets (see _droplet).
    const rain = this._noise(true);
    const rainHP = c.createBiquadFilter();
    rainHP.type = 'highpass';
    rainHP.frequency.value = 900;
    const rainLP = c.createBiquadFilter();
    rainLP.type = 'lowpass';
    rainLP.frequency.value = 5000;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    rain.connect(rainHP).connect(rainLP).connect(this.rainGain).connect(this.amb);
    for (const n of [breeze, pulse, chopLfo, rain]) n.start();
    this.dropTimer = setInterval(() => {
      if (this.blend.depressive > 0.3 && Math.random() < this.blend.depressive) this._droplet();
    }, 260);
  }

  _droplet() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(1400 + Math.random() * 1200, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(S.layers.droplet * this.blend.depressive, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g).connect(this.amb);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** Ambience + muffle follow the mood: weights {stable, manic, depressive}; crossfades over ~2 s. */
  setBlend(w, phase = 'stable', instant = false) {
    const changed = Math.abs(w.manic - this.blend.manic) + Math.abs(w.depressive - this.blend.depressive) > 0.02;
    this.blend = { ...w };
    if (!this.ctx || (!changed && !instant)) return;
    const t = this.ctx.currentTime, tc = instant ? 0.01 : S.crossfadeSec / 3, A = S.layers;
    this.breezeGain.gain.setTargetAtTime(A.breeze * w.stable, t, tc);
    this.pulseGain.gain.setTargetAtTime(A.pulse * w.manic, t, tc);
    this.rainGain.gain.setTargetAtTime(A.rain * w.depressive, t, tc);
    // Muffle everything as the mood leans low; fully muffled in a depressive episode.
    const hz = 18000 * Math.pow(S.muffleHz / 18000, w.depressive);
    this.muffle.frequency.setTargetAtTime(hz, t, tc);
  }

  // ---------- One-shot building blocks ----------
  _tone(freq, at, dur, { type = 'sine', gain = 0.25, attack = 0.01, glide, out = this.sfx, filter } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node = g.connect(f);
    }
    node.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noiseHit(at, dur, { type = 'bandpass', freq = 1500, to, Q = 1, gain = 0.2, attack = 0.005 } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const n = this._noise(), f = c.createBiquadFilter(), g = c.createGain();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = Q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.sfx);
    n.start(t, Math.random());
    n.stop(t + dur + 0.02);
  }

  /** Play a named one-shot. Dropped silently if audio is locked or 4 are already playing. */
  play(name, opts = {}) {
    if (!this.unlocked || this.muted) return;
    const fx = SOUNDS[name];
    if (!fx || this.voices >= S.maxVoices) return;
    this.voices++;
    const len = fx.call(this, opts) ?? 0.5;
    setTimeout(() => { this.voices--; }, len * 1000 + 30);
  }

  /** Testing helper: plays every sound in turn (call __app.sound.demo() in the console). */
  demo(gap = 900) {
    Object.keys(SOUNDS).forEach((name, i) => setTimeout(() => { console.log('♪', name); this.play(name); }, i * gap));
  }
}

// Each returns its length in seconds (all under 0.6 s).
const SOUNDS = {
  // ----- Support: gentle rewards -----
  medication() { // calm two-note chime going up (a routine, not a fanfare)
    this._tone(NOTE.C5, 0, 0.3, { type: 'triangle', gain: 0.16 });
    this._tone(NOTE.E5, 0.14, 0.36, { type: 'triangle', gain: 0.14 });
    return 0.5;
  },
  restStop() { // three-note rising chime, lower and softer
    [NOTE.E4, NOTE.G4, NOTE.C5].forEach((f, i) => this._tone(f, i * 0.12, 0.3, { type: 'sine', gain: 0.12 }));
    return 0.55;
  },
  routineCheckpoint() { // soft tick-ding
    this._noiseHit(0, 0.03, { type: 'highpass', freq: 3000, gain: 0.08 });
    this._tone(880, 0.05, 0.4, { type: 'sine', gain: 0.13 });
    return 0.45;
  },
  therapyPit() { // warm major chord swell
    [NOTE.C4, NOTE.E4, NOTE.G4].forEach((f) => this._tone(f, 0, 0.52, { type: 'triangle', gain: 0.09, attack: 0.2 }));
    return 0.55;
  },
  familyPit() { // warm major chord swell (a different, equally soft chord)
    [NOTE.F4, NOTE.A4, NOTE.C5].forEach((f) => this._tone(f, 0, 0.52, { type: 'triangle', gain: 0.09, attack: 0.2 }));
    return 0.55;
  },
  chime() { // practice month: a small, soft "well done" (two quiet bell notes)
    this._tone(NOTE.G5, 0, 0.35, { type: 'sine', gain: 0.1 });
    this._tone(NOTE.C6, 0.1, 0.4, { type: 'sine', gain: 0.08 });
    return 0.5;
  },
  coin({ dull = false } = {}) { // tiny high blip; dull thunk in a depressive episode
    if (dull) this._tone(150, 0, 0.12, { type: 'sine', gain: 0.12, glide: 110, filter: 600 });
    else this._tone(1320, 0, 0.09, { type: 'sine', gain: 0.08, glide: 1760 });
    return 0.13;
  },

  // ----- Triggers -----
  stigmaBillboard({ crack = false } = {}) { // gentle "nope": two low notes going down, plus a crack if a guardrail goes
    this._tone(233, 0, 0.2, { type: 'triangle', gain: 0.14 });
    this._tone(175, 0.18, 0.3, { type: 'triangle', gain: 0.13 });
    if (crack) this._noiseHit(0.36, 0.06, { type: 'highpass', freq: 2200, gain: 0.12 });
    return 0.5;
  },
  loss() { // low soft thud
    this._tone(95, 0, 0.32, { type: 'sine', gain: 0.25, glide: 45 });
    this._noiseHit(0, 0.12, { type: 'lowpass', freq: 400, gain: 0.08 });
    return 0.35;
  },
  criticism() { // muffled low "womp"
    this._tone(190, 0, 0.36, { type: 'sawtooth', gain: 0.1, glide: 105, filter: 450, attack: 0.04 });
    return 0.4;
  },
  trophy() { // bright, fast rising sparkle: feels great, slightly too much
    [NOTE.G5, NOTE.B5, NOTE.D6, NOTE.G6, NOTE.B6].forEach((f, i) => this._tone(f, i * 0.05, 0.22, { type: 'sine', gain: 0.11 }));
    this._noiseHit(0.05, 0.3, { type: 'highpass', freq: 6000, gain: 0.03 });
    return 0.45;
  },
  allNighter() { // quick tick-tock
    this._noiseHit(0, 0.035, { freq: 2600, Q: 4, gain: 0.14 });
    this._noiseHit(0.16, 0.035, { freq: 1300, Q: 4, gain: 0.14 });
    return 0.25;
  },
  redEye() { // short airy whoosh
    this._noiseHit(0, 0.5, { freq: 400, to: 1800, Q: 0.8, gain: 0.12, attack: 0.2 });
    return 0.52;
  },
  scheduleChaos() { // fast scrambled ticking
    for (let i = 0; i < 8; i++) this._noiseHit(i * 0.045 + Math.random() * 0.02, 0.025, { freq: 1200 + Math.random() * 2400, Q: 5, gain: 0.1 });
    return 0.45;
  },

  // ----- Episodes, driving, finish, UI -----
  manicStart() { // short rising swell
    this._tone(300, 0, 0.5, { type: 'triangle', gain: 0.12, glide: 620, attack: 0.25 });
    this._tone(450, 0, 0.5, { type: 'sine', gain: 0.07, glide: 930, attack: 0.25 });
    return 0.52;
  },
  depressiveStart() { // short falling, softening tone
    this._tone(440, 0, 0.55, { type: 'sine', gain: 0.14, glide: 210, filter: 1200 });
    return 0.57;
  },
  laneChange() { // very quiet swish
    this._noiseHit(0, 0.12, { freq: 900, to: 2200, Q: 0.7, gain: 0.03, attack: 0.04 });
    return 0.14;
  },
  finish() { // warm, gentle major chord
    [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5].forEach((f, i) => this._tone(f, i * 0.03, 0.55, { type: 'triangle', gain: 0.08, attack: 0.08 }));
    return 0.6;
  },
  click() { // soft UI click
    this._tone(900, 0, 0.04, { type: 'sine', gain: 0.07 });
    return 0.05;
  },
};
