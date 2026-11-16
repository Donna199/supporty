// models.js: builds every model in code from simple shapes with soft toon shading
// and blob shadows. Shapes are rounded (rounded boxes, capsules, smooth spheres and
// tori) for a soft toy / vinyl-figure look. Drivers follow the concept sketches;
// anything unsketched is listed in MODELS.md. Identical shapes share one geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { CONFIG } from '../config.js';

const C = CONFIG.colors;
const PI = Math.PI;

// ---------- Materials (smooth toon shading, shared by colour) ----------
let ramp;
function toonRamp() {
  if (!ramp) {
    // Three soft light steps (shadow, mid, lit) with a smooth edge between them: no harsh bands.
    const N = 64, tones = [150, 205, 255], soft = 0.09, data = new Uint8Array(N);
    const ease = (v) => { const t = Math.min(1, Math.max(0, v)); return t * t * (3 - 2 * t); };
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      data[i] = tones[0] + (tones[1] - tones[0]) * ease((x - 1 / 3 + soft) / (2 * soft)) + (tones[2] - tones[1]) * ease((x - 2 / 3 + soft) / (2 * soft));
    }
    ramp = new THREE.DataTexture(data, N, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.LinearFilter;
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
export function placed(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = paint(geo, color);
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  return g.translate(x, y, z);
}
export const merge = (parts) => mergeGeometries(parts, false);

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

// The drivers are in driver.js and the kart in car.js (baked seamless meshes, see tools/sdf/).

// ---------- Small shared shapes ----------
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

/** Puffy cloud: five soft balls with a flatter underside. */
export function cloudGeometry() {
  const parts = [[0, 0, 0, 6], [5.6, -1.3, 0.6, 4.6], [-5.6, -1.5, 0, 4.2], [2.6, 2.2, -1, 4], [-2.8, 1.7, 1, 3.6]].map(([x, y, z, r]) =>
    placed(new THREE.SphereGeometry(r, 10, 7), 0xffffff, x, y, z));
  return merge(parts).scale(1, 0.72, 1);
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

// ---------- Soft outline (a slightly larger back-face copy in a darker tone of the same colour) ----------
// Outlines sit on layer 1, so the camera can switch them all off at once (Graphics: Low).
export const OUTLINE_LAYER = 1;
const hullGeos = new WeakMap(), hullMats = new Map();
function hullGeometry(geo, thickness) {
  const key = thickness.toFixed(3);
  let byT = hullGeos.get(geo);
  if (!byT) hullGeos.set(geo, (byT = {}));
  if (byT[key]) return byT[key];
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  // Average the normals of vertices that share a position, so hard edges do not crack open.
  const sums = new Map(), keys = [];
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    keys.push(k);
    const v = sums.get(k) ?? sums.set(k, new THREE.Vector3()).get(k);
    v.x += nor.getX(i); v.y += nor.getY(i); v.z += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const n = sums.get(keys[i]).clone().normalize();
    out.set([pos.getX(i) + n.x * thickness, pos.getY(i) + n.y * thickness, pos.getZ(i) + n.z * thickness], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(geo.index);
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (geo.attributes.color) g.setAttribute('color', geo.attributes.color);
  return (byT[key] = g);
}
function hullMaterial(mat) {
  const c = mat.color.clone().multiplyScalar(0.42), key = c.getHexString() + (mat.vertexColors ? 'v' : '');
  if (!hullMats.has(key)) hullMats.set(key, new THREE.MeshBasicMaterial({ color: c, vertexColors: mat.vertexColors, side: THREE.BackSide }));
  return hullMats.get(key);
}
/** Gives every solid toon mesh under `root` a thin soft outline. Skips signs, glass, shadows and anything marked noOutline. */
export function outline(root, thickness = 0.03) {
  const meshes = [];
  root.traverse((o) => {
    const m = o.material;
    if (o.isMesh && !o.isInstancedMesh && m?.isMeshToonMaterial && !m.transparent && !m.map && !o.userData.noOutline && o.geometry.attributes.normal) meshes.push(o);
  });
  for (const o of meshes) o.add(hullMesh(o.geometry, o.material, thickness / Math.max(0.2, o.scale.x)));
  return root;
}
/** The outline shell for one geometry: its back faces, pushed out a little, in a darker tone of `material`'s colour. */
export function hullMesh(geometry, material, thickness) {
  const hull = new THREE.Mesh(hullGeometry(geometry, thickness), hullMaterial(material));
  hull.layers.set(OUTLINE_LAYER);
  hull.userData.noOutline = true;
  return hull;
}

// ---------- Soft glow (only for real lights: headlights, medication, manic neon) ----------
let glowTex;
export function glow(color, size = 1.6, opacity = 0.55) {
  if (!glowTex) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(cv);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}
