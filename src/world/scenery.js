// scenery.js: the small roadside props, each drawn as ONE instanced mesh: bushes, flowers,
// little houses, and a few snow patches that only show in winter. Colours come from palette.js.
import * as THREE from 'three';
import { WORLD as P, UI, CHARACTER, CAR } from './palette.js';
import * as M from './models.js';

const COUNT = { bushes: 90, flowers: 150, houses: 22, snow: 110 };
const PI = Math.PI;

/** Bush: two soft squashed balls. */
function bushGeometry() {
  return M.merge([
    M.placed(new THREE.SphereGeometry(0.9, 7, 5), 0xffffff, 0, 0.55, 0),
    M.placed(new THREE.SphereGeometry(0.62, 6, 4), 0xffffff, 0.7, 0.42, 0.2),
  ]).scale(1, 0.8, 1);
}
/** Flower: a short stem, a round bloom (tinted per flower) and a yellow centre. */
function flowerGeometry() {
  return M.merge([
    M.placed(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 3, 1, true), P.treeLeaf[0], 0, 0.25, 0),
    M.placed(new THREE.SphereGeometry(0.2, 7, 4), 0xffffff, 0, 0.55, 0).scale(1, 0.55, 1).translate(0, 0.25, 0),
    M.placed(new THREE.SphereGeometry(0.085, 5, 3), CAR.lamp, 0, 0.6, 0),
  ]);
}
/** Small house: rounded walls (tinted per house), a soft pink roof, a door, two windows and a chimney. */
function houseGeometry() {
  const roof = M.placed(new THREE.ConeGeometry(2.7, 1.7, 4), P.kartAccentBoy, 0, 3.15, 0, 0, PI / 4, 0);
  return M.merge([
    M.placed(M.roundedBoxGeo(3.2, 2.4, 3.2, 0.3, 1).toNonIndexed(), 0xffffff, 0, 1.2, 0),
    roof.index ? roof.toNonIndexed() : roof,
    M.placed(new THREE.BoxGeometry(0.7, 1.2, 0.1), P.treeTrunk, 0, 0.6, 1.62).toNonIndexed(),
    ...[-1, 1].map((s) => M.placed(new THREE.BoxGeometry(0.6, 0.6, 0.1), CAR.glass, s * 0.95, 1.5, 1.62).toNonIndexed()),
    M.placed(new THREE.BoxGeometry(0.45, 1.0, 0.45), UI.cream, 0.9, 3.3, -0.5).toNonIndexed(),
  ]);
}

/** Adds the props to the scene. `road` gives { pointAt, length, half, rand, distToRoad }. Returns { foliage, snow } materials for the seasons. */
export function addScenery(scene, { pointAt, frameAt, length, half, rand, distToRoad }) {
  const d = new THREE.Object3D(), c = new THREE.Color();
  const foliage = M.toon(0xffffff, { vertexColors: true, name: 'foliage' });
  const put = (mesh, n, shadows, at, size) => {
    d.position.copy(at); d.updateMatrix();
    mesh.setMatrixAt(n, d.matrix);
    if (shadows) { const y = d.position.y; d.position.y = 0.04; d.scale.setScalar(size); d.updateMatrix(); shadows.setMatrixAt(n, d.matrix); d.position.y = y; }
  };
  const shadowMesh = (n, w) => new THREE.InstancedMesh(new THREE.PlaneGeometry(w, w).rotateX(-PI / 2), M.blobMaterial(), n);

  // Bushes: scattered between the road and the trees.
  const bushes = new THREE.InstancedMesh(bushGeometry(), foliage, COUNT.bushes), bushShadows = shadowMesh(COUNT.bushes, 2.6);
  for (let n = 0; n < COUNT.bushes; n++) {
    const side = rand() < 0.5 ? -1 : 1, sc = 0.7 + rand() * 0.8;
    d.rotation.set(0, rand() * 6, 0); d.scale.setScalar(sc);
    put(bushes, n, bushShadows, pointAt(rand() * length, side * (half + 6 + rand() * 30), 0), sc);
    bushes.setColorAt(n, c.set(P.treeLeaf[n % 3]).lerp(new THREE.Color(P.hill[2]), 0.35));
  }
  // Flowers: little clusters close to the road, in the game's pastel accents.
  const tints = [UI.pink, UI.yellow, UI.white, CHARACTER.bow, UI.mint];
  const flowers = new THREE.InstancedMesh(flowerGeometry(), M.toon(0xffffff, { vertexColors: true, name: 'flowers' }), COUNT.flowers);
  for (let n = 0; n < COUNT.flowers;) {
    const s = rand() * length, side = rand() < 0.5 ? -1 : 1, lat = half + 3.4 + rand() * 9, tint = tints[Math.floor(rand() * tints.length)];
    for (let k = 0; k < 3 + Math.floor(rand() * 3) && n < COUNT.flowers; k++, n++) {
      d.rotation.set(0, rand() * 6, 0); d.scale.setScalar(1.1 + rand() * 0.7);
      put(flowers, n, null, pointAt(s + (rand() - 0.5) * 3, side * (lat + (rand() - 0.5) * 2.4), 0));
      flowers.setColorAt(n, c.set(tint));
    }
  }
  // Houses: a few, set well back, facing the road.
  const walls = [UI.paper, UI.yellow, UI.mint, P.guardCream, UI.pink];
  const houses = new THREE.InstancedMesh(houseGeometry(), M.vertexToon(), COUNT.houses), houseShadows = shadowMesh(COUNT.houses, 6.5);
  const f = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
  let placed = 0;
  for (let tries = 0; placed < COUNT.houses && tries < 400; tries++) {
    const s = rand() * length, side = rand() < 0.5 ? -1 : 1, at = pointAt(s, side * (half + 22 + rand() * 34), 0);
    if (distToRoad(at) < half + 18) continue;
    frameAt(s, f);
    const sc = 1 + rand() * 0.35;
    d.rotation.set(0, Math.atan2(-side * f.right.x, -side * f.right.z) + (rand() - 0.5) * 0.5, 0); d.scale.setScalar(sc);
    put(houses, placed, houseShadows, at, sc);
    houses.setColorAt(placed, c.set(walls[placed % walls.length]));
    placed++;
  }
  houses.count = houseShadows.count = placed;
  // Snow patches: soft white mounds on the grass, faded in only in winter.
  const snowMat = new THREE.MeshToonMaterial({ color: UI.white, transparent: true, opacity: 0, depthWrite: false });
  const snow = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 5, 0, PI * 2, 0, PI / 2), snowMat, COUNT.snow);
  for (let n = 0; n < COUNT.snow; n++) {
    const side = rand() < 0.5 ? -1 : 1, w = 2.2 + rand() * 3.4;
    d.rotation.set(0, rand() * 6, 0); d.scale.set(w, 0.45 + rand() * 0.35, w * (0.6 + rand() * 0.4));
    put(snow, n, null, pointAt(rand() * length, side * (half + 4 + rand() * 26), 0.0));
  }
  snow.visible = false;
  scene.add(bushes, bushShadows, flowers, houses, houseShadows, snow);
  return { foliage, snow };
}
