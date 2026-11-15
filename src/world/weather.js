// weather.js: sky, light, fog and clouds, plus the phase looks:
// manic = saturated sky, speed lines, flickering screen edges;
// depressive = grey sky, low fog, rain, dimmer and desaturated.
// setBlend() mixes them by how far the mood leans, so the change is gradual.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import * as M from './models.js';

const C = CONFIG.colors;
const LOOK = {
  stable:     { sky: 0xffffff, fog: 0xf3ecdc, near: 140, far: 560, hemi: 1.5, sun: 2.1 },
  manic:      { sky: 0xffc2ea, fog: 0xffd6f0, near: 160, far: 620, hemi: 1.7, sun: 2.4 },
  depressive: { sky: 0x8f9aa6, fog: 0xa3abb3, near: 18, far: 150, hemi: 1.0, sun: 0.9 },
};
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const instant = new URLSearchParams(location.search).has('phase'); // testing: show a phase look at once

export function createWeather(scene, camera) {
  // Sky dome with a soft vertical gradient (horizon cream, top blue). Its colour tints per phase.
  const skyGeo = new THREE.SphereGeometry(1000, 24, 12);
  const colors = [];
  const top = new THREE.Color(C.sky), horizon = new THREE.Color(0xfbf1dc);
  const p = skyGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, p.getY(i) / 450));
    const c = horizon.clone().lerp(top, Math.pow(t, 0.6));
    colors.push(c.r, c.g, c.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.fog = new THREE.Fog(LOOK.stable.fog, LOOK.stable.near, LOOK.stable.far);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x9cc58a, LOOK.stable.hemi);
  const sun = new THREE.DirectionalLight(0xfff1dd, LOOK.stable.sun);
  sun.position.set(-60, 120, 40);
  scene.add(hemi, sun);

  // A few drifting clouds.
  const clouds = new THREE.InstancedMesh(M.cloudGeometry(), new THREE.MeshToonMaterial({ vertexColors: true, fog: false }), 14);
  const d = new THREE.Object3D();
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + i;
    const r = 300 + (i % 4) * 120;
    d.position.set(Math.cos(a) * r, 70 + (i % 3) * 18, Math.sin(a) * r);
    d.scale.setScalar(1.3 + (i % 3) * 0.4);
    d.rotation.y = a;
    d.updateMatrix();
    clouds.setMatrixAt(i, d.matrix);
  }
  scene.add(clouds);

  // Rain: short falling streaks in a box that follows the camera.
  const RAIN = 900, box = { x: 46, y: 26, z: 60 };
  const rainPos = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) {
    const x = (Math.random() - 0.5) * box.x, y = Math.random() * box.y, z = (Math.random() - 0.5) * box.z;
    rainPos.set([x, y, z, x + 0.05, y + 0.9, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xdfe6ee, transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  // Speed lines: streaks around the edge of the view, rushing toward the camera.
  scene.add(camera);
  const LINES = 70;
  const linePos = new Float32Array(LINES * 6);
  const lineData = [];
  for (let i = 0; i < LINES; i++) {
    const a = Math.random() * Math.PI * 2, r = 2.2 + Math.random() * 2.5;
    lineData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, z: -Math.random() * 30, len: 2 + Math.random() * 3 });
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthTest: false });
  const speedLines = new THREE.LineSegments(lineGeo, lineMat);
  speedLines.frustumCulled = false;
  speedLines.renderOrder = 3;
  camera.add(speedLines);

  // Mud spray from the rear wheels during heavy lane changes (depressive episode).
  const drops = [];
  const dropGeo = new THREE.SphereGeometry(0.12, 8, 6);
  const dropMat = new THREE.MeshToonMaterial({ color: 0x7a5a3e });
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(dropGeo, dropMat);
    m.visible = false;
    scene.add(m);
    drops.push({ m, life: 0, v: new THREE.Vector3() });
  }
  let nextDrop = 0, sprayAcc = 0;
  const tmp = new THREE.Vector3();

  const fx = document.getElementById('fx');
  const canvas = document.getElementById('game');
  const w = { stable: 1, manic: 0, depressive: 0 };
  const mix = (key) => w.stable * LOOK.stable[key] + w.manic * LOOK.manic[key] + w.depressive * LOOK.depressive[key];
  const mixColor = (key, out) => out.setRGB(0, 0, 0)
    .add(new THREE.Color(LOOK.stable[key]).multiplyScalar(w.stable))
    .add(new THREE.Color(LOOK.manic[key]).multiplyScalar(w.manic))
    .add(new THREE.Color(LOOK.depressive[key]).multiplyScalar(w.depressive));
  let target = { stable: 1, manic: 0, depressive: 0 }, episode = 'stable', fogBoost = 0, speed = 1;

  return {
    /** weights: {stable, manic, depressive}; episode: current phase; speedFactor: kart speed multiplier. */
    setBlend(weights, phase = 'stable', speedFactor = 1) { target = weights; episode = phase; speed = speedFactor; },
    /** Throw a little mud from the kart's back wheels. */
    spray(kart, strength) {
      sprayAcc += strength * 0.05;
      while (sprayAcc >= 1) {
        sprayAcc -= 1;
        const d = drops[nextDrop++ % drops.length];
        tmp.set((Math.random() < 0.5 ? -1 : 1) * 1.05, 0.3, -1.2);
        d.m.position.copy(kart.localToWorld(tmp.clone()));
        d.v.set((Math.random() - 0.5) * 2, 2.5 + Math.random() * 1.5, 0).add(kart.getWorldDirection(tmp).multiplyScalar(-3));
        d.life = 0.6;
        d.m.visible = true;
        d.m.scale.setScalar(0.8 + Math.random() * 0.6);
      }
    },
    /** Thicker fog for a few seconds (the foggy fork). */
    fogBurst(sec) { fogBoost = sec; },
    update(dt) {
      sky.position.copy(camera.position);
      for (const d of drops) {
        if (!d.m.visible) continue;
        d.life -= dt;
        d.v.y -= 9 * dt;
        d.m.position.addScaledVector(d.v, dt);
        if (d.life <= 0 || d.m.position.y < 0) d.m.visible = false;
      }
      const k = instant ? 1 : 1 - Math.exp(-1.5 * dt);
      for (const key of Object.keys(w)) w[key] += (target[key] - w[key]) * k;
      mixColor('sky', skyMat.color);
      mixColor('fog', scene.fog.color);
      fogBoost = Math.max(0, fogBoost - dt);
      const thick = fogBoost > 0 ? 0.35 : 1;
      scene.fog.near = mix('near') * thick;
      scene.fog.far = mix('far') * thick;
      hemi.intensity = mix('hemi');
      sun.intensity = mix('sun');

      // Rain: starts lightly in the low leaning zone, full in a depressive episode.
      rainMat.opacity = Math.min(0.75, Math.max(0, (w.depressive - 0.15) * 1.1));
      rain.visible = rainMat.opacity > 0.01;
      if (rain.visible) {
        rain.position.set(camera.position.x, camera.position.y - 12, camera.position.z);
        const arr = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN; i++) {
          let y = arr[i * 6 + 1] - dt * 28;
          if (y < 0) y += box.y;
          arr[i * 6 + 1] = y; arr[i * 6 + 4] = y + 0.9;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }

      // Speed lines: from the high leaning zone up, strongest in a manic episode.
      lineMat.opacity = reduceMotion ? 0 : Math.min(0.7, Math.max(0, (w.manic - 0.2) * 1.2));
      speedLines.visible = lineMat.opacity > 0.01;
      if (speedLines.visible) {
        const arr = lineGeo.attributes.position.array;
        lineData.forEach((l, i) => {
          l.z += dt * 40 * speed;
          if (l.z > -1) l.z -= 30;
          arr.set([l.x, l.y, l.z, l.x * 1.04, l.y * 1.04, l.z + l.len], i * 6);
        });
        lineGeo.attributes.position.needsUpdate = true;
      }

      // Colour grade on the whole picture, plus the edge effects.
      const sat = 1 + 0.55 * w.manic - 0.6 * w.depressive;
      const bright = 1 + 0.04 * w.manic - 0.14 * w.depressive;
      canvas.style.filter = `saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)})`;
      fx.dataset.phase = episode;
      fx.classList.toggle('calm', reduceMotion);
    },
  };
}
