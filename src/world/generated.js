// generated.js: loads the meshes baked by `npm run models` (assets/generated/*.glb) once, before
// the game starts. Each model comes in two grid sizes: fine (Graphics: High) and coarse (Graphics: Low,
// also used for the outline shells). A model is a list of sub-meshes, one per colour, so colour
// borders are sharp edges and nothing is blended between vertices.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import girl from '../../assets/generated/girl.glb?url';
import boy from '../../assets/generated/boy.glb?url';
import kart from '../../assets/generated/kart.glb?url';
import wheel from '../../assets/generated/wheel.glb?url';
import girlLow from '../../assets/generated/girl-low.glb?url';
import boyLow from '../../assets/generated/boy-low.glb?url';
import kartLow from '../../assets/generated/kart-low.glb?url';
import wheelLow from '../../assets/generated/wheel-low.glb?url';
import { toon, hullMesh } from './models.js';

const loader = new GLTFLoader();
/** Returns [{ geometry, hex, accent }], one entry per colour. */
async function load(url) {
  const gltf = await loader.loadAsync(url), parts = [];
  gltf.scene.traverse((o) => { if (o.isMesh) parts.push({ geometry: o.geometry, hex: o.material.userData.hex, accent: !!o.material.userData.accent }); });
  return parts;
}
const files = { high: { girl, boy, kart, wheel }, low: { girl: girlLow, boy: boyLow, kart: kartLow, wheel: wheelLow } };
const PARTS = { high: {}, low: {} };
await Promise.all(Object.entries(files).flatMap(([lod, set]) => Object.entries(set).map(async ([name, url]) => { PARTS[lod][name] = await load(url); })));

let quality = 'high';
/** 'high' = the fine meshes; 'low' = the coarse ones. Applies to models built after the call. */
export function setModelQuality(level) { quality = level === 'low' ? 'low' : 'high'; }

/**
 * A baked model as a group of meshes, one per colour, with a thin outline shell around it.
 * `accent` fills in the driver's colour. The shell always uses the coarse mesh: it only shows as a silhouette.
 */
export function bakedModel(name, { accent = 0xffffff, outline = 0 } = {}) {
  const group = new THREE.Group();
  const material = (part) => toon(part.accent ? accent : part.hex);
  for (const part of PARTS[quality][name]) {
    const mesh = new THREE.Mesh(part.geometry, material(part));
    mesh.userData.noOutline = true; // the shell below is its outline
    group.add(mesh);
  }
  if (outline) for (const part of PARTS.low[name]) group.add(hullMesh(part.geometry, material(part), outline));
  return group;
}
