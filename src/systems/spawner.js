// spawner.js: decides what appears on the road and when.
// Scripted spawns follow the PRD month table (plus a medication checkpoint at the
// start of every month); between them, one random item every 4–6 seconds from the
// current phase's pool (stable/leaning road = triggers, episodes = hazards).
import { CONFIG } from '../config.js';

const S = CONFIG.spawner;
const spm = CONFIG.secondsPerMonth;

function pick(pool) {
  const entries = Object.entries(pool).filter(([, w]) => w > 0);
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [id, w] of entries) if ((r -= w) <= 0) return id;
  return entries[0][0];
}
const randLane = () => Math.floor(Math.random() * 3) - 1;

export class Spawner {
  constructor() {
    this.ahead = S.aheadDistance;
    this.queue = [];
    CONFIG.months.forEach((_, m) => this.queue.push({ t: m * spm + CONFIG.medAt, id: 'medCheckpoint' }));
    for (const e of CONFIG.script) {
      this.queue.push({ t: CONFIG.months.indexOf(e.month) * spm + e.at, id: e.spawn, scripted: true });
    }
    this.queue.sort((a, b) => a.t - b.t);
    this.nextRandom = spm; // January is the calm tutorial month
    this.lastS = -Infinity;
    this.lastLane = 0;
    this.nextCoins = 4;
  }

  /** Testing: start part-way through the year. */
  skipTo(t) {
    this.queue = this.queue.filter((e) => e.t >= t);
    this.nextRandom = t + 2;
  }

  /** Call every frame. `spawn(id, opts)` creates the item on the road. */
  update(t, phase, carS, spawn) {
    this.ahead = S.aheadDistance * (phase === 'depressive' ? S.depressiveAheadScale : 1);
    while (this.queue.length && this.queue[0].t <= t) {
      const e = this.queue.shift();
      const span = e.scripted && CONFIG.scriptedSpanLanes.includes(e.id);
      this._place(e.id, carS, spawn, { span, scripted: e.scripted });
    }
    const endOfYear = 12 * spm - 5;
    if (t >= this.nextRandom && t < endOfYear) {
      this._place(pick(S.pools[phase]), carS, spawn, {});
      this.nextRandom = t + S.everySec[0] + Math.random() * (S.everySec[1] - S.everySec[0]);
    }
    // Coins: a short row in one lane, placed between the other items.
    const K = CONFIG.coins;
    if (t >= this.nextCoins && t < endOfYear) {
      this.nextCoins = t + K.everySec[0] + Math.random() * (K.everySec[1] - K.everySec[0]);
      let s0 = carS + this.ahead;
      if (Math.abs(s0 - this.lastS) < 10) s0 = this.lastS + 10;
      const lane = randLane();
      for (let i = 0; i < K.row; i++) spawn('coin', { s: s0 + i * K.spacing, lane, coin: true });
    }
  }

  _place(id, carS, spawn, { span = false, scripted = false }) {
    const s = Math.max(carS + this.ahead, this.lastS + S.minGap);
    this.lastS = s;
    if (id === 'stigmaBillboard' && scripted) {
      // June: billboards block two lanes; the open lane has a supportive sign.
      const open = randLane();
      for (const lane of [-1, 0, 1]) spawn(lane === open ? 'notAlone' : 'stigmaBillboard', { s, lane, scripted });
      return;
    }
    let lane = randLane();
    if (lane === this.lastLane && Math.random() < 0.5) lane = randLane(); // a bit more variety
    this.lastLane = lane;
    spawn(id, { s, lane, side: Math.random() < 0.5 ? -1 : 1, span, scripted });
  }
}
