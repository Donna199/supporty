// guideArrow.js: the bouncing yellow arrow that points down at an item during the
// January practice month. Built from a cone and a rounded shaft, like the other models.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { cone, cyl } from './models.js';

const P = CONFIG.practice;

/** Adds a bouncing arrow above `item.group`. Returns a function that removes it. */
export function addGuideArrow(item) {
  const box = new THREE.Box3().setFromObject(item.group);
  const top = box.max.y - item.group.position.y;
  const arrow = new THREE.Group();
  const head = cone(0.75, 1.1, P.arrowColor, 0, 0.55, 0, 20);
  head.rotation.x = Math.PI; // point down
  arrow.add(head, cyl(0.28, 0.28, 1.2, P.arrowColor, 0, 1.6, 0));
  arrow.scale.setScalar(1 / Math.max(0.01, item.group.scale.x));
  item.group.add(arrow);
  const baseY = top + P.arrowGap;
  let t = 0;
  item.group.userData.arrowTick = (dt) => {
    t += dt;
    arrow.position.y = baseY + Math.abs(Math.sin(t * P.arrowBounceHz * Math.PI)) * P.arrowBounce;
    arrow.rotation.y += dt * 1.5;
  };
  return () => { arrow.removeFromParent(); delete item.group.userData.arrowTick; };
}
