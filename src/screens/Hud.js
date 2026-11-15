// Hud.js: the drive screen's heads-up display (HTML on top of the 3D view).
// Top: mood meter LOW – STABLE – HIGH with a needle and word labels (not colour only).
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
const fence = '<span class="gr-fence"><i></i><i></i><i></i><b></b><b></b></span>';
const GLYPH = { up: '↑', down: '↓', good: '✓', info: '•', manic: '↑', depressive: '↓', story: '✦' };
const now = () => performance.now() / 1000;

export class Hud {
  constructor(root, { onPause }) {
    root.insertAdjacentHTML('beforeend', `
      <div class="hud">
        <div class="calendar">
          <div class="cal-month">January</div>
          <div class="cal-sub">Month 1 of 12</div>
          <div class="cal-bar"><div class="cal-fill"></div></div>
          <div class="coin-count" aria-label="Coins"><i class="coin-dot"></i><span>0</span></div>
        </div>
        <div class="meter" role="meter" aria-label="Mood" aria-valuemin="-100" aria-valuemax="100">
          <div class="meter-track">
            <div class="zone low"><span>LOW</span></div>
            <div class="zone stable"><span>STABLE</span></div>
            <div class="zone high"><span>HIGH</span></div>
            <div class="needle"><div class="needle-head"></div></div>
          </div>
          <div class="episode"><span class="episode-name"></span><div class="episode-bar"><div class="episode-fill"></div></div></div>
        </div>
        <div class="guardrails" aria-label="Guardrails">
          <div class="gr-icons">${fence}${fence}${fence}</div>
          <div class="gr-label">Guardrails</div>
        </div>
        <div class="mirror" aria-hidden="true">
          <div class="mirror-glass"><div class="mirror-road"></div>
            <i class="friend f1"></i><i class="friend f2"></i><i class="friend f3"></i>
          </div>
          <div class="mirror-label">Friends falling behind</div>
        </div>
        <button class="icon-btn pause-btn" aria-label="Pause">❚❚</button>
        <div class="pull-prompt"></div>
        <div class="key-hint"><kbd>Space</kbd> Pull in</div>
        <button class="skip-practice" hidden></button>
        <div class="popup" role="status" aria-live="polite"><span class="popup-icon"></span><span class="popup-text"></span></div>
      </div>`);
    this.el = root.querySelector('.hud');
    const $ = (s) => this.el.querySelector(s);
    this.$ = { month: $('.cal-month'), sub: $('.cal-sub'), fill: $('.cal-fill'), bar: $('.cal-bar'), meter: $('.meter'),
      needle: $('.needle'), episode: $('.episode'), epName: $('.episode-name'), epFill: $('.episode-fill'),
      gr: [...this.el.querySelectorAll('.gr-fence')], pull: $('.pull-prompt'), coins: $('.coin-count span'),
      mirror: $('.mirror'), friends: [...this.el.querySelectorAll('.friend')],
      popup: $('.popup'), popIcon: $('.popup-icon'), popText: $('.popup-text'),
      grBox: $('.guardrails'), needleHead: $('.needle-head'), keyHint: $('.key-hint'), skip: $('.skip-practice') };
    $('.pause-btn').addEventListener('click', onPause);
    const stablePct = (M.stable / M.max) * 50;
    this.el.querySelector('.zone.low').style.width = `${50 - stablePct}%`;
    this.el.querySelector('.zone.stable').style.width = `${stablePct * 2}%`;
    this.el.querySelector('.zone.high').style.width = `${50 - stablePct}%`;
    this.waiting = [];
    this.current = null;
  }

  /** state: { mood, phase, guardrails, monthIndex, monthProgress, episodeLeft, episodeLength, coins } */
  update(s) {
    const $ = this.$;
    $.needle.style.left = `${50 + (s.mood / M.max) * 50}%`;
    $.meter.setAttribute('aria-valuenow', Math.round(s.mood));
    $.meter.dataset.phase = s.phase;
    this.el.dataset.phase = s.phase;
    const mi = Math.min(11, s.monthIndex);
    if ($.month.textContent !== FULL_MONTHS[mi]) {
      $.month.textContent = FULL_MONTHS[mi];
      $.sub.textContent = `Month ${mi + 1} of 12`;
    }
    $.fill.style.width = `${Math.min(1, s.monthProgress) * 100}%`;
    $.bar.dataset.phase = s.phase;
    $.gr.forEach((g, i) => g.classList.toggle('on', i < s.guardrails));
    $.coins.textContent = s.coins ?? 0;
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
