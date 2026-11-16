// weather.js: sky, light, fog and clouds, plus the phase looks:
// manic = saturated sky, speed lines, flickering screen edges;
// depressive = grey sky, low fog, rain, dimmer and desaturated.
// setBlend() mixes them by how far the mood leans, so the change is gradual.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import * as M from './models.js';
import { WORLD as P, UI, CAR, SKY, PHASES, inSeason } from './palette.js';

const C = CONFIG.colors;
// Fog distance and light strength per phase. Every colour comes from palette.js.
const LOOK = {
  stable:     { near: 140, far: 560, hemi: 1.35, sun: 2.0, rim: 0.7 },
  manic:      { near: 160, far: 620, hemi: 1.5, sun: 2.3, rim: 1.0 },
  depressive: { near: 22, far: 170, hemi: 1.2, sun: 1.15, rim: 0.3 },
};
const PHASE_KEYS = ['stable', 'manic', 'depressive'], SEASON_KEYS = ['winter', 'spring', 'summer', 'autumn'];
const SEASON_MID = { winter: 0.5, spring: 3.5, summer: 6.5, autumn: 9.5 }; // month (0 = January) at the middle of each season
const PETALS = { count: 140, box: [40, 16, 50], fall: 1.6, sway: 0.8, size: 0.15 };
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function createWeather(scene, camera) {
  // Sky dome with a soft vertical gradient (horizon cream, top blue). Its colour tints per phase.
  const skyGeo = new THREE.SphereGeometry(1000, 24, 12);
  const p = skyGeo.attributes.position, skyT = [];
  for (let i = 0; i < p.count; i++) skyT.push(Math.pow(Math.min(1, Math.max(0, p.getY(i) / 450)), 0.6));
  const skyColor = new THREE.Float32BufferAttribute(new Float32Array(p.count * 3), 3);
  skyGeo.setAttribute('color', skyColor);
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  scene.fog = new THREE.Fog(SKY.stable[1], LOOK.stable.near, LOOK.stable.far);
  // One soft warm key light, a gentle sky/ground fill, and a subtle rim light that always comes
  // from ahead of the camera, so the kart and drivers get a soft bright edge.
  const hemi = new THREE.HemisphereLight(UI.white, P.grass, LOOK.stable.hemi);
  const sun = new THREE.DirectionalLight(CAR.lamp, LOOK.stable.sun);
  sun.position.set(-60, 120, 40);
  const rim = new THREE.DirectionalLight(UI.paper, LOOK.stable.rim);
  scene.add(hemi, sun, rim, rim.target);

  // Blossom (spring) and leaves (autumn): a few small soft flecks drifting down around the camera.
  const petalPos = new Float32Array(PETALS.count * 3);
  for (let i = 0; i < PETALS.count; i++) petalPos.set(PETALS.box.map((v, k) => (k === 1 ? Math.random() : Math.random() - 0.5) * v), i * 3);
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
  // Each fleck is a small soft round dot (drawn once on a canvas), never a hard square.
  const dotCanvas = document.createElement('canvas');
  dotCanvas.width = dotCanvas.height = 32;
  const dot = dotCanvas.getContext('2d'), fade = dot.createRadialGradient(16, 16, 0, 16, 16, 16);
  fade.addColorStop(0, 'rgba(255,255,255,1)'); fade.addColorStop(0.6, 'rgba(255,255,255,0.9)'); fade.addColorStop(1, 'rgba(255,255,255,0)');
  dot.fillStyle = fade; dot.fillRect(0, 0, 32, 32);
  const petalMat = new THREE.PointsMaterial({ size: PETALS.size, color: UI.pink, map: new THREE.CanvasTexture(dotCanvas), transparent: true, opacity: 0, depthWrite: false });
  const petals = new THREE.Points(petalGeo, petalMat);
  petals.frustumCulled = false;
  scene.add(petals);
  const season = { winter: 1, spring: 0, summer: 0, autumn: 0 };
  let seasonal = null, high = true, time = 0;
  const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color(), topColor = new THREE.Color(), side = new THREE.Vector3();
  /** A palette colour blended over the current seasons (and, for the sky, the current phase mix). */
  const seasonColor = (base, key, out) => {
    out.setRGB(0, 0, 0);
    for (const k of SEASON_KEYS) if (season[k] > 0) out.add(c3.set(inSeason(base, k, key)).multiplyScalar(season[k]));
    return out;
  };
  /** Tint for a material whose own colours are already painted in: season colour divided by the base colour. */
  const seasonTint = (mat, base, key) => {
    seasonColor(base, key, mat.color); c3.set(base);
    mat.color.setRGB(mat.color.r / c3.r, mat.color.g / c3.g, mat.color.b / c3.b);
  };

  // A few drifting clouds.
  const clouds = new THREE.InstancedMesh(M.cloudGeometry(), new THREE.MeshToonMaterial({ color: UI.white, emissive: UI.paper, emissiveIntensity: 0.55, fog: false }), 14); // lit from within a little, so they stay soft and white
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
    const a = Math.random() * Math.PI * 2, r = 3.4 + Math.random() * 2.2; // near the edges of the view only
    lineData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, z: -Math.random() * 30, len: 0.8 + Math.random() * 1.4 });
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: UI.yellow, transparent: true, opacity: 0, depthTest: false });
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
  /** Sky colour (0 = top, 1 = horizon) for the current mix of phases and seasons. */
  const skyMix = (which, out) => {
    out.setRGB(0, 0, 0);
    for (const k of PHASE_KEYS) if (w[k] > 0.001) out.add(seasonColor(SKY[k][which], '', c2).multiplyScalar(w[k]));
    return out;
  };
  let target = { stable: 1, manic: 0, depressive: 0 }, episode = 'stable', fogBoost = 0, speed = 1;

  return {
    /** weights: {stable, manic, depressive}; episode: current phase; speedFactor: kart speed multiplier. */
    setBlend(weights, phase = 'stable', speedFactor = 1) { target = weights; episode = phase; speed = speedFactor; },
    /** month: 0 = start of January ... 12 = end of December. Seasons cross-fade into each other. */
    setSeason(month) {
      for (const k of SEASON_KEYS) { const d = Math.abs(((month - SEASON_MID[k]) % 12 + 18) % 12 - 6); season[k] = Math.max(0, 1 - d / 3); }
    },
    /** The materials the seasons tint (from road.js). */
    setSeasonal(materials) { seasonal = materials; },
    /** Graphics: High shows the drifting blossom and leaves; Low hides them. */
    setQuality(isHigh) { high = isHigh; },
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
      const k = 1 - Math.exp(-1.5 * dt);
      for (const key of Object.keys(w)) w[key] += (target[key] - w[key]) * k;
      // Sky gradient and haze, from the palette's sky colours for this mix of phases and seasons.
      const top = skyMix(0, topColor), horizon = skyMix(1, scene.fog.color);
      for (let i = 0; i < skyT.length; i++) { c1.copy(horizon).lerp(top, skyT[i]); skyColor.setXYZ(i, c1.r, c1.g, c1.b); }
      skyColor.needsUpdate = true;
      rim.intensity = mix('rim');
      clouds.material.emissiveIntensity = 0.55 - 0.5 * w.depressive; // greyer clouds on low days
      clouds.material.color.setScalar(1 - 0.3 * w.depressive);
      // The rim light sits ahead of the camera, a little above and to one side, shining back at the kart.
      camera.getWorldDirection(tmp);
      rim.target.position.copy(camera.position).addScaledVector(tmp, 9);
      rim.position.copy(rim.target.position).addScaledVector(tmp, 30).add(side.set(-tmp.z * 12, 16, tmp.x * 12));
      if (seasonal) {
        seasonColor(P.grass, 'grass', seasonal.ground.color);
        seasonTint(seasonal.hills, P.hill[0], 'hill');
        seasonTint(seasonal.trees, P.treeLeaf[1], 'treeLeaf');
        seasonal.foliage.color.copy(seasonal.trees.color);
        seasonal.snow.material.opacity = Math.min(1, season.winter * 1.4);
        seasonal.snow.visible = season.winter > 0.03;
      }
      // Blossom in spring, leaves in autumn, a little snow in winter.
      time += dt;
      petalMat.opacity = high && !reduceMotion ? Math.min(0.9, Math.max(season.spring, season.autumn, season.winter) * 1.3) : 0;
      petals.visible = petalMat.opacity > 0.02;
      if (petals.visible) {
        petalMat.color.set(season.winter >= Math.max(season.spring, season.autumn) ? UI.white : season.spring >= season.autumn ? UI.pink : CAR.amber);
        petals.position.set(camera.position.x, camera.position.y - 6, camera.position.z);
        for (let i = 0; i < PETALS.count; i++) {
          let y = petalPos[i * 3 + 1] - dt * PETALS.fall * (0.6 + (i % 5) * 0.2);
          if (y < 0) y += PETALS.box[1];
          petalPos[i * 3 + 1] = y;
          petalPos[i * 3] += Math.sin(time * 1.3 + i) * dt * PETALS.sway;
        }
        petalGeo.attributes.position.needsUpdate = true;
      }
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
      lineMat.opacity = reduceMotion ? 0 : Math.min(0.5, Math.max(0, (w.manic - 0.2) * 1.2));
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
      // Same hues, more or less saturated: the numbers are the palette's phase settings.
      const sat = w.stable + w.manic * PHASES.manic.sat + w.depressive * PHASES.depressive.sat;
      const bright = 1 + w.manic * PHASES.manic.light - w.depressive * 0.04;
      // No filter at all on stable days, so nothing can soften the picture; the phase looks only shift colour (never blur).
      const plain = Math.abs(sat - 1) < 0.004 && Math.abs(bright - 1) < 0.004;
      canvas.style.filter = plain ? 'none' : `saturate(${sat.toFixed(3)}) brightness(${bright.toFixed(3)})`;
      fx.dataset.phase = episode;
      fx.classList.toggle('calm', reduceMotion);
    },
  };
}
