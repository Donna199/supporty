# Supporty: A Year with Bipolar I

Supporty is a kart-style browser game about one year with bipolar I disorder. You drive through twelve months (about 3 minutes) and try to keep the mood needle near the middle, while sleep, life events, stigma and support shape the road: lost sleep and big wins can push mood toward a manic episode, losses and harsh criticism can pull it toward a depressive episode, and medication, rest, routines, therapy and family support make the drive steadier. There is no winning or losing. Made for PSY350 at Purdue.

## Play

**Live game:** https://donna199.github.io/supporty/

Best on a laptop with a phone as controller.

1. Open the game on a laptop and pick your driver (Shally or Brandon).
2. Scan the QR code on the title screen with your phone camera. The phone becomes the controller (steer ◀ ▶, Pull in, Pause). Turn the phone sideways.
3. Press **Start** on the phone.

**No phone?** Use the keyboard: arrow keys (or A / D) steer, **Space** = Pull in, **Esc** = pause, **Enter** = start / continue, **M** = sound on / off. You can also choose "Play on this device instead" for on-screen buttons.

## Content note

This game depicts low mood and risky behaviour. It shows one composite experience of bipolar I disorder; experiences vary from person to person. If you're struggling, call or text **988** (US).

## AI disclosure

Game concept, design, characters and research direction by Donna Le. Code and 3D models were generated with Claude Code from my PRD and concept sketches.

Prompt log available on request.

## Sources

These are the sources cited on the game's end screen.

- American Psychiatric Association. DSM-5-TR, Bipolar I disorder.
- Lewis, K. J. S., et al. (2017). Sleep loss as a trigger of mood episodes in bipolar disorder. *British Journal of Psychiatry*.
- Harvey, A. G. (2008). Sleep disturbance in bipolar disorder. *American Journal of Psychiatry*.
- Johnson, S. L., et al. (2000). Increases in manic symptoms after life events involving goal attainment. *Journal of Abnormal Psychology*.
- Johnson, S. L., et al. Negative and goal-attainment life events in bipolar I.
- Frank, E., et al. (2005). Two-year outcomes for interpersonal and social rhythm therapy. *Archives of General Psychiatry*.
- Miklowitz, D. J. Family systems and relapse in recurrent psychiatric disorders.
- Viscardi, L. H., et al. Personal stigma and treatment adherence.

## Run locally

```sh
npm install
npm run dev
```

Then open the address Vite prints (http://localhost:5280). Your phone must be on the same Wi-Fi to scan the QR code.
