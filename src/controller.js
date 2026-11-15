// controller.js: the phone controller page. A two-handed pad cut down to what the
// game needs: steering (left/right) on the left, a big round Pull in button on the
// right, Pause and Sound at the top centre. Also handles haptics, Wake Lock and
// the phase tint. `buildPad` is reused by the game screen's "Play on this device".
import { PhoneLink } from './net.js';

const ARROW = (flip) => `<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M${flip ? '13 7 L31 20 L13 33' : '27 7 L9 20 L27 33'} Z" fill="currentColor" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>`;

const PAUSE_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="2" width="5" height="16" rx="2"/><rect x="12" y="2" width="5" height="16" rx="2"/></svg>';
const SOUND_ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 7.5h3.2L10.5 3.6v12.8L5.7 12.5H2.5z"/><path d="M13.5 6.6a4.8 4.8 0 0 1 0 6.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const SCREEN_TEXT = {
  title: { button: 'Start', hint: 'Use ◀ ▶ to choose your driver' },
  note: { button: 'Continue', hint: 'Read the note on the big screen' },
  howto: { button: 'Continue', hint: 'Read the cards on the big screen' },
  intro: { button: 'Next', hint: 'Read the story on the big screen' },
  guide: { button: 'Start driving', hint: 'Your road guide is on the big screen' },
  drive: { button: '', hint: '' },
  practice: { button: 'Skip practice', hint: '' }, // January practice month
  review: { button: 'Drive again', hint: 'Your year is on the big screen' },
};

/** Builds the pad inside `root`. `send(msg)` receives every button message. */
export function buildPad(root, { send, local = false }) {
  root.innerHTML = `
    <div class="pad ${local ? 'local' : ''}" data-screen="title">
      <div class="pad-top">
        <div class="pad-status"><span class="pdot"></span><span class="ptxt">Connecting…</span></div>
        <div class="pad-menu">
          <button class="pill" data-act="pause">${PAUSE_ICON}Pause</button>
          <button class="pill" data-act="mute">${SOUND_ICON}Sound</button>
        </div>
        <div class="pad-room"></div>
      </div>
      <div class="pad-main">
        <div class="steer" aria-label="Steering pad">
          <div class="arrow left">${ARROW(false)}</div>
          <div class="arrow right">${ARROW(true)}</div>
        </div>
        <div class="centre">
          <button class="start-btn">Start</button>
          <p class="pad-hint"></p>
        </div>
        <button class="pull" aria-label="Pull in"><span>Pull<br />in</span></button>
      </div>
    </div>`;
  const pad = root.querySelector('.pad');
  const $ = (sel) => pad.querySelector(sel);

  const tap = (el, msg) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.classList.add('pressed');
      send(msg);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => el.classList.remove('pressed'));
  };
  tap($('[data-act=pause]'), { t: 'pause' });
  tap($('[data-act=mute]'), { t: 'mute' });
  tap($('.pull'), { t: 'pull' });
  tap($('.start-btn'), { t: 'start' });

  // Steering: one finger anywhere on the pad; sliding across switches direction.
  const steer = $('.steer');
  let dir = 0;
  const setDir = (d) => {
    if (d === dir) return;
    dir = d;
    $('.arrow.left').classList.toggle('pressed', d === -1);
    $('.arrow.right').classList.toggle('pressed', d === 1);
    send({ t: 'steer', dir: d });
  };
  // Which arrow is under the finger (works even when the whole pad is drawn rotated).
  const dirAt = (e) => {
    const arrow = document.elementFromPoint(e.clientX, e.clientY)?.closest('.arrow');
    return arrow ? (arrow.classList.contains('left') ? -1 : 1) : dir;
  };
  steer.addEventListener('pointerdown', (e) => { e.preventDefault(); steer.setPointerCapture(e.pointerId); setDir(dirAt(e)); });
  steer.addEventListener('pointermove', (e) => { if (steer.hasPointerCapture(e.pointerId)) setDir(dirAt(e)); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) steer.addEventListener(ev, () => setDir(0));
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  // No page zoom or scrolling from taps on the pad (iOS double-tap zoom ignores the viewport setting).
  pad.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });

  return {
    el: pad,
    setStatus(state, text) {
      $('.pdot').className = `pdot ${state}`;
      $('.ptxt').textContent = text;
    },
    setRoom(code) { $('.pad-room').textContent = code ? `Room ${code}` : ''; },
    setScreen(name) {
      const s = SCREEN_TEXT[name] || SCREEN_TEXT.title;
      pad.dataset.screen = name;
      $('.start-btn').textContent = s.button;
      $('.pad-hint').textContent = s.hint;
    },
    setPhase(phase) { pad.dataset.phase = phase; },
    /** 'pull' makes the Pull in button pulse (practice month); '' clears it. */
    setHint(name) { pad.dataset.hint = name || ''; },
    releaseSteer() { setDir(0); },
  };
}

// ---------- Phone page ----------
export function startController() {
  const root = document.getElementById('pad-root');
  const room = (new URLSearchParams(location.search).get('room') || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  if (room.length !== 4) return askForRoom(root);

  let link;
  const pad = buildPad(root, { send: (msg) => { link.send(msg); wakeLock(); } });
  pad.setRoom(room);
  link = new PhoneLink(room, {
    onStatus: (s) => {
      if (s === 'connected') pad.setStatus('ok', 'Connected');
      else if (s === 'lost') pad.setStatus('bad', 'Reconnecting…');
      else pad.setStatus('', 'Connecting…');
    },
    onMessage: (msg) => {
      if (msg?.t === 'phase') pad.setPhase(msg.phase);
      else if (msg?.t === 'screen') pad.setScreen(msg.name);
      else if (msg?.t === 'buzz') buzz(msg.pattern);
      else if (msg?.t === 'hint') pad.setHint(msg.name);
    },
  });
  link.connect();
  blockZoom();
  // Landscape by default: on the first tap, go full screen and lock to landscape where the phone allows it
  // (Android). Elsewhere the CSS draws the pad sideways when the phone is held upright.
  document.addEventListener('pointerdown', lockLandscape, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wakeLock(true); });
}

function askForRoom(root) {
  root.innerHTML = `
    <form class="join">
      <h1>Supporty</h1>
      <p>Type the 4-letter room code shown on the game screen.</p>
      <input name="room" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" />
      <button class="start-btn">Join</button>
    </form>`;
  root.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('room').toString().toUpperCase();
    location.search = `?room=${code}`;
  });
}

function lockLandscape() {
  const el = document.documentElement;
  try {
    const fs = el.requestFullscreen?.({ navigationUI: 'hide' });
    Promise.resolve(fs).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
  } catch { /* not supported: the CSS rotation handles it */ }
}

// Stop pinch-zoom and double-tap zoom anywhere on the controller page.
function blockZoom() {
  for (const ev of ['gesturestart', 'gesturechange', 'dblclick']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 350) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

// Haptics: Android only. iOS Safari has no vibration, so this silently does nothing there.
function buzz(pattern) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}

// Keep the phone screen awake during play (needs HTTPS; silently skipped otherwise).
let lock = null;
async function wakeLock(force = false) {
  if (!('wakeLock' in navigator) || (lock && !force)) return;
  try { lock = await navigator.wakeLock.request('screen'); } catch { lock = null; }
}
