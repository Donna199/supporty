// camera.js: chase camera that sits behind and slightly above the kart and
// smoothly follows the road's curves. FOV and height blend toward each phase's
// settings (wider in a manic episode, lower in a depressive episode).
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

export class ChaseCamera {
  constructor(camera) {
    this.cam = camera;
    this.params = { ...CONFIG.camera.stable };
    this.target = { ...CONFIG.camera.stable };
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.snap = true;
    this._want = new THREE.Vector3();
    this._lookWant = new THREE.Vector3();
  }

  /** Blend between phase camera settings. weights: { stable, manic, depressive } summing to 1. */
  setBlend(weights) {
    for (const key of ['fov', 'height', 'distance', 'lookAhead']) {
      this.target[key] = Object.entries(weights).reduce((sum, [phase, w]) => sum + CONFIG.camera[phase][key] * w, 0);
    }
  }

  /** Chase view: behind the kart, following the road direction. */
  follow(dt, carPos, fwd) {
    const p = this.params;
    const k = 1 - Math.exp(-2.5 * dt);
    for (const key of Object.keys(this.target)) p[key] += (this.target[key] - p[key]) * k;
    this._want.copy(carPos).addScaledVector(fwd, -p.distance).addScaledVector(UP, p.height);
    this._lookWant.copy(carPos).addScaledVector(fwd, p.lookAhead).addScaledVector(UP, 1.4);
    this._move(dt);
    if (Math.abs(this.cam.fov - p.fov) > 0.01) {
      this.cam.fov = p.fov;
      this.cam.updateProjectionMatrix();
    }
  }

  /** Title-screen view: in front of the kart at three-quarters, showing the driver's face. */
  showcase(dt, carPos, fwd, right) {
    this._want.copy(carPos).addScaledVector(fwd, 6.5).addScaledVector(right, -3.6).addScaledVector(UP, 2.6);
    this._lookWant.copy(carPos).addScaledVector(right, -1.1).addScaledVector(UP, 1.6);
    this._move(dt);
    if (this.cam.fov !== 50) { this.cam.fov = 50; this.cam.updateProjectionMatrix(); }
  }

  /** End-screen view: pull back and up so the road keeps going ahead. */
  pullBack(dt, carPos, fwd) {
    this._want.copy(carPos).addScaledVector(fwd, -22).addScaledVector(UP, 14);
    this._lookWant.copy(carPos).addScaledVector(fwd, 30);
    this._move(dt, 1.2);
  }

  _move(dt, speed = CONFIG.camera.followLerp) {
    if (this.snap) {
      this.pos.copy(this._want);
      this.look.copy(this._lookWant);
      this.snap = false;
    }
    const k = 1 - Math.exp(-speed * dt);
    this.pos.lerp(this._want, k);
    this.look.lerp(this._lookWant, k);
    this.cam.position.copy(this.pos);
    this.cam.lookAt(this.look);
  }
}
