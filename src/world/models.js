// models.js: builds every model in code from simple shapes with soft toon shading
// and blob shadows. Shapes are rounded (rounded boxes, capsules, smooth spheres and
// tori) for a soft toy / vinyl-figure look. Drivers follow the concept sketches;
// anything unsketched is listed in MODELS.md. Identical shapes share one geometry.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';

const C = CONFIG.colors;
const PI = Math.PI;

// ---------- Materials (smooth toon shading, shared by colour) ----------
let ramp;
function toonRamp() {
  if (!ramp) {
    // Three soft light steps: shadow, mid, lit.
    ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
  }
  return ramp;
}
const matCache = new Map();
export function toon(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: toonRamp(), ...extra }));
  }
  return matCache.get(key);
}
export const vertexToon = () => toon(0xffffff, { vertexColors: true });

// ---------- Shared geometry cache ----------
// Identical shapes reuse the same GPU buffers. If a caller moves a shared geometry
// (e.g. geometry.translate), it quietly gets its own copy first, so nothing else moves.
const geoCache = new Map();
function shared(key, make) {
  let base = geoCache.get(key);
  if (!base) { base = make(); geoCache.set(key, base); }
  const g = new THREE.BufferGeometry();
  g.setIndex(base.index);
  for (const [name, attr] of Object.entries(base.attributes)) g.setAttribute(name, attr);
  g.applyMatrix4 = function (m) {
    for (const name of Object.keys(this.attributes)) this.setAttribute(name, this.attributes[name].clone());
    delete this.applyMatrix4;
    return this.applyMatrix4(m);
  };
  return g;
}
const n2 = (v) => Math.round(v * 1000) / 1000;

/** Rounded box: corner radius ~20% of the smallest side (or `radius` if given). */
export function roundedBoxGeo(w, h, d, radius, segments = 2) {
  const r = Math.min(radius ?? Math.min(w, h, d) * 0.2, Math.min(w, h, d) / 2 - 0.001);
  return shared(`rb${n2(w)},${n2(h)},${n2(d)},${n2(r)},${segments}`, () => new RoundedBoxGeometry(w, h, d, segments, Math.max(0.001, r)));
}
const sphereGeo = (r, seg) => shared(`sp${n2(r)},${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(8, Math.round(seg * 0.75))));
const cylGeo = (rt, rb, h, seg) => shared(`cy${n2(rt)},${n2(rb)},${n2(h)},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
const coneGeo = (r, h, seg) => shared(`co${n2(r)},${n2(h)},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
const capsuleGeo = (r, len, seg = 16) => shared(`ca${n2(r)},${n2(len)},${seg}`, () => new THREE.CapsuleGeometry(r, len, 4, seg));
export const torusGeo = (r, tube, radial, tubular) => shared(`to${n2(r)},${n2(tube)},${radial},${tubular}`, () => new THREE.TorusGeometry(r, tube, radial, tubular));

// ---------- Shape helpers ----------
export function mesh(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  return m;
}
/** Rounded box (used for props and scenery). Hero models use `softBox` with more segments. */
export const box = (w, h, d, color, x, y, z) => mesh(roundedBoxGeo(w, h, d, undefined, 2), color, x, y, z);
// Tiny details (thinner than 0.1) don't show extra smoothness, so they use fewer segments.
const softBox = (w, h, d, color, x, y, z, radius) => mesh(roundedBoxGeo(w, h, d, radius, Math.min(w, h, d) < 0.1 ? 2 : 4), color, x, y, z);
export const ball = (r, color, x, y, z, seg = 16) => mesh(sphereGeo(r, Math.max(12, seg)), color, x, y, z);
export const cyl = (rt, rb, h, color, x, y, z, seg = 16) => mesh(cylGeo(rt, rb, h, Math.max(16, seg)), color, x, y, z);
export const cone = (r, h, color, x, y, z, seg = 16) => mesh(coneGeo(r, h, Math.max(12, seg)), color, x, y, z);
export const capsule = (r, len, color, x, y, z, seg) => mesh(capsuleGeo(r, len, seg), color, x, y, z);

/** Gives a geometry one flat vertex colour, so many parts can be merged into one mesh. */
export function paint(geo, color) {
  const c = new THREE.Color(color);
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.deleteAttribute('uv');
  return g;
}
/** Rounded box geometry already moved into place and painted, for merging. */
export function pbox(w, h, d, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = paint(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.2), color);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
}
/** Painted, placed copy of any geometry, for merging. */
function placed(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = paint(geo, color);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
}
export const merge = (parts) => mergeGeometries(parts, false);

/** Capsule that narrows toward its bottom end, hanging down from y = 0 (hair strands). */
function strandGeo(r, len, taper) {
  return shared(`st${n2(r)},${n2(len)},${taper}`, () => {
    const g = new THREE.CapsuleGeometry(r, len, 4, 16, 3);
    const p = g.attributes.position;
    const top = len / 2 + r, total = len + 2 * r;
    for (let i = 0; i < p.count; i++) {
      const k = 1 - (1 - taper) * ((top - p.getY(i)) / total);
      p.setX(i, p.getX(i) * k);
      p.setZ(i, p.getZ(i) * k);
      p.setY(i, p.getY(i) - top);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ---------- Soft blob shadow ----------
let blobTex;
function blobTexture() {
  if (!blobTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 32);
    grd.addColorStop(0, 'rgba(40,40,50,0.55)');
    grd.addColorStop(0.6, 'rgba(40,40,50,0.25)');
    grd.addColorStop(1, 'rgba(40,40,50,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    blobTex = new THREE.CanvasTexture(cv);
  }
  return blobTex;
}
let blobMat;
export function blobMaterial() {
  blobMat ??= new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  return blobMat;
}
/** A flat soft shadow disc that sits on the ground under an object. */
export function blobShadow(w, d = w) {
  const m = new THREE.Mesh(shared(`pl${n2(w)},${n2(d)}`, () => new THREE.PlaneGeometry(w, d)), blobMaterial());
  m.rotation.x = -PI / 2;
  m.position.y = 0.04;
  m.renderOrder = 1;
  return m;
}

// ---------- Drivers (from characters sketch) ----------
// Shared face: soft-cube head, big round eyes with dark pupils, pink blush, small ears.
function buildHead(browColor, ear) {
  const head = new THREE.Group();
  const skull = softBox(1.0, 0.95, 0.9, C.skin, 0, 0, 0, 0.25);
  skull.userData.skin = true; // used by tests/hairCoverage.js
  head.add(skull);
  for (const s of [-1, 1]) {
    const eye = ball(0.17, C.eyeWhite, s * 0.22, -0.02, 0.44, 20);
    eye.scale.z = 0.45;
    head.add(eye);
    head.add(ball(0.085, C.pupil, s * 0.2, 0.0, 0.5, 16));
    head.add(ball(0.025, 0xffffff, s * 0.2 + 0.03, 0.04, 0.57, 12)); // sparkle in the eye
    const blush = cyl(0.11, 0.11, 0.02, C.blush, s * 0.33, -0.2, 0.455, 24);
    blush.rotation.x = PI / 2;
    head.add(blush);
    const brow = capsule(0.028, 0.15, browColor, s * 0.22, 0.22, 0.455, 10);
    brow.rotation.z = PI / 2;
    head.add(brow);
    // Small ear peeking out in front of the side hair.
    head.add(softBox(0.09, 0.24, 0.17, C.skin, s * ear.x, ear.y, ear.z, 0.04));
    head.add(softBox(0.03, 0.12, 0.08, 0xd9a882, s * (ear.x + 0.045), ear.y, ear.z + 0.02, 0.012));
  }
  return head;
}

// ---------- Hair as one welded mesh ----------
const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** The head's rounded-box shape (1.0 x 0.95 x 0.9, corner radius 0.25), welded into one surface and scaled
 *  to sit just outside the head. Built from an evenly subdivided box so the flat faces have vertices to shape
 *  (three's RoundedBoxGeometry puts all its vertices in the corners). */
function headShellGeo(scale) {
  const [w, h, d, r] = [1.0, 0.95, 0.9, 0.25];
  const g = new THREE.BoxGeometry(w, h, d, 24, 24, 24);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const m = mergeVertices(g, 1e-4);
  const p = m.attributes.position;
  const inner = new THREE.Vector3(w / 2 - r, h / 2 - r, d / 2 - r);
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.copy(v).clamp(inner.clone().negate(), inner);
    v.sub(c).normalize().multiplyScalar(r).add(c); // push onto the rounded surface
    p.setXYZ(i, v.x * scale, v.y * scale, v.z * scale);
  }
  return m;
}
/** Pulls a vertex that was moved onto a cut edge slightly toward the head, so edges tuck in softly. */
function tuck(v, amount) {
  const len = Math.hypot(v.x, v.z) || 1;
  v.x -= (v.x / len) * amount;
  v.z -= (v.z / len) * amount;
}

/** Girl's hair window and fringe: face opening between the temples, below a centre-parted fringe line. */
export const GIRL_HAIR = { templeX: 0.42, earTop: 0.05, fringe: (x) => 0.1 + 0.3 * (1 - Math.min(1, Math.abs(x) / 0.42) ** 1.4) };

/** Girl: ONE mesh. Head shell 1.08x; the face window and ear openings are made by moving vertices onto the
 *  fringe / ear lines (no separate pieces), and the back and sides are pulled down into long hair. */
function girlHairGeo() {
  return shared('girlHair', () => {
    const g = headShellGeo(1.08);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const { templeX: W, earTop, fringe } = GIRL_HAIR;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ax = Math.abs(v.x), sx = Math.sign(v.x) || 1;
      if (v.z > 0.2 && ax < W && v.y < fringe(v.x)) {
        v.y = fringe(v.x); // face window: everything below the fringe line folds up onto it
        tuck(v, 0.035);
      } else if (ax < W && v.z > -0.05 && v.y < -0.3) {
        v.y = -0.3; // under the chin: fold inside the head so no hair lip shows below the jaw
        tuck(v, 0.05);
      } else if (ax >= W && v.z > -0.02 && v.z < 0.3 && v.y < earTop) {
        v.y = earTop; // side hair ends just above the ear, so the ear peeks out below it
        tuck(v, 0.03);
      }
      // Long hair: the back and the sides behind the ears hang down to mid-back, curving out a little.
      const back = clamp01((-v.z - 0.05) / 0.25);
      const side = clamp01((ax - 0.38) / 0.12) * clamp01((-0.02 - v.z) / 0.2);
      const w = Math.max(back, side);
      if (w > 0 && v.y < 0) {
        const t = clamp01(-v.y / 0.513);
        v.y -= w * t * 0.5;
        v.x += sx * side * t * 0.1;
        v.z -= back * t * t * 0.07;
      }
      // Centre part: a soft crease from the fringe peak back over the top of the head.
      if (Math.abs(v.x) < 0.06 && v.z > -0.1 && v.y > fringe(0) - 0.02) {
        const k = 1 - Math.abs(v.x) / 0.06;
        if (v.z > 0.4) v.z -= 0.025 * k; else v.y -= 0.02 * k;
      }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

/** Boy's cap: dome radius at the rim, and the rim height (head-local). */
export const BOY_CAP = { rimY: 0.3, rx: 0.612, rz: 0.6, hairline: 0.255 };

/** Boy: short hair band from the same head shape (1.04x), clamped between a bottom line and the cap rim,
 *  so it never rises above the rim or reaches outside the cap. */
function boyHairGeo() {
  return shared('boyHair', () => {
    const g = headShellGeo(1.04);
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const top = BOY_CAP.rimY - 0.005;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const ax = Math.abs(v.x);
      // Bottom edge: hairline at the forehead, above the ears at the sides, down to the nape at the back.
      const bottom = v.z > 0.2 && ax < 0.42 ? BOY_CAP.hairline : -0.35 + 0.4 * clamp01((v.z + 0.25) / 0.2);
      if (v.y < bottom) { v.y = bottom; tuck(v, 0.025); }
      if (v.y > top) v.y = top;
      // Near the top, flare out to meet the inside of the cap rim so no forehead shows under the cap.
      if (v.y > 0.2) {
        const foot = Math.sqrt((v.x / BOY_CAP.rx) ** 2 + (v.z / BOY_CAP.rz) ** 2) || 1;
        const k = clamp01((v.y - 0.2) / (top - 0.2));
        const sc = 1 + (0.97 / foot - 1) * k;
        v.x *= sc; v.z *= sc;
      }
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ---------- Head size and the girl's bow ----------
/** Heads are drawn bigger than life for a chunky toy look; the lift keeps the chin on the shoulders. */
const HEAD_SCALE = 1.2;
const HEAD_LIFT = 0.475 * (HEAD_SCALE - 1);

/** One bow loop: a puffy teardrop pillow. Inner end (x = 0, at the knot) pinches narrow, outer end stays
 *  round and wide, with a soft fold dent along the middle. Extends along +x. */
function bowLoopGeo() {
  return shared('bowLoop', () => {
    const g = new THREE.SphereGeometry(1, 32, 24);
    g.scale(1.0, 0.7, 0.5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const t = (x + 1) / 2;                                  // 0 = inner end, 1 = outer end
      const f = 0.22 + 0.78 * Math.pow(Math.sin((t * PI) / 2), 0.7); // pinch toward the knot
      y *= f; z *= f;
      z *= 1 - 0.32 * Math.exp(-((y / (0.18 * f + 0.02)) ** 2)) * t; // fabric fold along the middle
      p.setXYZ(i, (x + 1) * 0.5, y, z);
    }
    g.scale(0.38, 0.38, 0.38);
    g.computeVertexNormals();
    return g;
  });
}
/** Ribbon tail: a flat, tapered strip with a rounded tip, hanging down and curving outward. */
function bowTailGeo() {
  return shared('bowTail', () => {
    const g = new THREE.CapsuleGeometry(0.045, 0.1, 6, 16);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i) * 1.35, y = p.getY(i) - 0.08, z = p.getZ(i) * 0.35; // hang from the top; wide, flat ribbon
      const k = 1 - 0.35 * clamp01(-y / 0.2);                       // taper toward the tip
      x = x * k + 2.2 * y * y;                                       // gentle outward curve
      p.setXYZ(i, x, y, z * k);
    }
    g.computeVertexNormals();
    return g;
  });
}
/** Soft, fluffy fabric bow: two puffy loops tilted up and back, a squashed knot, and two short tails. */
function buildBow(color, dark) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const holder = new THREE.Group();
    const loop = mesh(bowLoopGeo(), color, 0.02 * s, 0, 0);
    if (s < 0) loop.rotation.y = PI; // mirror by turning, so the faces stay outward
    holder.add(loop);
    holder.rotation.set(0, s * 0.25, s * 0.22); // ~12° up and a little back
    g.add(holder);
    const tail = mesh(bowTailGeo(), dark, s * 0.03, -0.02, 0.05);
    tail.rotation.set(-0.75, 0, s * 0.75);          // drapes down, forward and outward from under the knot over the hair
    if (s < 0) tail.scale.x = -1;
    g.add(tail);
  }
  const knot = mesh(shared('bowKnot', () => new THREE.SphereGeometry(1, 24, 16)), dark);
  knot.scale.set(0.075, 0.062, 0.068);
  g.add(knot);
  return g;
}

/** Arms that reach from the shoulders to the steering-wheel grips (set by the kart). */
function makeReach(body, { color, hand, r, shoulderX, shoulderY }) {
  return (grips) => grips.forEach((g, i) => {
    const sh = new THREE.Vector3((i ? 1 : -1) * shoulderX, shoulderY, 0.05);
    const dir = g.clone().sub(sh);
    const len = dir.length();
    const a = capsule(r, Math.max(0.05, len - 2 * r - 0.04), color);
    a.position.copy(sh).addScaledVector(dir, 0.47);
    a.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    body.add(a, ball(0.095, hand, g.x, g.y, g.z, 16));
  });
}

function buildGirl() {
  const hair = 0xe2c65a, shirt = 0x5cbf8f, skirt = 0x4a4242, bow = 0xf59bc4;
  const body = new THREE.Group();
  // Green T-shirt (soft box) with rounded short sleeves; dark pleated skirt with a flared hem.
  body.add(softBox(0.8, 0.72, 0.5, shirt, 0, 0.36, 0, 0.16));
  body.add(mesh(shared('skirt', () => new THREE.LatheGeometry(
    [[0.4, 0.17], [0.44, 0.08], [0.5, -0.06], [0.56, -0.15], [0.57, -0.17]].map(([x, y]) => new THREE.Vector2(x, y)), 28)), skirt, 0, -0.02, 0.05));
  for (const s of [-1, 1]) {
    body.add(softBox(0.26, 0.24, 0.42, shirt, s * 0.46, 0.58, 0.02, 0.1));
    const leg = capsule(0.09, 0.52, C.skin, s * 0.2, -0.3, 0.45);
    leg.rotation.x = PI / 2;
    body.add(leg);
  }
  const head = buildHead(hair, { x: 0.555, y: -0.1, z: 0.13 });
  // Hair: ONE continuous mesh (see girlHairGeo) covering the top, back and sides, with a face window,
  // centre-parted fringe and long hair, all from the same welded surface.
  const hairMesh = new THREE.Mesh(girlHairGeo(), toon(hair, { side: THREE.DoubleSide }));
  hairMesh.userData.hair = true;
  head.add(hairMesh);
  // Soft fabric bow sitting on the hair at the top of the head, slightly tilted to one side.
  const bowG = buildBow(bow, 0xe27fae);
  bowG.position.set(0.04, 0.575, 0.05);
  bowG.rotation.z = 0.14;
  head.add(bowG);
  head.scale.setScalar(HEAD_SCALE);
  head.position.y = 1.22 + HEAD_LIFT;
  body.add(head);
  const reach = makeReach(body, { color: C.skin, hand: C.skin, r: 0.075, shoulderX: 0.44, shoulderY: 0.56 });
  return { body, head, reach, bow: bowG };
}

/** Curved cap brim: a soft fan that bends gently downward at its edge. */
function brimGeo() {
  return shared('brim', () => {
    const g = new THREE.CylinderGeometry(0.84, 0.84, 0.05, 32, 1, false, 0.43 - 0.6, 1.2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const d = Math.hypot(p.getX(i), p.getZ(i));
      p.setY(i, p.getY(i) - Math.max(0, d - 0.52) ** 2 * 0.5);
    }
    g.computeVertexNormals();
    return g;
  });
}

function buildBoy() {
  const hair = 0x2e2b2b, jacket = 0xa83a35, capA = 0xb83a3a, capB = 0xe0706f, pants = 0x2b2b2b;
  const body = new THREE.Group();
  // Soft red jacket open over a white T-shirt; black pants with a white side stripe.
  body.add(softBox(0.84, 0.74, 0.52, jacket, 0, 0.37, 0, 0.16));
  body.add(softBox(0.2, 0.7, 0.06, 0xffffff, 0, 0.36, 0.25, 0.025));
  body.add(softBox(0.5, 0.08, 0.5, jacket, 0, 0.76, 0, 0.035)); // collar
  for (const s of [-1, 1]) {
    const leg = capsule(0.1, 0.52, pants, s * 0.2, -0.3, 0.45);
    leg.rotation.x = PI / 2;
    body.add(leg);
    const stripe = capsule(0.022, 0.56, 0xffffff, s * 0.3, -0.3, 0.45, 8);
    stripe.rotation.x = PI / 2;
    body.add(stripe);
  }
  const head = buildHead(hair, { x: 0.555, y: -0.06, z: 0.13 });
  // Short black hair: covers the back and sides, a hairline at the front, all under the cap.
  // Short black hair: a band cut from the same head shape, kept below the cap's rim and inside its footprint.
  const hairMesh = new THREE.Mesh(boyHairGeo(), toon(hair, { side: THREE.DoubleSide }));
  hairMesh.userData.hair = true;
  head.add(hairMesh);
  // Striped cap: a rounded dome covering the whole top of the head down to the forehead, brim at the front.
  const cap = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const g = shared(`capw${i}`, () => new THREE.SphereGeometry(0.6, 8, 12, (i * PI) / 3, PI / 3, 0, PI / 2));
    cap.add(new THREE.Mesh(g, toon(i % 2 ? capB : capA, { side: THREE.DoubleSide })));
  }
  cap.scale.set(BOY_CAP.rx / 0.6, 0.56, BOY_CAP.rz / 0.6);
  cap.position.y = BOY_CAP.rimY;
  cap.userData.cap = BOY_CAP;
  head.add(cap);
  // Rounded rim band where the cap meets the hair, so the join is solid from every angle.
  const band = mesh(shared('capBand', () => new THREE.TorusGeometry(0.6, 0.035, 8, 48)), capA, 0, BOY_CAP.rimY + 0.01, 0);
  band.rotation.x = PI / 2;
  band.scale.set(BOY_CAP.rx / 0.6, BOY_CAP.rz / 0.6, 1);
  band.userData.capPart = true;
  head.add(band);
  head.add(mesh(brimGeo(), capA, 0, BOY_CAP.rimY + 0.02, 0));
  head.add(ball(0.07, capA, 0, 0.3 + 0.6 * 0.56, 0, 16));
  head.scale.setScalar(HEAD_SCALE);
  head.position.y = 1.24 + HEAD_LIFT;
  body.add(head);
  const reach = makeReach(body, { color: jacket, hand: C.skin, r: 0.095, shoulderX: 0.46, shoulderY: 0.56 });
  return { body, head, reach };
}

/** One of the two selectable drivers, as drawn in the characters sketch. */
export function buildDriver(name) {
  return name === 'boy' ? buildBoy() : buildGirl();
}

// ---------- Kart (no sketch yet: see MODELS.md) ----------
let starGeo;
export function star() {
  if (!starGeo) {
    const sh = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.055 : 0.13, a = PI / 2 + (i * PI) / 5;
      if (i) sh.lineTo(Math.cos(a) * r, Math.sin(a) * r); else sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    starGeo = new THREE.ShapeGeometry(sh);
  }
  return starGeo;
}
export const kb = (w, h, d, color, x, y, z, r) => mesh(roundedBoxGeo(w, h, d, r, 2), color, x, y, z); // kart panels (fewer segments: they sit far from the camera)

/** Chunky rounded toy go-kart (bumper-car feel) with the chosen driver sitting in it. Faces +Z.
 *  Returns { group, setLean, spin }. */
// The car itself is built in car.js (buildKart), which uses the helpers above and buildDriver.

// ---------- Scenery ----------
/** Soft tier of leaves: a cone shape with a gently rounded top. */
function leafTier(r, y0, h) {
  const pts = [[r, 0], [r * 0.3, h * 0.82], [0, h]].map(([x, y]) => new THREE.Vector2(x, y + y0));
  return new THREE.LatheGeometry(pts, 16);
}
/** Tree (no sketch yet): two soft, round-topped tiers on a trunk. Merged, vertex-coloured. */
export function treeGeometry(leaf) {
  const trunk = placed(new THREE.CylinderGeometry(0.25, 0.35, 1.6, 8, 1, true), C.treeTrunk, 0, 0.8, 0);
  const low = paint(leafTier(1.7, 1.3, 2.55), leaf);
  const top = paint(leafTier(1.2, 2.8, 2.0), leaf);
  return merge([trunk, low, top]);
}

/** Rolling hill: a smooth squashed ball. */
export function hillGeometry() {
  return new THREE.SphereGeometry(1, 12, 7);
}

/** Puffy cloud: three smooth balls. */
export function cloudGeometry() {
  const parts = [[0, 0, 0, 6], [5, -1, 1, 4.5], [-5, -1.2, 0, 4]].map(([x, y, z, r]) =>
    placed(new THREE.SphereGeometry(r, 8, 6), 0xffffff, x, y, z));
  return merge(parts);
}

/** Red-and-cream guardrail panel (from the assets sketch): rounded red posts, round cream rails edged in red. Runs along local Z. */
export function guardrailGeometry(len) {
  const parts = [];
  const post = new THREE.CylinderGeometry(0.09, 0.09, 1.15, 6);
  for (const z of [-len / 2 + 0.2, len / 2 - 0.2]) parts.push(placed(post, C.guardRed, 0, 0.58, z));
  const rail = new THREE.CylinderGeometry(0.07, 0.07, len, 6, 1, true);
  const edge = new THREE.CylinderGeometry(0.045, 0.045, len, 6, 1, true);
  for (const y of [0.55, 0.9]) {
    parts.push(placed(rail, C.guardCream, 0, y, 0, PI / 2));
    parts.push(placed(edge, C.guardRed, 0, y - 0.08, 0, PI / 2));
  }
  return merge(parts);
}

/** Ordinary brown roadside fence (from the assets sketch): rounded posts poke out above two round rails. */
export function brownFenceGeometry(len) {
  const parts = [];
  const post = new THREE.CylinderGeometry(0.1, 0.1, 1.4, 6);
  for (const z of [-len / 4, len / 4]) parts.push(placed(post, C.fenceBrown, 0, 0.7, z));
  const rail = new THREE.CylinderGeometry(0.08, 0.08, len, 6, 1, true);
  for (const y of [0.45, 0.95]) parts.push(placed(rail, C.fenceBrown, 0, y, 0, PI / 2));
  return merge(parts);
}
