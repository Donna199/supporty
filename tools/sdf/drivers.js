// drivers.js: the two drivers as SDF models, from the character sketch (references/Supporty-character.png).
// Each is ONE seamless surface, seated, hands on the steering wheel. Hair is part of the head's shape:
// a shell around the head with a window carved out for the face, so it can never leave a gap.
import { CHARACTER as CH, WORLD as W } from '../../src/world/palette.js';
import { HEAD, SEAT, grip } from '../../src/world/dims.js';
import { sphere, ellipsoid, roundBox, capsule, cylinderY, local, smin, smax, carve, both, clamp } from './sdf.js';

const HC = [0, HEAD.y, 0], [HX, HY, HZ] = HEAD.half;
const hand = (s) => { const g = grip(s); return [g[0] - SEAT[0], g[1] - SEAT[1], g[2] - SEAT[2]]; };
const up = (dy, x = 0, z = 0) => [x, HEAD.y + dy, z]; // a point relative to the head's centre

// ----- Shared by both drivers -----
const head = (p) => smin(
  roundBox(p, HC, HEAD.half, HEAD.round),
  both((s) => ellipsoid(p, up(-0.1, s * 0.67, 0.12), [0.1, 0.15, 0.11])), 0.03); // ears
const earInside = (p) => both((s) => ellipsoid(p, up(-0.1, s * 0.735, 0.2), [0.03, 0.075, 0.03]));
const neck = (p) => capsule(p, [0, 0.66, 0], [0, 0.82, 0], 0.17);
/** An arm from the shoulder, through a slightly bent elbow, to the hand on the wheel. */
const arm = (p, s, r, sx) => {
  const sh = [s * sx, 0.55, 0.04], el = [s * (sx + 0.04), 0.33, 0.36], g = hand(s);
  return smin(capsule(p, sh, el, r), capsule(p, el, g, r, r * 0.92), 0.05);
};
const hands = (p) => both((s) => sphere(p, hand(s), 0.105));
const legs = (p, r) => both((s) => capsule(p, [s * 0.2, -0.16, 0.3], [s * 0.2, -0.2, 0.86], r));
const base = { cell: 0.05, k: 0.03, min: [-0.92, -0.42, -0.78], max: [0.92, 2.36, 1.1] };

// ----- Shally: long blonde hair with a centre parting, pink bow, green T-shirt, dark skirt -----
// The face window: everything in front and below, up to a parting that peaks in the middle of the forehead,
// plus a round opening for each ear.
function girlWindow(p) {
  const front = roundBox(p, up(-0.42, 0, 0.62), [0.5, 0.82, 0.66], 0.12);
  const parting = (p[1] - (HEAD.y + 0.37 - 0.52 * Math.abs(p[0]))) / 1.13;
  return Math.min(smax(front, parting, 0.07), both((s) => ellipsoid(p, up(-0.1, s * 0.74, 0.13), [0.2, 0.21, 0.17])));
}
function girlHair(p) {
  const shell = roundBox(p, HC, [HX + 0.07, HY + 0.07, HZ + 0.07], HEAD.round + 0.05);
  // Long hair: five soft locks down the back, the middle ones longest, so the hem is scalloped and the shoulders show.
  let locks = Infinity;
  for (const [x, end] of [[-0.46, 0.66], [-0.23, 0.5], [0, 0.42], [0.23, 0.5], [0.46, 0.66]]) {
    locks = smin(locks, capsule(p, [x, HEAD.y + 0.1, -0.4], [x * 0.9, end, -0.44], 0.2, 0.13), 0.05);
  }
  let d = smin(shell, locks, 0.12);
  d = carve(d, capsule(p, [0, HEAD.y + HY + 0.1, 0.34], [0, HEAD.y + HY + 0.1, -0.5], 0.035), 0.06); // centre parting on top
  return carve(d, girlWindow(p), 0.06);
}
const bowAt = up(HY + 0.22, 0.04, 0.05);
const bowLoops = (p) => both((s) => ellipsoid(local(p, [bowAt[0] + s * 0.28, bowAt[1] + 0.04, bowAt[2]], 0, s * 0.3), [0, 0, 0], [0.26, 0.18, 0.12]));
const bowKnot = (p) => ellipsoid(p, [bowAt[0], bowAt[1] - 0.02, bowAt[2]], [0.11, 0.12, 0.12]);

export const girl = {
  ...base, name: 'girl',
  parts: [
    { color: W.skin, d: (p) => Math.min(neck(p), both((s) => arm(p, s, 0.08, 0.45)), hands(p), legs(p, 0.095)) },
    { color: CH.girlShirt, d: (p) => smin(roundBox(p, [0, 0.36, 0], [0.4, 0.36, 0.25], 0.17), both((s) => sphere(p, [s * 0.44, 0.56, 0.03], 0.17)), 0.08),
      regions: [{ color: W.skin, mask: (p) => ellipsoid(p, [0, 0.8, 0.2], [0.19, 0.17, 0.2]) }] }, // neckline
    { color: CH.girlSkirt, d: (p) => roundBox(p, [0, -0.12, 0.2], [0.5, 0.15, 0.42], 0.14) },
    // Head and hair are one shape; the skin is the part of it inside the face window (a clean, exact border).
    { color: CH.girlHair, d: (p) => smin(head(p), girlHair(p), 0.03), k: 0.05, regions: [{ color: W.skin, mask: girlWindow }] },
    { color: CH.bow, d: bowLoops, k: 0.05, regions: [] },
    { color: CH.bowDark, d: bowKnot, k: 0.04 },
  ],
};

// ----- Brandon: short black hair, striped red cap, red jacket open over a white T-shirt, black pants -----
const CAP_Y = HEAD.y + 0.36;
function boyWindow(p) {
  const face = roundBox(p, up(-0.38, 0, 0.6), [0.46, 0.63, 0.62], 0.13);   // straight hairline with short sideburns
  const below = roundBox(p, up(-0.62, 0, 0.6), [0.9, 0.56, 0.64], 0.1);    // nothing below ear height at the front
  return Math.min(face, below);
}
function boyHair(p) {
  const shell = roundBox(p, HC, [HX + 0.06, HY + 0.06, HZ + 0.06], HEAD.round + 0.04);
  const nape = both((s) => sphere(p, up(-0.66, s * 0.66, -0.5), 0.25));       // rounded corners at the nape
  return carve(carve(shell, nape, 0.1), boyWindow(p), 0.06);
}
const capDome = (p) => smax(roundBox(p, [0, CAP_Y, 0], [0.73, 0.43, 0.69], 0.4), CAP_Y - 0.07 - p[1], 0.04);
const capBrim = (p) => cylinderY(local(p, [0.27, CAP_Y + 0.005, 0.6], 0.14, -0.06), [0, 0, 0], 0.44, 0.055, 0.05);
const capParts = (p) => Math.min(smin(capDome(p), capBrim(p), 0.05), sphere(p, [0, CAP_Y + 0.44, 0], 0.085));
/** Ten even cap stripes, a light one centred at the front (the same from either side). */
const capStripes = (p) => Math.max(-Math.cos(5 * Math.atan2(p[0], p[2])) * Math.hypot(p[0], p[2]) / 5, capDome(p) - capBrim(p), p[1] - CAP_Y - 0.4);

export const boy = {
  ...base, name: 'boy',
  parts: [
    { color: W.skin, d: (p) => Math.min(neck(p), hands(p)) },
    { color: CH.boyJacket, d: (p) => Math.min(
        smin(roundBox(p, [0, 0.37, 0], [0.42, 0.37, 0.26], 0.17), cylinderY(p, [0, 0.76, 0], 0.26, 0.06, 0.05), 0.05), // body and collar
        both((s) => arm(p, s, 0.1, 0.46))),
      regions: [{ color: CH.white, mask: (p) => roundBox(p, [0, 0.36, 0.3], [0.1, 0.42, 0.2], 0.04) }] },              // white T-shirt
    { color: CH.boyPants, d: (p) => Math.min(roundBox(p, [0, -0.12, 0.18], [0.42, 0.14, 0.4], 0.13), legs(p, 0.105)),
      regions: [{ color: CH.white, mask: (p) => both((s) => roundBox(p, [s * 0.44, -0.12, 0.3], [0.05, 0.05, 0.7], 0.03)) }] }, // side stripe
    { color: CH.boyHair, d: (p) => smin(head(p), boyHair(p), 0.03), k: 0.05, regions: [{ color: W.skin, mask: boyWindow }, { color: CH.earShade, mask: earInside }] },
    { color: CH.boyCap, d: capParts, k: 0.03, regions: [{ color: CH.boyCapLight, mask: capStripes },
      { color: CH.boyHair, mask: (p) => ellipsoid(p, [0, CAP_Y - 0.1, -0.74], [0.2, 0.2, 0.2]) }] }, // the opening above the strap at the back
  ],
};

/** Colours that must never show on the top, back or sides of the head (a gap in the hair). */
export const SKIN = W.skin;
