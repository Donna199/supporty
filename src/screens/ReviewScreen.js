// ReviewScreen: the Year in review. The camera pulls back as the kart rolls past
// graduation and the road keeps going, with guardrails and the pit crew still there.
// Shows the mood timeline (episodes shaded), stats, one reflection, research lines,
// the closing line and the 988 line. Buttons: Drive again, Sources, Home (back to the title screen).
import { CONFIG } from '../config.js';
import { UI, hex } from '../world/palette.js';

const RESEARCH = [
  ['Sleep loss can trigger manic episodes: about 1 in 5 people with bipolar disorder said it had set off a high-mood episode.', 'Lewis et al., 2017'],
  ['Life events about reaching a big goal can be followed by a rise in manic symptoms.', 'Johnson et al., 2000'],
  ['Steady daily rhythms help keep mood stable. Interpersonal and social rhythm therapy builds them.', 'Frank et al., 2005'],
  ['Family criticism is linked to relapse, and family-focused therapy lowers that risk.', 'Miklowitz'],
];
const SOURCES = [
  'American Psychiatric Association. DSM-5-TR, Bipolar I disorder.',
  'Lewis, K. J. S., et al. (2017). Sleep loss as a trigger of mood episodes in bipolar disorder. British Journal of Psychiatry.',
  'Harvey, A. G. (2008). Sleep disturbance in bipolar disorder. American Journal of Psychiatry.',
  'Johnson, S. L., et al. (2000). Increases in manic symptoms after life events involving goal attainment. Journal of Abnormal Psychology.',
  'Johnson, S. L., et al. Negative and goal-attainment life events in bipolar I.',
  'Frank, E., et al. (2005). Two-year outcomes for interpersonal and social rhythm therapy. Archives of General Psychiatry.',
  'Miklowitz, D. J. Family systems and relapse in recurrent psychiatric disorders.',
  'Viscardi, L. H., et al. Personal stigma and treatment adherence.',
];

export class ReviewScreen {
  constructor(app) { this.app = app; }

  enter(data = {}) {
    const { app } = this;
    app.setPhoneScreen('review');
    app.setPhase('stable');
    const calm = { stable: 1, manic: 0, depressive: 0 };
    app.world.weather.setBlend(calm);
    app.world.chase.setBlend(calm);
    app.sound.setBlend(calm);
    this.items = app.screens.drive.items;
    const car = app.world.car;
    car.speed = 9;
    // The road keeps going: support is still there after graduation.
    if (this.items) for (const [id, ahead] of [['familyPit', 45], ['therapyPit', 95], ['restStop', 140]]) this.items.spawn(id, { s: car.s + ahead });

    const log = data.log;
    const s = log ? log.summary() : { stableDays: 0, manic: 0, depressive: 0, support: 0 };
    const epText = `${s.manic} manic, ${s.depressive} depressive`;
    app.ui.innerHTML = `
      <div class="review" tabindex="0" role="region" aria-label="Year in review, scrollable">
        <div class="card review-card" role="dialog" aria-labelledby="review-title">
          <h2 id="review-title">Your year on the road</h2>
          <canvas class="timeline" width="1200" height="440" role="img"></canvas>
          <div class="legend"><span><i class="lg-line"></i>Mood</span><span><i class="lg-manic"></i>Manic episode (M)</span><span><i class="lg-dep"></i>Depressive episode (D)</span><span><i class="lg-stable"></i>Stable zone</span></div>
          <div class="stats">
            <div><b data-count="${s.stableDays}">${s.stableDays}</b><span>days on the stable road</span></div>
            <div><b data-count="${s.manic + s.depressive}">${s.manic + s.depressive}</b><span>episodes (${epText})</span></div>
            <div><b data-count="${s.support}">${s.support}</b><span>support items used</span></div>
            <div><b data-count="${s.coins?.collected ?? 0}">${s.coins?.collected ?? 0}</b><span>coins collected${s.coins?.dull ? ` (${s.coins.dull} felt like nothing during a depressive episode)` : ''}</span></div>
          </div>
          <p class="reflection">${log ? log.reflection() : ''}</p>
          <h3>What the research says</h3>
          <ul class="research">${RESEARCH.map(([t, c]) => `<li>${t} <cite>(${c})</cite></li>`).join('')}</ul>
          <p class="closing">Bipolar disorder is a lifelong condition, and it is treatable. Support makes the road steadier.</p>
          <p class="helpline">If you are struggling, call or text <b>988</b> (US).</p>
          <div class="row">
            <button class="btn again">Drive again</button>
            <button class="btn secondary sources-btn" aria-expanded="false">Sources</button>
            <button class="btn secondary home-btn">Home</button>
          </div>
          <ol class="sources" hidden>${SOURCES.map((x) => `<li>${x}</li>`).join('')}</ol>
        </div>
      </div>`;
    const $ = (sel) => app.ui.querySelector(sel);
    drawTimeline($('.timeline'), log);
    countUp(app.ui.querySelectorAll('.stats b'));
    $('.again').addEventListener('click', () => app.show('drive'));
    $('.home-btn').addEventListener('click', () => app.show('title'));
    $('.sources-btn').addEventListener('click', (e) => {
      const list = $('.sources');
      list.hidden = !list.hidden;
      e.target.setAttribute('aria-expanded', String(!list.hidden));
      if (!list.hidden) list.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    this.offs = [app.input.on('start', () => app.show('drive'))];
  }

  exit() { this.offs.forEach((off) => off()); }

  update(dt) {
    const { world } = this.app;
    world.car.s += world.car.speed * dt;
    world.car.vx = 0;
    world.placeKart(dt);
    this.items?.update(dt, world.car);
    world.chase.pullBack(dt, world.kart.group.position, world.frame.fwd);
  }
}

/** The stats count up from 0 as the card appears (skipped if the player asked for reduced motion). */
function countUp(els, delay = 1500, dur = 900) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const t0 = performance.now() + delay;
  els.forEach((el) => { el.textContent = '0'; });
  const timer = setInterval(() => {
    const k = Math.max(0, Math.min(1, (performance.now() - t0) / dur));
    const eased = 1 - (1 - k) ** 3;
    els.forEach((el) => { el.textContent = Math.round(Number(el.dataset.count) * eased); });
    if (k >= 1 || !els[0]?.isConnected) clearInterval(timer);
  }, 30);
}

/** Line graph of mood across Jan–Dec, with episodes shaded. Drawn from the run log. */
function drawTimeline(cv, log) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, L = 120, R = 20, T = 20, B = 50;
  const total = CONFIG.secondsPerMonth * 12;
  const x = (t) => L + (Math.min(t, total) / total) * (W - L - R);
  const y = (m) => T + ((100 - m) / 200) * (H - T - B);
  g.font = '800 26px Inter, system-ui, sans-serif';
  g.fillStyle = hex(UI.white); g.fillRect(0, 0, W, H);
  // The three zones as soft bands (the same colours as the mood gauge), inside a rounded plot area.
  g.save();
  g.beginPath(); g.roundRect(L, T, W - L - R, H - T - B, 18); g.clip();
  g.globalAlpha = 0.45; g.fillStyle = hex(UI.zoneHigh); g.fillRect(L, T, W - L - R, y(CONFIG.mood.stable) - T);
  g.fillStyle = hex(UI.zoneLow); g.fillRect(L, y(-CONFIG.mood.stable), W - L - R, H - B - y(-CONFIG.mood.stable));
  g.globalAlpha = 1; g.fillStyle = hex(UI.zoneStable);
  g.fillRect(L, y(CONFIG.mood.stable), W - L - R, y(-CONFIG.mood.stable) - y(CONFIG.mood.stable));
  // episodes
  for (const ep of log?.episodes || []) {
    g.fillStyle = ep.phase === 'manic' ? 'rgba(217,71,156,0.28)' : 'rgba(95,116,135,0.32)';
    g.fillRect(x(ep.start), T, x(ep.end ?? total) - x(ep.start), H - T - B);
  }
  // Each shaded band also carries a letter, so episodes never rely on colour alone (WCAG 1.4.1).
  g.fillStyle = hex(UI.ink); g.textAlign = 'center'; g.textBaseline = 'top';
  for (const ep of log?.episodes || []) {
    const x0 = x(ep.start), x1 = x(ep.end ?? total);
    if (x1 - x0 >= 22) g.fillText(ep.phase === 'manic' ? 'M' : 'D', (x0 + x1) / 2, T + 8);
  }
  g.restore();
  // axes, zone words and month labels
  g.strokeStyle = 'rgba(59,52,51,0.3)'; g.lineWidth = 2; g.fillStyle = hex(UI.ink);
  g.beginPath(); g.roundRect(L, T, W - L - R, H - T - B, 18); g.stroke();
  g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText('HIGH', L - 14, y(65)); g.fillText('STABLE', L - 14, y(0)); g.fillText('LOW', L - 14, y(-65));
  g.textAlign = 'center'; g.textBaseline = 'top';
  CONFIG.months.forEach((m, i) => g.fillText(m[0], x((i + 0.5) * CONFIG.secondsPerMonth), H - B + 12));
  g.setLineDash([6, 8]); g.strokeStyle = 'rgba(59,52,51,0.35)';
  for (const m of [CONFIG.mood.stable, -CONFIG.mood.stable]) { g.beginPath(); g.moveTo(L, y(m)); g.lineTo(W - R, y(m)); g.stroke(); }
  g.setLineDash([]);
  // mood line
  const pts = log?.samples || [];
  g.strokeStyle = hex(UI.ink); g.lineWidth = 5; g.lineJoin = g.lineCap = 'round';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(x(p.t), y(p.mood)) : g.moveTo(x(p.t), y(p.mood))));
  g.stroke();
  const last = pts[pts.length - 1]; // a dot marks where the year ended
  if (last) { g.beginPath(); g.arc(x(last.t), y(last.mood), 9, 0, Math.PI * 2); g.fillStyle = hex(UI.yellow); g.fill(); g.lineWidth = 4; g.stroke(); }
  const eps = log?.episodes || [];
  cv.setAttribute('aria-label', `Mood timeline from January to December. ${eps.length} episode${eps.length === 1 ? '' : 's'}: ${eps.map((e) => `${e.phase} in ${CONFIG.months[Math.min(11, Math.floor(e.start / CONFIG.secondsPerMonth))]}`).join(', ') || 'none'}.`);
}
