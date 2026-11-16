// mesher.js: turns an SDF model into a triangle mesh with surface nets (one smooth vertex per
// grid cell the surface passes through), then:
// - slides every vertex exactly onto the surface and takes its normal from the SDF (smooth shading),
// - slides vertices near a colour border onto the border, so borders are clean lines,
// - gives every triangle ONE colour and returns a separate triangle list per colour (sharp borders).
import { field, shade, clamp } from './sdf.js';

const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

function surfaceNets(f, min, max, h) {
  const n = [0, 1, 2].map((i) => Math.ceil((max[i] - min[i]) / h) + 1);
  const [nx, ny, nz] = n, id = (i, j, k) => i + nx * (j + ny * k);
  const val = new Float32Array(nx * ny * nz);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[id(i, j, k)] = f([min[0] + i * h, min[1] + j * h, min[2] + k * h]);
  const cellVert = new Int32Array(nx * ny * nz).fill(-1), verts = [];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v = CORNERS.map(([a, b, c]) => val[id(i + a, j + b, k + c)]);
    if (v.every((x) => x < 0) || v.every((x) => x >= 0)) continue;
    let x = 0, y = 0, z = 0, count = 0;
    for (const [a, b] of EDGES) {
      if ((v[a] < 0) === (v[b] < 0)) continue;
      const t = v[a] / (v[a] - v[b]);
      x += CORNERS[a][0] + (CORNERS[b][0] - CORNERS[a][0]) * t;
      y += CORNERS[a][1] + (CORNERS[b][1] - CORNERS[a][1]) * t;
      z += CORNERS[a][2] + (CORNERS[b][2] - CORNERS[a][2]) * t;
      count++;
    }
    cellVert[id(i, j, k)] = verts.length;
    verts.push([min[0] + (i + x / count) * h, min[1] + (j + y / count) * h, min[2] + (k + z / count) * h]);
  }
  // One quad for every grid edge that crosses the surface, joining the four cells around that edge.
  const quads = [];
  const quad = (...cells) => { const q = cells.map((c) => cellVert[c]); if (q.every((x) => x >= 0)) quads.push(q); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const s = val[id(i, j, k)] < 0;
    if (s !== val[id(i + 1, j, k)] < 0) quad(id(i, j - 1, k - 1), id(i, j, k - 1), id(i, j, k), id(i, j - 1, k));
    if (s !== val[id(i, j + 1, k)] < 0) quad(id(i - 1, j, k - 1), id(i, j, k - 1), id(i, j, k), id(i - 1, j, k));
    if (s !== val[id(i, j, k + 1)] < 0) quad(id(i - 1, j - 1, k), id(i, j - 1, k), id(i, j, k), id(i - 1, j, k));
  }
  return { verts, quads };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function gradient(f, p, e) {
  return [f([p[0] + e, p[1], p[2]]) - f([p[0] - e, p[1], p[2]]), f([p[0], p[1] + e, p[2]]) - f([p[0], p[1] - e, p[2]]), f([p[0], p[1], p[2] + e]) - f([p[0], p[1], p[2] - e])].map((v) => v / (2 * e));
}
/** Move p toward where g(p) = 0 (one Newton step, at most `limit` far). `flat` keeps the step along a surface. */
function step(g, p, e, limit, flat) {
  const v = g(p);
  let n = gradient(g, p, e);
  if (flat) { const k = dot(n, flat); n = n.map((c, i) => c - flat[i] * k); }
  const len2 = dot(n, n);
  if (len2 < 1e-10) return p;
  const s = clamp(v / len2, -limit / Math.sqrt(len2), limit / Math.sqrt(len2));
  return [p[0] - n[0] * s, p[1] - n[1] * s, p[2] - n[2] * s];
}
const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };

/**
 * Meshes a model with grid cells of size `cell`. Returns { position, normal, groups: [{ color, index }] }:
 * one shared set of vertices (normals straight from the SDF gradient, never from the triangles) and one
 * triangle list per colour. No colour is ever blended between vertices, so every border is a sharp line.
 */
export function buildMesh(model, cell = model.cell) {
  const h = cell, e = h * 0.2, f = (p) => field(model, p), edge = (p) => shade(model, p).edge;
  const { verts, quads } = surfaceNets(f, model.min, model.max, h);
  const position = [], normal = [], normals = [];
  verts.forEach((p0, i) => {
    let p = p0;
    for (let n = 0; n < 3; n++) p = step(f, p, e, h);
    if (edge(p) < h * 0.8) {
      // Near a colour border: slide along the surface onto it (but never far from where the mesher put it),
      // so the border runs along triangle edges instead of zig-zagging through them.
      let q = p;
      for (let n = 0; n < 5; n++) { q = step(edge, q, e * 0.5, h * 0.3, unit(gradient(f, q, e))); q = step(f, q, e, h); }
      if (Math.hypot(...sub(q, p0)) < h * 0.9 && Math.abs(f(q)) < h * 0.05) p = q;
    }
    verts[i] = p;
    normals[i] = unit(gradient(f, p, e));
    position.push(...p);
    normal.push(...normals[i]);
  });
  // Each triangle belongs to exactly one colour: the colour of the nearest SDF part at its centre.
  const groups = new Map();
  for (const q of quads) {
    const d02 = Math.hypot(...sub(verts[q[0]], verts[q[2]])), d13 = Math.hypot(...sub(verts[q[1]], verts[q[3]]));
    const tris = d02 <= d13 ? [[q[0], q[1], q[2]], [q[0], q[2], q[3]]] : [[q[0], q[1], q[3]], [q[1], q[2], q[3]]];
    for (const [a, b, c] of tris) {
      const n = cross(sub(verts[b], verts[a]), sub(verts[c], verts[a]));
      if (Math.hypot(...n) < 1e-10) continue;
      const mid = [0, 1, 2].map((k) => (verts[a][k] + verts[b][k] + verts[c][k]) / 3);
      const avg = [0, 1, 2].map((k) => normals[a][k] + normals[b][k] + normals[c][k]);
      if (model.cull?.(mid, unit(avg))) continue;
      const color = shade(model, step(f, mid, e, h)).color;
      if (!groups.has(color)) groups.set(color, { color, index: [] });
      groups.get(color).index.push(...(dot(n, avg) >= 0 ? [a, b, c] : [a, c, b]));
    }
  }
  return { position, normal, groups: [...groups.values()] };
}
