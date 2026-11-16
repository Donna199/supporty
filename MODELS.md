# Models in Supporty

Every model is built in code from simple shapes with soft toon shading and a blob shadow, in a rounded toy / vinyl-figure style: rounded boxes, capsules, smooth spheres and tori. No outside models, textures or images are used. Your concept sketches were used only as a reference.

- The drivers and the kart are signed-distance models in `tools/sdf/`, meshed once by `npm run models` into `assets/generated/*.glb` (one seamless surface each, split into one sub-mesh per colour so borders are sharp; a fine version for Graphics: High and a coarse `-low` version for Graphics: Low and the outline shells). `src/world/driver.js` adds the face (blinking eyes, three mouths) and `src/world/car.js` adds the spinning wheels and the glass. Scenery is in `src/world/models.js`.
- Road items are in `src/world/itemModels.js`. They use the shared rounded shape helpers from `models.js`.

## From your sketches

| Model | Sketch | How it is built |
| --- | --- | --- |
| Girl driver | characters | One seamless figure: soft-cube skin-tone head; blonde hair that is part of the head's shape (a shell with a centre-parted face window, long hair tapering down the back with soft strand lines); pink bow blended onto the hair; green T-shirt with a skin neckline; dark skirt; hands on the steering wheel. Face added in code: big round eyes with a sparkle and a blinking eyelid, pink blush, arched blonde brows, and three small mouths (calm, excited, flat) by mood phase. |
| Boy driver | characters | Same head and face (peach blush, short dark brows). Short black hair as a shell with a straight hairline, showing only below the cap rim. Six-panel red cap blended onto the head, light panels at the front and both back corners, brim and top button. Red jacket open over a white T-shirt, collar, black pants with a white side stripe. |
| Medication | assets | Red-and-white capsule that turns slowly, with a faint yellow ring and halo (kept subtle: a routine, not a power-up), under a small green drive-through arch labelled "Medication". |
| Trophy | assets | Gold cup with two round handles, a knotted stem and a base. Used for the "Accepted!" trigger. |
| REST STOP sign | assets | Red round sign with white "REST STOP" text on a grey pole, plus a small bed beside it. Pull-in stop on the right. |
| Rock | assets | Cluster of four soft grey lumps. Falls into the lane as you approach and leaves a dark pothole ("A loss"). |
| Guardrail (red and cream) | assets: road fences | Round red posts with round cream rails, each edged in red underneath. **One of every three panels is shown per guardrail level** (0 = none, 3 = solid). |
| Brown roadside fence | assets: road fences | Round dark-brown posts poking out above two round rails, further out from the road. |

## Not sketched yet: please review and redesign

| Model | Current design | Used for |
| --- | --- | --- |
| Car | A small teal open-top toy kart, one seamless surface: rounded hull with a sloping hood, round fenders over wheel arches, sunken deep-teal cockpit, dashboard, wing mirrors, cream bumpers, seat and windshield frame, round headlights, red tail lights, dark steering wheel and folded soft-top, a cream number plate, and a side stripe and tail lip in the driver's colour. Added in code: four spinning wheels, the glass, and the star on the plate. | Player |
| Tree / hill / cloud | Two round-topped green tiers on a trunk / smooth squashed green balls / three white balls. | Scenery |
| "Skip the rest stop" sign | Navy sign with a yellow crescent moon crossed out in red. | `allNighter` trigger |
| Plane | White plane with a red tail and stripe, hovering low across the lane. | `redEye` trigger |
| Spinning clocks | Two clock faces on a post with hands spinning fast. | `scheduleChaos` trigger |
| Speech-bubble roadblock | White bubble on two legs: “Just try harder”. | `criticism` trigger |
| Supportive bubble | The same bubble in soft green: “We’re here for you”. | `criticism` after a family pit stop |
| Stigma billboard | Grey-lilac billboard: "What will people think?", labelled "Stigma". | `stigmaBillboard` trigger |
| Life-event arch | Tall arch across all three lanes with a word banner, and the trigger's model in the middle lane. | Scripted triggers from the month table |
| Routine gate | Mustard arch with a calm clock face on top. | `routineCheckpoint` |
| Therapy booth | Sage hut with a striped awning, a "Therapy" sign and two speech-bubble balls. | `therapyPit` |
| Family pit crew | Three small blocky-rounded people in orange, blue and lilac waving under a "Family & friends" banner. | `familyPit` |
| Shortcut ramp | Orange ramp with a yellow "Shortcut! →" sign. | Manic hazard: grandiosity |
| Spending booth | Small pink "SALE!" hut with shopping bags. | Manic hazard: risky spending |
| Shiny billboard | Pink "Look at me!" billboard with twinkling stars. Tugs your steering. | Manic hazard: distractibility |
| Racing signs | Yellow sign whose words change too fast to read. | Manic hazard: racing thoughts |
| Mud | Brown puddles in a lane. Slows the kart. | Depressive hazard: psychomotor slowing |
| Foggy fork | Signpost with ← → arrows that keep swapping; fog thickens. | Depressive hazard: indecision |
| Harsh signs | Grey sign with harsh self-talk ("You ruined everything"). | Depressive hazard: guilt / worthlessness |
| Graduation arch | Arch with a "Graduation day" banner, a spinning mortarboard and a checkered line. | Finish |

## Added in the look pass

- **Roadside props** (`src/world/scenery.js`, one instanced mesh each): bushes (two soft balls), flowers (stem, round bloom, yellow centre) and small houses (rounded walls, pink roof, door, windows, chimney). Snow patches appear only in winter.
- **Finish arch:** the existing "Graduation day" banner with a spinning graduation cap, now with a row of pastel bunting flags.
- **Outlines:** a slightly larger back-face copy of each solid model in a darker tone of its own colour (off in Graphics: Low).
- **Glow:** soft additive sprites on the headlights, the medication capsule and the manic racing-thoughts sign only.
