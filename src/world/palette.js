// palette.js: the single source of truth for every colour in Supporty.
// BASE colours are the game's current colours. Everything else is derived from them:
// - phases: stable (as is), manic (same hues, brighter and more saturated, warmer sky, neon accents),
//   depressive (same hues, desaturated, cooler, lower contrast; still soft, never dark).
// - seasons: a subtle tint on top (winter, spring, summer, autumn).
// Plain numbers and maths only (no Three.js), so the game, the CSS and build scripts can all use it.

// ---------- Base colours (0xRRGGBB) ----------
/** World colours. CONFIG.colors points here, so the keys must stay as they are. */
export const WORLD = {
  sky: 0xbfe3f2, skyManic: 0xffb3e6, skyDepressive: 0x8e9aa6, skyHorizon: 0xfbf1dc,
  grass: 0x9cc58a, grassDark: 0x84b276, hill: [0xa9cf8f, 0x93c17f, 0xb7d69a],
  road: 0x9a948c, roadEdge: 0xf6efe0, laneDash: 0xf6efe0, shoulder: 0x857f78,
  treeLeaf: [0x6fa36a, 0x7fb176, 0x5e9461], treeTrunk: 0x8a6a4f,
  fenceBrown: 0x5a2c1a, guardRed: 0xd23b3b, guardCream: 0xfbeedd,
  kart: 0x8ccfcb, kartTrim: 0xf6efe0, kartDark: 0x5f9c9a, kartAccentGirl: 0xf5a3c7, kartAccentBoy: 0xe57a72, tyre: 0x3c3a3a,
  skin: 0xfde4c5, blush: 0xf4a1a8, eyeWhite: 0xffffff, pupil: 0x3b1f17,
};

const CAR_AMBER = 0xf2a65a;
/** Character colours, from the two driver designs. */
export const CHARACTER = {
  girlHair: 0xe2c65a, girlShirt: 0x5cbf8f, girlSkirt: 0x4a4242, bow: 0xf59bc4, bowDark: 0xe27fae,
  boyHair: 0x2e2b2b, boyJacket: 0xa83a35, boyCap: 0xb83a3a, boyCapLight: 0xe0706f, boyPants: 0x2b2b2b,
  earShade: 0xd9a882, white: 0xffffff,
};
CHARACTER.boyBlush = mix(WORLD.blush, CAR_AMBER, 0.4); // Brandon's blush is peach in the sketch


/** Car details. */
export const CAR = {
  glass: 0xcfeaf5, chrome: 0xdfe3e6, lamp: 0xfff3c4, tailLamp: 0xe0524f, amber: CAR_AMBER,
  cabin: 0x4f8f8a, trimDark: 0x3a3534, wheelDish: 0x55504e, wheelWell: 0x2f2b2a, plate: 0xfffaf0,
};

/** Interface colours (the same values as the CSS tokens in style.css). */
export const UI = {
  white: 0xffffff, paper: 0xffffff, cream: 0xf6efe0, ink: 0x3b3433, inkSoft: 0x6d6460,
  sage: 0x7fae7a, btnGreen: 0x467f4d, red: 0xd23b3b, focus: 0xe08a00,
  teal: 0x8ccfcb, tealDeep: 0x4f8f8a, yellow: 0xffe9a8, mint: 0xa8e6cf, pink: 0xf5a3c7,
  stable: 0x6aa56a, manic: 0xd9479c, depressive: 0x5f7487,
  zoneLow: 0xc9d6e2, zoneStable: 0xcfe7c4, zoneHigh: 0xf8cfe6, // the three bands of the mood gauge
};

// ---------- How each phase and season changes a base colour ----------
// sat: saturation x; light: lightness +; contrast: 1 = unchanged, lower pulls every colour toward `mid`;
// tint/amount: mix toward a base colour.
export const PHASES = {
  stable:     { sat: 1,    light: 0,     contrast: 1,    mid: 0.6,  tint: UI.paper,            amount: 0 },
  manic:      { sat: 1.45, light: 0.03,  contrast: 1.06, mid: 0.6,  tint: WORLD.skyManic,      amount: 0.06 },
  depressive: { sat: 0.42, light: 0,     contrast: 0.88, mid: 0.62, tint: WORLD.skyDepressive, amount: 0.15 },
};
/** The sky in each phase: [top, horizon]. Manic is the base sky warmed with the pink accent. */
export const SKY = {
  stable:     [WORLD.sky, WORLD.skyHorizon],
  manic:      [mix(WORLD.sky, WORLD.skyManic, 0.7), mix(WORLD.skyHorizon, CAR.amber, 0.3)],
  depressive: [WORLD.skyDepressive, mix(WORLD.skyDepressive, UI.cream, 0.4)],
};
/** Small neon accents for manic episodes only: the base accents at full saturation. */
export const NEON = [UI.pink, UI.yellow, UI.teal, UI.mint].map((c) => setSL(c, 1, 0.62));

// Seasons: `amount` tints everything, `foliage` tints grass, hills and trees more strongly.
export const SEASONS = {
  winter: { tint: 0xe6f1fb,  amount: 0.16, foliage: 0.68, sat: 0.8 },  // cool and white
  spring: { tint: UI.pink,   amount: 0.14, foliage: 0.04, sat: 1 },    // soft pink in the sky and haze, greens stay fresh
  summer: { tint: UI.stable, amount: 0,    foliage: 0.22, sat: 1.12 }, // richer green
  autumn: { tint: CAR.amber, amount: 0.08, foliage: 0.32, sat: 1 },    // warm orange
};
const FOLIAGE = new Set(['grass', 'grassDark', 'hill', 'treeLeaf']);

// ---------- Colour maths ----------
function rgb(n) { return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function num([r, g, b]) { return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b); }
function clamp(v) { return Math.min(1, Math.max(0, v)); }
/** 0xRRGGBB -> '#rrggbb' (for CSS and canvases). */
export const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return num(A.map((v, i) => v + (B[i] - v) * t));
}
function toHsl(n) {
  const [r, g, b] = rgb(n).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function fromHsl([h, s, l]) {
  const f = (k) => {
    const x = (k + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(x - 3, 9 - x, 1));
  };
  return num([f(0) * 255, f(8) * 255, f(4) * 255]);
}
function setSL(n, s, l) { return fromHsl([toHsl(n)[0], s, l]); }

/** One colour as it looks in a phase ('stable' | 'manic' | 'depressive'). */
export function inPhase(color, phase = 'stable') {
  const p = PHASES[phase];
  if (phase === 'stable') return color;
  let [h, s, l] = toHsl(color);
  s = clamp(s * p.sat);
  l = clamp(p.mid + (l + p.light - p.mid) * p.contrast);
  return mix(fromHsl([h, s, l]), p.tint, p.amount);
}
/** One colour with a season's tint. `key` is its name in WORLD (foliage is tinted more). */
export function inSeason(color, season, key = '') {
  const s = SEASONS[season];
  if (!s) return color;
  const [h, sat, l] = toHsl(color);
  return mix(fromHsl([h, clamp(sat * s.sat), l]), s.tint, FOLIAGE.has(key) ? s.foliage : s.amount);
}
/** The whole world palette for a phase and (optionally) a season. */
export function worldPalette(phase = 'stable', season = null) {
  const one = (c, key) => inPhase(inSeason(c, season, key), phase);
  const out = {};
  for (const [key, v] of Object.entries(WORLD)) out[key] = Array.isArray(v) ? v.map((c) => one(c, key)) : one(v, key);
  [out.sky, out.skyHorizon] = SKY[phase].map((c) => inSeason(c, season));
  return out;
}

// ---------- Text contrast (WCAG 2.1) ----------
function luminance(n) {
  const [r, g, b] = rgb(n).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
/** Returns `fg`, moved away from `bg` (darker or lighter) only as far as needed to reach the AA ratio. */
export function readable(fg, bg, min = 4.5) {
  const toward = luminance(fg) < luminance(bg) ? 0x000000 : 0xffffff;
  let c = fg;
  for (let t = 0.05; contrast(c, bg) < min && t <= 1; t += 0.05) c = mix(fg, toward, t);
  return c;
}
/** Text-on-background pairs used in the game: [label, text colour, background colour]. */
export const TEXT_PAIRS = [
  ['Text on panel', UI.ink, UI.paper], ['Soft text on panel', UI.inkSoft, UI.paper], ['Text on cream sign', UI.ink, UI.cream],
  ['Button', UI.white, UI.btnGreen], ['Text on yellow', UI.ink, UI.yellow], ['Text on pink', UI.ink, UI.pink],
  ['Text on teal', UI.ink, UI.teal], ['Text on mint', UI.ink, UI.mint],
];
/** A text pair in a phase: both are shaded, then nudged apart only if needed to stay AA. Returns { fg, bg, ratio }. */
export function textPair(fg, bg, phase = 'stable') {
  let b = inPhase(bg, phase);
  const f = readable(inPhase(fg, phase), b);
  if (contrast(f, b) < 4.5) b = readable(b, f); // the text is already pure white or black: move the background instead
  return { fg: f, bg: b, ratio: contrast(f, b) };
}

/** The interface colours as CSS variables, so style.css takes its colours from this file. */
export function cssVars() {
  const names = { paper: 'paper', cream: 'cream', ink: 'ink', inkSoft: 'ink-soft', sage: 'sage', btnGreen: 'btn-green', red: 'red', focus: 'focus',
    teal: 'teal', tealDeep: 'teal-deep', yellow: 'yellow', mint: 'mint', pink: 'pink', stable: 'stable', manic: 'manic', depressive: 'depressive',
    white: 'panel', zoneLow: 'zone-low', zoneStable: 'zone-stable', zoneHigh: 'zone-high' };
  return Object.entries(names).map(([key, name]) => [`--${name}`, hex(UI[key])]);
}
