# Models in Supporty

Every model is built in code from simple shapes with soft toon shading and a blob shadow, in a rounded toy / vinyl-figure style: rounded boxes, capsules, smooth spheres and tori. No outside models, textures or images are used. Your concept sketches were used only as a reference.

- Drivers, kart and scenery are in `src/world/models.js`.
- Road items are in `src/world/itemModels.js`. They use the shared rounded shape helpers from `models.js`.
- To view every item at once, open `index.html?screen=drive&gallery=1`.

## From your sketches

| Model | Sketch | How it is built |
| --- | --- | --- |
| Girl driver | characters | Soft-cube skin-tone head; big round eyes with dark-brown pupils and a white sparkle; pink blush; small rounded ears. Blonde hair: a soft dome, centre-parted rounded bangs, and long tapered strands down the sides and back. Pink bow (two round loops and a soft knot). Rounded green T-shirt with soft short sleeves; dark skirt with a flared hem; capsule arms and legs; round hands. |
| Boy driver | characters | Same face. Short black hair: a dome, a rounded nape and side pieces. Smooth cap of alternating red and light-red wedges, with a curved brim turned to the side and a top button. Soft red jacket open over a white T-shirt; black capsule legs with a white side stripe. |
| Medication | assets | Red-and-white capsule that turns slowly, with a faint yellow ring and halo (kept subtle: a routine, not a power-up), under a small green drive-through arch labelled "Medication". |
| Trophy | assets | Gold cup with two round handles, a knotted stem and a base. Used for the "Accepted!" trigger. |
| REST STOP sign | assets | Red round sign with white "REST STOP" text on a grey pole, plus a small bed beside it. Pull-in stop on the right. |
| Rock | assets | Cluster of four soft grey lumps. Falls into the lane as you approach and leaves a dark pothole ("A loss"). |
| Guardrail (red and cream) | assets: road fences | Round red posts with round cream rails, each edged in red underneath. **One of every three panels is shown per guardrail level** (0 = none, 3 = solid). |
| Brown roadside fence | assets: road fences | Round dark-brown posts poking out above two round rails, further out from the road. |

## Not sketched yet: please review and redesign

| Model | Current design | Used for |
| --- | --- | --- |
| Kart | Soft teal rounded tub with a cream rim, a rounded cream bumper at the front and back (like a bumper car), a cream seat back, a round steering wheel, torus tyres with cream hubs, headlights and tail lights. | Player |
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
