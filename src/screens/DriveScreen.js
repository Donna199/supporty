// DriveScreen: the drive itself. Runs the year clock, moves and steers the kart
// between the 3 lanes, updates the mood and HUD, and shows the pause menu
// (Esc, phone Pause, or automatically when the phone disconnects). January is the
// practice month (systems/practice.js) unless the player skips it.
import { CONFIG } from '../config.js';
import { controllerUrl, drawQR } from '../net.js';
import { Mood } from '../systems/mood.js';
import { Hud } from './Hud.js';
import { Spawner } from '../systems/spawner.js';
import { Items } from '../systems/items.js';
import { applyItemEvent } from '../systems/effects.js';
import { RunLog } from '../systems/runLog.js';
import { guideEntry, EPISODE_INTRO } from '../content.js';
import { Practice } from '../systems/practice.js';
import { openGuide } from './RoadGuideScreen.js';

const W = CONFIG.world;

export class DriveScreen {
  constructor(app) { this.app = app; }

  enter() {
    const { app } = this;
    app.setPhoneScreen('drive');
    app.setPhase('stable');
    const car = app.world.car;
    car.x = 0;
    car.vx = 0;
    car.lean = 0;
    this.lane = 0;
    this.steerDir = 0;
    this.repeat = 0;
    this.paused = false;
    this.time = 0;
    this.month = -1;
    this.hintsShown = new Set();
    app.world.chase.snap = true;

    this.mood = new Mood();
    this.mood.onPhase = (phase, old) => this.onPhase(phase, old);
    this.log = new RunLog();
    this.feel = { speed: 1, steer: 1, lagMs: 0 };
    this.spawner = new Spawner();
    this.items?.clear();
    this.items = new Items(app.world.scene, app.world.road);
    this.flags = { blockChaos: false, convertCriticism: false, highlightLeft: 0, slowTimer: 0, hop: 0 };
    this.stats = { support: 0, triggers: 0 };
    this.coins = { collected: 0, points: 0, dull: 0 };
    this.tipsShown = new Set(); // first-time tips, never repeated in a run
    this.episodesSeen = new Set(); // first manic / depressive episode gets a longer intro
    this.introSlow = 0;
    this.noTutorial = false; // set by "Skip practice": no hints, no "New:" tips, no teaching slow-downs
    this.pullable = null;
    this.finishSpawned = false;
    this.finished = false;

    app.ui.innerHTML = '<div class="pause-layer"></div>';
    this.hud = new Hud(app.ui, { onPause: () => this.togglePause() });
    app.ui.appendChild(app.ui.querySelector('.pause-layer')); // pause menu sits above the HUD

    this.offs = [
      app.input.on('steer', (dir) => this.onSteer(dir)),
      app.input.on('pause', () => { if (!this.guideOpen) this.togglePause(); }),
      app.input.on('start', () => {
        if (this.paused && !this.guideOpen) this.togglePause(false);
        else if (!this.paused && this.practice?.active) this.practice.skip(); // phone "Skip practice" / Enter
      }),
      app.input.on('pull', () => this.onPull()),
    ];
    const onStatus = (s) => {
      if (s === 'lost' && !app.localPad) this.togglePause(true);
      else if (this.paused) this.renderPause();
    };
    app.statusListeners.add(onStatus);
    this.offs.push(() => app.statusListeners.delete(onStatus));

    // Testing shortcuts: ?month=7 starts in July; ?gallery=1 lines up every model in front of a parked kart.
    const params = new URLSearchParams(location.search);
    const startMonth = Number(params.get('month'));
    if (startMonth >= 2 && startMonth <= 12) {
      this.time = (startMonth - 1) * CONFIG.secondsPerMonth;
      this.spawner.skipTo(this.time);
    }
    if (['manic', 'depressive'].includes(params.get('phase'))) this.mood.push(params.get('phase') === 'manic' ? 999 : -999);
    this.gallery = params.has('gallery');
    if (this.gallery) {
      const ids = params.get('gallery').split(',').filter(Boolean);
      const all = ids.length ? ids : ['medCheckpoint', 'trophy', 'restStop', 'allNighter', 'redEye', 'scheduleChaos', 'loss', 'criticism', 'stigmaBillboard',
        'routineCheckpoint', 'therapyPit', 'familyPit', 'supportive', 'cliffRamp', 'spendDetour', 'billboardPull', 'racingSigns', 'mud', 'fogFork', 'harshSigns'];
      all.forEach((id, i) => this.items.spawn(id, { s: car.s + 16 + i * 10, lane: (i % 3) - 1, side: i % 2 ? 1 : -1 }));
    }

    // January practice month (not when testing from a later month or the model gallery).
    this.practice = startMonth >= 2 || this.gallery ? null : new Practice(this);

    // ?debug=1: keys 1 / 2 push the mood low / high, 3 / 4 remove / add a guardrail.
    if (new URLSearchParams(location.search).has('debug')) {
      const key = (e) => {
        if (e.key === '1') this.mood.push(-25);
        if (e.key === '2') this.mood.push(25);
        if (e.key === '3') this.mood.addGuardrails(-1);
        if (e.key === '4') this.mood.addGuardrails(1);
      };
      window.addEventListener('keydown', key);
      this.offs.push(() => window.removeEventListener('keydown', key));
    }
  }

  exit() {
    this.offs.forEach((off) => off());
    this.hud.pullPrompt(null);
    this.app.input.lagMs = 0;
    this.app.setPadHint('');
    document.getElementById('fx').classList.remove('dim');
  }

  // ---------- Phases ----------
  onPhase(phase, old) {
    this.log.phase(this.time, phase, old);
    this.app.setPhase(phase);
    if (phase !== 'stable') this.app.sound.play(phase === 'manic' ? 'manicStart' : 'depressiveStart');
    if (phase !== 'stable' && !this.episodesSeen.has(phase)) {
      // First time this kind of episode starts: slow down and explain it in a larger box.
      this.episodesSeen.add(phase);
      if (!this.noTutorial) this.introSlow = CONFIG.episodeIntro.slowSec;
      this.hud.episodeIntro(EPISODE_INTRO[phase], phase);
    } else if (phase === 'manic') this.hud.caption('Manic episode', true, 'manic');
    else if (phase === 'depressive') this.hud.caption('Depressive episode', true, 'depressive');
    else this.hud.caption('The episode is easing. Back toward stable', true, 'good');
  }

  // ---------- Steering: hold to move lane by lane ----------
  onSteer(dir) {
    if (this.paused) return;
    this.steerDir = dir;
    if (dir) {
      this.stepLane(dir);
      this.repeat = W.steerRepeatMs / this.feel.steer;
    }
  }
  stepLane(dir) {
    const max = (W.lanes - 1) / 2;
    const before = this.lane;
    this.lane = Math.max(-max, Math.min(max, this.lane + dir));
    if (this.lane !== before) this.app.sound.play('laneChange');
  }
  onPull() {
    if (this.paused || !this.pullable || this.pullable.pulled) return;
    applyItemEvent(this, { type: 'pull', item: this.pullable });
  }

  /** Spawner callback: turns criticism into support after a family pit stop, marks triggers after therapy. */
  spawnItem(id, opts) {
    if (id === 'criticism' && this.flags.convertCriticism) { id = 'supportive'; this.flags.convertCriticism = false; }
    const isTrigger = !!CONFIG.triggers[id];
    const highlight = isTrigger && this.flags.highlightLeft > 0;
    if (highlight) this.flags.highlightLeft--;
    this.items.spawn(id, { ...opts, highlight });
    this.firstTip(id, id);
  }

  /** The first time something appears in a run: its road-guide line, labelled "New:". */
  firstTip(key, iconId) {
    const entry = guideEntry(key);
    if (!entry || this.noTutorial || this.tipsShown.has(key)) return;
    this.tipsShown.add(key);
    this.hud.tip(entry, iconId);
  }

  // ---------- Pause menu ----------
  togglePause(force) {
    this.paused = force ?? !this.paused;
    this.steerDir = 0;
    this.renderPause();
  }
  renderPause() {
    const { app } = this;
    const layer = app.ui.querySelector('.pause-layer');
    if (!layer) return;
    this.hud.el.inert = this.paused; // keyboard focus stays inside the pause menu (WCAG 2.4.3)
    if (!this.paused) { layer.innerHTML = ''; return; }
    const needPhone = !app.localPad && app.net.everConnected && app.net.status !== 'connected';
    layer.innerHTML = `
      <div class="screen dim">
        <div class="card pause-card" role="dialog" aria-modal="true" aria-labelledby="pause-title">
          <h2 id="pause-title">${needPhone ? 'Controller disconnected' : 'Paused'}</h2>
          ${needPhone ? `<p>Scan to reconnect your phone, or keep going with the keyboard.</p><canvas class="qr" width="420" height="420" role="img" aria-label="QR code for the phone controller"></canvas><div class="room" role="img" aria-label="Room code ${[...(app.net.code || '')].join(' ')}">${[...(app.net.code || '')].map((c) => `<span aria-hidden="true">${c}</span>`).join('')}</div>` : ''}
          <div class="row">
            <button class="btn resume">Resume</button>
            <button class="btn secondary open-guide">Road guide</button>
            <button class="btn secondary restart">Restart</button>
            <button class="btn secondary mute">${app.muted ? 'Sound on' : 'Mute'}</button>
          </div>
        </div>
      </div>`;
    if (needPhone) drawQR(layer.querySelector('.qr'), controllerUrl(app.net.code));
    layer.querySelector('.resume').addEventListener('click', () => this.togglePause(false));
    layer.querySelector('.restart').addEventListener('click', () => app.show('title'));
    layer.querySelector('.open-guide').addEventListener('click', () => {
      const holder = document.createElement('div');
      app.ui.appendChild(holder);
      this.guideOpen = true;
      openGuide(holder, app, { button: 'Back to the pause menu', onDone: () => { holder.remove(); app.setPhoneScreen(this.practice?.active ? 'practice' : 'drive'); setTimeout(() => { this.guideOpen = false; }, 0); this.renderPause(); } });
    });
    layer.querySelector('.mute').addEventListener('click', () => { app.toggleMute(); this.renderPause(); });
    layer.querySelector('.resume').focus();
  }

  // ---------- Year clock ----------
  tickCalendar() {
    // January tutorial hints (once each).
    this.hintsShown ??= new Set();
    for (const h of this.noTutorial ? [] : CONFIG.tutorialHints) {
      if (this.time >= h.at && this.time < CONFIG.secondsPerMonth && !this.hintsShown.has(h)) { this.hintsShown.add(h); this.hud.caption(h.text); }
    }
    const m = Math.floor(this.time / CONFIG.secondsPerMonth);
    if (m !== this.month && m < 12) {
      this.month = m;
      this.hud.caption(`${CONFIG.months[m]}: ${CONFIG.storyBeats[m]}`);
    }
  }

  // ---------- How the road feels and looks, blended through the leaning zones ----------
  /** {stable, manic, depressive} weights: full episode = 1; leaning = partway (PRD: +60 ≈ 1.3x speed). */
  weights() {
    const m = this.mood;
    if (m.phase !== 'stable') return { stable: 0, manic: m.phase === 'manic' ? 1 : 0, depressive: m.phase === 'depressive' ? 1 : 0 };
    const a = Math.abs(m.mood), lim = CONFIG.mood.stable;
    const k = a > lim ? (a - lim) / (CONFIG.mood.max - lim) : 0;
    return { stable: 1 - k, manic: m.mood > 0 ? k : 0, depressive: m.mood < 0 ? k : 0 };
  }
  applyPhaseFeel(dt) {
    const w = this.weights();
    const P = CONFIG.phases;
    const blend = (key) => w.stable * P.stable[key] + w.manic * P.manic[key] + w.depressive * P.depressive[key];
    this.feel = { speed: blend('speed'), steer: blend('steer'), lagMs: blend('lagMs'), laneChangeSec: blend('laneChangeSec'), laneDamping: blend('laneDamping') };
    this.app.input.lagMs = this.feel.lagMs; // depressive: steering answers late
    const { world } = this.app;
    world.chase.setBlend(w);
    world.weather.setBlend(w, this.mood.phase, this.feel.speed);
    this.app.sound.setBlend(w, this.mood.phase);

    // Manic episode: the kart keeps swerving toward other lanes (agitation, PRD allLanes).
    if (this.mood.phase === 'manic' && Math.random() < CONFIG.manicSwerveChance * dt) {
      this.stepLane(Math.random() < 0.5 ? -1 : 1);
      if (!this.swerveHinted) { this.swerveHinted = true; this.hud.caption('Hard to stay in one lane', true); }
    }
    // Depressive episode: the screen dims now and then and the kart drifts (sleep changes).
    this.dimTimer = (this.dimTimer ?? CONFIG.depressiveDimEverySec) - dt;
    const fx = document.getElementById('fx');
    if (this.mood.phase === 'depressive' && this.dimTimer <= 0) {
      this.dimTimer = CONFIG.depressiveDimEverySec;
      fx.classList.add('dim');
      setTimeout(() => fx.classList.remove('dim'), 1600);
      if (Math.random() < 0.6) this.stepLane(Math.random() < 0.5 ? -1 : 1);
    }
  }

  // ---------- Lane changes: a spring that takes ~laneChangeSec; manic overshoots, depressive is heavy ----------
  moveSideways(dt) {
    const car = this.app.world.car;
    const targetX = this.lane * W.laneWidth;
    const w = 4.5 / this.feel.laneChangeSec, z = this.feel.laneDamping;
    const steps = Math.ceil(dt / 0.004);
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      car.vx += (w * w * (targetX - car.x) - 2 * z * w * car.vx) * h;
      car.x += car.vx * h;
    }
    // Body lean: quick normally, slow and heavy in a depressive episode.
    const want = Math.max(-1, Math.min(1, car.vx / (0.37 * W.laneWidth * w)));
    const heavy = this.mood.phase === 'depressive';
    car.lean += (want - car.lean) * (1 - Math.exp(-dt * (heavy ? 2.5 : 12)));
    if (heavy && Math.abs(car.vx) > 0.6) this.app.world.weather.spray(this.app.world.kart.group, Math.abs(car.vx));
  }

  // ---------- End of the year ----------
  finish() {
    if (this.finished) return;
    this.finished = true;
    this.log.finish(this.time);
    this.log.coins = this.coins;
    this.hud.caption('Graduation day!', true);
    this.app.sound.play('finish');
    setTimeout(() => { if (this.app.current === this) this.app.show('review', { log: this.log }); }, 1200);
  }

  // ---------- Frame ----------
  update(dt) {
    const { world } = this.app;
    const car = world.car;
    const realDt = dt;
    const practising = this.practice?.active && !this.paused;
    // Slow-downs (the slowest one wins): first-time tip, first episode, practice item coming.
    let slow = 1;
    if (this.hud.tipShowing && !this.paused) slow = Math.min(slow, CONFIG.firstTipSlow);
    if (this.introSlow > 0 && !this.paused) { this.introSlow -= realDt; slow = Math.min(slow, CONFIG.episodeIntro.slow); }
    if (practising) slow = Math.min(slow, this.practice.timeScale);
    dt *= slow;
    if (this.gallery) { world.placeKart(0); world.chase.follow(dt, world.kart.group.position, world.frame.fwd); this.items.update(dt, { s: -1e9, x: 0 }); return; }
    if (!this.paused) {
      // Practice month: the year clock, mood drift and mood samples wait until it is over.
      if (!practising) {
        this.time += dt;
        this.tickCalendar();
        this.mood.update(dt);
        this.log.sample(this.time, this.mood.mood, this.mood.phase);
      }
      this.applyPhaseFeel(dt);
      world.road.setGuardrails(this.mood.guardrails);

      // Holding a direction keeps moving lane by lane.
      if (this.steerDir) {
        this.repeat -= dt * 1000;
        if (this.repeat <= 0) { this.stepLane(this.steerDir); this.repeat = W.steerRepeatMs / this.feel.steer; }
      }
      this.moveSideways(dt);
      this.flags.slowTimer = Math.max(0, this.flags.slowTimer - dt);
      const mud = this.flags.slowTimer > 0 ? CONFIG.hazards.mud.slow : 1;
      car.speed = W.baseSpeed * this.feel.speed * mud;
      car.s += car.speed * dt;

      // Road items: scripted + random spawns, then what happened as we passed them.
      if (!practising) this.spawner.update(this.time, this.mood.phase, car.s, (id, opts) => this.spawnItem(id, opts));
      if (this.time >= 12 * CONFIG.secondsPerMonth && !this.finishSpawned) {
        this.finishSpawned = true;
        this.items.spawn('finish', { s: car.s + 70 });
      }
      this.pullable = null;
      let pullHint = null;
      for (const ev of this.items.update(dt, car, this.mood.phase === 'depressive')) {
        if (ev.type === 'pullable' && ev.item.id === 'restStop' && this.mood.phase === 'manic' && !ev.item.noRestShown) {
          ev.item.noRestShown = true; // decreased need for sleep: the rest stop doesn't help
          this.hud.toast('Doesn’t feel tired', 'up', 'restStop');
        }
        if (ev.type === 'pullable') {
          if (ev.inLane && !ev.item.pulled) this.pullable = ev.item;
          else if (!ev.item.pulled) pullHint = 'Move right to pull in';
        } else applyItemEvent(this, ev);
      }
      this.hud.pullPrompt(this.pullable ? 'Pull in! (Space)' : pullHint);
      if (practising) this.practice.update(realDt);
    }
    world.placeKart(this.paused ? 0 : dt);
    if (this.flags.hop > 0) { // little bounce after a bump: no crash, no injury
      this.flags.hop = Math.max(0, this.flags.hop - dt * 2.5);
      world.kart.group.position.y += Math.sin(this.flags.hop * Math.PI) * 0.5;
    }
    world.chase.follow(dt, world.kart.group.position, world.frame.fwd);
    const m = this.mood;
    this.hud.update({
      mood: m.mood, phase: m.phase, guardrails: m.guardrails, time: this.time,
      monthIndex: Math.floor(this.time / CONFIG.secondsPerMonth),
      monthProgress: this.practice?.active ? this.practice.progress : (this.time % CONFIG.secondsPerMonth) / CONFIG.secondsPerMonth,
      episodeLeft: m.episodeTimer, episodeLength: m.episodeLength, coins: this.coins.points,
    });
  }
}
