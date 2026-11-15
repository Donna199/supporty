// RoadGuideScreen: "Your road guide". A grid of cards, one per thing on the road,
// each with its small rotating 3D model (or a drawn mood picture), its name and one
// line. Shown after the story intro ("Start driving"), and from the pause menu.
import { GUIDE } from '../content.js';
import { drawInto } from '../world/thumbs.js';

const VISUAL = {
  meter: '<div class="mini-meter"><span>LOW</span><span>STABLE</span><span>HIGH</span><i style="left:50%"></i></div>',
  manic: '<div class="mini-scene manic"><b></b><b></b><b></b><div class="mini-meter"><span></span><span></span><span></span><i style="left:96%"></i></div></div>',
  depressive: '<div class="mini-scene depressive"><b></b><b></b><b></b><b></b><div class="mini-meter"><span></span><span></span><span></span><i style="left:4%"></i></div></div>',
};

/** Opens the guide inside `holder`. Calls onDone when the button is pressed. */
export function openGuide(holder, app, { button, onDone }) {
  holder.className = 'guide-layer';
  holder.innerHTML = `
    <div class="guide" role="dialog" aria-labelledby="guide-title">
      <h2 id="guide-title">Your road guide</h2>
      ${GUIDE.map((g) => `
        <h3>${g.heading}</h3>
        <div class="guide-grid">
          ${g.items.map((it) => `
            <div class="guide-card">
              <div class="guide-pic">${it.model ? `<canvas width="192" height="144" data-model="${it.model}" aria-hidden="true"></canvas>` : VISUAL[it.visual]}</div>
              <div class="guide-name">${it.name}</div>
              <div class="guide-line">${it.line}</div>
            </div>`).join('')}
        </div>`).join('')}
      <div class="guide-foot"><button class="btn done">${button}</button></div>
    </div>`;
  const canvases = [...holder.querySelectorAll('canvas[data-model]')].map((c, i) => ({ ctx: c.getContext('2d'), id: c.dataset.model, phase: i * 0.7 }));
  let open = true;
  const start = performance.now();
  const spin = () => {
    if (!open) return;
    const t = (performance.now() - start) / 1000;
    for (const c of canvases) drawInto(c.ctx, c.id, Math.sin(t * 0.6 + c.phase) * 0.9, t + c.phase); // slow turntable sway, front stays readable
    requestAnimationFrame(spin);
  };
  spin();
  const close = () => { if (!open) return; open = false; offs.forEach((off) => off()); onDone(); };
  holder.querySelector('.done').addEventListener('click', close);
  holder.querySelector('.done').focus({ preventScroll: true });
  const offs = [app.input.on('start', close), app.input.on('pull', close)];
  app.setPhoneScreen('guide');
  return close;
}

/** Onboarding version: "Start driving" goes to the drive. */
export class RoadGuideScreen {
  constructor(app) { this.app = app; }
  enter() {
    const holder = document.createElement('div');
    this.app.ui.appendChild(holder);
    this.close = openGuide(holder, this.app, { button: 'Start driving', onDone: () => this.app.show('drive') });
  }
  exit() { this.close?.(); }
  update(dt) { this.app.screens.title.update(dt); }
}
