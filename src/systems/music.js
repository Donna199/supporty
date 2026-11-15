// music.js: the background music, generated in code with the Web Audio API (no audio files).
// A small step sequencer: bass, plucked chord notes, a simple melody and soft percussion in a
// 4-bar loop. It follows the mood (weights {stable, manic, depressive}):
// - stable: relaxed and cheerful.
// - manic: faster and restless, the melody jumps up, jittery extra notes, sometimes a tense one.
//   It should sound like too much, never simply like fun.
// - depressive: slow, minor chords, no drums, only a few low melody notes (sound.js also muffles it).
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
    const [root, third] = (low ? LOW : BRIGHT)[bar];
    const chord = [root, root + third, root + 7];
    const vol = 1 - 0.3 * w.depressive;

    // Bass: the chord's root on beats 1 and 3 (plus an octave hop when manic).
    if (s % 8 === 0) this._note(hz(root - 12), t, len * 7, { type: 'triangle', gain: 0.1 * vol });
    if (wild && s % 8 === 6) this._note(hz(root), t, len * 1.5, { type: 'triangle', gain: 0.07 });

    // Plucked chord notes: every 8th note, or slow and sparse when low.
    if (low ? s % 4 === 0 : s % 2 === 0) {
      const i = [0, 1, 2, 1][(low ? s / 4 : s / 2) % 4];
      this._note(hz(chord[i] + 12), t, len * (low ? 5 : 1.8), { type: 'sine', gain: 0.045 * vol });
    }

    // Melody.
    if (s % 2 === 0) {
      const n = TUNE[bar][s / 2];
      if (n !== null) {
        if (low) { if (s === 0 || s === 8) this._note(hz(n - 15), t, len * 6, { type: 'sine', gain: 0.045 }); }
        else this._note(hz(n + (wild ? 12 : 0)), t, len * 1.7, { type: 'square', gain: wild ? 0.028 : 0.034, filter: wild ? 3200 : 2200 });
      }
    } else if (wild && Math.random() < 0.75) {
      // Manic: jittery in-between notes, now and then one that clashes (a raised 4th).
      const n = Math.random() < 0.2 ? root + 30 : chord[Math.floor(Math.random() * 3)] + 24;
      this._note(hz(n), t, len * 0.9, { type: 'square', gain: 0.018, filter: 3400 });
    }

    // Percussion: soft kick on the beat, light tick off the beat. None in a depressive episode.
    if (!low) {
      if (s % 4 === 0) this._note(110, t, 0.13, { type: 'sine', gain: 0.11 * (1 - w.depressive), glide: 45 });
      if (s % 4 === 2 || (wild && s % 2 === 1)) this._tick(t, wild ? 0.02 : 0.016);
    }
  }

  _note(freq, t, dur, { type = 'sine', gain = 0.05, filter, glide } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
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

  _tick(t, gain) {
    const c = this.ctx;
    const n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    n.buffer = this.noise;
    f.type = 'highpass';
    f.frequency.value = 6000;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(f).connect(g).connect(this.out);
    n.start(t, Math.random());
    n.stop(t + 0.05);
  }
}
