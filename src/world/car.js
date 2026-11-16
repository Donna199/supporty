// car.js: the player's car, a small open-top convertible built in code.
// The body is ONE sculpted shell (a row of rounded cross-sections from tail to nose, with the
// cockpit sunk into it), so the hood, doors and trunk flow into each other like a real car.
// On top of that: wheels set into arches, grille, headlights, bumpers, windshield, mirrors,
// door seams and handles, dashboard, seat, folded soft-top, tail lights and number plates.
// The car faces +Z. Sizes are in metres; every tunable shape number is in the SHAPE table below.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon, vertexToon, mesh, ball, cyl, star, blobShadow, buildDriver } from './models.js';

const C = CONFIG.colors;
const PI = Math.PI;

const SHAPE = {
  tail: -1.78, nose: 1.86,          // length of the body
  halfWidth: 0.88, belt: 1.12,      // widest half-width; height of the door tops
  floor: 0.74,                      // cockpit floor
  cockpit: [-1.0, 0.6],             // cockpit opening, back to front
  bottom: 0.34,
  wheelR: 0.44, wheelX: 0.8, wheelZ: [1.12, -1.08],
  glass: 0xcfeaf5, chrome: 0xdfe3e6, lamp: 0xfff3c4, tailLamp: 0xe0524f, amber: 0xf2a65a, cabin: 0x4f8f8a,
};
const S = SHAPE;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const bump = (z, at, width) => Math.exp(-(((z - at) / width) ** 2));

// ---------- Body outline: how tall and wide the body is at each point along its length ----------
/** Top of the body at z: hood slopes down to the nose, level at the doors, a slightly lower trunk. */
function topAt(z) {
  const hood = clamp01((z - 0.78) / (S.nose - 0.78));
  const trunk = clamp01((-1.15 - z) / (-1.15 - S.tail));
  return S.belt - 0.07 * smooth((z - 0.55) / 0.23) - 0.2 * hood ** 1.7 - 0.04 * smooth((-0.95 - z) / 0.2) - 0.09 * trunk ** 1.5;
}
/** Half-width at z: narrower at the nose and tail, a little wider over each wheel (fenders). */
function widthAt(z) {
  const front = clamp01((z - 0.6) / (S.nose - 0.6)), rear = clamp01((-0.9 - z) / (-0.9 - S.tail));
  return S.halfWidth - 0.1 * front ** 2 - 0.07 * rear ** 2 + 0.04 * bump(z, S.wheelZ[0], 0.42) + 0.04 * bump(z, S.wheelZ[1], 0.42);
}
/** 1 in the middle of the car, shrinking to a rounded end at the nose and tail. */
function endScale(z) {
  const mid = (S.nose + S.tail) / 2, half = (S.nose - S.tail) / 2, round = 0.3;
  const q = clamp01((Math.abs(z - mid) - (half - round)) / round);
  return Math.max(0.14, (1 - q ** 3) ** (1 / 3));
}

/** The sculpted body shell, with the cockpit sunk in and painted dark inside. */
function bodyGeometry() {
  const NZ = 38, NT = 48;
  const pos = [], col = [], idx = [];
  const paint = new THREE.Color(C.kart), inside = new THREE.Color(S.cabin), c = new THREE.Color();
  for (let i = 0; i <= NZ; i++) {
    const z = S.tail + (S.nose - S.tail) * (0.5 - 0.5 * Math.cos((i / NZ) * PI)); // more rings near the ends
    const top = topAt(z), w = widthAt(z), r = endScale(z);
    const cy = (top + S.bottom) / 2, hy = (top - S.bottom) / 2;
    const open = smooth((z - S.cockpit[0]) / 0.12) * smooth((S.cockpit[1] - z) / 0.14); // 1 inside the cockpit
    for (let j = 0; j < NT; j++) {
      const a = (j / NT) * PI * 2, cs = Math.cos(a), sn = Math.sin(a);
      let x = w * Math.sign(cs) * Math.abs(cs) ** 0.45; // rounded-box cross-section
      let y = cy + hy * Math.sign(sn) * Math.abs(sn) ** 0.45;
      if (sn > 0) x *= 1 - 0.07 * sn; else x *= 1 - 0.1 * sn * sn; // sides lean in a little toward the top and the sills
      x *= r; y = cy + (y - cy) * r;
      // Cockpit: the middle of the top drops down to the floor, leaving the door tops standing.
      let sunk = 0;
      if (sn > 0) {
        sunk = open * smooth((w * 0.8 - Math.abs(x)) / 0.07);
        y += (S.floor - y) * sunk;
      }
      pos.push(x, y, z);
      c.copy(paint).lerp(inside, smooth(sunk * 1.6 - 0.3));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NT; j++) {
    const a = i * NT + j, b = (i + 1) * NT + j, a2 = i * NT + ((j + 1) % NT), b2 = (i + 1) * NT + ((j + 1) % NT);
    idx.push(a, a2, b, a2, b2, b);
  }
  // Close the two ends with a small flat cap (hidden behind the bumpers).
  for (const [ring, z, flip] of [[0, S.tail, true], [NZ, S.nose, false]]) {
    const centre = pos.length / 3;
    pos.push(0, (topAt(z) + S.bottom) / 2, z);
    col.push(paint.r, paint.g, paint.b);
    for (let j = 0; j < NT; j++) {
      const a = ring * NT + j, b = ring * NT + ((j + 1) % NT);
      if (flip) idx.push(centre, b, a); else idx.push(centre, a, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Part helpers, kept light: the car has many small parts, so each uses only as many triangles as can be seen.
/** Rounded panel (seat, dashboard, lamps). */
const kb = (w, h, d, color, x, y, z, r) => mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(r ?? 0.03, Math.min(w, h, d) / 2 - 0.001)), color, x, y, z);
/** Plain thin part (seams, stripes, spokes, bars): rounding would never show. */
const flat = (w, h, d, color, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z);
const capsule = (r, len, color, x, y, z, seg = 8) => mesh(new THREE.CapsuleGeometry(r, len, 3, seg), color, x, y, z);
const torusGeo = (r, tube, radial, tubular) => new THREE.TorusGeometry(r, tube, radial, tubular);

let bodyGeo;
const tilted = (m, rx = 0, ry = 0, rz = 0) => { m.rotation.set(rx, ry, rz); return m; };
const crossBar = (r, len, color, x, y, z) => tilted(capsule(r, len, color, x, y, z, 10), 0, 0, PI / 2); // a rounded bar across the car

// ---------- One wheel: tyre, rim, five spokes, hub cap ----------
function buildWheel(side) {
  const w = new THREE.Group();
  w.add(tilted(mesh(torusGeo(0.3, 0.14, 8, 18), C.tyre), 0, PI / 2, 0));
  w.add(tilted(cyl(0.31, 0.31, 0.26, C.tyre, 0, 0, 0, 16), 0, 0, PI / 2));
  w.add(tilted(cyl(0.25, 0.25, 0.3, 0x55504e, 0, 0, 0, 16), 0, 0, PI / 2));       // dark dish behind the spokes
  const face = side * 0.15;
  w.add(tilted(mesh(torusGeo(0.235, 0.03, 5, 16), S.chrome, face, 0, 0), 0, PI / 2, 0));  // rim edge
  for (let i = 0; i < 5; i++) {
    const spoke = flat(0.035, 0.22, 0.07, S.chrome, face, 0, 0, 0.015);
    const a = (i / 5) * PI * 2;
    spoke.position.set(face, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
    spoke.rotation.x = a;
    w.add(spoke);
  }
  w.add(tilted(cyl(0.075, 0.075, 0.05, C.kartTrim, face + side * 0.01, 0, 0, 16), 0, 0, PI / 2)); // hub cap
  return w;
}

/** Builds the car with its driver. Returns { group, setLean(lean), spin(distance) }. */
export function buildKart(driverName) {
  const accent = driverName === 'boy' ? C.kartAccentBoy : C.kartAccentGirl;
  const group = new THREE.Group();
  const tilt = new THREE.Group(); // body roll + bounce
  group.add(tilt);
  const add = (...parts) => tilt.add(...parts);

  // ----- Body shell -----
  bodyGeo ??= bodyGeometry();
  add(new THREE.Mesh(bodyGeo, vertexToon()));

  // ----- Wheel arches: a dark wheel well and a body-colour flare over each wheel -----
  const wheels = [];
  const wellGeo = new THREE.CircleGeometry(0.535, 24, 0, PI);
  for (const z of S.wheelZ) for (const side of [-1, 1]) {
    const x = side * (widthAt(z) + 0.004);
    const well = new THREE.Mesh(wellGeo, toon(0x2f2b2a, { side: THREE.DoubleSide }));
    well.position.set(x, S.wheelR, z);
    well.rotation.y = side * PI / 2;
    add(well);
    const flare = mesh(new THREE.TorusGeometry(0.55, 0.055, 6, 14, PI), C.kart, x - side * 0.01, S.wheelR, z);
    flare.rotation.y = PI / 2;
    add(flare);
    const wheel = buildWheel(side);
    wheel.position.set(side * S.wheelX, S.wheelR, z);
    group.add(wheel); // wheels stay on the road while the body rolls
    wheels.push(wheel);
  }

  // ----- Sides: sills, door seams, handles, accent stripe, mirrors -----
  for (const side of [-1, 1]) {
    const x = side * S.halfWidth;
    add(flat(0.07, 0.1, 1.28, 0x55504e, x - side * 0.03, 0.37, 0.02, 0.03));                 // sill between the wheels
    for (const z of [0.5, -0.52]) add(flat(0.02, 0.6, 0.022, C.kartDark, x - side * 0.004, 0.74, z, 0.008)); // door seams
    add(flat(0.02, 0.022, 1.02, C.kartDark, x - side * 0.006, 0.45, -0.01, 0.008));          // door bottom seam
    add(tilted(capsule(0.022, 0.12, S.chrome, x + side * 0.006, 0.96, -0.3, 6), PI / 2)); // door handle
    add(flat(0.024, 0.055, 2.5, accent, x - side * 0.012, 1.03, 0.05, 0.01));                // accent stripe under the belt line
    // Wing mirror on a short stalk by the windshield.
    add(flat(0.14, 0.03, 0.04, C.kart, side * 0.9, 1.16, 0.62, 0.012));
    add(kb(0.1, 0.13, 0.17, C.kart, side * 0.99, 1.2, 0.62, 0.04));
    add(flat(0.02, 0.1, 0.13, S.glass, side * 0.985, 1.2, 0.535, 0.008));
  }

  // ----- Front: grille, headlights with chrome rims, indicators, bumper, number plate -----
  const zN = S.nose;
  add(kb(0.62, 0.17, 0.08, 0x3a3534, 0, 0.62, zN - 0.035, 0.05));
  for (const y of [0.585, 0.62, 0.655]) add(flat(0.56, 0.014, 0.02, S.chrome, 0, y, zN + 0.008, 0.006));
  for (const side of [-1, 1]) {
    // Each headlight sits in a rounded pod on the front of the fender, like a classic roadster.
    const pod = ball(0.2, C.kart, side * 0.5, 0.73, zN - 0.26, 12);
    pod.scale.z = 1.25;
    add(pod);
    const lamp = ball(0.15, S.lamp, side * 0.5, 0.73, zN - 0.08, 12);
    lamp.scale.z = 0.5;
    add(lamp);
    add(mesh(torusGeo(0.155, 0.03, 5, 14), S.chrome, side * 0.5, 0.73, zN - 0.07));
    const blink = ball(0.06, S.amber, side * 0.58, 0.5, zN - 0.1, 12);
    blink.scale.z = 0.6;
    add(blink);
    add(tilted(capsule(0.035, 0.1, C.kartTrim, side * 0.3, 0.46, zN + 0.05, 10)));     // bumper over-rider
  }
  add(crossBar(0.085, 1.22, C.kartTrim, 0, 0.42, zN - 0.03));
  add(flat(0.4, 0.13, 0.03, 0xfffaf0, 0, 0.43, zN + 0.06, 0.02));
  // Hood: a raised centre line and the seam where it meets the body.
  const ridge = flat(0.05, 0.02, 0.92, C.kartDark, 0, 0, 0, 0.008);
  ridge.position.set(0, (topAt(1.3) + topAt(0.9)) / 2 + 0.012, 1.24);
  ridge.rotation.x = Math.atan2(topAt(0.85) - topAt(1.65), 0.8);
  add(ridge);

  // ----- Windshield: chrome frame, glass, rear-view mirror -----
  const baseY = topAt(0.66) - 0.02, topY = baseY + 0.62, rake = 0.2; // the top sits `rake` further back
  for (const side of [-1, 1]) {
    const pillar = capsule(0.035, Math.hypot(0.62, rake), S.chrome, side * 0.74, (baseY + topY) / 2, 0.66 - rake / 2, 10);
    pillar.rotation.x = -Math.atan2(rake, 0.62);
    pillar.rotation.z = side * 0.07;
    pillar.position.x = side * 0.72;
    add(pillar);
  }
  add(crossBar(0.035, 1.36, S.chrome, 0, topY, 0.66 - rake));
  add(crossBar(0.03, 1.44, S.chrome, 0, baseY, 0.66));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, Math.hypot(0.62, rake)),
    new THREE.MeshToonMaterial({ color: S.glass, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.set(0, (baseY + topY) / 2, 0.66 - rake / 2);
  glass.rotation.x = -Math.atan2(rake, 0.62);
  add(glass);
  add(flat(0.2, 0.07, 0.03, 0x3a3534, 0, topY - 0.1, 0.66 - rake - 0.04, 0.02));

  // ----- Cockpit: dashboard with gauges, steering wheel, seat with headrest -----
  add(kb(1.34, 0.2, 0.22, C.kartDark, 0, 1.0, 0.5, 0.08));
  for (const x of [-0.36, 0.36]) add(tilted(cyl(0.085, 0.085, 0.02, 0xfffaf0, x, 1.05, 0.385, 16), PI / 2 - 0.35));
  const wheelPos = new THREE.Vector3(0, 1.3, 0.42), wheelTilt = -0.6;
  add(tilted(cyl(0.045, 0.045, 0.36, C.tyre, 0, 1.17, 0.5, 12), -0.8));
  const steer = new THREE.Group();
  steer.add(mesh(torusGeo(0.26, 0.055, 6, 20), C.tyre));
  for (const a of [PI / 2, PI * 7 / 6, PI * 11 / 6]) {
    const spoke = flat(0.24, 0.05, 0.035, C.tyre, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0, 0.015);
    spoke.rotation.z = a;
    steer.add(spoke);
  }
  steer.add(tilted(cyl(0.07, 0.07, 0.05, S.chrome, 0, 0, 0, 16), PI / 2));
  steer.position.copy(wheelPos);
  steer.rotation.x = wheelTilt;
  add(steer);
  add(kb(1.36, 0.26, 0.82, C.kartTrim, 0, 0.9, -0.42, 0.1));                        // seat cushion
  add(tilted(kb(1.3, 0.66, 0.2, C.kartTrim, 0, 1.3, -0.9, 0.09), -0.12));           // seat back
  for (const x of [-0.12, 0.12]) add(cyl(0.02, 0.02, 0.14, S.chrome, x, 1.66, -0.95, 8));
  add(kb(0.44, 0.2, 0.15, C.kartTrim, 0, 1.78, -0.96, 0.07));                       // headrest

  // ----- Rear: folded soft-top, trunk seam, tail lights, bumper, number plate, exhaust -----
  const zT = S.tail;
  add(crossBar(0.115, 1.2, 0x3a3534, 0, topAt(-1.14) + 0.07, -1.14));               // folded soft-top
  add(flat(1.1, 0.016, 0.02, C.kartDark, 0, topAt(-1.36) + 0.004, -1.36, 0.006));     // trunk lid seam
  add(kb(1.16, 0.045, 0.14, accent, 0, topAt(-1.64) + 0.03, -1.62, 0.02));          // small tail lip in the driver's colour
  for (const side of [-1, 1]) {
    // Tail light: a chrome surround, a red lens and a small amber indicator beside it.
    add(kb(0.36, 0.2, 0.2, S.chrome, side * 0.44, 0.78, zT + 0.07, 0.07));
    add(kb(0.2, 0.14, 0.2, S.tailLamp, side * 0.47, 0.78, zT + 0.045, 0.06));
    add(kb(0.09, 0.14, 0.2, S.amber, side * 0.325, 0.78, zT + 0.045, 0.04));
    add(tilted(capsule(0.035, 0.1, C.kartTrim, side * 0.3, 0.46, zT - 0.06, 10)));     // bumper over-rider
  }
  add(tilted(cyl(0.06, 0.06, 0.02, S.chrome, -(widthAt(-1.45) - 0.012), 0.86, -1.52, 16), 0, 0, PI / 2)); // fuel cap
  add(cyl(0.012, 0.012, 0.5, S.chrome, 0.62, topAt(1.0) + 0.24, 1.0, 6));                   // radio aerial
  add(ball(0.025, S.chrome, 0.62, topAt(1.0) + 0.5, 1.0, 8));
  add(crossBar(0.085, 1.16, C.kartTrim, 0, 0.42, zT + 0.02));
  add(flat(0.42, 0.2, 0.03, 0xfffaf0, 0, 0.62, zT + 0.005, 0.03));
  const st = new THREE.Mesh(star(), toon(accent, { side: THREE.DoubleSide }));
  st.scale.setScalar(0.62);
  st.position.set(0, 0.62, zT - 0.014);
  add(st);
  add(tilted(cyl(0.05, 0.06, 0.26, 0xb9bec4, 0.5, 0.33, zT + 0.1, 12), PI / 2));
  add(tilted(cyl(0.032, 0.032, 0.02, C.tyre, 0.5, 0.33, zT - 0.03, 10), PI / 2));

  // ----- Driver in the seat, hands on the wheel at 10 and 2 o'clock -----
  const driver = buildDriver(driverName);
  const bodyPos = new THREE.Vector3(0, 1.05, -0.35);
  driver.body.position.copy(bodyPos);
  const grip = (s) => new THREE.Vector3(s * 0.225, 0.13, 0).applyEuler(new THREE.Euler(wheelTilt, 0, 0)).add(wheelPos).sub(bodyPos);
  driver.reach([grip(-1), grip(1)]);
  add(driver.body);

  group.add(blobShadow(3.0, 4.7));

  let bounce = 0;
  return {
    group,
    /** lean: -1..1, tips the car body, driver body and head into the turn. */
    setLean(lean) {
      tilt.rotation.z = -lean * 0.09;
      driver.body.rotation.z = -lean * 0.06;
      driver.head.rotation.z = -lean * 0.12;
      driver.head.rotation.y = lean * 0.18;
    },
    /** Wheels roll with distance; the body bounces gently while driving. */
    spin(dist) {
      for (const w of wheels) w.rotation.x += dist / S.wheelR;
      bounce += dist;
      tilt.position.y = Math.abs(Math.sin(bounce * 1.1)) * 0.035;
      if (driver.bow) driver.bow.rotation.x = Math.sin(bounce * 2.2) * 0.035; // ~2° bow wobble, in step with the bounce
    },
  };
}
