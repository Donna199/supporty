// generated.js: loads the meshes baked by `npm run models` (assets/generated/*.glb) once, before
// the game starts. GEO.girl, GEO.boy, GEO.kart and GEO.wheel are ready-to-use geometries.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import girl from '../../assets/generated/girl.glb?url';
import boy from '../../assets/generated/boy.glb?url';
import kart from '../../assets/generated/kart.glb?url';
import wheel from '../../assets/generated/wheel.glb?url';

const loader = new GLTFLoader();
async function load(url) {
  const gltf = await loader.loadAsync(url);
  let geo = null;
  gltf.scene.traverse((o) => { if (o.isMesh) geo = o.geometry; });
  return geo;
}
const files = { girl, boy, kart, wheel };
export const GEO = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([name, url]) => [name, await load(url)])));

/** A copy of a baked mesh with its "accent" parts painted in the given colour (the driver's colour). */
const tinted = new Map();
export function withAccent(name, color) {
  const key = name + color;
  if (!tinted.has(key)) {
    const geo = GEO[name].clone(), col = geo.attributes.color, mark = geo.attributes._accent, c = new THREE.Color(color);
    for (let i = 0; i < col.count; i++) { const a = mark.getX(i); if (a > 0) col.setXYZ(i, c.r * a, c.g * a, c.b * a); }
    tinted.set(key, geo);
  }
  return tinted.get(key);
}
