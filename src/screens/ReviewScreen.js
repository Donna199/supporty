// ReviewScreen: the Year in review. The camera pulls back as the kart rolls past
// graduation and the road keeps going, with guardrails and the pit crew still there.
// Shows the mood timeline (episodes shaded), stats, one reflection, research lines,
// the closing line and the 988 line. Buttons: Drive again, Sources.
import { CONFIG } from '../config.js';

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
      <div class="review">
        <div class="card review-card" role="dialog" aria-labelledby="review-title">
          <h2 id="review-title">Your year on the road</h2>
          <canvas class="timeline" width="1200" height="440" role="img"></canvas>
          <div class="legend"><span><i class="lg-line"></i>Mood</span><span><i class="lg-manic"></i>Manic episode</span><span><i class="lg-dep"></i>Depressive episode</span><span><i class="lg-stable"></i>Stable zone</span></div>
          <div class="stats">
            <div><b>${s.stableDays}</b><span>days on the stable road</span></div>
            <div><b>${s.manic + s.depressive}</b><span>episodes (${epText})</span></div>
            <div><b>${s.support}</b><span>support items used</span></div>
            <div><b>${s.coins?.collected ?? 0}</b><span>coins collected${s.coins?.dull ? ` (${s.coins.dull} felt like nothing during a depressive episode)` : ''}</span></div>
          </div>
          <p class="reflection">${log ? log.reflection() : ''}</p>
          <h3>What the research says</h3>
          <ul class="research">${RESEARCH.map(([t, c]) => `<li>${t} <cite>(${c})</cite></li>`).join('')}</ul>
          <p class="closing">Bipolar disorder is a lifelong condition, and it is treatable. Support makes the road steadier.</p>
          <p class="helpline">If you are struggling, call or text <b>988</b> (US).</p>
          <div class="row">
            <button class="btn again">Drive again</button>
            <button class="btn secondary sources-btn" aria-expanded="false">Sources</button>
          </div>
          <ol class="sources" hidden>${SOURCES.map((x) => `<li>${x}</li>`).join('')}</ol>
        </div>
      </div>`;
    const $ = (sel) => app.ui.querySelector(sel);
    drawTimeline($('.timeline'), log);
    $('.again').addEventListener('click', () => app.show('drive'));
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

/** Line graph of mood across Jan–Dec, with episodes shaded. Drawn from the run log. */
function drawTimeline(cv, log) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height, L = 120, R = 20, T = 20, B = 50;
  const total = CONFIG.secondsPerMonth * 12;
  const x = (t) => L + (Math.min(t, total) / total) * (W - L - R);
  const y = (m) => T + ((100 - m) / 200) * (H - T - B);
  g.font = '800 26px Nunito, system-ui, sans-serif';
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, W, H);
  // stable zone band
  g.fillStyle = '#e1efd9';
  g.fillRect(L, y(CONFIG.mood.stable), W - L - R, y(-CONFIG.mood.stable) - y(CONFIG.mood.stable));
  // episodes
  for (const ep of log?.episodes || []) {
    g.fillStyle = ep.phase === 'manic' ? 'rgba(217,71,156,0.28)' : 'rgba(95,116,135,0.32)';
    g.fillRect(x(ep.start), T, x(ep.end ?? total) - x(ep.start), H - T - B);
  }
  // axes, zone words and month labels
  g.strokeStyle = '#3b3433'; g.lineWidth = 2; g.fillStyle = '#3b3433';
  g.strokeRect(L, T, W - L - R, H - T - B);
  g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillText('HIGH', L - 14, y(65)); g.fillText('STABLE', L - 14, y(0)); g.fillText('LOW', L - 14, y(-65));
  g.textAlign = 'center'; g.textBaseline = 'top';
  CONFIG.months.forEach((m, i) => g.fillText(m[0], x((i + 0.5) * CONFIG.secondsPerMonth), H - B + 12));
  g.setLineDash([6, 8]); g.strokeStyle = 'rgba(59,52,51,0.35)';
  for (const m of [CONFIG.mood.stable, -CONFIG.mood.stable]) { g.beginPath(); g.moveTo(L, y(m)); g.lineTo(W - R, y(m)); g.stroke(); }
  g.setLineDash([]);
  // mood line
  const pts = log?.samples || [];
  g.strokeStyle = '#3b3433'; g.lineWidth = 5; g.lineJoin = 'round';
  g.beginPath();
  pts.forEach((p, i) => (i ? g.lineTo(x(p.t), y(p.mood)) : g.moveTo(x(p.t), y(p.mood))));
  g.stroke();
  const eps = log?.episodes || [];
  cv.setAttribute('aria-label', `Mood timeline from January to December. ${eps.length} episode${eps.length === 1 ? '' : 's'}: ${eps.map((e) => `${e.phase} in ${CONFIG.months[Math.min(11, Math.floor(e.start / CONFIG.secondsPerMonth))]}`).join(', ') || 'none'}.`);
}
