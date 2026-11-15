// main.js: entry point for the game screen. Sets up the Three.js renderer and
// 3D world (road, kart, camera, sky), the phone link and input, switches between
// the five screens, and runs the main loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRoad } from './world/road.js';
import { ChaseCamera } from './world/camera.js';
import { createWeather } from './world/weather.js';
import { buildKart } from './world/models.js';
import { HostLink } from './net.js';
import { Input } from './systems/input.js';
import { Sound } from './systems/sound.js';
import { buildPad } from './controller.js';
import './controller.css';
import { TitleScreen } from './screens/TitleScreen.js';
import { ContentNoteScreen } from './screens/ContentNoteScreen.js';
import { HowToScreen } from './screens/HowToScreen.js';
import { DriveScreen } from './screens/DriveScreen.js';
import { ReviewScreen } from './screens/ReviewScreen.js';
import { IntroScreen } from './screens/IntroScreen.js';
import { RoadGuideScreen } from './screens/RoadGuideScreen.js';

// ---------- Renderer and world ----------
const canvas = document.getElementById('game');
const testMode = Number(new URLSearchParams(location.search).get('timescale')) > 1;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: testMode });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 2200);

const road = createRoad(scene);
const weather = createWeather(scene, camera);
const chase = new ChaseCamera(camera);

const UP = new THREE.Vector3(0, 1, 0);
const frame = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
const heading = new THREE.Vector3();

const world = {
  road, weather, chase, scene, camera,
  kart: null,
  car: { s: 0, x: 0, vx: 0, speed: 0 },
  frame,
  /** Swap the driver sitting in the kart. */
  setDriver(name) {
    if (world.kart) scene.remove(world.kart.group);
    world.kart = buildKart(name);
    scene.add(world.kart.group);
  },
  /** Put the kart on the road at car.s / car.x, facing where it is heading. */
  placeKart(dt) {
    const { car, kart } = world;
    road.frameAt(car.s, frame);
    kart.group.position.copy(frame.pos).addScaledVector(frame.right, car.x);
    const slip = car.speed > 1 ? THREE.MathUtils.clamp(car.vx / car.speed, -0.35, 0.35) : 0;
    heading.copy(frame.fwd).addScaledVector(frame.right, slip).normalize();
    kart.group.lookAt(kart.group.position.clone().add(heading));
    kart.setLean(car.lean ?? THREE.MathUtils.clamp(car.vx / CONFIG.world.laneChangeSpeed, -1, 1));
    kart.spin(car.speed * dt);
    road.update(car.s);
  },
};

// ---------- App: shared state used by every screen ----------
const ui = document.getElementById('ui');
const app = {
  renderer, scene, camera, world, ui,
  input: new Input(),
  sound: new Sound(),
  driver: 'girl',
  muted: false,
  localPad: null,
  screens: {},
  current: null,
  phoneScreen: 'title',
  show(name, data) {
    app.current?.exit();
    app.current = app.screens[name];
    ui.innerHTML = '';
    app.input.quiet(); // a press that changed the screen never also acts on the new one
    app.current.enter(data);
  },
  /** Tell the phone (and the local pad) which screen we are on. */
  setPhoneScreen(name) {
    app.phoneScreen = name;
    app.net.send({ t: 'screen', name });
    app.localPad?.setScreen(name);
  },
  setPhase(phase) {
    app.net.send({ t: 'phase', phase });
    app.localPad?.setPhase(phase);
  },
  buzz(pattern) { app.net.send({ t: 'buzz', pattern }); },
  padHint: '',
  /** Highlight a pad button on the phone (and the local pad), e.g. 'pull' in the practice month. */
  setPadHint(name = '') {
    app.padHint = name;
    app.net.send({ t: 'hint', name });
    app.localPad?.setHint(name);
  },
  toggleMute() {
    app.muted = !app.muted;
    app.sound.setMuted(app.muted);
    try { sessionStorage.setItem('supporty-muted', app.muted ? '1' : '0'); } catch { /* private mode */ }
    muteBtn.setAttribute('aria-checked', String(!app.muted));
    muteBtn.querySelector('.st-state').textContent = app.muted ? 'OFF' : 'ON';
    muteBtn.title = app.muted ? 'Sound is off (M to turn on)' : 'Sound is on (M to turn off)';
  },
  /** "Play on this device": overlay the controller buttons on this screen. */
  enableLocalPad() {
    if (app.localPad) return;
    const holder = document.createElement('div');
    holder.className = 'local-pad';
    document.getElementById('stage').insertBefore(holder, document.getElementById('grain'));
    app.localPad = buildPad(holder, { send: (msg) => app.input.handle(msg), local: true });
    app.localPad.setScreen(app.phoneScreen);
    app.localPad.setHint(app.padHint);
  },
  statusListeners: new Set(),
};

// Phone link: messages go straight into the shared input.
app.net = new HostLink({
  onMessage: (msg) => app.input.handle(msg),
  onStatus: (s) => {
    if (s === 'lost') app.input.release();
    for (const fn of app.statusListeners) fn(s);
  },
});
app.net.onConnect = () => { app.setPhoneScreen(app.phoneScreen); app.setPadHint(app.padHint); };
app.net.open();

// Persistent mute button (bottom-right on every screen). No audio yet; the game is fully playable muted.
// Sound on/off switch, bottom-left on every screen.
const muteBtn = document.createElement('button');
muteBtn.className = 'sound-toggle';
muteBtn.setAttribute('role', 'switch');
muteBtn.setAttribute('aria-label', 'Sound');
muteBtn.innerHTML = '<span class="st-label">Sound</span><span class="st-track"><span class="st-knob"></span></span><span class="st-state">ON</span>';
document.getElementById('stage').appendChild(muteBtn);
muteBtn.addEventListener('click', () => app.toggleMute());
app.input.on('mute', () => app.toggleMute());
// Mute is remembered for this browser session.
let startMuted = false;
try { startMuted = sessionStorage.getItem('supporty-muted') === '1'; } catch { /* private mode */ }
app.muted = !startMuted;
app.toggleMute();

// Audio unlocks on any click or key press on this page (the phone controller doesn't count).
const unlockAudio = () => app.sound.unlock();
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// Soft click for buttons and for advancing menu / onboarding screens.
document.addEventListener('click', (e) => { if (e.target.closest('button')) app.sound.play('click'); });
for (const ev of ['start', 'pull']) app.input.on(ev, () => { if (app.current !== app.screens.drive) app.sound.play('click'); });

app.screens = {
  title: new TitleScreen(app),
  contentNote: new ContentNoteScreen(app),
  howTo: new HowToScreen(app),
  intro: new IntroScreen(app),
  guide: new RoadGuideScreen(app),
  drive: new DriveScreen(app),
  review: new ReviewScreen(app),
};

// ---------- Loop ----------
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ?debug=1 shows fps and triangle count (budget: under 50k).
const debugEl = new URLSearchParams(location.search).has('debug') ? document.createElement('pre') : null;
if (debugEl) {
  debugEl.style.cssText = 'position:fixed;left:8px;bottom:8px;margin:0;background:#fffaf0;padding:4px 8px;border:2px solid #3b3433;border-radius:8px;font:700 13px Inter;z-index:9';
  document.body.appendChild(debugEl);
}
let frames = 0, fpsTime = 0;
// ?timescale=8 fast-forwards the game (testing only). Errors are noted on <body data-error>.
const timeScale = Math.max(1, Math.min(40, Number(new URLSearchParams(location.search).get('timescale')) || 1));
window.addEventListener('error', (e) => { document.body.dataset.error = e.message; });

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  app.input.update();
  for (let i = 0; i < timeScale; i++) app.current?.update(dt);
  weather.update(dt);
  renderer.render(scene, camera);
  if (debugEl) {
    frames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) { debugEl.dataset.fps = Math.round(frames / fpsTime); frames = fpsTime = 0; }
    debugEl.textContent = `t=${(app.screens.drive.time || 0).toFixed(1)} · ${debugEl.dataset.fps || '…'} fps · ${renderer.info.render.triangles} triangles · ${renderer.info.render.calls} draw calls`;
  }
}
if (timeScale > 1) setInterval(tick, 16); // test mode: also runs where animation frames don't (headless)
else renderer.setAnimationLoop(tick);

// Debug shortcuts for testing: index.html?driver=boy&screen=drive
const params = new URLSearchParams(location.search);
if (params.get('driver') === 'boy') app.driver = 'boy';
world.setDriver(app.driver);
app.show(app.screens[params.get('screen')] ? params.get('screen') : 'title');
window.__app = app; // handy for debugging in the browser console
