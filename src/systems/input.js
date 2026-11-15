// input.js: merges phone messages and the keyboard into one input.
// Screens listen for: 'steer' (dir -1/0/1), 'pull', 'pause', 'mute', 'start'.
// Keyboard: arrows or A/D steer, Space = Pull in, Enter = Start/Continue, Esc = Pause, M = Mute.
// `lagMs` delays steering (used for the depressive episode's heavy, slow response).

export class Input {
  constructor() {
    this.listeners = new Map();
    this.keys = { left: false, right: false };
    this.phoneDir = 0;
    this.dir = 0;          // steering direction after lag
    this.lagMs = 0;
    this.queue = [];       // delayed steering changes
    this.quietUntil = 0;   // 'start' / 'pull' are ignored until then (just after a screen change)
    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    window.addEventListener('blur', () => { this.keys.left = this.keys.right = false; this._steerChanged(); });
  }

  /** Subscribe to an input event. Returns a function that unsubscribes. */
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type).delete(fn);
  }
  /** Ignore 'start' and 'pull' for a moment, so one press can't also skip the next screen. */
  quiet(ms = 300) { this.quietUntil = performance.now() + ms; }
  emit(type, value) {
    if ((type === 'start' || type === 'pull') && performance.now() < this.quietUntil) return;
    // Loop over a copy: a listener that changes the screen adds the next screen's listener,
    // and that one must not also fire for the same press (one Enter was skipping 3 screens).
    const set = this.listeners.get(type);
    if (set) for (const fn of [...set]) if (set.has(fn)) fn(value);
  }

  /** A message from the phone controller (or the on-screen pad). */
  handle(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'steer') { this.phoneDir = Math.sign(msg.dir) || 0; this._steerChanged(); }
    else if (['pull', 'pause', 'mute', 'start'].includes(msg.t)) this.emit(msg.t);
  }

  /** Clears held steering, e.g. when the controller disconnects. */
  release() { this.phoneDir = 0; this.keys.left = this.keys.right = false; this._steerChanged(); }

  _key(e, down) {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { this.keys.left = down; this._steerChanged(); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { this.keys.right = down; this._steerChanged(); e.preventDefault(); }
    else if (k === ' ') { e.preventDefault(); if (down && !e.repeat) this.emit('pull'); } // never "clicks" a focused button
    else if (!down || e.repeat) return;
    else if (k === 'Enter') {
      // One Enter = one action: click the focused button, or emit start. Without preventDefault the
      // browser would also "click" the button the next screen has just focused (skipping a screen).
      e.preventDefault();
      if (e.target?.tagName === 'BUTTON') e.target.click(); else this.emit('start');
    }
    else if (k === 'Escape' || k === 'p' || k === 'P') this.emit('pause');
    else if (k === 'm' || k === 'M') this.emit('mute');
  }

  _steerChanged() {
    const kb = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    const raw = this.phoneDir || kb;
    this.queue.push({ at: performance.now() + this.lagMs, dir: raw });
  }

  /** Call once per frame: applies steering changes whose lag has passed. */
  update() {
    const now = performance.now();
    while (this.queue.length && this.queue[0].at <= now) {
      const { dir } = this.queue.shift();
      if (dir !== this.dir) { this.dir = dir; this.emit('steer', dir); }
    }
  }
}
