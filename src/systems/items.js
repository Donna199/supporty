// items.js: everything placed on the road (triggers, support, hazards, finish).
// Places each model at its road distance, animates it, and reports what happened
// as the kart passes: hit or missed (lane items), pull-in chance (stops beside the
// road), or nearby (roadside hazards). The DriveScreen decides what each event does.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { buildItem } from '../world/itemModels.js';
import { outline } from '../world/models.js';

const W = CONFIG.world;
const HALF = (W.lanes * W.laneWidth) / 2;
const ROADSIDE = HALF + W.shoulder + 2.8;

// How each item behaves when the kart reaches it.
const KIND = {
  allNighter: 'lane', redEye: 'lane', trophy: 'lane', scheduleChaos: 'lane', loss: 'lane', criticism: 'lane', stigmaBillboard: 'lane',
  supportive: 'lane', notAlone: 'lane', coin: 'lane', medCheckpoint: 'lane', routineCheckpoint: 'lane', cliffRamp: 'lane', spendDetour: 'lane', mud: 'lane',
  restStop: 'pull', therapyPit: 'pull', familyPit: 'pull',
  billboardPull: 'roadside', racingSigns: 'roadside', fogFork: 'roadside', harshSigns: 'roadside',
  finish: 'finish',
};
export const laneOf = (x) => Math.max(-1, Math.min(1, Math.round(x / W.laneWidth)));

export class Items {
  constructor(scene, road) {
    this.scene = scene;
    this.road = road;
    this.list = [];
    this.f = { pos: new THREE.Vector3(), fwd: new THREE.Vector3(), right: new THREE.Vector3() };
  }

  /** Place an item at road distance s. lane: -1/0/1, side: -1/+1 for roadside items, span: fills all lanes. */
  spawn(id, { s, lane = 0, side = 1, span = false, highlight = false }) {
    const kind = KIND[id];
    const group = outline(buildItem(id, { span }));
    const lateral = span || kind === 'finish' ? 0 : kind === 'pull' ? ROADSIDE + 0.8 : kind === 'roadside' ? side * ROADSIDE : lane * W.laneWidth;
    this.road.frameAt(s, this.f);
    group.position.copy(this.f.pos).addScaledVector(this.f.right, lateral);
    group.lookAt(group.position.clone().add(this.f.fwd));
    if (highlight) group.add(highlightRing());
    this.scene.add(group);
    const item = { id, kind, s, lane, side: kind === 'pull' ? 1 : side, span, group, done: false, pulled: false, age: Math.random() * 10, pop: 0 };
    this.list.push(item);
    return item;
  }

  /** Returns events: {type:'hit'|'miss'|'near'|'pullable'|'finish', item}. `dull`: coins turn grey (depressive). */
  update(dt, car, dull = false) {
    const events = [];
    const carLane = laneOf(car.x);
    for (const it of this.list) {
      it.age += dt;
      if (it.id === 'coin' && !it.done) it.group.userData.setDull(dull);
      const d = it.s - car.s; // metres ahead of the kart
      it.group.userData.spin?.(it.age);
      it.group.userData.approach?.(d);
      if (it.pop > 0) { // knocked aside: a soft hop and shrink, never a crash
        it.pop += dt;
        const k = Math.min(1, it.pop / 0.5);
        it.group.scale.setScalar(Math.max(0.01, 1 - k));
        it.group.position.y = Math.sin(k * Math.PI) * 1.5;
      }
      if (it.done) continue;
      if (it.kind === 'lane' && d <= 0) {
        it.done = true;
        const hit = it.span || carLane === it.lane;
        events.push({ type: hit ? 'hit' : 'miss', item: it });
        if (hit) it.pop = 0.001;
      } else if (it.kind === 'pull') {
        const [from, to] = CONFIG.pullWindow;
        if (d <= -from && d >= -to) events.push({ type: 'pullable', item: it, inLane: carLane === 1 });
        if (d < -to) it.done = true;
      } else if (it.kind === 'roadside' && d < 22) {
        it.done = true;
        events.push({ type: 'near', item: it });
      } else if (it.kind === 'finish' && d <= 0) {
        it.done = true;
        events.push({ type: 'finish', item: it });
      }
    }
    // Remove items well behind the kart.
    this.list = this.list.filter((it) => {
      if (it.s - car.s > -30) return true;
      this.scene.remove(it.group);
      return false;
    });
    return events;
  }

  clear() {
    for (const it of this.list) this.scene.remove(it.group);
    this.list = [];
  }
}

// A soft yellow ring that marks a trigger early (after a therapy pit stop).
function highlightRing() {
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.0, 24), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  return ring;
}
