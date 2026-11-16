// Hud.js: the drive screen's heads-up display (HTML on top of the 3D view).
// Top: mood gauge, a curved band LOW – STABLE – HIGH with a needle and word labels (not colour only).
// Top-left: calendar (phase colour during episodes) and coin count.
// Top-right: guardrail level, pause, and in a manic episode a rear-view mirror
// where friends fall behind (impaired social functioning).
// Bottom centre: ONE pop-up box for hits, first-time tips, story and episode captions,
// shown one at a time from a short queue. Bottom-right: the "Pull in" prompt, and in the
// January practice month a small "Skip practice" button and a "Space = Pull in" hint.
import { CONFIG } from '../config.js';
import { iconFor } from '../world/thumbs.js';

const M = CONFIG.mood;
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Guardrail level: a small shield with a fence on it (filled when that level is held).
const fence = '<svg class="gr-fence" viewBox="0 0 24 28" aria-hidden="true"><path class="sh" d="M12 1.5 21.5 5v8.2c0 6.2-4 10.9-9.5 13.3C6.5 24.1 2.5 19.4 2.5 13.2V5z"/><path class="rail" d="M7 11.2h10M7 16h10M8.8 8.6v10M12 8.6v10M15.2 8.6v10"/></svg>';
// Simple line icons for pop-ups that have no item picture.
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const UP = svg('M12 19V5M5.5 11.5 12 5l6.5 6.5'), DOWN = svg('M12 5v14M5.5 12.5 12 19l6.5-6.5');
const GLYPH = { up: UP, down: DOWN, manic: UP, depressive: DOWN, good: svg('M5 12.5l4.5 4.5L19 7.5'), info: svg('M12 11v6M12 7.2v.1'),
  story: svg('M12 3.5l2.3 5.6 6 .5-4.6 3.9 1.4 5.9L12 16.3l-5.1 3.1 1.4-5.9L3.7 9.6l6-.5z') };

// The mood gauge: a gently curved band (part of a big circle) with LOW / STABLE / HIGH zones.
const G = { w: 560, cy: 930, r: 900, band: 40, half: 16.66 };            // half = degrees from the middle to each end
const onArc = (deg, r = G.r) => { const a = (deg * Math.PI) / 180; return [G.w / 2 + r * Math.sin(a), G.cy - r * Math.cos(a)]; };
const arc = (from, to) => { const [x0, y0] = onArc(from), [x1, y1] = onArc(to); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${G.r} ${G.r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
function gauge() {
  const st = G.half * (M.stable / M.max);
  const label = (deg, text) => { const [x, y] = onArc(deg); return `<text class="zone-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" transform="rotate(${deg} ${x.toFixed(1)} ${y.toFixed(1)})">${text}</text>`; };
  const tick = (deg) => { const [x0, y0] = onArc(deg, G.r - G.band / 2), [x1, y1] = onArc(deg, G.r + G.band / 2); return `<path class="g-tick" d="M${x0.toFixed(1)} ${y0.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}"/>`; };
  const top = G.cy - G.r;
  return `<svg class="gauge" viewBox="0 -16 ${G.w} 118" aria-hidden="true">
    <path class="g-panel" d="${arc(-G.half, G.half)}"/>
    <path class="g-zone low" d="${arc(-G.half, -st)}"/><path class="g-zone high" d="${arc(st, G.half)}"/><path class="g-zone stable" d="${arc(-st, st)}"/>
    ${tick(-st)}${tick(st)}
    ${label(-(G.half + st) / 2, 'LOW')}${label(0, 'STABLE')}${label((G.half + st) / 2, 'HIGH')}
    <g class="needle"><path class="needle-stem" d="M${G.w / 2} ${top - G.band / 2 - 4}V${top + G.band / 2 + 6}"/><circle class="needle-head" cx="${G.w / 2}" cy="${top - G.band / 2 - 6}" r="11"/></g>
  </svg>`;
}
const now = () => performance.now() / 1000;
const PAUSE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="2" width="5" height="16" rx="2"/><rect x="12" y="2" width="5" height="16" rx="2"/></svg>';
/** Restart a one-shot CSS animation class (month pop, coin bump). */
const replay = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

export class Hud {
  constructor(root, { onPause }) {
    root.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="calendar">
          <div class="cal-month">January</div>
          <div class="cal-sub">Month 1 of 12</div>
          <div class="cal-bar"><div class="cal-fill"></div></div>
          <div class="coin-count"><i class="coin-dot" aria-hidden="true"></i><span class="sr-only">Coins: </span><span class="coin-num">0</span></div>
        </div>
        <div class="meter" role="meter" aria-label="Mood" aria-valuemin="-100" aria-valuemax="100">
          <div class="meter-track">${gauge()}</div>
          <div class="episode"><span class="episode-name"></span><div class="episode-bar"><div class="episode-fill"></div></div></div>
        </div>
        <div class="guardrails" role="img" aria-label="Guardrails: 2 of 3">
          <div class="gr-icons">${fence}${fence}${fence}</div>
          <div class="gr-label" aria-hidden="true">Guardrails</div>
        </div>
        <div class="mirror" aria-hidden="true">
          <div class="mirror-glass"><div class="mirror-road"></div>
            <i class="friend f1"></i><i class="friend f2"></i><i class="friend f3"></i>
          </div>
          <div class="mirror-label">Friends falling behind</div>
        </div>
        <button class="icon-btn pause-btn" aria-label="Pause" title="Pause (Esc)">${PAUSE_ICON}</button>
        <div class="pull-prompt" role="status" aria-live="polite"></div>
        <div class="key-hint"><kbd>Space</kbd> Pull in</div>
        <button class="skip-practice" hidden></button>
        <div class="popup" role="status" aria-live="polite"><span class="popup-icon"></span><span class="popup-text"></span></div>
      </div>`);
    this.el = root.querySelector('.hud');
    const $ = (s) => this.el.querySelector(s);
    this.$ = { month: $('.cal-month'), sub: $('.cal-sub'), fill: $('.cal-fill'), bar: $('.cal-bar'), meter: $('.meter'),
      needle: $('.needle'), episode: $('.episode'), epName: $('.episode-name'), epFill: $('.episode-fill'),
      gr: [...this.el.querySelectorAll('.gr-fence')], pull: $('.pull-prompt'), coins: $('.coin-num'), coinBox: $('.coin-count'),
      mirror: $('.mirror'), friends: [...this.el.querySelectorAll('.friend')],
      popup: $('.popup'), popIcon: $('.popup-icon'), popText: $('.popup-text'),
      grBox: $('.guardrails'), needleHead: $('.needle-head'), keyHint: $('.key-hint'), skip: $('.skip-practice') };
    $('.pause-btn').addEventListener('click', onPause);
    this.waiting = [];
    this.current = null;
  }

  /** state: { mood, phase, guardrails, monthIndex, monthProgress, episodeLeft, episodeLength, coins } */
  update(s) {
    const $ = this.$;
    $.needle.style.transform = `rotate(${((s.mood / M.max) * G.half).toFixed(2)}deg)`;
    $.meter.setAttribute('aria-valuenow', Math.round(s.mood));
    // Words for screen readers, updated only when they change (WCAG 4.1.2).
    const zone = s.phase === 'manic' ? 'Manic episode' : s.phase === 'depressive' ? 'Depressive episode'
      : s.mood > M.stable ? 'Leaning high' : s.mood < -M.stable ? 'Leaning low' : 'Stable';
    if (zone !== this.zoneText) { this.zoneText = zone; $.meter.setAttribute('aria-valuetext', zone); }
    if (s.guardrails !== this.grShown) { this.grShown = s.guardrails; $.grBox.setAttribute('aria-label', `Guardrails: ${s.guardrails} of ${M.maxGuardrails}`); }
    $.meter.dataset.phase = s.phase;
    this.el.dataset.phase = s.phase;
    const mi = Math.min(11, s.monthIndex);
    if ($.month.textContent !== FULL_MONTHS[mi]) {
      $.month.textContent = FULL_MONTHS[mi];
      $.sub.textContent = `Month ${mi + 1} of 12`;
      replay($.month, 'pop');
    }
    $.fill.style.width = `${Math.min(1, s.monthProgress) * 100}%`;
    $.bar.dataset.phase = s.phase;
    $.gr.forEach((g, i) => g.classList.toggle('on', i < s.guardrails));
    const coins = String(s.coins ?? 0);
    if ($.coins.textContent !== coins) { $.coins.textContent = coins; replay($.coinBox, 'bump'); }
    const inEp = s.phase !== 'stable';
    $.episode.classList.toggle('show', inEp);
    if (inEp) {
      $.epName.textContent = s.phase === 'manic' ? 'Manic episode' : 'Depressive episode';
      $.epFill.style.width = `${(s.episodeLeft / s.episodeLength) * 100}%`;
    }
    // Rear-view mirror: during a manic episode, friends drift further back as it goes on.
    const manic = s.phase === 'manic';
    $.mirror.classList.toggle('show', manic);
    if (manic) {
      const p = 1 - s.episodeLeft / s.episodeLength;
      $.friends.forEach((f, i) => {
        const back = Math.min(1, p * 1.2 + i * 0.08);
        f.style.transform = `translate(-50%, ${-back * 30}px) scale(${1 - back * 0.75})`;
        f.style.opacity = String(1 - back * 0.6);
      });
    }
    this._tickPopup();
  }

  // ---------- The bottom pop-up box ----------
  /** kind: 'hit' (droppable), 'caption' (story / hints), 'tip' (first-time), 'episode' (urgent). */
  notify({ text, label = '', icon = '', tone = 'info', sec = CONFIG.popupSec, kind = 'hit', big = false }) {
    const msg = { text, label, icon, tone, sec, kind, big };
    if (kind === 'episode') this.waiting.unshift(msg); else this.waiting.push(msg);
    // Max N waiting: drop older pick-up pop-ups first, then older captions. Tips and episodes are kept.
    while (this.waiting.length > CONFIG.popupMaxWaiting) {
      const i = this.waiting.findIndex((m) => m.kind === 'hit');
      const j = i >= 0 ? i : this.waiting.findIndex((m) => m.kind === 'caption');
      if (j < 0) break;
      this.waiting.splice(j, 1);
    }
    this._tickPopup();
  }
  toast(text, tone = 'info', iconId = '') { this.notify({ text, tone, icon: iconId, kind: 'hit' }); }
  caption(text, urgent = false, tone = 'story') {
    this.notify({ text, tone, sec: CONFIG.captionSec, kind: urgent ? 'episode' : 'caption' });
  }
  tip(entry, iconId) {
    this.notify({ text: entry.line, label: `New: ${entry.name}`, icon: iconId, tone: 'good', sec: CONFIG.firstTipSec, kind: 'tip' });
  }
  /** First time an episode starts: a slightly larger box, shown before anything else. */
  episodeIntro(text, phase) {
    this.notify({ text, tone: phase, sec: CONFIG.episodeIntro.popupSec, kind: 'episode', big: true });
  }
  /** Practice month: replace whatever is showing right away (nothing else waits). */
  showNow({ text, icon = '', tone = 'info', sec = 99 }) {
    this.waiting = [{ text, label: '', icon, tone, sec, kind: 'practice', big: false }];
    this.current = null;
    this.gapUntil = 0;
    this._tickPopup();
  }
  /** Practice month: drop the current line and let anything waiting show. */
  clearPopup() {
    if (this.current?.kind === 'practice') this.current.until = 0;
    this._tickPopup();
  }

  // ---------- Practice-month highlights ----------
  /** Pulsing outline around the mood meter and a wiggling needle. */
  highlightMeter(on) { this.$.meter.classList.toggle('practice-glow', on); }
  /** The needle head jumps toward 'right' (up) or 'left' (down). */
  needleJump(dir) {
    const h = this.$.needleHead;
    h.classList.remove('jump-right', 'jump-left');
    void h.offsetWidth; // restart the animation
    h.classList.add(`jump-${dir}`);
  }
  /** Flash the guardrail box; the fence segment for `level` pops in. */
  flashGuardrails(level) {
    const box = this.$.grBox, fence = this.$.gr[level - 1];
    for (const el of [box, fence]) { if (!el) continue; el.classList.remove('gr-flash', 'gr-new'); void el.offsetWidth; }
    box.classList.add('gr-flash');
    fence?.classList.add('gr-new');
  }
  showKeyHint(on) { this.$.keyHint.classList.toggle('show', on); }
  /** "Skip practice" button (bottom-right). Pass null to hide it. */
  skipButton(text, onClick) {
    const b = this.$.skip;
    b.hidden = !text;
    b.textContent = text || '';
    b.onclick = onClick || null;
  }

  /** True while a first-time tip is on screen (the game runs at half speed then). */
  get tipShowing() { return this.current?.kind === 'tip'; }

  _tickPopup() {
    const t = now();
    if (this.current && t >= this.current.until) {
      this.current = null;
      this.$.popup.classList.remove('show');
      this.gapUntil = t + 0.3; // let it fade out before the next one slides in
    }
    if (this.current || !this.waiting.length || t < (this.gapUntil || 0)) return;
    const msg = this.waiting.shift();
    msg.until = t + msg.sec;
    this.current = msg;
    const img = msg.icon ? iconFor(msg.icon) : '';
    this.$.popIcon.className = `popup-icon tone-${msg.tone}`;
    this.$.popIcon.innerHTML = img ? `<img src="${img}" alt="" />` : GLYPH[msg.tone] || '•';
    this.$.popText.innerHTML = msg.label ? `<b>${msg.label}</b> ${msg.text}` : msg.text;
    this.$.popup.classList.toggle('big', !!msg.big);
    this.$.popup.classList.add('show');
  }

  /** Show or hide the "Pull in" prompt. */
  pullPrompt(text) {
    this.$.pull.textContent = text || '';
    this.$.pull.classList.toggle('show', !!text);
  }
}
