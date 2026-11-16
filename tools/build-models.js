// build-models.js: meshes the SDF models once and saves them to assets/generated/.
// Each model is baked twice: <name>.glb (fine grid, for Graphics: High) and <name>-low.glb
// (the coarser grid, for Graphics: Low and for the outline shells).
// Run with `npm run models` after changing anything in tools/sdf/ or src/world/dims.js.
import { mkdirSync } from 'node:fs';
import { buildMesh } from './sdf/mesher.js';
import { writeGlb } from './sdf/glb.js';
import { girl, boy } from './sdf/drivers.js';
import { kart, wheel } from './sdf/kart.js';
import { HEAD } from '../src/world/dims.js';
import { WORLD } from '../src/world/palette.js';

const OUT = new URL('../assets/generated/', import.meta.url).pathname;
const DETAIL = { girl: 2, boy: 2, kart: 2, wheel: 1.6 }; // how many times finer the High grid is than the Low one
mkdirSync(OUT, { recursive: true });

/** Hair check: no skin-coloured triangle on the top, back or sides of the head. */
function hairGaps(m) {
  let gaps = 0;
  for (const i of m.groups.find((g) => g.color === WORLD.skin)?.index ?? []) {
    const x = m.position[i * 3], y = m.position[i * 3 + 1] - HEAD.y, z = m.position[i * 3 + 2];
    const onHead = Math.abs(x) < 0.72 && Math.abs(y) < 0.7 && Math.abs(z) < 0.7;
    if (onHead && (y > 0.45 || (z < -0.3 && y > -0.3) || (Math.abs(x) > 0.55 && y > 0.12 && z < 0.3))) gaps++;
  }
  return gaps;
}

let failed = false;
for (const model of [girl, boy, kart, wheel]) {
  for (const [suffix, cell] of [['', model.cell / DETAIL[model.name]], ['-low', model.cell]]) {
    const t = Date.now(), m = buildMesh(model, cell);
    writeGlb(`${OUT}${model.name}${suffix}.glb`, m, model.name);
    let note = '';
    if (model === girl || model === boy) { const g = hairGaps(m); note = g ? `  HAIR GAPS: ${g}` : '  hair: no gaps'; failed ||= g > 0; }
    const tris = m.groups.reduce((n, g) => n + g.index.length / 3, 0);
    console.log(`${model.name}${suffix}.glb  ${tris} triangles, ${m.position.length / 3} vertices, ${m.groups.length} colours, ${Date.now() - t} ms${note}`);
  }
}
if (failed) { console.error('Hair coverage check failed.'); process.exit(1); }
