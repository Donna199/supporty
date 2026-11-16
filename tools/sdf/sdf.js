// sdf.js: signed distance functions. Each returns how far point p = [x, y, z] is from a shape's
// surface (negative inside). Shapes are joined with smin (smooth union) into one seamless surface.
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export function sphere(p, c, r) { return Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) - r; }

/** Ellipsoid with radii r = [rx, ry, rz] (a close approximation of the true distance). */
export function ellipsoid(p, c, r) {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  const k0 = Math.hypot(x / r[0], y / r[1], z / r[2]);
  const k1 = Math.hypot(x / (r[0] * r[0]), y / (r[1] * r[1]), z / (r[2] * r[2]));
  return k1 < 1e-9 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1)) / k1;
}

/** Box with half-sizes h and rounded corners of radius r. */
export function roundBox(p, c, h, r) {
  const x = Math.abs(p[0] - c[0]) - h[0] + r, y = Math.abs(p[1] - c[1]) - h[1] + r, z = Math.abs(p[2] - c[2]) - h[2] + r;
  return Math.hypot(Math.max(x, 0), Math.max(y, 0), Math.max(z, 0)) + Math.min(Math.max(x, y, z), 0) - r;
}

/** Capsule from a to b. The radius can change along it (ra at a, rb at b). */
export function capsule(p, a, b, ra, rb = ra) {
  const px = p[0] - a[0], py = p[1] - a[1], pz = p[2] - a[2];
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const t = clamp((px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz));
  return Math.hypot(px - bx * t, py - by * t, pz - bz * t) - (ra + (rb - ra) * t);
}

/** Ring lying in the XY plane (its axis is z). Use `local` to tilt it. */
export function torus(p, c, R, r) {
  const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  return Math.hypot(Math.hypot(x, y) - R, z) - r;
}

/** Cylinder along the x axis with rounded rims. */
export function cylinderX(p, c, r, half, round = 0) {
  const a = Math.hypot(p[1] - c[1], p[2] - c[2]) - r + round, b = Math.abs(p[0] - c[0]) - half + round;
  return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - round;
}

/** Cylinder along the y axis with rounded rims. */
export function cylinderY(p, c, r, half, round = 0) {
  const a = Math.hypot(p[0] - c[0], p[2] - c[2]) - r + round, b = Math.abs(p[1] - c[1]) - half + round;
  return Math.min(Math.max(a, b), 0) + Math.hypot(Math.max(a, 0), Math.max(b, 0)) - round;
}

/** p as seen from a shape centred at c and rotated by rx, then rz (radians). Pass [0,0,0] as the shape's centre. */
export function local(p, c, rx = 0, rz = 0) {
  let x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
  if (rz) { const co = Math.cos(-rz), s = Math.sin(-rz); [x, y] = [x * co - y * s, x * s + y * co]; }
  if (rx) { const co = Math.cos(-rx), s = Math.sin(-rx); [y, z] = [y * co - z * s, y * s + z * co]; }
  return [x, y, z];
}

/** Smooth union: like min(a, b) but with a soft blend of size k where the shapes meet. */
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** Smooth intersection. */
export const smax = (a, b, k) => -smin(-a, -b, k);
/** Smoothly carve shape b out of shape a. */
export const carve = (a, b, k) => smax(a, -b, k);
/** The same shape on both sides of the car or body: f(side) with side = -1, 1. */
export const both = (f) => Math.min(f(-1), f(1));

export const ACCENT = { accent: true }; // a colour filled in by the game (the driver's colour)

/**
 * A model is { cell, min, max, k, outline, parts: [{ color, k, d(p), regions: [{ color, mask(p) }] }] }.
 * field: the whole surface (all parts joined). shade: the colour at p and how near p is to a colour border.
 */
export function field(model, p) {
  let d = Infinity;
  for (const part of model.parts) d = smin(d, part.d(p), part.k ?? model.k);
  return d;
}
export function shade(model, p) {
  let best = null, bd = Infinity;
  const ds = model.parts.map((part) => part.d(p));
  ds.forEach((d, i) => { if (d < bd) { bd = d; best = model.parts[i]; } });
  let color = best.color, other = color, edge = Infinity;
  ds.forEach((d, i) => { const c = model.parts[i].color; if (c !== best.color && d - bd < edge) { edge = d - bd; other = c; } });
  for (const region of best.regions ?? []) {
    const m = region.mask(p);
    if (Math.abs(m) < edge) { edge = Math.abs(m); other = m < 0 ? color : region.color; }
    if (m < 0) color = region.color;
  }
  return { color, other, edge };
}
