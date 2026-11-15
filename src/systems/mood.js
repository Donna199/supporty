// mood.js: the mood needle (-100 low … +100 high), guardrails, drift and episodes.
// PRD rules: pushes are cut by guardrails, mood drifts back to centre, and reaching
// ±100 starts a manic or depressive episode with a timer. Episodes always end.
// Agreed additions: drift waits a few seconds after a push, and in a leaning zone
// mood keeps moving outward until support (rest stop, routine) breaks the cycle.
import { CONFIG } from '../config.js';

const M = CONFIG.mood;
const E = CONFIG.episode;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Mood {
  constructor({ guardrails = M.startGuardrails } = {}) {
    this.mood = 0;
    this.guardrails = guardrails;
    this.phase = 'stable';          // 'stable' | 'manic' | 'depressive'
    this.episodeTimer = 0;
    this.episodeLength = 0;
    this.sincePush = 99;
    this.recovering = false;        // drifting back to centre after an episode or support
    this.onPhase = null;            // callback(newPhase, oldPhase)
  }

  get pushScale() { return 1 - M.pushCutPerGuardrail * this.guardrails; }
  get inEpisode() { return this.phase !== 'stable'; }
  get zone() {
    if (this.phase !== 'stable') return this.phase;
    if (this.mood > M.stable) return 'leanHigh';
    if (this.mood < -M.stable) return 'leanLow';
    return 'stable';
  }

  /** A trigger pushes the needle. Returns the push actually applied. */
  push(amount) {
    if (this.inEpisode) return 0; // the needle stays pinned during an episode
    const applied = amount * this.pushScale;
    this.mood = clamp(this.mood + applied, M.min, M.max);
    this.sincePush = 0;
    this.recovering = false;
    this._checkEdge();
    return applied;
  }

  /** Support moves the needle toward the centre and breaks a leaning cycle. */
  toCentre(amount) {
    if (this.inEpisode) return 0;
    const before = this.mood;
    this.mood = Math.sign(this.mood) * Math.max(0, Math.abs(this.mood) - amount);
    if (Math.abs(this.mood) > M.stable) this.recovering = true;
    return Math.abs(before) - Math.abs(this.mood);
  }

  addGuardrails(n) {
    this.guardrails = clamp(this.guardrails + n, 0, M.maxGuardrails);
  }

  /** Change the episode timer (negative = support shortens it). */
  changeEpisode(sec) {
    if (!this.inEpisode) return 0;
    const before = this.episodeTimer;
    this.episodeTimer = Math.max(0.5, this.episodeTimer + sec);
    return this.episodeTimer - before;
  }

  update(dt) {
    this.sincePush += dt;
    if (this.inEpisode) {
      this.episodeTimer -= dt;
      if (this.episodeTimer <= 0) this._endEpisode();
      return;
    }
    const a = Math.abs(this.mood);
    if (a <= M.stable) this.recovering = false;
    if (a > M.stable && !this.recovering) {
      // Leaning: the cycle feeds itself (less sleep → higher mood → less sleep), slowed by guardrails.
      const rate = M.escalatePerSec * Math.max(0, 1 - M.escalateCutPerGuardrail * this.guardrails);
      this.mood = clamp(this.mood + Math.sign(this.mood) * rate * dt, M.min, M.max);
      this._checkEdge();
    } else if (this.sincePush >= M.driftDelaySec || this.recovering) {
      const drift = M.driftPerSec * (1 + M.driftPerGuardrail * this.guardrails) * dt;
      this.mood = Math.sign(this.mood) * Math.max(0, a - drift);
    }
  }

  _checkEdge() {
    if (this.mood >= M.max) this._startEpisode('manic');
    else if (this.mood <= M.min) this._startEpisode('depressive');
  }

  _startEpisode(phase) {
    const old = this.phase;
    this.phase = phase;
    this.mood = phase === 'manic' ? M.max : M.min;
    this.episodeTimer = this.episodeLength = phase === 'manic' ? E.maniaSec : E.depressionSec;
    this.onPhase?.(phase, old);
  }

  _endEpisode() {
    const old = this.phase;
    this.mood = old === 'manic' ? E.resetTo : -E.resetTo;
    this.phase = 'stable';
    this.episodeTimer = 0;
    this.recovering = true; // drift back to centre (PRD), don't fall straight back in
    this.onPhase?.('stable', old);
  }
}
