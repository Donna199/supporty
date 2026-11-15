# PRD: Supporty — a bipolar I driving game (PSY350)

Nov 14, 2026 · @Donna

## Overview

Supporty is a 3–5 minute browser driving game in which the player drives through one year in the life of a person with bipolar I disorder, trying to keep a two-sided mood meter in the stable zone. Working title; rename freely.

It is the creative project for PSY350. It must depict one DSM-5 disorder accurately, show biopsychosocial factors, and avoid stigmatizing portrayals.

**Core message:** bipolar I involves episodes of mania and depression with stable periods in between. Sleep, life events, stigma and support shape its course, and treatment aims for stability, not a cure.

### Goals

1. Show the DSM-5 manic and depressive episode criteria as road and car behaviour the player can feel.
2. Show biological (sleep, circadian rhythm), psychological (reactions to goals and losses) and sociocultural (family criticism, stigma) factors as triggers on the road.
3. Show treatment (medication, routine, family support) as things that make the drive steadier.
4. Every player finishes the year. The end screen explains what shaped their drive.

### Non-goals

- No fail state or game over. The character never "loses" to the disorder.
- No depiction of self-harm or suicide as a game object.
- Not a medical tool and not a diagnosis simulator.
- No Nintendo or Mario Kart assets, characters, sounds or names. All art is original.

### Course requirements this game must support

| Requirement | Where the game covers it |
| --- | --- |
| One DSM-5 disorder | Bipolar I only |
| At least one biopsychosocial factor | Triggers on the stable road (sections below) |
| Two or more peer-reviewed articles | Trigger and support mechanics, cited on the end screen |
| No stigmatizing depiction | Sensitivity guidelines section |
| AI disclosure | Keep every prompt used to build the game in a log for the rationale |

## Platform, tech and controls

The road plays on a laptop or TV (the game screen), and the player scans a QR code to turn their phone into the controller. Both run in the browser, so there is nothing to install.

- **Stack:** JavaScript with [Three.js](https://threejs.org) for the 3D game screen, built with Vite. Two pages: `index.html` (game screen) and `controller.html` (phone).
- **Phone link:** [PeerJS](https://peerjs.com) (WebRTC), using the free PeerJS cloud server for the handshake, so you need no backend of your own. QR code drawn with the `qrcode` npm package.
- **Hosting:** any static HTTPS host (GitHub Pages, Netlify or Vercel). HTTPS is required for WebRTC and the phone's Wake Lock.
- **View:** stylized 2.5D, kart-game style. A low-poly 3D road winds through simple hills, and a chase camera follows behind the car. The car, characters, items and scenery are toy-like low-poly 3D models built in code from simple shapes, designed from the artist's concept sketches (the sketches are design references only, never in-game assets). Toon shading and soft colours keep it cute, not realistic. Manic phase widens the camera's field of view and adds speed lines; depressive phase lowers the camera, adds fog and rain.
- **Orientation:** game screen 16:9 landscape; controller page landscape on the phone.
- **Performance target:** 60 fps on the game screen; under 100 ms from button press to car movement on the same Wi-Fi.

### Controls

The phone is the controller: a game-pad page styled like a classic two-handed controller, cut down to the buttons this game needs.

#### Connecting

1. The title screen shows a QR code and a 4-letter room code (for example `MOOD`).
2. The player scans it; the phone opens `controller.html?room=MOOD`.
3. The phone connects through PeerJS. The game screen shows "Controller connected" and the phone buzzes once.
4. The player presses Start on the phone to begin.
5. If the connection drops, the game auto-pauses and shows the QR code again.

#### Controller layout

Original design inspired by a two-handed game pad. No Nintendo logos, button shapes copied from a real product, or names like "Joy-Con".

| Button | Position | Action |
| --- | --- | --- |
| Steering pad (left and right arrows only) | Left side | Hold to steer; up/down removed |
| Pull in (one large round button) | Right side | Enter a rest stop or pit stop when the car is beside one |
| Pause (replaces Start) | Top centre | Pause and open the menu: Resume, Restart, Mute |
| Sound (replaces Select) | Top centre | Mute or unmute |

L/R and the extra face buttons are dropped: the game only needs steering and one action, and fewer buttons make it easy for first-time players. Pulling in is a deliberate press, so choosing to stop for rest, therapy or family support is the player's own action. Medication checkpoints stay drive-through.

#### Controller feedback

- The controller's background tint follows the phase: soft daylight (stable), neon (manic), grey-blue (depressive).
- Haptics on Android (`navigator.vibrate`): short buzz on a trigger hit, double buzz on a support pickup. iOS Safari does not support vibration, so skip it silently there.
- In a depressive episode, button presses animate with a 0.4 s delay to match the game's input lag; in a manic episode the steering pad pulses.
- The phone screen stays awake during play (Wake Lock API).

#### Messages

Phone to game: `{t:'steer', dir:-1|0|1}` on press and release, `{t:'pull'}`, `{t:'pause'}`, `{t:'mute'}`, `{t:'start'}`.

Game to phone: `{t:'phase', phase:'stable'|'manic'|'depressive'}`, `{t:'buzz', pattern:[ms, …]}`, `{t:'screen', name:'title'|'drive'|'review'}`.

**Fallbacks:** keyboard on the laptop (arrows or A/D steer, Space = Pull in, Esc = Pause), and a "Play on this device" button that overlays the same controller buttons on a single phone screen. Test the QR connection on campus Wi-Fi early: some networks block peer-to-peer links. If it fails, a small WebSocket relay (for example on Render) is the backup, listed as a stretch task.

The player only steers and pulls in. Speed is set by the current phase, not by the player, so the game stays about mood, not racing skill.

## Core loop and mood meter

The player steers through one year, avoids triggers, picks up support items, and tries to keep the mood needle in the stable zone. Hitting the edge starts an episode, never a game over.

### Core loop

1. Road scrolls; a calendar in the corner ticks through the months.
2. Triggers and support items appear in lanes.
3. Hitting a trigger pushes the needle left (low) or right (high).
4. Picking up a support item pulls the needle toward centre or strengthens the guardrails.
5. The needle's position sets the road state: stable, leaning, or a full episode.
6. At the end of December the car reaches the finish milestone; the end screen shows the year.

### Mood meter

A horizontal gauge at the top of the screen: LOW on the left, STABLE in the middle, HIGH on the right.

| Variable | Range / value | Meaning |
| --- | --- | --- |
| `mood` | −100 to +100 | Needle position. Negative = depressive side, positive = manic side |
| Stable zone | −30 to +30 | Euthymia. Normal road |
| Leaning zones | ±31 to ±99 | Road starts to change (light rain or extra speed) |
| Episode threshold | ≤ −100 or ≥ +100 | Full depressive or manic episode begins |
| Drift to centre | 4 per second × (1 + 0.25 × `guardrails`) | Mood slowly returns to centre when nothing pushes it |
| `guardrails` | 0 to 3 | Built by taking medication on time. Starts at 2 |
| Push multiplier | 1 − 0.2 × `guardrails` | Each trigger's push is reduced by guardrails (level 3 = 40% of the push) |

### Episodes

- When `mood` hits ±100, set `phase` to `manic` or `depressive` and start `episodeTimer` (manic 20 s, depressive 30 s, roughly 1.5 to 2 in-game months).
- During an episode the needle stays pinned at the edge and the road uses that phase's hazards.
- Support items cut the timer: rest stop −3 s, therapy pit stop −6 s, family pit crew −4 s.
- When the timer reaches 0, `mood` resets to ±60 and drifts back to centre; `phase` returns to `stable`.
- Missed medication checkpoints during an episode add +3 s.

The depressive episode is longer than the manic one because the DSM-5 minimum is 2 weeks for a major depressive episode versus 1 week for mania, and bipolar depression often lasts longer.

## Phases, obstacles and support items

The road has three states. Triggers appear on the stable road and push the needle; hazards appear only inside an episode and are DSM-5 symptoms shown as road behaviour.

### Road states

| Phase | Speed | Steering | Look and sound |
| --- | --- | --- | --- |
| `stable` | 1.0× | Normal response | Clear day, soft colours, calm music |
| `manic` | 1.6× | 2× sensitive, car drifts sideways | Saturated neon colours, fast music, screen edges flicker |
| `depressive` | 0.5× | 0.4 s input lag, heavy | Grey rain, muddy road, muffled sound |

Leaning zones blend toward the next state: at mood +60, speed is about 1.3× with light glare; at −60, light rain and 0.75×.

### Triggers (stable and leaning road)

| id | On-screen object | Push | Factor | Basis |
| --- | --- | --- | --- | --- |
| `allNighter` | "Skip the rest stop" sign, moon icon | +25 | Biological: sleep loss | Sleep loss can trigger mania (Lewis et al., 2017) |
| `redEye` | Plane crossing the road | +20 | Biological: circadian disruption | Time-zone travel linked to switches into mania (Harvey, 2008) |
| `trophy` | Golden trophy ("Accepted!") | +30 | Psychological: reward sensitivity | Goal-attainment events predict rises in manic symptoms (Johnson et al., 2000) |
| `scheduleChaos` | Signs with spinning clocks | +15 or −15 (random) | Bio-social: social rhythm disruption | Social zeitgeber hypothesis (Frank et al., 2005) |
| `loss` | Falling rock leaving a pothole | ∓30 | Psychological/social: negative life event | Loss events predict depressive symptoms (Johnson et al.) |
| `criticism` | Speech-bubble roadblock ("Just try harder") | −20 | Sociocultural: high expressed emotion | Family criticism linked to relapse (Miklowitz) |
| `stigmaBillboard` | Billboard: "What will people think?" | −1 `guardrails` | Sociocultural: stigma | Lower stigma linked to better adherence (Viscardi et al.) |

### Manic hazards (inside a manic episode)

| id | On-screen behaviour | DSM-5 criterion |
| --- | --- | --- |
| `noRest` | Rest stops flash by; car won't pull in | Decreased need for sleep |
| `racingSigns` | Road signs change faster than they can be read | Racing thoughts / flight of ideas |
| `billboardPull` | Shiny billboards tug the steering sideways | Distractibility |
| `cliffRamp` | "Shortcut" ramp toward a canyon | Grandiosity |
| `spendDetour` | Shopping-spree detour that drains coins | Risky pleasurable activities |
| `allLanes` | Car swerves toward every lane | Increased goal-directed activity / agitation |
| `friendsBehind` | Rear-view mirror shows friends falling behind | Impaired social functioning |

### Depressive hazards (inside a depressive episode)

| id | On-screen behaviour | DSM-5 criterion |
| --- | --- | --- |
| `greyRain` | Rain, grey palette, muffled audio | Depressed mood |
| `dullCoins` | Coins stop sparkling and score 0 | Loss of interest or pleasure |
| `fuelDrain` | Fuel gauge drops quickly | Fatigue / loss of energy |
| `mud` | Mud patches slow the car further | Psychomotor slowing |
| `fogFork` | Foggy fork with arrows that keep switching | Poor concentration / indecisiveness |
| `harshSigns` | Signs with harsh self-talk ("You ruined everything") | Worthlessness or guilt |
| `dimScreen` | Screen dims and car drifts | Sleep changes |

Thoughts of death or suicide are part of the DSM-5 criteria but are never a game object. They are covered in the rationale and the end-screen resources.

### Support items

| id | On-screen object | Effect | Basis |
| --- | --- | --- | --- |
| `medCheckpoint` | Pill-bottle checkpoint once per month | Collected: `guardrails` +1 (max 3). Missed: −1 | Mood stabilizers prevent episodes over time |
| `restStop` | Rest stop with a bed icon | Mood moves 15 toward centre; episode −3 s | Regular sleep protects stability |
| `routineCheckpoint` | Clock-face gate | Mood moves 10 toward centre; blocks the next `scheduleChaos` | IPSRT stabilises daily rhythms (Frank et al., 2005) |
| `therapyPit` | Pit stop labelled "Therapy" | Episode −6 s; highlights the next 3 triggers early | Psychoeducation and warning-sign spotting |
| `familyPit` | Pit crew of family/friends | Episode −4 s; turns the next `criticism` into a supportive sign | Family-focused therapy lowers relapse (Miklowitz) |

## The year, month by month

One run = 12 in-game months at 15 seconds each (3 minutes total; raise `secondsPerMonth` to 20–25 if it feels rushed). Scripted events below are placed at fixed times; between them, the spawner adds 1 random trigger every 4–6 seconds from the current phase's pool.

Tuning goal: a typical player has one manic and one depressive episode. Good play shortens and softens them but cannot always prevent them, which matches the reality that treatment reduces episodes rather than removing them.

| Month | Story beat (shown as a small caption) | Scripted spawns | Intended result |
| --- | --- | --- | --- |
| Jan | "New semester" | `medCheckpoint`, `restStop`, tutorial hints | Learn steering and the meter |
| Feb | "Midterms" | `allNighter` ×2, `scheduleChaos` | Needle leans high |
| Mar | "Got the internship!" | `trophy`, `redEye` | Likely pushes into a manic episode |
| Apr | "Everything feels possible" | Manic hazards; `restStop`, `therapyPit` | Manic episode, then recovery |
| May | "Getting back on track" | `routineCheckpoint`, `medCheckpoint` | Return to stable |
| Jun | "Summer job" | `stigmaBillboard` ×2, `medCheckpoint` | Tests whether the player keeps guardrails |
| Jul | "A breakup" | `loss`, `criticism` | Needle leans low |
| Aug | "Hard to get up" | Depressive hazards; `familyPit` | Depressive episode |
| Sep | "Asking for help" | `therapyPit`, `restStop` | Recovery |
| Oct | "Steady weeks" | `routineCheckpoint`, `medCheckpoint` | Stable stretch |
| Nov | "Flying home for the holidays" | `redEye`, `criticism`, `familyPit` | Mixed pushes, support available |
| Dec | "Finals, then graduation" | `allNighter`, `restStop`, finish line | Reach the milestone |

A `medCheckpoint` also appears at the start of every month not listed above, so there are 12 in total.

## Screens and flow

Five screens, in this order: Title → Content note → How to play → Drive → Year in review (with Drive again).

1. **Title:** game name, a car on an empty road, the controller QR code with its room code, connection status, and a "Play on this device" link. The game starts when Start is pressed on the phone. Small line: "A game about one year with bipolar I disorder."
2. **Content note:** "This game shows one composite experience of bipolar I disorder. Experiences vary from person to person. It includes depictions of low mood and risky behaviour." Buttons: "Continue". The phone shows Continue, so the player can read on the big screen and tap on the controller.
3. **How to play:** three short cards. (a) Steer to keep the needle in the middle. (b) Triggers push your mood; support items steady it. (c) There is no game over: episodes happen, and support helps you recover.
4. **Drive (HUD):**
   - Top: mood meter (LOW – STABLE – HIGH) with needle.
   - Top-left: calendar (month name + progress bar); the bar is shaded in the phase colour during episodes.
   - Top-right: guardrail level (0–3 small shields) and pause.
   - Bottom: story caption for the month, shown for 3 seconds.
   - When an episode starts, a one-line caption names it: "Manic episode" or "Depressive episode".
5. **Year in review (end screen):**
   - Finish line animation: the car crosses "Graduation day", then the camera pulls back and the road keeps going ahead, with guardrails and pit crew still there.
   - Mood timeline: a line graph of `mood` across Jan–Dec, episodes shaded (manic one colour, depressive another).
   - Stats: days on stable road, number of episodes, support items used.
   - One personalised reflection, picked by rule from the run log, e.g. "Most of your high-mood stretches started after a skipped rest stop. In a large study, about 1 in 5 people with bipolar disorder reported sleep loss had triggered a high-mood episode."
   - "What the research says": 3–4 short lines with citations.
   - Closing line: "Bipolar disorder is a lifelong condition, and it is treatable. Support makes the road steadier." Plus: "If you are struggling, call or text 988 (US)."
   - Buttons: "Drive again" and "Sources".

### Drive again (comparison mode)

"Drive again" lets the player replay the same year with one change, then shows both timelines on one chart.

| Mode | Change | What it shows |
| --- | --- | --- |
| More support | `guardrails` starts at 3; `familyPit` replaces every `criticism`; no `stigmaBillboard` | Support and a low-criticism environment steady the course |
| Less support | `guardrails` starts at 0; no `therapyPit` or `familyPit`; `stigmaBillboard` ×3 | Stigma and missing support make episodes longer and more frequent |

## Look, sound and sensitivity

The art is flat, friendly and original; colour and sound carry the mood, never scary imagery.

### Visual direction

- Toy-like low-poly 3D: every model is built from simple shapes (boxes, spheres, cylinders) with toon shading, following the concept sketches for shape and colour. Characters have blocky heads, dot eyes and blush cheeks, as in the sketches.
- Stable: soft daylight palette (sky blue, sage green, warm grey road).
- Manic: saturated neon (magenta, yellow, cyan), slight motion-blur streaks.
- Depressive: desaturated blue-grey, rain particles, muddy brown patches.
- Every trigger and support item needs a readable icon plus a 1–3 word label, so the meaning does not rely on colour alone.
- Typeface: one rounded sans (for example Nunito from Google Fonts).

### Sound

- One music loop per phase, crossfaded when the phase changes (royalty-free or your own).
- Short sound for each trigger hit and support pickup.
- Mute button on every screen; the game must be fully playable with sound off.

### Accessibility

- Text at least 16 px on a phone; captions for every story beat.
- Option to reduce flicker and motion (turns off manic screen flicker and blur).
- Colour-blind check on the mood meter: label the zones with words, not just colour.

### Sensitivity rules (non-negotiable)

- No game over, no death, no crash animations that suggest injury.
- No self-harm, suicide or weapon imagery anywhere. Suicidal thoughts are acknowledged only in the rationale and end-screen resources.
- No violence or "dangerous person" framing; mania is shown as risky and out of control, never as threatening to others.
- Mania is not shown as purely fun: speed always comes with harder steering and visible costs.
- No slurs or casual words like "crazy" or "psycho" except inside the stigma billboards, where they are framed as harmful.
- Medication is never a quick boost or a cure; it builds steadiness over time.
- Use clinical terms in captions and end screen: "manic episode", "depressive episode", "bipolar I disorder".
- The person is shown as having a life (school, internship, friends, graduation), not only symptoms.

## Build spec for vibe-coding

All tuning numbers live in one config file so you can adjust the game without touching the game logic.

### File structure

```
index.html           game screen
controller.html      phone controller page
/src
  main.js            Three.js renderer, screen switching, main loop
  config.js          all numbers + spawn tables (below)
  net.js             PeerJS room, QR code, message send/receive
  controller.js      phone page: buttons, haptics, wake lock, phase tint
  world/
    road.js           curving spline road with 3 lanes, low-poly hills
    camera.js         chase camera; FOV and height change per phase
    models.js      builds the low-poly models (car, drivers, items, signs, fences, trees) from simple shapes, with blob shadows
    weather.js        rain, fog, speed lines
  screens/
    TitleScreen.js    QR code + connection status + character select (HTML overlay)
    ContentNoteScreen.js
    HowToScreen.js
    DriveScreen.js    car, spawner, collisions, HUD
    ReviewScreen.js   end screen, timeline chart, Drive again
  systems/
    mood.js           mood, guardrails, drift, episodes
    spawner.js        scripted + random spawns along the road
    input.js          merges phone messages + keyboard into one steer/pull/pause input
    runLog.js         records mood every 0.5 s + every event
/assets  (drawings, placeholders, audio, font)
```

### config.js shape

```js
export const CONFIG = {
  secondsPerMonth: 15,
  mood: { min: -100, max: 100, stable: 30, driftPerSec: 4, startGuardrails: 2, maxGuardrails: 3 },
  episode: { maniaSec: 20, depressionSec: 30, resetTo: 60 },
  phases: {
    stable:     { speed: 1.0, steer: 1.0, lagMs: 0 },
    manic:      { speed: 1.6, steer: 2.0, lagMs: 0, drift: 0.3 },
    depressive: { speed: 0.5, steer: 1.0, lagMs: 400 }
  },
  triggers: {
    allNighter: { push: 25, label: 'Skip the rest stop' },
    redEye: { push: 20, label: 'Red-eye flight' },
    trophy: { push: 30, label: 'Accepted!' },
    scheduleChaos: { push: [15, -15], label: 'Schedule chaos' },
    loss: { push: -30, label: 'A loss' },
    criticism: { push: -20, label: 'Just try harder' },
    stigmaBillboard: { guardrails: -1, label: 'What will people think?' }
  },
  support: {
    medCheckpoint: { guardrails: 1, missed: -1 },
    restStop: { toCentre: 15, episodeSec: -3 },
    routineCheckpoint: { toCentre: 10, blocksNext: 'scheduleChaos' },
    therapyPit: { episodeSec: -6, highlightNext: 3 },
    familyPit: { episodeSec: -4, convertsNext: 'criticism' }
  },
  script: [ { month: 'Feb', at: 3, spawn: 'allNighter' } /* … one entry per scripted spawn in the month table */ ]
};
```

### MVP scope (build this first)

- [ ] Drive scene with scrolling road, steerable car, keyboard controls, and the QR phone controller (steer, Pull in, Pause)
- [ ] Mood meter, drift, guardrails, and the three phases with speed/steering changes
- [ ] 7 triggers + 5 support items as simple coloured shapes with labels
- [ ] Scripted year from the month table + random spawner
- [ ] Episodes with timer and support cuts
- [ ] End screen with mood timeline, stats, research lines, 988 line

### Nice to have (only if time allows)

- [ ] Controller haptics, phase tint and Wake Lock; WebSocket relay backup
- [ ] Final art, music, sound effects
- [ ] Drive again comparison mode
- [ ] Personalised reflection line
- [ ] Reduce-motion option

### Acceptance criteria

- A full run takes 3–5 minutes and always ends at the finish milestone.
- Mood never exceeds ±100; reaching ±100 always starts the matching episode, and episodes always end.
- With `guardrails` at 3, the same trigger pushes the needle 40% as far as at 0.
- No screen ever shows "Game over", death, or self-harm imagery.
- Game screen runs at 60 fps on a laptop in Chrome and Safari; controller page works on iPhone and Android; playable with sound off.
- End-screen timeline matches the run log.

### Suggested build order (one prompt each)

1. "Set up a Vite + Three.js project with the scenes and file structure in this PRD; placeholder text on each scene."
2. "Build DriveScreen: a 3-lane road along a gently curving spline, low-poly hills, chase camera, and a low-poly car with the chosen driver, steerable with the keyboard. Then build net.js, controller.html and controller.js exactly as in the Controls section: PeerJS room, QR code on TitleScene, steering pad, Pull in, Pause and Sound buttons."
3. "Add mood.js and the mood meter HUD exactly as specified in the Core loop and mood meter section, using config.js."
4. "Add spawner.js with the triggers, support items and month script; collisions apply their effects."
5. "Add phases and episodes: speed, steering, input lag, visuals and timers."
6. "Add runLog.js and ReviewScene with the mood timeline chart and stats."
7. Art, sound, controller haptics and tint, polish.

Paste this whole PRD into the coding tool at step 1, and save every prompt you use for the AI disclosure in your rationale.

## Sources

- American Psychiatric Association. *DSM-5-TR*, Bipolar I disorder; criteria summarised via [MDCalc](https://www.mdcalc.com/calc/10196/dsm-5-criteria-bipolar-disorder). Verify against the manual or your textbook.
- Lewis, K. J. S., et al. (2017). Sleep loss as a trigger of mood episodes in bipolar disorder. *British Journal of Psychiatry*. [Summary](https://www.news-medical.net/news/20171019/Sleep-loss-can-trigger-mood-episodes-in-bipolar-disorder-patients.aspx)
- Harvey, A. G. (2008). [Sleep disturbance in bipolar disorder](https://ajp.psychiatryonline.org/doi/10.1176/appi.ajp.2008.08010077). *American Journal of Psychiatry*.
- Johnson, S. L., et al. (2000). [Increases in manic symptoms after life events involving goal attainment](https://pmc.ncbi.nlm.nih.gov/articles/PMC2847485). *Journal of Abnormal Psychology*.
- Johnson, S. L., et al. [Negative and goal-attainment life events in bipolar I](https://pmc.ncbi.nlm.nih.gov/articles/PMC2862221).
- Frank, E., et al. (2005). [Two-year outcomes for interpersonal and social rhythm therapy](https://typeset.io/pdf/two-year-outcomes-for-interpersonal-and-social-rhythm-4owm5me4sf.pdf). *Archives of General Psychiatry*.
- Miklowitz, D. J. [Family systems and relapse in recurrent psychiatric disorders](https://www.neuroscience.ox.ac.uk/publications/168243).
- Viscardi, L. H., et al. [Personal stigma and treatment adherence](https://searchworks.jioinstitute.edu.in/articles/asx__176327877).
