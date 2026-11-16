// build-models.js: meshes the SDF models once and saves them to assets/generated/*.glb.
// Run with `npm run models` after changing anything in tools/sdf/ or src/world/dims.js.
import { mkdirSync } from 'node:fs';
import { buildMesh } from './sdf/mesher.js';
import { writeGlb } from './sdf/glb.js';
import { girl, boy } from './sdf/drivers.js';
import { kart, wheel } from './sdf/kart.js';
import { HEAD } from '../src/world/dims.js';
import { WORLD } from '../src/world/palette.js';

const OUT = new URL('../assets/generated/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const skin = [16, 8, 0].map((s) => linear(((WORLD.skin >> s) & 255) / 255));

/** Hair check: no skin-coloured vertex on the top, back or sides of the head. */
function hairGaps(m) {
  let gaps = 0;
  for (let i = 0; i < m.position.length; i += 3) {
    const x = m.position[i], y = m.position[i + 1] - HEAD.y, z = m.position[i + 2];
    const onHead = Math.abs(x) < 0.72 && Math.abs(y) < 0.7 && Math.abs(z) < 0.7;
    const covered = y > 0.45 || (z < -0.3 && y > -0.3) || (Math.abs(x) > 0.55 && y > 0.12 && z < 0.3);
    const isSkin = Math.hypot(m.color[i] - skin[0], m.color[i + 1] - skin[1], m.color[i + 2] - skin[2]) < 0.02;
    if (onHead && covered && isSkin) gaps++;
  }
  return gaps;
}

let failed = false;
for (const model of [girl, boy, kart, wheel]) {
  const t = Date.now(), m = buildMesh(model);
  writeGlb(`${OUT}${model.name}.glb`, m, model.name);
  let note = '';
  if (model === girl || model === boy) { const g = hairGaps(m); note = g ? `  HAIR GAPS: ${g}` : '  hair: no gaps'; failed ||= g > 0; }
  console.log(`${model.name}.glb  ${m.index.length / 3} triangles, ${m.position.length / 3} vertices, ${Date.now() - t} ms${note}`);
}
if (failed) { console.error('Hair coverage check failed.'); process.exit(1); }
