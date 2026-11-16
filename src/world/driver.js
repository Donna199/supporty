// driver.js: a driver = the baked seamless body mesh (see tools/sdf/drivers.js) plus a small face
// added in code: big round eyes that blink (an eyelid that scales down), blush, brows and three
// swappable mouths (calm, excited, flat) chosen by the mood phase.
import * as THREE from 'three';
import { WORLD as W, CHARACTER as CH } from './palette.js';
import { HEAD, FACE as F } from './dims.js';
import { GEO } from './generated.js';
import { toon, vertexToon } from './models.js';

const PI = Math.PI, FRONT = HEAD.half[2];
const BLINK = { everySec: [2.4, 5], closeSec: 0.07, openSec: 0.11 };
const MOUTH = { stable: 'calm', manic: 'excited', depressive: 'flat' };

const geo = {};
const part = (key, make, color, x, y, z) => {
  const m = new THREE.Mesh((geo[key] ??= make()), toon(color));
  m.userData.noOutline = true; // the small face parts stay clean: no outline around eyes, blush or mouth
  m.position.set(x, y, z);
  return m;
};
const ballGeo = (r, seg = 20) => () => new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6));

function buildMouths() {
  const c = W.pupil, y = F.mouthY, z = FRONT + 0.012;
  const calm = part('smile', () => new THREE.TorusGeometry(0.06, 0.017, 8, 14, PI), c, 0, y + 0.03, z);
  calm.rotation.z = PI; // the lower half of a ring: a small smile
  const excited = part('open', () => new THREE.SphereGeometry(0.075, 14, 6, 0, PI * 2, PI / 2, PI / 2), c, 0, y + 0.035, z - 0.01);
  excited.scale.z = 0.35; // a small open mouth
  const flat = part('flat', () => new THREE.CapsuleGeometry(0.017, 0.1, 3, 8), c, 0, y, z);
  flat.rotation.z = PI / 2;
  return { calm, excited, flat };
}

/** Returns { body, setMood(phase), update(dt) }. `body` is placed at the kart's seat. */
export function buildDriver(name) {
  const body = new THREE.Group();
  body.add(new THREE.Mesh(GEO[name], vertexToon()));
  const face = new THREE.Group();
  face.position.y = HEAD.y;
  body.add(face);
  const boy = name === 'boy', brow = boy ? CH.boyHair : CH.girlHair;
  const lids = [], pupils = [];
  for (const s of [-1, 1]) {
    const white = part('eye', ballGeo(F.eyeR), W.eyeWhite, s * F.eyeX, F.eyeY, FRONT - 0.03);
    white.scale.z = 0.4;
    const pupil = new THREE.Group();
    pupil.position.set(s * (F.eyeX - 0.03), F.eyeY + 0.015, FRONT + 0.035);
    const dot = part('pupil', ballGeo(0.088, 16), W.pupil, 0, 0, 0);
    dot.scale.z = 0.45;
    pupil.add(dot, part('sparkle', ballGeo(0.028, 8), CH.white, 0.03, 0.036, 0.032));
    // Eyelid: a skin-coloured cover hinged at the top of the eye; scaling it down closes the eye.
    const lid = new THREE.Group();
    lid.position.set(s * F.eyeX, F.eyeY + F.eyeR + 0.01, FRONT - 0.03);
    const cover = part('lid', ballGeo(F.eyeR + 0.012), W.skin, 0, -F.eyeR - 0.01, 0);
    cover.scale.z = 0.5;
    const lash = part('lash', () => new THREE.TorusGeometry(0.1, 0.015, 6, 12, PI * 0.7), W.pupil, 0, -F.eyeR * 1.25, 0.09);
    lash.rotation.z = PI + PI * 0.15;
    lid.add(cover, lash);
    lid.visible = false;
    const blush = part('blush', ballGeo(F.blushR, 14), boy ? CH.boyBlush : W.blush, s * F.blushX, F.blushY, FRONT - 0.003);
    blush.scale.z = 0.08;
    // Brows as in the sketch: Brandon's are short dark dashes, Shally's are longer and gently arched.
    const b = boy ? part('browBoy', () => new THREE.CapsuleGeometry(0.034, 0.09, 3, 10), brow, s * F.eyeX, F.browY, FRONT + 0.005)
      : part('browGirl', () => new THREE.CapsuleGeometry(0.026, 0.15, 3, 10), brow, s * F.eyeX, F.browY - 0.01, FRONT + 0.005);
    b.rotation.z = PI / 2 + s * (boy ? 0.05 : 0.2);
    face.add(white, pupil, lid, blush, b);
    lids.push(lid); pupils.push(pupil);
  }
  const mouths = buildMouths();
  face.add(...Object.values(mouths));

  let wait = 1.5, t = -1; // t: seconds into the current blink, or -1 between blinks
  const setLids = (closed) => {
    for (const lid of lids) { lid.visible = closed > 0.02; lid.scale.y = Math.max(0.02, closed); }
    for (const p of pupils) p.scale.y = Math.max(0.05, 1 - closed);
  };
  return {
    body,
    setMood(phase) { for (const [key, m] of Object.entries(mouths)) m.visible = key === (MOUTH[phase] ?? 'calm'); },
    update(dt) {
      if (t < 0) { wait -= dt; if (wait <= 0) t = 0; return; }
      t += dt;
      const closed = t < BLINK.closeSec ? t / BLINK.closeSec : 1 - (t - BLINK.closeSec) / BLINK.openSec;
      setLids(Math.max(0, closed));
      if (closed <= 0) { t = -1; wait = BLINK.everySec[0] + Math.random() * (BLINK.everySec[1] - BLINK.everySec[0]); }
    },
    /** For review renders: hold the eyes closed by this much (0..1). */
    setLids,
  };
}
