// All tunable numbers for Supporty live here, so you can tweak the game
// without touching game logic. Values marked "PRD" come straight from PRD.md.

import { WORLD } from './world/palette.js';

export const CONFIG = {
  secondsPerMonth: 15, // PRD
  months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],

  // ---- Mood meter (PRD) ----
  mood: {
    min: -100, max: 100, stable: 30, driftPerSec: 4, startGuardrails: 2, maxGuardrails: 3, // PRD
    driftPerGuardrail: 0.25,  // PRD: drift x (1 + 0.25 x guardrails)
    pushCutPerGuardrail: 0.2, // PRD: push x (1 - 0.2 x guardrails)
    // Agreed additions (not in PRD):
    driftDelaySec: 12,        // drift to centre waits this long after a push ("when nothing pushes it")
    escalatePerSec: 14,       // in a leaning zone, mood keeps moving outward (sleep-loss / withdrawal cycle)...
    escalateCutPerGuardrail: 0.15, // ...slowed by guardrails (level 3 = 55% as fast)
  },
  // Retuned so depression is more common and ~2x longer than mania (Judd et al., 2002). PRD had 20 / 30.
  episode: { maniaSec: 14, depressionSec: 34, resetTo: 60, missedMedSec: 3 },

  // ---- Road states (PRD) ----
  phases: {
    // laneChangeSec: time for one lane change. laneDamping < 1 = small overshoot wobble.
    stable:     { speed: 1.0, steer: 1.0, lagMs: 0, laneChangeSec: 0.25, laneDamping: 1 },
    manic:      { speed: 1.6, steer: 2.0, lagMs: 0, drift: 0.3, laneChangeSec: 0.15, laneDamping: 0.45 },
    depressive: { speed: 0.5, steer: 1.0, lagMs: 400, laneChangeSec: 0.8, laneDamping: 1 },
  },

  // ---- Triggers and support items (PRD; pushes retuned, PRD values in brackets) ----
  triggers: {
    allNighter: { push: 22, label: 'Skip the rest stop' },  // [25]
    redEye: { push: 17, label: 'Red-eye flight' },  // [20]
    trophy: { push: 27, label: 'Accepted!' },  // [30]
    scheduleChaos: { push: [15, -15], label: 'Schedule chaos' },
    loss: { push: -58, label: 'A loss' },  // [-30]
    criticism: { push: -42, label: 'Just try harder' },  // [-20]
    stigmaBillboard: { guardrails: -1, label: 'What will people think?' },
  },
  support: {
    medCheckpoint: { guardrails: 1, missed: -1 },
    restStop: { toCentre: 15, episodeSec: -3 },
    routineCheckpoint: { toCentre: 10, blocksNext: 'scheduleChaos' },
    therapyPit: { episodeSec: -6, highlightNext: 3 },
    familyPit: { episodeSec: -4, convertsNext: 'criticism', supportiveToCentre: 10, supportiveLabel: 'We’re here for you' },
  },
  supportLabels: {
    medCheckpoint: 'Medication', restStop: 'Rest stop', routineCheckpoint: 'Routine',
    therapyPit: 'Therapy', familyPit: 'Family & friends',
  },

  // ---- Episode hazards: DSM-5 symptoms as road behaviour (PRD) ----
  hazards: {
    // manic
    cliffRamp:    { label: 'Shortcut!', episodeSec: 2 },          // grandiosity: risky ramp, costs time
    spendDetour:  { label: 'Spending spree', episodeSec: 2 },     // risky pleasurable activities
    billboardPull:{ label: 'Look at me!' },                       // distractibility: tugs steering
    racingSigns:  { label: 'New plan!', words: ['New plan!', 'Start a band!', 'Call everyone!', 'Buy a boat?', 'Write a book!', 'No sleep needed!', 'Move abroad!'] },
    // depressive
    mud:          { label: 'Mud', slow: 0.5, slowSec: 1.5 },     // psychomotor slowing
    fogFork:      { label: 'Which way?' },                        // poor concentration / indecision
    harshSigns:   { label: 'You ruined everything', words: ['You ruined everything', 'Why even try?', 'Not good enough'] }, // guilt / worthlessness
  },
  manicSwerveChance: 0.3,     // per second: car swerves toward another lane (agitation)
  depressiveDimEverySec: 7,   // screen dims and the car drifts (sleep changes)

  // ---- The year (PRD month table). `at` = seconds into the month. ----
  storyBeats: ['New semester', 'Midterms', 'Got the internship!', 'Everything feels possible', 'Getting back on track', 'Summer job',
    'A breakup', 'Hard to get up', 'Asking for help', 'Steady weeks', 'Flying home for the holidays', 'Finals, then graduation'],
  medAt: 1, // a medication checkpoint opens every month (12 in total)
  script: [
    { month: 'Jan', at: 7, spawn: 'restStop' },
    { month: 'Feb', at: 3, spawn: 'allNighter' }, { month: 'Feb', at: 6, spawn: 'allNighter' }, { month: 'Feb', at: 10, spawn: 'scheduleChaos' },
    { month: 'Mar', at: 4, spawn: 'trophy' }, { month: 'Mar', at: 9, spawn: 'redEye' },
    { month: 'Apr', at: 5, spawn: 'restStop' }, { month: 'Apr', at: 10, spawn: 'therapyPit' },
    { month: 'May', at: 6, spawn: 'routineCheckpoint' },
    { month: 'Jun', at: 5, spawn: 'stigmaBillboard' }, { month: 'Jun', at: 10, spawn: 'stigmaBillboard' },
    { month: 'Jul', at: 4, spawn: 'loss' }, { month: 'Jul', at: 9, spawn: 'criticism' },
    { month: 'Aug', at: 8, spawn: 'familyPit' },
    { month: 'Sep', at: 5, spawn: 'therapyPit' }, { month: 'Sep', at: 10, spawn: 'restStop' },
    { month: 'Oct', at: 6, spawn: 'routineCheckpoint' },
    { month: 'Nov', at: 4, spawn: 'redEye' }, { month: 'Nov', at: 8, spawn: 'criticism' }, { month: 'Nov', at: 11, spawn: 'familyPit' },
    { month: 'Dec', at: 4, spawn: 'allNighter' }, { month: 'Dec', at: 9, spawn: 'restStop' },
  ],
  // Scripted life events fill all three lanes (you can't steer around a breakup or public stigma). Agreed addition.
  scriptedSpanLanes: ['allNighter', 'redEye', 'trophy', 'scheduleChaos', 'loss', 'criticism'],
  // June stigma billboards block two lanes; the open lane has a supportive sign and avoids the guardrail loss.
  stigmaOpenLaneText: 'You’re not alone',
  tutorialHints: [
    { at: 3.2, text: 'Steer ◀ ▶ to change lanes' },
    { at: 6.5, text: 'Drive through medication checkpoints. They build guardrails over time' },
    { at: 10, text: 'Rest stop ahead: move to the right lane and press Pull in' },
  ],

  // ---- Random spawner (PRD: one every 4–6 s from the current phase's pool) ----
  spawner: {
    everySec: [4, 6],
    aheadDistance: 150,   // spawn this far ahead of the kart
    depressiveAheadScale: 1.4, // in a depressive episode, spawn 40% further ahead so early steering still works
    minGap: 22,           // keep spawns at least this far apart on the road
    pools: {
      stable: { allNighter: 2, redEye: 1, trophy: 1, scheduleChaos: 2, loss: 1.2, criticism: 1.2, stigmaBillboard: 0.5, restStop: 1.2, routineCheckpoint: 1 },
      manic: { cliffRamp: 2, spendDetour: 2, billboardPull: 1.5, racingSigns: 1.5, restStop: 1, therapyPit: 1, familyPit: 0.8 },
      depressive: { mud: 2, fogFork: 1.2, harshSigns: 1.5, therapyPit: 1, familyPit: 1, restStop: 1 },
    },
  },
  // ---- Coins: score only, no effect on mood. Grey and worth 0 in a depressive episode (loss of interest). ----
  coins: { everySec: [2.5, 4], row: 4, spacing: 3.5, points: 1 },

  // ---- January practice month: one item at a time, learn by doing (see systems/practice.js) ----
  practice: {
    slow: 0.6,            // game speed while an item is coming
    pauseSec: 2,          // normal speed between items
    meterSec: 3,          // the mood meter step continues by itself after this
    readySec: 2.5,        // "You're ready" before February starts
    aheadDistance: 50,    // practice items spawn closer than usual (keeps practice under 60 s, even with every miss)
    retryGapSec: 1,       // after a miss, the same item comes back this soon
    maxMood: 25,          // practice can never push the needle out of the stable zone
    arrowColor: 0xffd34d, arrowGap: 1.2, arrowBounce: 0.7, arrowBounceHz: 1.6,
  },
  episodeIntro: { slow: 0.5, slowSec: 3, popupSec: 5 }, // the FIRST manic / depressive episode of a run

  firstTipSec: 4,         // first-time item tips stay this long...
  firstTipSlow: 0.5,      // ...and slow the game to this speed while showing
  popupSec: 2.5,          // hit / pick-up pop-ups
  popupMaxWaiting: 2,

  // ---- Sound (all generated in code, see systems/sound.js) ----
  sound: {
    master: 0.5,          // overall volume
    sfx: 0.8,             // one-shot effects
    // Background music (systems/music.js): quiet, and its speed follows the mood.
    music: {
      volume: 0.6, bpm: { stable: 108, manic: 176, depressive: 52 },
      manicShift: 2, manicBoost: 0.3,          // manic: tune up 2 semitones, 30% louder
      depressiveShift: -5, depressiveCut: 0.45, // depressive: tune down 5 semitones, 45% quieter
    },
    maxVoices: 4,         // never more than 4 one-shots at once
    crossfadeSec: 2,      // how quickly the muffle eases in when the phase changes
    muffleHz: 900,        // low-pass on everything in a depressive episode
  },

  pullWindow: [-28, 6],   // you can pull in from 28 m before a stop until 6 m after it
  captionSec: 3,          // PRD: story caption shown for 3 seconds

  // ---- World and driving feel ----
  world: {
    lanes: 3,
    laneWidth: 3.4,          // metres between lane centres
    shoulder: 0.9,           // grey strip outside the outer lanes
    loopRadius: 260,         // the road is one big wobbly loop that never ends
    baseSpeed: 24,           // road units per second at 1.0x
    laneChangeSpeed: 9,      // how fast the kart slides sideways (units/s) at steer 1.0
    steerRepeatMs: 320,      // holding a direction moves one more lane every N ms
    treeCount: 170,
    hillCount: 46,
    fenceSpacing: 5,         // brown roadside fence
    guardrailSpacing: 4,     // red-and-cream guardrail panels
    visibleAhead: 200,       // fences/guardrails are only built near the kart
    visibleBehind: 30,
  },

  // ---- Camera per phase (blended in leaning zones at step 5) ----
  camera: {
    stable:     { fov: 62, height: 5.0, distance: 10.0, lookAhead: 9 },
    manic:      { fov: 80, height: 5.2, distance: 9.5, lookAhead: 11 },
    depressive: { fov: 56, height: 3.0, distance: 8.5, lookAhead: 6 },
    followLerp: 5,           // higher = camera follows curves more tightly
  },

  // ---- Colours (soft, muted, toy-like) ----
  colors: WORLD, // every colour lives in world/palette.js

  // linkTimeoutSec: if the phone finds the room but the direct link has not opened by then, the network is blocking it.
  net: { peerPrefix: 'supporty-v1-', roomLetters: 'BCDFGHJKLMNPQRSTVWXZ', linkTimeoutSec: 8 },
};
