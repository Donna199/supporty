// road.js: one long, gently curving 3-lane road (a closed spline loop, so it never ends),
// with lane markings, grass, low-poly hills, trees, brown fences and the
// red-and-cream guardrails (one panel of every three per guardrail level).
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import * as M from './models.js';

const W = CONFIG.world;
const C = CONFIG.colors;
const UP = new THREE.Vector3(0, 1, 0);
const SAMPLES = 1200;

// Small seeded random so the world looks the same every run.
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRoad(scene) {
  // ---- The centre line: a wobbly circle ----
  const ctrl = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const r = W.loopRadius * (1 + 0.13 * Math.sin(3 * a + 1) + 0.05 * Math.sin(5 * a + 2));
    ctrl.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
  }
  const curve = new THREE.CatmullRomCurve3(ctrl, true, 'centripetal');
  const length = curve.getLength();
  const pos = [], tan = [], right = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / SAMPLES;
    pos.push(curve.getPointAt(u));
    const t = curve.getTangentAt(u).setY(0).normalize();
    tan.push(t);
    right.push(new THREE.Vector3().crossVectors(t, UP).normalize());
  }

  const wrap = (s) => ((s % length) + length) % length;
  /** Position, forward and right vectors at distance `s` along the road. */
  function frameAt(s, out = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() }) {
    const f = (wrap(s) / length) * SAMPLES;
    const i = Math.floor(f) % SAMPLES, j = (i + 1) % SAMPLES, k = f - Math.floor(f);
    out.pos.lerpVectors(pos[i], pos[j], k);
    out.fwd.lerpVectors(tan[i], tan[j], k).normalize();
    out.right.lerpVectors(right[i], right[j], k).normalize();
    return out;
  }
  const tmp = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
  /** World point at road distance `s`, `lateral` metres right of centre, `y` up. */
  function pointAt(s, lateral = 0, y = 0, out = new THREE.Vector3()) {
    frameAt(s, tmp);
    return out.copy(tmp.pos).addScaledVector(tmp.right, lateral).addScaledVector(UP, y);
  }

  // ---- Flat ribbons that follow the road (road surface, edges, dashes) ----
  function ribbon(fromLat, toLat, y, color, keep = () => true, step = 2) {
    const v = [];
    for (let i = 0; i < SAMPLES; i += step) {
      const j = (i + step) % SAMPLES;
      if (!keep(i)) continue;
      const a0 = pos[i].clone().addScaledVector(right[i], fromLat).setY(y);
      const a1 = pos[i].clone().addScaledVector(right[i], toLat).setY(y);
      const b0 = pos[j].clone().addScaledVector(right[j], fromLat).setY(y);
      const b1 = pos[j].clone().addScaledVector(right[j], toLat).setY(y);
      v.push(...a0.toArray(), ...b0.toArray(), ...a1.toArray(), ...a1.toArray(), ...b0.toArray(), ...b1.toArray());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, M.toon(color, { side: THREE.DoubleSide }));
    scene.add(m);
    return m;
  }
  const half = (W.lanes * W.laneWidth) / 2;
  ribbon(-half - W.shoulder - 0.6, half + W.shoulder + 0.6, 0.0, C.shoulder);
  ribbon(-half - W.shoulder, half + W.shoulder, 0.01, C.road);
  ribbon(-half - 0.08, -half + 0.18, 0.02, C.roadEdge);
  ribbon(half - 0.18, half + 0.08, 0.02, C.roadEdge);
  const dashEvery = 6; // samples per dash cycle
  for (const lat of [-W.laneWidth / 2, W.laneWidth / 2]) {
    ribbon(lat - 0.1, lat + 0.1, 0.02, C.laneDash, (i) => (i / 2) % dashEvery < dashEvery / 2, 2);
  }

  // ---- Ground, hills and trees ----
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1100, 40), M.toon(C.grass));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.03;
  scene.add(ground);

  const rand = rng(350);
  const distToRoad = (p) => {
    let best = Infinity;
    for (let i = 0; i < SAMPLES; i += 6) best = Math.min(best, pos[i].distanceToSquared(p));
    return Math.sqrt(best);
  };

  const hillGeo = M.hillGeometry();
  const hills = new THREE.InstancedMesh(hillGeo, M.toon(0xffffff), W.hillCount);
  const dummy = new THREE.Object3D();
  let placed = 0, tries = 0;
  while (placed < W.hillCount && tries++ < 2000) {
    const a = rand() * Math.PI * 2;
    const r = rand() < 0.35 ? rand() * W.loopRadius * 0.6 : W.loopRadius * (1.35 + rand() * 1.6);
    const size = 22 + rand() * 40;
    const p = new THREE.Vector3(Math.cos(a) * r, -size * 0.12, Math.sin(a) * r);
    if (distToRoad(p) < size + 16) continue;
    dummy.position.copy(p);
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.scale.set(size, size * (0.32 + rand() * 0.2), size * (0.8 + rand() * 0.4));
    dummy.updateMatrix();
    hills.setMatrixAt(placed, dummy.matrix);
    hills.setColorAt(placed, new THREE.Color(C.hill[placed % C.hill.length]));
    placed++;
  }
  hills.count = placed;
  scene.add(hills);

  const trees = C.treeLeaf.map((leaf) => new THREE.InstancedMesh(M.treeGeometry(leaf), M.vertexToon(), W.treeCount));
  const treeShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(4, 4).rotateX(-Math.PI / 2), M.blobMaterial(), W.treeCount);
  const counts = [0, 0, 0];
  for (let n = 0; n < W.treeCount; n++) {
    const s = rand() * length;
    const side = rand() < 0.5 ? -1 : 1;
    const lat = side * (half + 8 + rand() * rand() * 70);
    const p = pointAt(s, lat, 0);
    if (distToRoad(p) < half + 6) continue;
    const kind = n % 3;
    const sc = 0.8 + rand() * 0.7;
    dummy.position.copy(p);
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.scale.setScalar(sc);
    dummy.updateMatrix();
    trees[kind].setMatrixAt(counts[kind]++, dummy.matrix);
    dummy.position.y = 0.04;
    dummy.updateMatrix();
    treeShadows.setMatrixAt(counts[0] + counts[1] + counts[2] - 1, dummy.matrix);
  }
  trees.forEach((t, i) => { t.count = counts[i]; scene.add(t); });
  treeShadows.count = counts[0] + counts[1] + counts[2];
  scene.add(treeShadows);

  // ---- Fences: only built near the kart, recycled as it drives ----
  const guardSpacing = length / Math.round(length / W.guardrailSpacing);
  const fenceSpacing = length / Math.round(length / W.fenceSpacing);
  const guardrails = new RoadsideStrip(scene, frameAt, M.guardrailGeometry(guardSpacing), guardSpacing, half + W.shoulder + 0.35);
  const fences = new RoadsideStrip(scene, frameAt, M.brownFenceGeometry(fenceSpacing), fenceSpacing, half + W.shoulder + 4.2,
    (i) => Math.floor(i / 24) % 3 !== 2); // gaps every so often so it does not feel like a cage
  let level = CONFIG.mood.startGuardrails;
  guardrails.visible = (i) => (((i % 3) + 3) % 3) < level;

  return {
    length, frameAt, pointAt, wrap, halfWidth: half,
    /** Show one red-and-cream panel in every three per guardrail level (0 = none, 3 = solid). */
    setGuardrails(n) { if (n !== level) { level = n; guardrails.dirty = true; } },
    update(carS) { guardrails.update(carS); fences.update(carS); },
  };
}

/** A row of repeating fence panels on both sides of the road, rebuilt only near the kart. */
class RoadsideStrip {
  constructor(scene, frameAt, geo, spacing, lateral, visible = () => true) {
    this.frameAt = frameAt;
    this.spacing = spacing;
    this.lateral = lateral;
    this.visible = visible;
    this.perSide = Math.ceil((W.visibleAhead + W.visibleBehind) / spacing) + 2;
    this.mesh = new THREE.InstancedMesh(geo, M.vertexToon(), this.perSide * 2);
    this.shadow = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.4, spacing * 1.1).rotateX(-Math.PI / 2), M.blobMaterial(), this.perSide * 2);
    this.mesh.frustumCulled = this.shadow.frustumCulled = false;
    scene.add(this.mesh, this.shadow);
    this.first = null;
    this.dirty = true;
    this.f = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
    this.d = new THREE.Object3D();
  }
  update(carS) {
    const first = Math.floor((carS - W.visibleBehind) / this.spacing);
    if (first === this.first && !this.dirty) return;
    this.first = first;
    this.dirty = false;
    let n = 0;
    for (let k = 0; k < this.perSide; k++) {
      const idx = first + k;
      const s = (idx + 0.5) * this.spacing;
      this.frameAt(s, this.f);
      for (const side of [-1, 1]) {
        const show = this.visible(idx);
        this.d.position.copy(this.f.pos).addScaledVector(this.f.right, side * this.lateral);
        this.d.lookAt(this.d.position.clone().add(this.f.fwd));
        this.d.scale.setScalar(show ? 1 : 0.0001);
        this.d.updateMatrix();
        this.mesh.setMatrixAt(n, this.d.matrix);
        this.d.position.y = 0.03;
        this.d.updateMatrix();
        this.shadow.setMatrixAt(n, this.d.matrix);
        n++;
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.shadow.instanceMatrix.needsUpdate = true;
  }
}
