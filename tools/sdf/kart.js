// kart.js: the kart and its wheel as SDF models. The kart is ONE seamless toy-like surface:
// rounded hull, fenders, bumpers, lights, seat, steering wheel and windshield frame, all blended.
// (Wheels are a second small model so they can spin; the glass is added in the game because it is see-through.)
import { WORLD as W, CAR } from '../../src/world/palette.js';
import { STEER, WHEEL, SCREEN, PLATE } from '../../src/world/dims.js';
import { sphere, ellipsoid, roundBox, capsule, torus, cylinderX, local, smin, smax, carve, both, ACCENT } from './sdf.js';

const NOSE = 1.86, TAIL = -1.78;
const wells = (p, grow = 0) => Math.min(...WHEEL.z.map((z) => both((s) => cylinderX(p, [s * (WHEEL.x + 0.02), WHEEL.r, z], WHEEL.r + 0.05 + grow, 0.26 + grow, 0.05))));
const cockpit = (p, grow = 0) => roundBox(p, [0, 1.12, -0.2], [0.64 + grow, 0.38 + grow, 0.8 + grow], 0.17);

function body(p) {
  // A long rounded hull, a taller cabin section, and a crowned nose (one smooth convex bonnet).
  const hull = roundBox(p, [0, 0.68, -0.3], [0.84, 0.34, 1.48], 0.3);
  const cabin = roundBox(p, [0, 0.8, -0.2], [0.88, 0.32, 0.98], 0.26);
  const nose = ellipsoid(p, [0, 0.66, 0.98], [0.86, 0.37, 0.89]);
  let d = smin(smin(hull, cabin, 0.22), nose, 0.3);
  // Round fenders over the wheels, then the wheel wells and the cockpit carved out.
  for (const z of WHEEL.z) d = smin(d, both((s) => ellipsoid(p, [s * 0.7, 0.6, z], [0.3, 0.43, 0.62])), 0.3);
  d = carve(d, wells(p), 0.05);
  d = carve(d, cockpit(p), 0.07);
  // Dashboard hump and wing mirrors.
  d = smin(d, roundBox(p, [0, 1.04, 0.64], [0.6, 0.12, 0.1], 0.09), 0.06);
  d = smin(d, both((s) => smin(ellipsoid(p, [s * 0.9, 1.3, 0.62], [0.11, 0.09, 0.07]), capsule(p, [s * 0.74, 1.12, 0.62], [s * 0.88, 1.28, 0.62], 0.05), 0.03)), 0.04);
  return d;
}

const frame = (p) => {
  const S = SCREEN, top = (s) => [s * S.topX, S.topY, S.topZ];
  return Math.min(both((s) => capsule(p, [s * S.baseX, S.baseY - 0.06, S.baseZ], top(s), S.post)), capsule(p, top(-1), top(1), S.post));
};
const steering = (p) => smin(
  torus(local(p, STEER.pos, STEER.tilt), [0, 0, 0], STEER.r, STEER.tube),
  capsule(p, [0, 1.02, 0.66], STEER.pos, 0.055), 0.04);

export const kart = {
  name: 'kart', cell: 0.056, k: 0.03, min: [-1.16, 0.24, -2.0], max: [1.16, 1.8, 2.08],
  // The underside is never seen.
  cull: (mid, n) => mid[1] < 0.4 && n[1] < -0.6,
  parts: [
    { color: W.kart, d: body, regions: [
      { color: ACCENT, mask: (p) => both((s) => roundBox(p, [s * 0.9, 0.9, -0.12], [0.2, 0.065, 1.1], 0.06)) },       // side stripe
      { color: CAR.wheelWell, mask: (p) => wells(p, 0.015) },
      { color: CAR.cabin, mask: (p) => Math.min(cockpit(p, 0.02), roundBox(p, [0, 1.04, 0.64], [0.6, 0.13, 0.11], 0.09)) },
      { color: CAR.trimDark, mask: (p) => roundBox(p, [0, 0.7, NOSE], [0.36, 0.1, 0.12], 0.09) },                     // grille
      { color: CAR.plate, mask: (p) => roundBox(p, [0, PLATE.y, TAIL], [0.26, 0.12, 0.12], 0.05) },                   // number plate
    ] },
    { color: W.kartTrim, k: 0.025, d: (p) => Math.min(
        capsule(p, [-0.42, 0.46, NOSE - 0.03], [0.42, 0.46, NOSE - 0.03], 0.1), both((s) => capsule(p, [s * 0.42, 0.46, NOSE - 0.03], [s * 0.82, 0.46, 1.5], 0.1)), // front bumper, wrapped round the nose
        capsule(p, [-0.7, 0.46, TAIL + 0.02], [0.7, 0.46, TAIL + 0.02], 0.1),
        frame(p),
        smin(roundBox(p, [0, 1.2, -1.08], [0.46, 0.44, 0.1], 0.09), roundBox(p, [0, 0.8, -0.42], [0.5, 0.1, 0.5], 0.08), 0.06)) },                // seat
    { color: CAR.lamp, k: 0.02, d: (p) => both((s) => sphere(p, [s * 0.58, 0.76, 1.6], 0.17)) },
    { color: CAR.tailLamp, k: 0.02, d: (p) => both((s) => ellipsoid(p, [s * 0.56, 0.8, TAIL + 0.04], [0.17, 0.12, 0.1])) },
    { color: ACCENT, k: 0.04, d: (p) => capsule(p, [-0.6, 1.03, -1.58], [0.6, 1.03, -1.58], 0.075) },                  // tail lip
    { color: CAR.trimDark, k: 0.03, d: (p) => Math.min(steering(p), capsule(p, [-0.6, 1.17, -1.22], [0.6, 1.17, -1.22], 0.12)) }, // steering wheel, folded soft-top
  ],
};

/** One wheel, centred on its axle (x). Only the outer half is kept; the game turns it round for the other side. */
const R = WHEEL.r, HW = WHEEL.halfWidth;
const dimples = (p) => Math.min(...[0, 1, 2, 3, 4].map((i) => sphere(p, [HW + 0.03, 0.15 * Math.cos(i * 1.2566), 0.15 * Math.sin(i * 1.2566)], 0.055)));
export const wheel = {
  name: 'wheel', cell: 0.046, k: 0.03, min: [-0.1, -0.5, -0.5], max: [0.3, 0.5, 0.5],
  cull: (mid) => mid[0] < -0.04,
  parts: [
    { color: W.tyre, d: (p) => cylinderX(p, [0, 0, 0], R, HW, 0.11) },
    { color: W.kartTrim, d: (p) => smin(cylinderX(p, [0, 0, 0], 0.27, HW + 0.025, 0.04), sphere(p, [HW - 0.02, 0, 0], 0.1), 0.03),
      regions: [{ color: CAR.wheelDish, mask: dimples }] },
  ],
};
