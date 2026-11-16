// check-shaders.js: runs before every build (`npm run build`). The game uses only Three.js's own
// tested materials, so no shader can fail to compile. This guard keeps it that way: if anyone adds
// hand-written shader code, the build stops here with a clear error instead of shipping a game that
// may show blank objects on some computers. (At run time, main.js also reports any shader error.)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../src/', import.meta.url).pathname;
const BANNED = [/ShaderMaterial/, /onBeforeCompile/, /gl_FragColor|gl_Position/, /#include\s*</, /\.glsl['"]/];
const files = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });

const problems = [];
for (const file of files(ROOT)) {
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (BANNED.some((re) => re.test(line))) problems.push(`${file.replace(ROOT, 'src/')}:${i + 1}  ${line.trim().slice(0, 90)}`);
  });
}
if (problems.length) {
  console.error('\nBUILD STOPPED: hand-written shader code found. It cannot be compile-checked at build time.\n' +
    'Use a built-in Three.js material instead, or add a real compile test before removing this guard.\n\n' + problems.join('\n') + '\n');
  process.exit(1);
}
console.log('Shader check: no hand-written shaders (built-in Three.js materials only).');
