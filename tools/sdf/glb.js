// glb.js: writes one mesh as a binary glTF file (.glb): positions, normals, vertex colours,
// an "_ACCENT" value per vertex (parts the game recolours per driver) and the triangle list.
import { writeFileSync } from 'node:fs';

export function writeGlb(path, mesh, name) {
  const count = mesh.position.length / 3;
  const index = count > 65535 ? new Uint32Array(mesh.index) : new Uint16Array(mesh.index);
  const arrays = [
    { data: new Float32Array(mesh.position), type: 'VEC3', comp: 5126, target: 34962, bounds: true },
    { data: new Float32Array(mesh.normal), type: 'VEC3', comp: 5126, target: 34962 },
    { data: new Float32Array(mesh.color), type: 'VEC3', comp: 5126, target: 34962 },
    { data: new Float32Array(mesh.accent), type: 'SCALAR', comp: 5126, target: 34962 },
    { data: index, type: 'SCALAR', comp: count > 65535 ? 5125 : 5123, target: 34963 },
  ];
  const bufferViews = [], accessors = [], chunks = [];
  let offset = 0;
  for (const a of arrays) {
    const bytes = Buffer.from(a.data.buffer, a.data.byteOffset, a.data.byteLength);
    const pad = (4 - (bytes.length % 4)) % 4;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target: a.target });
    const acc = { bufferView: bufferViews.length - 1, componentType: a.comp, count: a.type === 'VEC3' ? a.data.length / 3 : a.data.length, type: a.type };
    if (a.bounds) {
      acc.min = [0, 1, 2].map((k) => Math.min(...Array.from({ length: count }, (_, i) => a.data[i * 3 + k])));
      acc.max = [0, 1, 2].map((k) => Math.max(...Array.from({ length: count }, (_, i) => a.data[i * 3 + k])));
    }
    accessors.push(acc);
    chunks.push(bytes, Buffer.alloc(pad));
    offset += bytes.length + pad;
  }
  const bin = Buffer.concat(chunks);
  const json = {
    asset: { version: '2.0', generator: 'Supporty tools/sdf' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, COLOR_0: 2, _ACCENT: 3 }, indices: 4 }] }],
    buffers: [{ byteLength: bin.length }], bufferViews, accessors,
  };
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12), jsonHead = Buffer.alloc(8), binHead = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + text.length + bin.length, 8);
  jsonHead.writeUInt32LE(text.length, 0); jsonHead.writeUInt32LE(0x4e4f534a, 4);
  binHead.writeUInt32LE(bin.length, 0); binHead.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, jsonHead, text, binHead, bin]));
}
