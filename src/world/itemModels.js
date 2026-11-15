// itemModels.js: low-poly models for everything that appears on the road:
// triggers, support items, episode hazards and the finish arch. Built from simple
// shapes like models.js, each with a readable label so meaning never relies on colour.
// Sketched: medication capsule, trophy, REST STOP sign, rock. The rest are listed in MODELS.md.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { toon, box, ball, cyl, cone, blobShadow } from './models.js';

const W = CONFIG.world;
const HALF = (W.lanes * W.laneWidth) / 2;
const INK = '#3b3433';

// ---------- Text on canvas (labels, signs) ----------
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Floating pill label (sprite) that always faces the camera. */
export function label(text, { bg = '#fffaf0', fg = INK, height = 0.95 } = {}) {
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d');
  const font = '900 46px Nunito, system-ui, sans-serif';
  g.font = font;
  const w = Math.ceil(g.measureText(text).width) + 52;
  cv.width = w; cv.height = 76;
  g.font = font;
  roundRect(g, 4, 4, w - 8, 68, 34);
  g.fillStyle = bg; g.fill();
  g.lineWidth = 6; g.strokeStyle = INK; g.stroke();
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, 41);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set((w / 76) * height, height, 1);
  sp.renderOrder = 2;
  return sp;
}

/** Flat sign face with wrapped text. Returns the mesh; mesh.userData.setText(text) redraws it. */
export function textPanel(text, { w = 3, h = 1.5, bg = '#fffaf0', fg = INK, round = false, px = 64 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round((512 * h) / w);
  const g = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = (t) => {
    g.clearRect(0, 0, cv.width, cv.height);
    if (round) { g.beginPath(); g.arc(256, 256, 250, 0, Math.PI * 2); } else roundRect(g, 6, 6, cv.width - 12, cv.height - 12, 28);
    g.fillStyle = bg; g.fill();
    g.lineWidth = 12; g.strokeStyle = INK; g.stroke();
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${px}px Nunito, system-ui, sans-serif`;
    const words = t.split(' '); const lines = []; let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > cv.width - 70 && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
    const lh = px * 1.1;
    lines.forEach((l, i) => g.fillText(l, cv.width / 2, cv.height / 2 + (i - (lines.length - 1) / 2) * lh + 4));
    tex.needsUpdate = true;
  };
  draw(text);
  const geo = round ? new THREE.CircleGeometry(w / 2, 24) : new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  mesh.userData.setText = draw;
  return mesh;
}

// ---------- Small shared pieces ----------
function post(h, color, x, z = 0) { return cyl(0.09, 0.09, h, color, x, h / 2, z, 6); }
/** Sign board on two posts, facing the kart (-Z). */
function board(text, { w = 2.8, h = 1.4, y = 2.2, bg, fg, px } = {}) {
  const g = new THREE.Group();
  g.add(post(y + h / 2, 0x8d8a86, -w / 2 + 0.25), post(y + h / 2, 0x8d8a86, w / 2 - 0.25));
  g.add(box(w + 0.15, h + 0.15, 0.12, 0x3b3433, 0, y, 0.02));
  const p = textPanel(text, { w, h, bg, fg, px });
  p.position.set(0, y, -0.06);
  p.rotation.y = Math.PI;
  g.add(p);
  g.userData.panel = p;
  return g;
}
function withLabel(group, text, y, opts) {
  const l = label(text, opts);
  l.position.y = y;
  group.add(l);
  group.userData.label = l;
  return group;
}

// ---------- Triggers ----------
function allNighter() {
  const g = board('', { w: 2.4, h: 1.6, y: 1.9, bg: '#3f4a7a' });
  const moon = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.16, 6, 14, Math.PI * 1.25), toon(0xf7d36b));
  moon.position.set(-0.2, 1.95, -0.2);
  moon.rotation.z = 1.2;
  g.add(moon);
  const cross = box(1.6, 0.16, 0.06, 0xd23b3b, 0.15, 1.9, -0.26);
  cross.rotation.z = -0.6; // "skip": the night's sleep is crossed out
  g.add(cross);
  return withLabel(g, CONFIG.triggers.allNighter.label, 3.6);
}

function plane() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 2.2, 4, 8), toon(0xf4f1ea));
  hull.rotation.x = Math.PI / 2;
  body.add(hull);
  body.add(box(3.6, 0.08, 0.7, 0xd9dde3, 0, 0, 0.1));
  body.add(box(1.4, 0.07, 0.4, 0xd9dde3, 0, 0.1, -1.3));
  body.add(box(0.08, 0.7, 0.5, 0xd23b3b, 0, 0.45, -1.3));
  for (const s of [-1, 1]) body.add(ball(0.12, 0x6fb6d6, s * 0.3, 0.2, 1.1, 6)); // windows
  body.add(box(0.86, 0.08, 1.6, 0xd23b3b, 0, -0.05, 0.2)); // red stripe
  body.position.y = 3.2;
  body.rotation.y = Math.PI / 2 + 0.3; // crossing the road
  g.add(body);
  g.add(blobShadow(3, 2.4));
  g.userData.spin = (t) => { body.position.y = 3.2 + Math.sin(t * 2) * 0.2; body.position.x = Math.sin(t * 0.8) * 0.8; };
  return withLabel(g, CONFIG.triggers.redEye.label, 4.9);
}

export function trophyModel() {
  const gold = 0xf1b43a;
  const g = new THREE.Group();
  const cup = new THREE.Group();
  cup.add(box(1.0, 0.18, 0.5, gold, 0, 0.09, 0));
  cup.add(cyl(0.12, 0.18, 0.5, gold, 0, 0.42, 0, 8));
  cup.add(ball(0.17, gold, 0, 0.72, 0, 8));
  cup.add(cyl(0.75, 0.32, 1.1, gold, 0, 1.4, 0, 12));
  cup.add(cyl(0.8, 0.8, 0.14, 0xf7cb5c, 0, 1.98, 0, 12));
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.09, 6, 10), toon(gold));
    h.position.set(s * 0.78, 1.45, 0);
    cup.add(h);
  }
  cup.add(box(0.08, 0.6, 0.06, 0xfff3c4, -0.3, 1.45, -0.5)); // shine
  cup.position.y = 0.2;
  g.add(cup);
  g.add(blobShadow(2.2));
  g.userData.spin = (t) => { cup.rotation.y = Math.sin(t * 1.5) * 0.4; };
  return g;
}
function trophy() { return withLabel(trophyModel(), CONFIG.triggers.trophy.label, 3.3, { bg: '#ffe9a8' }); }

function clockFace(r, fast) {
  const c = new THREE.Group();
  const face = cyl(r, r, 0.12, 0xfffaf0, 0, 0, 0, 16);
  face.rotation.x = Math.PI / 2;
  c.add(face);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 18), toon(0x3b3433));
  c.add(rim);
  const hour = box(0.08, r * 0.55, 0.05, 0x3b3433, 0, 0, -0.08);
  const min = box(0.06, r * 0.85, 0.05, fast ? 0xd23b3b : 0x3b3433, 0, 0, -0.1);
  hour.geometry.translate(0, r * 0.27, 0);
  min.geometry.translate(0, r * 0.42, 0);
  c.add(hour, min);
  c.userData.hands = { hour, min };
  return c;
}
function scheduleChaos() {
  const g = new THREE.Group();
  g.add(post(2.4, 0x8d8a86, 0));
  const a = clockFace(0.6, true); a.position.set(-0.55, 2.5, 0);
  const b = clockFace(0.5, true); b.position.set(0.6, 1.8, 0);
  g.add(a, b);
  g.add(blobShadow(2));
  g.userData.spin = (t) => {
    a.userData.hands.min.rotation.z = -t * 9; a.userData.hands.hour.rotation.z = t * 4;
    b.userData.hands.min.rotation.z = t * 11; b.userData.hands.hour.rotation.z = -t * 3;
    a.rotation.z = Math.sin(t * 6) * 0.15;
  };
  return withLabel(g, CONFIG.triggers.scheduleChaos.label, 3.6);
}

/** Grey rounded rock (from the sketch): a cluster of soft low-poly lumps. */
export function rockModel() {
  const g = new THREE.Group();
  for (const [x, y, z, r] of [[0, 0.7, 0, 0.95], [-0.8, 0.5, 0.1, 0.7], [0.75, 0.5, -0.1, 0.72], [0.1, 0.45, 0.5, 0.6]]) {
    const lump = ball(r, 0x9aa1aa, x, y, z, 7);
    lump.scale.y = 0.8;
    g.add(lump);
  }
  return g;
}
function loss() {
  const g = new THREE.Group();
  const hole = cyl(1.2, 1.2, 0.04, 0x4b4440, 0, 0.03, 0, 12);
  hole.scale.z = 0.75;
  g.add(hole);
  const rock = rockModel();
  rock.position.y = 14; // falls when the kart gets close
  g.add(rock);
  g.add(blobShadow(2.6));
  g.userData.rock = rock;
  g.userData.approach = (d) => { rock.position.y = Math.max(0, Math.min(14, (d - 25) * 0.7)); };
  return withLabel(g, CONFIG.triggers.loss.label, 3.3, { bg: '#c9d6e2' });
}

function speechBubble(text, color, fg) {
  const g = new THREE.Group();
  g.add(box(0.2, 0.9, 0.2, 0x8d8a86, -0.9, 0.45, 0), box(0.2, 0.9, 0.2, 0x8d8a86, 0.9, 0.45, 0));
  const bubble = new THREE.Group();
  bubble.add(box(2.6, 1.3, 0.4, color, 0, 0, 0));
  for (const s of [-1, 1]) { const end = cyl(0.65, 0.65, 0.4, color, s * 1.3, 0, 0, 12); end.rotation.x = Math.PI / 2; bubble.add(end); }
  const tail = cone(0.3, 0.6, color, 0.7, -0.85, 0, 4);
  tail.rotation.z = Math.PI + 0.4;
  bubble.add(tail);
  const p = textPanel(text, { w: 3.1, h: 1.2, bg: 'rgba(0,0,0,0)', fg, px: 76 });
  p.position.z = -0.22; p.rotation.y = Math.PI;
  bubble.add(p);
  bubble.position.y = 1.7;
  g.add(bubble);
  g.add(blobShadow(3, 1.4));
  g.userData.spin = (t) => { bubble.position.y = 1.7 + Math.sin(t * 2.5) * 0.06; };
  return g;
}
const criticism = () => speechBubble(`“${CONFIG.triggers.criticism.label}”`, 0xf2f2f0, INK);
const supportive = () => withLabel(speechBubble(`“${CONFIG.support.familyPit.supportiveLabel}”`, 0xbfe3b4, INK), 'Support', 3.3, { bg: '#cfe7c4' });

function stigmaBillboard() {
  const g = board(CONFIG.triggers.stigmaBillboard.label, { w: 3.0, h: 1.7, y: 2.1, bg: '#b9aebf', px: 72 });
  g.add(blobShadow(3.2, 1));
  return withLabel(g, 'Stigma', 3.85, { bg: '#e4dbe8' });
}

// ---------- Support items ----------
/** Medication capsule (from the sketch): red-and-white, with a subtle glow. It's a routine, not a power-up. */
export function capsuleModel() {
  const g = new THREE.Group();
  const red = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), toon(0xd23b3b));
  const white = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 4, 10), toon(0xf7f4ee));
  red.position.y = 0.36; white.position.y = -0.36;
  const halves = new THREE.Group();
  halves.add(red, white);
  halves.scale.setScalar(0.9);
  halves.rotation.z = -0.7;
  g.add(halves);
  const glow = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffe28a, transparent: true, opacity: 0.45 }));
  g.add(glow);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(0.8, 20), new THREE.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.18, depthWrite: false }));
  halo.position.z = 0.05;
  g.add(halo);
  g.userData.halves = halves;
  return g;
}
function gateArch(color) {
  const g = new THREE.Group();
  const w = W.laneWidth * 0.8;
  g.add(box(0.22, 3.1, 0.22, color, -w / 2, 1.55, 0), box(0.22, 3.1, 0.22, color, w / 2, 1.55, 0));
  g.add(box(w + 0.4, 0.3, 0.3, color, 0, 3.15, 0));
  g.add(blobShadow(w + 0.6, 1));
  return g;
}
function medCheckpoint() {
  const g = gateArch(0x7fae7a);
  const cap = capsuleModel();
  cap.position.y = 1.7;
  cap.rotation.y = Math.PI;
  g.add(cap);
  g.userData.spin = (t) => { cap.userData.halves.rotation.y = t * 0.8; cap.position.y = 1.7 + Math.sin(t * 2) * 0.08; };
  return withLabel(g, CONFIG.supportLabels.medCheckpoint, 3.95, { bg: '#cfe7c4' });
}
function routineCheckpoint() {
  const g = gateArch(0xe0b45a);
  const c = clockFace(0.8, false);
  c.position.set(0, 3.15, -0.1);
  c.userData.hands.min.rotation.z = 0;
  c.userData.hands.hour.rotation.z = -Math.PI / 2; // a calm 9 o'clock
  g.add(c);
  return withLabel(g, CONFIG.supportLabels.routineCheckpoint, 4.6, { bg: '#cfe7c4' });
}

/** Red round REST STOP sign on a pole (from the sketch), with a bed and a bench. */
function restStop() {
  const g = new THREE.Group();
  g.add(cyl(0.07, 0.07, 3.0, 0xc7ccd2, 0, 1.5, 0, 6));
  const back = cyl(0.85, 0.85, 0.1, 0xb32f2f, 0, 3.3, 0, 20);
  back.rotation.x = Math.PI / 2;
  g.add(back);
  const face = textPanel('REST STOP', { w: 1.7, h: 1.7, round: true, bg: '#d23b3b', fg: '#ffffff', px: 104 });
  face.position.set(0, 3.3, -0.07); face.rotation.y = Math.PI;
  g.add(face);
  const bed = new THREE.Group();
  bed.add(box(1.6, 0.4, 2.4, 0x8a6a4f, 0, 0.3, 0), box(1.5, 0.25, 2.3, 0xfffaf0, 0, 0.6, 0), box(1.0, 0.2, 0.5, 0xbfe3f2, 0, 0.8, 0.8), box(1.52, 0.18, 1.3, 0x7bb8c9, 0, 0.74, -0.45));
  bed.position.set(2.2, 0, 0.5);
  g.add(bed);
  g.add(blobShadow(5, 3.4));
  g.userData.face = face;
  return withLabel(g, CONFIG.supportLabels.restStop, 4.7, { bg: '#cfe7c4' });
}

function booth(color, awningA, awningB) {
  const g = new THREE.Group();
  g.add(box(3.2, 2.2, 2.2, color, 0, 1.1, 0.3));
  g.add(box(3.4, 0.2, 2.4, 0xfffaf0, 0, 2.3, 0.3));
  for (let i = 0; i < 6; i++) {
    const s = box(0.58, 0.12, 1.0, i % 2 ? awningA : awningB, -1.45 + i * 0.58, 2.05, -1.1);
    s.rotation.x = -0.35;
    g.add(s);
  }
  g.add(box(1.4, 1.1, 0.06, 0x3b3433, 0, 1.05, -0.82)); // window
  g.add(blobShadow(4.4, 3.4));
  return g;
}
function therapyPit() {
  const g = booth(0x9cc5b0, 0x7fae7a, 0xfffaf0);
  const sign = textPanel('Therapy', { w: 2.6, h: 0.8, bg: '#fffaf0', px: 120 });
  sign.position.set(0, 2.95, -0.9); sign.rotation.y = Math.PI;
  g.add(sign);
  // icon: two speech bubbles (talking it through)
  g.add(ball(0.42, 0xfffaf0, -0.4, 4.0, -0.6, 8), ball(0.32, 0xbfe3f2, 0.35, 4.25, -0.6, 8));
  return withLabel(g, CONFIG.supportLabels.therapyPit, 5.2, { bg: '#cfe7c4' });
}

function person(shirt, hair, x) {
  const p = new THREE.Group();
  p.add(box(0.6, 0.7, 0.4, shirt, 0, 0.9, 0), box(0.5, 0.55, 0.3, 0x55606a, 0, 0.3, 0));
  p.add(box(0.62, 0.6, 0.55, CONFIG.colors.skin, 0, 1.55, 0), box(0.66, 0.2, 0.6, hair, 0, 1.9, 0.02));
  for (const s of [-1, 1]) p.add(ball(0.06, 0x3b1f17, s * 0.13, 1.58, -0.28, 6));
  const arm = box(0.16, 0.6, 0.16, shirt, 0.4, 1.35, 0);
  arm.geometry.translate(0, 0.25, 0);
  p.add(arm);
  p.position.x = x;
  p.userData.arm = arm;
  return p;
}
function familyPit() {
  const g = new THREE.Group();
  const crew = [person(0xf2a65a, 0x6b4a32, -1.3), person(0x7bb8c9, 0x2e2b2b, 0), person(0xc68fd0, 0xe2c65a, 1.3)];
  crew.forEach((p) => g.add(p)); // faces are on -Z, toward the kart
  const banner = textPanel('Family & friends', { w: 3.6, h: 0.8, bg: '#ffe9a8', px: 88 });
  banner.position.set(0, 2.85, -0.1); banner.rotation.y = Math.PI;
  g.add(banner, post(3.2, 0x8a6a4f, -1.9), post(3.2, 0x8a6a4f, 1.9));
  g.add(blobShadow(4.6, 1.8));
  g.userData.spin = (t) => crew.forEach((p, i) => { p.userData.arm.rotation.z = 0.6 + Math.sin(t * 6 + i) * 0.5; });
  return withLabel(g, CONFIG.supportLabels.familyPit, 3.9, { bg: '#cfe7c4' });
}

// ---------- Episode hazards ----------
function cliffRamp() {
  const g = new THREE.Group();
  const ramp = box(2.4, 0.2, 3.2, 0xe6a04a, 0, 0.55, 0);
  ramp.rotation.x = 0.32;
  g.add(ramp, box(2.4, 1.1, 0.2, 0xb87b33, 0, 0.55, 1.5));
  const arrow = board('Shortcut! →', { w: 2.2, h: 0.8, y: 2.4, bg: '#ffe066', px: 96 });
  g.add(arrow);
  g.add(blobShadow(3, 3.6));
  return withLabel(g, 'Risky shortcut', 3.6, { bg: '#f8cfe6' });
}
function spendDetour() {
  const g = booth(0xe86fb8, 0xffe066, 0xfffaf0);
  g.scale.setScalar(0.75);
  const sign = textPanel('SALE!', { w: 2.6, h: 0.8, bg: '#ffe066', px: 120 });
  sign.position.set(0, 2.95, -0.9); sign.rotation.y = Math.PI;
  g.add(sign);
  for (const [x, c] of [[-0.8, 0x7bb8c9], [0, 0xf2a65a], [0.8, 0xc68fd0]]) g.add(box(0.5, 0.6, 0.3, c, x, 0.3, -1.4));
  return withLabel(g, CONFIG.hazards.spendDetour.label, 3.4, { bg: '#f8cfe6' });
}
function billboardPull() {
  const g = board(CONFIG.hazards.billboardPull.label, { w: 3.6, h: 1.8, y: 2.6, bg: '#ff8fd0', px: 96 });
  const stars = [];
  for (let i = 0; i < 5; i++) {
    const st = cone(0.18, 0.4, 0xffe066, -1.6 + i * 0.8, 3.75, -0.1, 4);
    g.add(st); stars.push(st);
  }
  g.userData.spin = (t) => stars.forEach((s, i) => { s.rotation.y = t * 4 + i; s.scale.setScalar(0.8 + Math.abs(Math.sin(t * 5 + i)) * 0.5); });
  return g;
}
function racingSigns() {
  const words = CONFIG.hazards.racingSigns.words;
  const g = board(words[0], { w: 2.6, h: 1.2, y: 2.2, bg: '#fff1a8', px: 84 });
  let last = -1;
  g.userData.spin = (t) => {
    const i = Math.floor(t * 4) % words.length; // changes too fast to read: racing thoughts
    if (i !== last) { last = i; g.userData.panel.userData.setText(words[i]); }
  };
  return g;
}
function mud() {
  const g = new THREE.Group();
  for (const [x, z, r] of [[0, 0, 1.3], [-0.7, 0.8, 0.8], [0.8, -0.6, 0.9], [0.3, 1.2, 0.6]]) {
    const m = cyl(r, r, 0.08, 0x7a5a3e, x, 0.05, z, 9);
    m.scale.z = 0.8;
    g.add(m);
  }
  return withLabel(g, CONFIG.hazards.mud.label, 1.8, { bg: '#d9c7b4' });
}
function fogFork() {
  const g = new THREE.Group();
  g.add(post(3.2, 0x8a6a4f, 0));
  const arrows = new THREE.Group();
  const a = textPanel('←', { w: 1.4, h: 0.7, bg: '#e8e4dc', px: 150 });
  const b = textPanel('→', { w: 1.4, h: 0.7, bg: '#e8e4dc', px: 150 });
  a.position.set(-0.7, 2.9, -0.1); b.position.set(0.7, 2.3, -0.1);
  a.rotation.y = b.rotation.y = Math.PI;
  arrows.add(a, b);
  g.add(arrows);
  g.userData.spin = (t) => { arrows.scale.x = Math.sin(t * 3) > 0 ? 1 : -1; }; // arrows keep switching
  return withLabel(g, CONFIG.hazards.fogFork.label, 3.9, { bg: '#e8e4dc' });
}
function harshSigns() {
  const words = CONFIG.hazards.harshSigns.words;
  return board(words[Math.floor(Math.random() * words.length)], { w: 3.0, h: 1.4, y: 2.2, bg: '#a7adb3', fg: '#2c2c2c', px: 70 });
}

// ---------- Life-event arch (scripted triggers fill all lanes) and finish ----------
function spanArch(text, bg) {
  const g = new THREE.Group();
  const x = HALF + 0.5;
  g.add(box(0.35, 5.2, 0.35, 0x8d8a86, -x, 2.6, 0), box(0.35, 5.2, 0.35, 0x8d8a86, x, 2.6, 0));
  g.add(box(x * 2 + 0.4, 1.25, 0.16, 0x3b3433, 0, 5.0, 0.04));
  const p = textPanel(text, { w: x * 2, h: 1.1, bg, px: 100 });
  p.position.set(0, 5.0, -0.06); p.rotation.y = Math.PI;
  g.add(p);
  return g;
}
const SPAN_BG = { allNighter: '#c9cdea', redEye: '#c9cdea', trophy: '#ffe9a8', scheduleChaos: '#f6efe0', loss: '#c9d6e2', criticism: '#e9e9e6', stigmaBillboard: '#e4dbe8' };
const SPAN_TEXT = { stigmaBillboard: 'Stigma: “What will people think?”', criticism: '“Just try harder”', loss: 'A loss' };

function finish() {
  const g = spanArch('Graduation day', '#ffe9a8');
  const cap = new THREE.Group();
  cap.add(box(1.6, 0.12, 1.6, 0x3b3433, 0, 0.5, 0), box(0.9, 0.5, 0.9, 0x3b3433, 0, 0.2, 0), box(0.06, 0.6, 0.06, 0xf1b43a, 0.7, 0.2, 0.7));
  cap.position.y = 6.0;
  g.add(cap);
  // checkered strip on the road
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) {
    const t = box((HALF * 2) / 12, 0.03, 0.6, (i + j) % 2 ? 0x3b3433 : 0xfffaf0, -HALF + (i + 0.5) * ((HALF * 2) / 12), 0.03, j * 0.6);
    g.add(t);
  }
  g.userData.spin = (t) => { cap.rotation.y = t; };
  return g;
}

// ---------- Coins (score only) and the open-lane sign at the stigma billboards ----------
const COIN_RIM = new THREE.TorusGeometry(0.42, 0.05, 6, 20);
const COIN_SPARK = new THREE.OctahedronGeometry(0.16);
const COIN_SPARK_MAT = new THREE.MeshBasicMaterial({ color: 0xffffff });
/** Gold coin that spins and sparkles. setDull(true): grey, still, no sparkle (loss of interest or pleasure). */
function coin() {
  const g = new THREE.Group();
  const disc = cyl(0.42, 0.42, 0.12, 0xf1b43a, 0, 1.0, 0, 24);
  disc.rotation.x = Math.PI / 2;
  const rim = new THREE.Mesh(COIN_RIM, toon(0xf7cb5c));
  rim.position.y = 1.0;
  const spark = new THREE.Mesh(COIN_SPARK, COIN_SPARK_MAT); // small 8-sided twinkle
  spark.position.set(0.32, 1.35, -0.12);
  const spinner = new THREE.Group();
  spinner.add(disc, rim, spark);
  g.add(spinner, blobShadow(0.9));
  let dull = false;
  g.userData.setDull = (on) => {
    if (on === dull) return;
    dull = on;
    disc.material = toon(on ? 0x9a9a96 : 0xf1b43a);
    rim.material = toon(on ? 0xb0b0ab : 0xf7cb5c);
    spark.visible = !on;
  };
  g.userData.spin = (t) => {
    if (dull) return;
    spinner.rotation.y = t * 3;
    spark.scale.setScalar(0.6 + Math.abs(Math.sin(t * 5)) * 0.6);
  };
  return g;
}
function notAlone() {
  const g = board(CONFIG.stigmaOpenLaneText, { w: 2.2, h: 1.0, y: 1.6, bg: '#cfe7c4', px: 84 });
  g.add(blobShadow(2.4, 0.8));
  return withLabel(g, 'Support', 2.8, { bg: '#cfe7c4' });
}

const BUILDERS = {
  coin, notAlone,
  allNighter, redEye: plane, trophy, scheduleChaos, loss, criticism, stigmaBillboard, supportive,
  medCheckpoint, routineCheckpoint, restStop, therapyPit, familyPit,
  cliffRamp, spendDetour, billboardPull, racingSigns, mud, fogFork, harshSigns, finish,
};

/** Builds the model for an item id. `span` = life event across all lanes (arch + icon in the middle lane). */
export function buildItem(id, { span = false } = {}) {
  if (!span) return BUILDERS[id]();
  const g = spanArch(SPAN_TEXT[id] || CONFIG.triggers[id]?.label || id, SPAN_BG[id] || '#fffaf0');
  const icon = BUILDERS[id]();
  if (icon.userData.label) icon.remove(icon.userData.label); // the arch carries the words
  g.add(icon);
  g.userData.spin = icon.userData.spin;
  g.userData.approach = icon.userData.approach;
  return g;
}
