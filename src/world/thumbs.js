// thumbs.js: draws small pictures of road items with one shared offscreen renderer.
// Used for the rotating models in the Road guide and the little icons in pop-ups.
import * as THREE from 'three';
import { buildItem } from './itemModels.js';

let renderer, scene, camera;
const models = new Map();   // item id -> { group, dist, centre }
const icons = new Map();    // item id -> data URL
const W = 192, H = 144; // same 4:3 shape as the guide cards

function setup() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9cc58a, 1.6));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.0);
  sun.position.set(-3, 6, -4);
  scene.add(sun);
  camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
}

function model(id) {
  if (!models.has(id)) {
    const group = buildItem(id);
    const sprites = [];
    group.traverse((o) => { if (o.isSprite) sprites.push(o); });
    sprites.forEach((sp) => sp.removeFromParent()); // the card shows the name instead (and labels would skew the framing)
    group.userData.approach?.(0); // e.g. the rock sits on the road
    const box = new THREE.Box3().setFromObject(group);
    const centre = box.getCenter(new THREE.Vector3());
    const dist = box.getSize(new THREE.Vector3()).length() * 1.25;
    const holder = new THREE.Group();
    holder.add(group);
    group.position.sub(centre);
    models.set(id, { holder, group, dist });
  }
  return models.get(id);
}

function draw(id, angle, t = 0) {
  setup();
  const m = model(id);
  scene.add(m.holder);
  m.holder.rotation.y = angle;
  m.group.userData.spin?.(t);
  camera.position.set(0, m.dist * 0.32, -m.dist); // items face -Z (toward the kart)
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
  scene.remove(m.holder);
  return renderer.domElement;
}

/** Draws the item into a 2D canvas, turned by `angle` (for the slowly rotating guide cards). */
export function drawInto(ctx, id, angle, t) {
  const src = draw(id, angle, t);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(src, 0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** A small still picture of the item, for pop-up icons. Cached. */
export function iconFor(id) {
  if (!icons.has(id)) {
    try { icons.set(id, draw(id, 0.5).toDataURL('image/png')); } catch { icons.set(id, ''); }
  }
  return icons.get(id);
}
