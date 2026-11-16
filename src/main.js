// main.js: entry point for the game screen. Sets up the Three.js renderer and
// 3D world (road, kart, camera, sky), the phone link and input, switches between
// the five screens, and runs the main loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createRoad } from './world/road.js';
import { ChaseCamera } from './world/camera.js';
import { createWeather } from './world/weather.js';
import { buildKart } from './world/car.js';
import { OUTLINE_LAYER } from './world/models.js';
import { cssVars } from './world/palette.js';
import { setModelQuality } from './world/generated.js';

for (const [name, value] of cssVars()) document.documentElement.style.setProperty(name, value); // interface colours come from palette.js
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
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.3, 2200);

const road = createRoad(scene);
const weather = createWeather(scene, camera);
weather.setSeasonal(road.seasonal);
// Any shader that fails to compile is reported loudly instead of leaving a silent blank object.
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  const msg = `Shader failed to compile: ${gl.getShaderInfoLog(vs) || ''} ${gl.getShaderInfoLog(fs) || ''} ${gl.getProgramInfoLog(program) || ''}`;
  document.body.dataset.error = msg;
  throw new Error(msg);
};
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
    world.kart.setMood(world.phase ?? 'stable');
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
    kart.update(dt);
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
  graphics: 'high',
  /** Graphics: 'high' = outlines, drifting blossom and leaves, sharper picture; 'low' = those off, for slower laptops. */
  setGraphics(level) {
    app.graphics = level === 'low' ? 'low' : 'high';
    const high = app.graphics === 'high';
    if (high) camera.layers.enable(OUTLINE_LAYER); else camera.layers.disable(OUTLINE_LAYER);
    weather.setQuality(high);
    setModelQuality(app.graphics);
    if (world.kart) world.setDriver(app.driver); // rebuild the kart and driver from the fine or the coarse meshes
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 2 : 1));
    try { sessionStorage.setItem('supporty-graphics', app.graphics); } catch { /* private mode */ }
  },
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
    world.phase = phase;
    world.kart?.setMood(phase);
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
// If the page was still silent, the first click on the switch (or first M press) only starts the sound;
// it doesn't also switch it off (it already says ON).
let justUnlocked = false;
const toggleUnlessFirst = () => { if (justUnlocked && !app.muted) return; app.toggleMute(); };
muteBtn.addEventListener('click', toggleUnlessFirst);
app.input.on('mute', toggleUnlessFirst);
// Mute is remembered for this browser session.
let startMuted = false;
try { startMuted = sessionStorage.getItem('supporty-muted') === '1'; } catch { /* private mode */ }
app.muted = !startMuted;
app.toggleMute();

// Browsers only allow sound after a click or key press on this page (the phone controller doesn't count).
// Try right away anyway: some browsers allow it for sites the visitor has played before.
const unlockAudio = () => {
  justUnlocked = !app.sound.unlocked; // true only for the gesture that starts the sound
  app.sound.unlock();
  setTimeout(() => { justUnlocked = false; }, 0); // after this gesture's click / key handlers have run
};
window.addEventListener('pointerdown', unlockAudio, true);
window.addEventListener('keydown', unlockAudio, true);
app.sound.unlock();
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

window.addEventListener('error', (e) => { document.body.dataset.error = e.message; }); // errors are noted on <body data-error>

const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  app.input.update();
  app.current?.update(dt);
  weather.update(dt);
  renderer.render(scene, camera);
}
renderer.setAnimationLoop(tick);

let savedGraphics = null;
try { savedGraphics = sessionStorage.getItem('supporty-graphics'); } catch { /* private mode */ }
app.setGraphics(savedGraphics || 'high');
world.setDriver(app.driver);
app.show('title');
