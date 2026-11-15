// practice.js: the January practice month ("learn by doing"). Replaces January's normal
// spawns with one item at a time: the game slows to 0.6x, a bouncing arrow marks the
// item, the bottom box says what to do, and the player has to DO it. A miss brings the
// same item back once; a second miss moves on anyway (progress is never blocked).
// Success: a small ✓ and a soft chime, then 2 s at normal speed before the next item.
// Uses real item effects (they go in the run log, marked as practice), but the mood can
// never leave the stable zone here, and practice mood never counts on the end screen.
import { CONFIG } from '../config.js';
import { PRACTICE as TXT } from '../content.js';
import { addGuideArrow } from '../world/guideArrow.js';

const P = CONFIG.practice;

// goal: 'hit' (drive through), 'avoid' (steer away), 'pull' (press Pull in), 'open' (take the open lane).
const STEPS = [
  { id: 'meter' },
  { id: 'medCheckpoint', goal: 'hit', text: TXT.med, ok: TXT.medOk },
  { id: 'allNighter', goal: 'avoid', text: TXT.allNighter, ok: TXT.sleepOk, bad: TXT.moodUp, jump: 'right' },
  { id: 'loss', goal: 'avoid', text: TXT.loss, ok: TXT.lossOk, bad: TXT.moodDown, jump: 'left' },
  { id: 'restStop', goal: 'pull', text: TXT.rest, ok: TXT.restOk },
  { id: 'stigmaBillboard', goal: 'open', text: TXT.stigma, ok: TXT.stigmaOk },
];
/** Items the practice teaches: their "New:" first-time tips are not shown again afterwards. */
export const PRACTISED = ['medCheckpoint', 'allNighter', 'loss', 'restStop', 'stigmaBillboard'];

export class Practice {
  /** `ds` is the DriveScreen. */
  constructor(ds) {
    this.ds = ds;
    this.active = true;
    this.step = 0;
    this.tries = 0;
    this.state = 'start';   // start → meter | coming → gap → … → ready → done
    this.timer = 0;
    this.items = [];
    ds.log.practice = true;
    ds.app.setPhoneScreen('practice');
    ds.hud.skipButton(TXT.skip, () => this.skip());
  }

  /** Game speed while practising: 0.6x while an item is coming, normal otherwise. */
  get timeScale() { return this.state === 'coming' ? P.slow : 1; }
  /** 0..1 through the practice, for the calendar bar. */
  get progress() { return Math.min(1, this.step / STEPS.length); }

  /** Call every frame (after the road items have been updated) with real seconds. */
  update(dt) {
    if (!this.active) return;
    this.items.forEach((it) => it.group.userData.arrowTick?.(dt));
    this.timer -= dt;
    if (this.state === 'start') this._begin();
    else if (this.state === 'meter' && this.timer <= 0) { this.ds.hud.highlightMeter(false); this._next(); }
    else if (this.state === 'coming') this._check();
    else if (this.state === 'gap' && this.timer <= 0) this._begin();
    else if (this.state === 'ready' && this.timer <= 0) this._finish();
  }

  // ---------- Steps ----------
  _begin() {
    const s = STEPS[this.step];
    if (!s) { this._ready(); return; }
    const { hud } = this.ds;
    if (s.id === 'meter') {
      this.state = 'meter';
      this.timer = P.meterSec;
      hud.highlightMeter(true);
      hud.showNow({ text: TXT.meter, tone: 'story', sec: P.meterSec });
      return;
    }
    this.state = 'coming';
    this._spawn(s);
    hud.showNow({ text: s.text, icon: s.id });
    if (s.goal === 'pull') { this.ds.app.setPadHint('pull'); hud.showKeyHint(true); }
  }

  _spawn(s) {
    const { ds } = this;
    const at = ds.app.world.car.s + P.aheadDistance;
    const lane = Math.round(ds.lane);
    // Somewhere the player has to steer to: the middle, or a side lane if already in the middle.
    const other = lane === 0 ? (Math.random() < 0.5 ? -1 : 1) : 0;
    this.items = [];
    if (s.goal === 'open') {
      for (const l of [-1, 0, 1]) {
        const it = ds.items.spawn(l === other ? 'notAlone' : 'stigmaBillboard', { s: at, lane: l });
        if (l === other) this.target = it;
        this.items.push(it);
      }
    } else {
      this.target = ds.items.spawn(s.id, { s: at, lane: s.goal === 'avoid' ? lane : other });
      this.items.push(this.target);
    }
    this.removeArrow = addGuideArrow(this.target);
  }

  /** Has the player done it? Item effects (applyItemEvent) already ran this frame. */
  _check() {
    const s = STEPS[this.step];
    const t = this.target;
    let result = null;
    if (s.goal === 'pull') { if (t.pulled) result = true; else if (t.done) result = false; }
    else if (s.goal === 'open') { if (this.items.every((it) => it.done)) result = t.pop > 0; }
    else if (t.done) result = (t.pop > 0) === (s.goal === 'hit');
    if (result !== null) this._resolve(s, result);
  }

  _resolve(s, ok) {
    const { ds } = this;
    const { hud, mood } = ds;
    this.removeArrow?.();
    this.removeArrow = null;
    ds.app.setPadHint('');
    hud.showKeyHint(false);
    mood.mood = Math.max(-P.maxMood, Math.min(P.maxMood, mood.mood)); // practice stays in the stable zone
    if (ok) {
      ds.app.sound.play('chime');
      hud.showNow({ text: s.ok, tone: 'good', sec: P.pauseSec + 0.5 }); // tone 'good' with no icon shows a ✓
      if (s.id === 'medCheckpoint') hud.flashGuardrails(mood.guardrails);
      this.tries = 0;
      this.step++;
    } else {
      if (s.bad) { hud.showNow({ text: s.bad, tone: s.jump === 'right' ? 'up' : 'down', icon: s.id, sec: P.pauseSec + 0.5 }); hud.needleJump(s.jump); }
      else hud.clearPopup(); // the item's own pop-up (e.g. "Missed medication") shows instead
      this.tries++;
      if (this.tries >= 2) { this.tries = 0; this.step++; } // never block progress
    }
    this.state = 'gap';
    this.timer = ok || this.tries === 0 ? P.pauseSec : P.retryGapSec;
  }

  _next() { this.step++; this.state = 'gap'; this.timer = 0; }

  _ready() {
    this.state = 'ready';
    this.timer = P.readySec;
    this.ds.hud.skipButton(null);
    this.ds.hud.showNow({ text: TXT.ready, tone: 'good', sec: P.readySec });
  }

  // ---------- Ending ----------
  _end() {
    const { ds } = this;
    this.active = false;
    this.removeArrow?.();
    ds.log.practice = false;
    ds.app.setPadHint('');
    ds.app.setPhoneScreen('drive');
    ds.hud.highlightMeter(false);
    ds.hud.showKeyHint(false);
    ds.hud.skipButton(null);
    ds.mood.mood = 0; // practice mood never carries into the year
  }

  /** Practice done: February starts normally. Guardrails earned are kept (never below the start level). */
  _finish() {
    const { ds } = this;
    this._end();
    ds.mood.guardrails = Math.max(CONFIG.mood.startGuardrails, ds.mood.guardrails);
    PRACTISED.forEach((id) => ds.tipsShown.add(id));
    ds.time = CONFIG.secondsPerMonth;
    ds.spawner.skipTo(ds.time);
  }

  /** "Skip practice": January plays with its normal spawns, from the start, and the rest of the
   *  run has no teaching: no January hints, no "New:" tips, no slow-downs. */
  skip() {
    if (!this.active) return;
    const { ds } = this;
    this._end();
    ds.noTutorial = true;
    ds.items.clear();
    ds.mood.guardrails = CONFIG.mood.startGuardrails;
    ds.hud.clearPopup();
  }
}
