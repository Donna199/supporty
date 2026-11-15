// TitleScreen: game name, the kart on an empty road, character select (girl or boy),
// the controller QR code with its room code and connection status, and a
// "Play on this device" link. Start on the phone (or Enter) begins.
import { controllerUrl, drawQR } from '../net.js';

const STATUS = {
  opening: ['', 'Opening a room…'],
  waiting: ['', 'Waiting for your phone'],
  connected: ['ok', 'Controller connected'],
  lost: ['bad', 'Controller disconnected. Scan again to reconnect.'],
  error: ['bad', 'The phone link is blocked on this network. Use the keyboard or “Play on this device”.'],
};

export class TitleScreen {
  constructor(app) { this.app = app; }

  enter() {
    const { app } = this;
    app.setPhoneScreen('title');
    app.setPhase('stable');
    app.world.chase.snap = true;
    const calm = { stable: 1, manic: 0, depressive: 0 };
    app.world.weather.setBlend(calm);
    app.world.chase.setBlend(calm);
    app.sound.setBlend(calm);
    app.world.car.speed = 5;
    app.world.car.x = 0;
    app.world.car.lean = 0;
    app.world.car.vx = 0;
    app.ui.innerHTML = `
      <div class="screen title">
        <div class="title-left">
          <div>
            <h1 class="logo">Supporty</h1>
            <div class="subtitle">A Year with Bipolar I</div>
            <div class="tagline">A game about one year with bipolar I disorder.</div>
          </div>
          <div>
            <div class="driver-pick" role="radiogroup" aria-label="Choose your driver">
              <button class="driver-card" data-driver="girl" role="radio"><span class="swatch" style="background:#5cbf8f"></span>Shally</button>
              <button class="driver-card" data-driver="boy" role="radio"><span class="swatch" style="background:#a83a35"></span>Brandon</button>
            </div>
            <p class="hint">Choose your driver with ◀ ▶ (phone or keyboard) or click.</p>
          </div>
        </div>
        <div class="title-right">
          <div class="card qr-card">
            <canvas class="qr" width="420" height="420" aria-label="QR code for the phone controller"></canvas>
            <div class="room"></div>
            <div class="hint">Scan with your phone camera to use it as the controller</div>
            <div class="network-tip">📶 Make sure your phone and this computer are on the same Wi-Fi network.</div>
            <div class="status"><span class="dot"></span><span class="status-text"></span></div>
            <button class="link local-link">Play on this device instead</button>
          </div>
          <div class="press-start">Press Start on your phone, or Enter</div>
        </div>
      </div>`;
    const $ = (s) => app.ui.querySelector(s);
    for (const b of app.ui.querySelectorAll('.driver-card')) b.addEventListener('click', () => this.pick(b.dataset.driver));
    $('.local-link').addEventListener('click', () => { app.enableLocalPad(); this.refresh(); });
    this.pick(app.driver);
    this.refresh();

    this.offs = [
      app.input.on('steer', (dir) => { if (dir) this.pick(dir < 0 ? 'girl' : 'boy'); }),
      app.input.on('start', () => app.show('contentNote')),
      app.input.on('pull', () => app.show('contentNote')),
    ];
    const onStatus = () => this.refresh();
    app.statusListeners.add(onStatus);
    this.offs.push(() => app.statusListeners.delete(onStatus));
  }

  pick(name) {
    const { app } = this;
    if (app.driver !== name) {
      app.driver = name;
      app.world.setDriver(name);
    }
    for (const b of app.ui.querySelectorAll('.driver-card')) {
      const on = b.dataset.driver === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', on);
    }
  }

  refresh() {
    const { app } = this;
    const $ = (s) => app.ui.querySelector(s);
    if (!$('.qr-card')) return;
    if (app.localPad) {
      $('.qr-card').style.display = 'none';
      $('.press-start').textContent = 'Tap Start, or press Enter';
      return;
    }
    const [cls, text] = STATUS[app.net.status] || STATUS.opening;
    $('.dot').className = `dot ${cls}`;
    $('.status-text').textContent = text;
    if (this.qrCode !== app.net.code) {
      this.qrCode = app.net.code;
      $('.room').textContent = app.net.code;
      drawQR($('.qr'), controllerUrl(app.net.code));
    }
    $('.press-start').textContent = app.net.connected ? 'Press Start on your phone' : 'Press Enter to play with the keyboard';
  }

  exit() { this.offs.forEach((off) => off()); }

  update(dt) {
    const { world } = this.app;
    world.car.s += world.car.speed * dt;
    world.placeKart(dt);
    world.chase.showcase(dt, world.kart.group.position, world.frame.fwd, world.frame.right);
  }
}
