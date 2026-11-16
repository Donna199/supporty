// dims.js: sizes shared by the model build script (tools/sdf) and the game, so the
// baked meshes and the parts added in code (face, glass, wheels) always line up.
export const SEAT = [0, 1.05, -0.35];                                   // where the driver's body sits in the kart
export const HEAD = { y: 1.315, half: [0.6, 0.57, 0.54], round: 0.3 };  // head centre (above the body origin) and size
export const FACE = { eyeX: 0.235, eyeY: -0.07, eyeR: 0.175, browY: 0.17, blushX: 0.37, blushY: -0.3, blushR: 0.095, mouthY: -0.3 }; // on the head's front
export const STEER = { pos: [0, 1.3, 0.42], tilt: -0.6, r: 0.24, tube: 0.05, gripX: 0.225, gripY: 0.13 };
export const WHEEL = { r: 0.44, halfWidth: 0.15, x: 0.8, z: [1.12, -1.08] };
export const SCREEN = { baseX: 0.66, baseY: 1.1, baseZ: 0.68, topX: 0.6, topY: 1.64, topZ: 0.5, post: 0.055 }; // windshield frame
export const PLATE = { y: 0.66, z: -1.79 };                              // rear number plate (the star sits on it)

/** Where a hand holds the steering wheel (side = -1 or 1), in kart coordinates. */
export function grip(side) {
  const c = Math.cos(STEER.tilt), s = Math.sin(STEER.tilt);
  return [side * STEER.gripX, STEER.pos[1] + STEER.gripY * c, STEER.pos[2] + STEER.gripY * s];
}
