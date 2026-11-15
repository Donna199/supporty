// music.js: the background music, generated in code with the Web Audio API (no audio files).
// A small step sequencer: bass, plucked chord notes, a simple melody and soft percussion in a
// 4-bar loop. It follows the mood (weights {stable, manic, depressive}):
// - stable: relaxed and cheerful.
// - manic: fast, louder and excited: the tune lifts a tone, driving bass, racing notes, claps, the
//   melody an octave up with jittery extra notes and sometimes a clashing one. Exciting, but too much.
// - depressive: very slow, low and quiet: minor chords sunk a fourth, a low drone, a rare low
//   melody note, no drums (sound.js also muffles it).
import { CONFIG } from '../config.js';

const M = CONFIG.sound.music;
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Chords: [root (MIDI note), third above the root]. One chord per bar.
const BRIGHT = [[48, 4], [45, 3], [41, 4], [43, 4]]; // C, A minor, F, G
const LOW = [[45, 3], [41, 4], [38, 3], [40, 3]];    // A minor, F, D minor, E minor
// Melody: 8 notes per bar (null = rest).
const TUNE = [
  [76, 79, 81, 79, 76, null, 72, null],
  [76, null, 72, 74, 76, null, 69, null],
  [77, 81, 84, 81, 77, null, 72, null],
  [79, null, 74, 79, 83, null, 79, null],
];

export class Music {
  /** `out` = where the music goes (a gain node); `noise` = a shared white-noise buffer for the percussion. */
  constructor(ctx, out, noise) {
    this.ctx = ctx;
    this.out = out;
    this.noise = noise;
    this.w = { stable: 1, manic: 0, depressive: 0 };
    this.muted = false;
    this.step = 0;      // 16 steps per bar, 4 bars
    this.next = 0;      // audio-clock time of the next step
  }

  start() {
    clearInterval(this.timer);
    this.timer = setInterval(() => this._schedule(), 60);
  }
  setBlend(w) { this.w = { ...w }; }

  // Schedule a little ahead of the audio clock so the rhythm stays steady.
  _schedule() {
    const c = this.ctx;
    if (c.state !== 'running' || this.muted) return;
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05;
    while (this.next < c.currentTime + 0.25) {
      const { w } = this;
      const bpm = M.bpm.stable * w.stable + M.bpm.manic * w.manic + M.bpm.depressive * w.depressive;
      const len = 60 / bpm / 4; // one 16th note
      this._play(this.step, this.next, len);
      this.step = (this.step + 1) % 64;
      this.next += len;
    }
  }

  _play(step, t, len) {
    const { w } = this;
    const bar = Math.floor(step / 16), s = step % 16;
    const low = w.depressive > 0.5, wild = w.manic > 0.5;
    const [r0, third] = (low ? LOW : BRIGHT)[bar];
    // Manic: the whole tune lifts a tone. Depressive: it sinks a fourth.
    const shift = wild ? M.manicShift : low ? M.depressiveShift : 0;
    const root = r0 + shift;
    const chord = [root, root + third, root + 7];
    const vol = 1 + M.manicBoost * w.manic - M.depressiveCut * w.depressive;

    // ----- Depressive episode: very little happens. A low drone, a slow pluck, a rare low melody note. No drums.
    if (low) {
      if (s === 0) this._note(hz(root - 24), t, len * 15, { type: 'sine', gain: 0.09 * vol, attack: 0.4 });
      if (s % 8 === 0) this._note(hz(chord[[0, 1][(s / 8) % 2]]), t, len * 7, { type: 'sine', gain: 0.05 * vol, attack: 0.05 });
      const n = TUNE[bar][0];
      if (s === 0 && bar % 2 === 0 && n !== null) this._note(hz(n - 24 + shift), t, len * 12, { type: 'sine', gain: 0.04 * vol, attack: 0.08 });
      return;
    }

    // ----- Bass: the chord's root on beats 1 and 3. Manic: a driving bass on every 8th note.
    if (wild) { if (s % 2 === 0) this._note(hz(root - 12 + (s % 4 === 2 ? 12 : 0)), t, len * 1.6, { type: 'triangle', gain: 0.085 * vol }); }
    else if (s % 8 === 0) this._note(hz(root - 12), t, len * 7, { type: 'triangle', gain: 0.1 * vol });

    // ----- Plucked chord notes: every 8th note. Manic: racing 16th notes that climb and fall over two octaves.
    if (wild) this._note(hz(chord[s % 3] + 12 + (s % 8 >= 4 ? 12 : 0)), t, len * 1.1, { type: 'sine', gain: 0.04 * vol });
    else if (s % 2 === 0) this._note(hz(chord[[0, 1, 2, 1][(s / 2) % 4]] + 12), t, len * 1.8, { type: 'sine', gain: 0.045 * vol });

    // ----- Melody. Manic: an octave up and brighter, with jittery in-between notes, now and then one that clashes.
    if (s % 2 === 0) {
      const n = TUNE[bar][s / 2];
      if (n !== null) this._note(hz(n + shift + (wild ? 12 : 0)), t, len * 1.7, { type: 'square', gain: (wild ? 0.03 : 0.034) * vol, filter: wild ? 3600 : 2200 });
    } else if (wild && Math.random() < 0.8) {
      const n = Math.random() < 0.2 ? root + 30 : chord[Math.floor(Math.random() * 3)] + 24;
      this._note(hz(n), t, len * 0.9, { type: 'square', gain: 0.02 * vol, filter: 3800 });
    }

    // ----- Percussion: soft kick on the beat, light tick off the beat.
    // Manic: kick with extra pushes, a clap on beats 2 and 4, ticks on every 16th.
    const drums = 1 - w.depressive;
    if (s % 4 === 0 || (wild && (s === 6 || s === 14))) this._note(110, t, 0.13, { type: 'sine', gain: 0.11 * vol * drums, glide: 45 });
    if (wild && s % 8 === 4) this._tick(t, 0.05 * vol, 1800, 0.09);
    if (wild || s % 4 === 2) this._tick(t, (wild ? 0.02 : 0.016) * drums);
  }

  _note(freq, t, dur, { type = 'sine', gain = 0.05, filter, glide, attack = 0.012 } = {}) {
    const c = this.ctx;
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
      f.frequency.value = filter; // takes the buzzy edge off the square wave
      node = g.connect(f);
    }
    node.connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** A short noise hit: a light tick by default, or a clap with a lower `freq` and longer `dur`. */
  _tick(t, gain, freq = 6000, dur = 0.04) {
    const c = this.ctx;
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = freq;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + dur + 0.01);
  }
}
