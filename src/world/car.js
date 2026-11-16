// car.js: the kart with its driver. The body is one seamless baked mesh (see tools/sdf/kart.js);
// this file adds what must stay separate: four wheels that spin, the see-through windshield,
// the star on the number plate, the driver and the soft shadow.
import * as THREE from 'three';
import { WORLD as W, CAR } from './palette.js';
import { SEAT, WHEEL, SCREEN as SC, PLATE } from './dims.js';
import { bakedModel } from './generated.js';
import { buildDriver } from './driver.js';
import { toon, star, blobShadow, glow } from './models.js';

const LEAN = { car: 0.09, driver: 0.05 };       // radians at full lean
const BOUNCE = { height: 0.035, perMetre: 1.1 }; // gentle bounce while driving
const OUTLINE = 0.022;                           // thickness of the soft outline
const HEADLIGHTS = { x: 0.58, y: 0.76, z: 1.78, size: 0.55, opacity: 0.28 }; // small: only the light's core glows

let glassGeo;
function windshield() {
  if (!glassGeo) {
    glassGeo = new THREE.BufferGeometry();
    glassGeo.setAttribute('position', new THREE.Float32BufferAttribute([
      -SC.baseX, SC.baseY, SC.baseZ, SC.baseX, SC.baseY, SC.baseZ, SC.topX, SC.topY, SC.topZ, -SC.topX, SC.topY, SC.topZ], 3));
    glassGeo.setIndex([0, 1, 2, 0, 2, 3]);
    glassGeo.computeVertexNormals();
  }
  return new THREE.Mesh(glassGeo, toon(CAR.glass, { transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false }));
}

/** Builds the kart with its driver. Returns { group, setLean(lean), spin(distance), update(dt), setMood(phase) }. */
export function buildKart(driverName) {
  const accent = driverName === 'boy' ? W.kartAccentBoy : W.kartAccentGirl;
  const group = new THREE.Group();
  const tilt = new THREE.Group(); // body roll + bounce
  group.add(tilt);

  tilt.add(bakedModel('kart', { accent, outline: OUTLINE }), windshield());
  const plateStar = new THREE.Mesh(star(), toon(accent));
  plateStar.position.set(0, PLATE.y, PLATE.z);
  plateStar.rotation.y = Math.PI;
  plateStar.scale.setScalar(0.8);
  tilt.add(plateStar);

  // Wheels: the baked wheel is the outer half; the left-hand ones are turned round.
  const wheels = [];
  for (const z of WHEEL.z) for (const side of [-1, 1]) {
    const holder = new THREE.Group();
    holder.position.set(side * WHEEL.x, WHEEL.r, z);
    if (side < 0) holder.rotation.y = Math.PI;
    const w = bakedModel('wheel', { outline: OUTLINE });
    w.userData.dir = side;
    holder.add(w);
    tilt.add(holder);
    wheels.push(w);
  }

  const driver = buildDriver(driverName, OUTLINE);
  driver.body.position.set(...SEAT);
  driver.setMood('stable');
  tilt.add(driver.body);
  // Soft glow on the headlights (real lights only) and the contact shadow.
  for (const side of [-1, 1]) { const g = glow(CAR.lamp, HEADLIGHTS.size, HEADLIGHTS.opacity); g.position.set(side * HEADLIGHTS.x, HEADLIGHTS.y, HEADLIGHTS.z); tilt.add(g); }
  group.add(blobShadow(3.0, 4.7), blobShadow(2.2, 3.6));

  let rolled = 0;
  return {
    group,
    /** lean: -1..1, tips the kart and the driver into the turn (each is rotated as a whole). */
    setLean(lean) {
      tilt.rotation.z = -lean * LEAN.car;
      driver.body.rotation.z = -lean * LEAN.driver;
    },
    /** Wheels roll with distance; the body bounces gently while driving. */
    spin(dist) {
      for (const w of wheels) w.rotation.x += (w.userData.dir * dist) / WHEEL.r;
      rolled += dist;
      tilt.position.y = Math.abs(Math.sin(rolled * BOUNCE.perMetre)) * BOUNCE.height;
    },
    /** Blinking. */
    update(dt) { driver.update(dt); },
    /** The driver's mouth follows the mood phase: 'stable' | 'manic' | 'depressive'. */
    setMood(phase) { driver.setMood(phase); },
    driver,
  };
}
