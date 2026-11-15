// HowToScreen: three short cards explaining the game, with a button to read the Road guide.
import { openGuide } from './RoadGuideScreen.js';
export class HowToScreen {
  constructor(app) { this.app = app; }

  enter() {
    const { app } = this;
    app.setPhoneScreen('howto');
    this.guideOpen = false;
    app.ui.innerHTML = `
      <div class="screen dim">
        <div class="stack">
          <div class="howto">
            <div class="card"><div class="num">1</div><h2>Steer</h2><p>Steer left and right to keep the needle in the middle of the mood meter.</p></div>
            <div class="card"><div class="num">2</div><h2>Push and steady</h2><p>Triggers push your mood. Support items steady it. Pull in at rest stops and pit stops.</p></div>
            <div class="card"><div class="num">3</div><h2>No game over</h2><p>There is no game over. Episodes happen, and support helps you recover.</p></div>
          </div>
          <div class="row"><button class="btn go">Let’s drive</button><button class="btn secondary guide-btn">Road guide</button><span class="hint" style="background:var(--paper);padding:4px 10px;border-radius:10px">Keyboard: ◀ ▶ steer · Space pull in · Esc pause</span></div>
        </div>
      </div>`;
    const next = () => { if (!this.guideOpen) app.show('intro'); };
    app.ui.querySelector('.guide-btn').addEventListener('click', () => {
      if (this.guideOpen) return;
      this.guideOpen = true;
      const holder = document.createElement('div');
      app.ui.appendChild(holder);
      openGuide(holder, app, { button: 'Back', onDone: () => {
        holder.remove();
        app.setPhoneScreen('howto');
        setTimeout(() => { this.guideOpen = false; }, 0);
      } });
    });
    app.ui.querySelector('.go').addEventListener('click', next);
    app.ui.querySelector('.go').focus();
    this.offs = [app.input.on('start', next), app.input.on('pull', next)];
  }

  exit() { this.offs.forEach((off) => off()); }

  update(dt) { this.app.screens.title.update(dt); }
}
