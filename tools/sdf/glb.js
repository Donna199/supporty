// glb.js: writes a mesh as a binary glTF file (.glb): one shared set of positions and normals,
// and one sub-mesh per colour (its own triangle list and a plain material that carries the colour).
// The colour the game fills in per driver is a material named "accent".
import { writeFileSync } from 'node:fs';

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function writeGlb(path, mesh, name) {
  const count = mesh.position.length / 3, wide = count > 65535;
  const pos = new Float32Array(mesh.position);
  const views = [{ data: pos, type: 'VEC3', comp: 5126, target: 34962, bounds: true }, { data: new Float32Array(mesh.normal), type: 'VEC3', comp: 5126, target: 34962 }];
  for (const g of mesh.groups) views.push({ data: wide ? new Uint32Array(g.index) : new Uint16Array(g.index), type: 'SCALAR', comp: wide ? 5125 : 5123, target: 34963 });
  const bufferViews = [], accessors = [], chunks = [];
  let offset = 0;
  for (const a of views) {
    const bytes = Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength), pad = (4 - (bytes.length % 4)) % 4;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: a.target });
    const acc = { bufferView: bufferViews.length - 1, componentType: a.comp, count: a.type === 'VEC3' ? a.data.length / 3 : a.data.length, type: a.type };
    if (a.bounds) {
      acc.min = [Infinity, Infinity, Infinity]; acc.max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < pos.length; i++) { acc.min[i % 3] = Math.min(acc.min[i % 3], pos[i]); acc.max[i % 3] = Math.max(acc.max[i % 3], pos[i]); }
    }
    accessors.push(acc);
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
  }
  const bin = Buffer.concat(chunks);
  const materials = mesh.groups.map(({ color }) => (color.accent
    ? { name: 'accent', extras: { accent: true }, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0 } }
    : { name: '#' + color.toString(16).padStart(6, '0'), extras: { hex: color },
        pbrMetallicRoughness: { baseColorFactor: [...[16, 8, 0].map((sh) => linear(((color >> sh) & 255) / 255)), 1], metallicFactor: 0 } }));
  const json = {
    asset: { version: '2.0', generator: 'Supporty tools/sdf' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: mesh.groups.map((g, i) => ({ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 + i, material: i })) }],
    materials, buffers: [{ byteLength: bin.length }], bufferViews, accessors,
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + text.length + bin.length, 8);
  jsonHead.writeUInt32LE(text.length, 0); jsonHead.writeUInt32LE(0x4e4f534a, 4);
  binHead.writeUInt32LE(bin.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, jsonHead, text, binHead, bin]));
}
