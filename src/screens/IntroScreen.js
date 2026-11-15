// IntroScreen: the story intro. Six short cards, one at a time, with the chosen
// driver idling in the kart behind them (the guardrails card also shows the HUD's fence icons). Next (phone Start / Pull in, Space, Enter,
// or a click) advances; "Skip intro" is always visible. Then the Road guide.
import { storyCards, GUARDRAIL_CARD } from '../content.js';
import { openGuide } from './RoadGuideScreen.js';

export class IntroScreen {
  constructor(app) { this.app = app; }

  enter() {
    const { app } = this;
    app.setPhoneScreen('intro');
    this.cards = storyCards(app.driver === 'boy' ? 'Brandon' : 'Shally');
    this.index = 0;
    this.guideOpen = false;
    this.t = 0;
    app.ui.innerHTML = `
      <div class="screen intro">
        <div class="top-actions">
          <button class="btn secondary guide-btn">Road guide</button>
          <button class="btn secondary skip">Skip intro</button>
        </div>
        <div class="card story-card" role="region" aria-label="Story">
          <div class="story-guardrails" aria-hidden="true">${'<span class="gr-fence on"><i></i><i></i><i></i><b></b><b></b></span>'.repeat(2)}<span class="gr-fence"><i></i><i></i><i></i><b></b><b></b></span></div>
          <p class="story-text" aria-live="polite"></p>
          <div class="row story-foot">
            <div class="dots" aria-hidden="true">${this.cards.map(() => '<i></i>').join('')}</div><span class="sr-only card-count"></span>
            <button class="btn next">Next</button>
          </div>
          <p class="hint">Space, Enter, click, or Start on your phone</p>
        </div>
      </div>`;
    const $ = (s) => app.ui.querySelector(s);
    $('.next').addEventListener('click', (e) => { e.stopPropagation(); this.next(); });
    $('.story-card').addEventListener('click', () => this.next());
    $('.skip').addEventListener('click', () => app.show('guide'));
    $('.guide-btn').addEventListener('click', (e) => { e.stopPropagation(); this.openGuide(); });
    this.offs = [app.input.on('start', () => this.next()), app.input.on('pull', () => this.next())];
    this.render();
    $('.next').focus();
  }

  render() {
    const $ = (s) => this.app.ui.querySelector(s);
    const text = $('.story-text');
    text.textContent = this.cards[this.index];
    text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap'); // ease each card in
    $('.story-guardrails').classList.toggle('show', this.index === GUARDRAIL_CARD);
    this.app.ui.querySelectorAll('.dots i').forEach((d, i) => d.classList.toggle('on', i === this.index));
    $('.card-count').textContent = `Card ${this.index + 1} of ${this.cards.length}`;
    $('.next').textContent = this.index === this.cards.length - 1 ? 'Road guide' : 'Next';
  }

  /** Read the road guide on top of the story, then come back to the same card. */
  openGuide() {
    if (this.guideOpen) return;
    this.guideOpen = true;
    const holder = document.createElement('div');
    this.app.ui.appendChild(holder);
    openGuide(holder, this.app, { button: 'Back to the story', onDone: () => {
      holder.remove();
      this.app.setPhoneScreen('intro');
      setTimeout(() => { this.guideOpen = false; }, 0);
    } });
  }

  next() {
    if (this.guideOpen) return;
    if (this.index < this.cards.length - 1) { this.index++; this.render(); }
    else this.app.show('guide');
  }

  exit() { this.offs.forEach((off) => off()); }

  update(dt) {
    // The kart rolls slowly on the title view; the driver idles (sways and bobs).
    this.t += dt;
    this.app.screens.title.update(dt);
    const kart = this.app.world.kart;
    kart.setLean(Math.sin(this.t * 1.6) * 0.7);
    kart.group.position.y += Math.abs(Math.sin(this.t * 3)) * 0.06;
  }
}
