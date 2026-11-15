// runLog.js: records the run so the end screen can show it. Mood every 0.5 s,
// every road event, and when each episode started and ended. Events from the January
// practice month are kept but marked `practice`, and never count toward the end-screen stats.
import { CONFIG } from '../config.js';

export class RunLog {
  constructor() {
    this.samples = [];   // {t, mood, phase}
    this.events = [];    // {t, id, type, effect, mood}
    this.episodes = [];  // {phase, start, end}
    this.next = 0;
    this.practice = false; // true during the practice month
  }

  sample(t, mood, phase) {
    if (t < this.next) return;
    this.samples.push({ t, mood, phase });
    this.next = t + 0.5;
  }

  event(t, id, type, effect, mood) {
    this.events.push({ t, id, type, effect, mood: mood.mood, ...(this.practice ? { practice: true } : {}) });
  }

  phase(t, phase, old) {
    if (phase !== 'stable') this.episodes.push({ phase, start: t, end: null });
    else if (old !== 'stable') { const e = this.episodes.at(-1); if (e && e.end === null) e.end = t; }
  }

  finish(t) {
    const e = this.episodes.at(-1);
    if (e && e.end === null) e.end = t;
    this.length = t;
  }

  /** Numbers for the end screen. */
  summary() {
    const events = this.events.filter((e) => !e.practice);
    const stable = this.samples.filter((s) => s.phase === 'stable' && Math.abs(s.mood) <= CONFIG.mood.stable).length;
    const support = events.filter((e) => e.type === 'pull' && e.effect === 'pulled in'
      || (e.type === 'hit' && ['medCheckpoint', 'routineCheckpoint', 'supportive'].includes(e.id))).length;
    return {
      stableDays: Math.round((stable / Math.max(1, this.samples.length)) * 365),
      manic: this.episodes.filter((e) => e.phase === 'manic').length,
      depressive: this.episodes.filter((e) => e.phase === 'depressive').length,
      support,
      missedMeds: events.filter((e) => e.id === 'medCheckpoint' && e.type === 'miss').length,
      coins: this.coins || { collected: 0, points: 0, dull: 0 },
    };
  }

  /** One personalised reflection, picked by simple rules from what happened. */
  reflection() {
    const before = (ep, ids, sec) => this.events.some((e) => !e.practice && ids.includes(e.id) && e.type === 'hit' && e.t <= ep.start && e.t >= ep.start - sec);
    const manic = this.episodes.filter((e) => e.phase === 'manic');
    const dep = this.episodes.filter((e) => e.phase === 'depressive');
    const s = this.summary();
    if (manic.length && manic.some((ep) => before(ep, ['allNighter', 'redEye'], 30))) {
      return 'Your high-mood stretch started after lost sleep. In a large study, about 1 in 5 people with bipolar disorder reported that sleep loss had triggered a high-mood episode.';
    }
    if (dep.length && dep.some((ep) => before(ep, ['loss', 'criticism', 'stigmaBillboard'], 35))) {
      return 'Your low stretch followed a loss and harsh words. Negative life events and family criticism are linked to depressive symptoms and relapse, and support from family lowers that risk.';
    }
    if (s.missedMeds >= 3) {
      return 'Several missed medication checkpoints left you with fewer guardrails. Mood stabilizers work over time, by making episodes less likely, not by fixing a single day.';
    }
    if (s.support >= 10) {
      return 'You pulled in for support again and again. Rest, routine, therapy and people who care do not remove bipolar disorder, but they make the road steadier.';
    }
    if (!manic.length && !dep.length) {
      return 'Your year stayed mostly on the stable road. In real life, treatment lowers the chance of episodes but cannot always prevent them, and that is not anyone’s fault.';
    }
    return 'Episodes came and went, and every one of them ended. Bipolar I disorder has stable stretches in between, and support shortens the hard parts.';
  }
}
