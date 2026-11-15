// ContentNoteScreen: the content note shown before playing. Continue on the phone,
// Enter, or the button moves on to How to play.
export class ContentNoteScreen {
  constructor(app) { this.app = app; }

  enter() {
    const { app } = this;
    app.setPhoneScreen('note');
    app.ui.innerHTML = `
      <div class="screen dim">
        <div class="card" role="dialog" aria-labelledby="note-title">
          <h2 id="note-title">Content note</h2>
          <p>This game shows one composite experience of bipolar I disorder. Experiences vary from person to person. It includes depictions of low mood and risky behaviour.</p>
          <div class="row"><button class="btn go">Continue</button><span class="hint">or press Continue on your phone</span></div>
        </div>
      </div>`;
    const next = () => app.show('howTo');
    app.ui.querySelector('.go').addEventListener('click', next);
    app.ui.querySelector('.go').focus();
    this.offs = [app.input.on('start', next), app.input.on('pull', next)];
  }

  exit() { this.offs.forEach((off) => off()); }

  update(dt) { this.app.screens.title.update(dt); }
}
