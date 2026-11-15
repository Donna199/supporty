// net.js: the phone link. The game screen opens a PeerJS "room" named by a
// 4-letter code and shows it as a QR code; the phone joins that room.
// Messages are small JSON objects, e.g. {t:'steer', dir:-1}. See PRD "Messages".
import Peer from 'peerjs';
import QRCode from 'qrcode';
import { CONFIG } from './config.js';

const N = CONFIG.net;

/** 4 letters with no vowels, so a random code never spells a word. */
export function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 4; i++) code += N.roomLetters[Math.floor(Math.random() * N.roomLetters.length)];
  return code;
}

/** URL the phone should open. On localhost we swap in the laptop's Wi-Fi address. */
export function controllerUrl(code) {
  const url = new URL('controller.html', window.location.href);
  if (['localhost', '127.0.0.1', '::1'].includes(url.hostname) && __LAN_IP__ !== 'localhost') url.hostname = __LAN_IP__;
  url.search = `?room=${code}`;
  url.hash = '';
  return url.toString();
}

export function drawQR(canvas, text) {
  return QRCode.toCanvas(canvas, text, { width: 420, margin: 1, color: { dark: '#3b3433', light: '#fffaf0' } });
}

/** Game-screen side: opens the room and accepts one controller at a time. */
export class HostLink {
  constructor({ onMessage, onStatus }) {
    this.onMessage = onMessage;
    this.onStatus = onStatus; // 'opening' | 'waiting' | 'connected' | 'lost' | 'error'
    this.conn = null;
    this.status = 'opening';
    this.lastSeen = 0;
    setInterval(() => this._heartbeat(), 1000);
  }

  open() {
    this.code = makeRoomCode();
    this._set('opening');
    this.peer?.destroy();
    this.peer = new Peer(N.peerPrefix + this.code, { debug: 0 });
    this.peer.on('open', () => this._set(this.conn?.open ? 'connected' : 'waiting'));
    this.peer.on('connection', (conn) => this._accept(conn));
    this.peer.on('disconnected', () => { if (!this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', (err) => {
      if (err.type === 'unavailable-id') return this.open(); // code already taken: pick another
      if (err.type === 'peer-unavailable') return;
      console.warn('PeerJS:', err.type, err);
      this.error = err.type;
      if (!this.conn?.open) this._set('error');
    });
    return this.code;
  }

  _accept(conn) {
    if (this.conn && this.conn !== conn) this.conn.close();
    this.conn = conn;
    conn.on('open', () => {
      this.lastSeen = performance.now();
      this.everConnected = true;
      this._set('connected');
      this.send({ t: 'buzz', pattern: [60] });
      this.onConnect?.();
    });
    conn.on('data', (msg) => {
      this.lastSeen = performance.now();
      if (msg?.t !== 'ping') this.onMessage(msg);
    });
    conn.on('close', () => { if (this.conn === conn) { this.conn = null; this._set('lost'); } });
    conn.on('error', () => {});
  }

  // The phone pings every second; if it goes quiet (closed tab, locked phone) we treat it as lost.
  _heartbeat() {
    if (this.status === 'connected' && performance.now() - this.lastSeen > 4500) {
      this.conn?.close();
      this.conn = null;
      this._set('lost');
    }
  }

  send(msg) { if (this.conn?.open) this.conn.send(msg); }
  get connected() { return this.status === 'connected'; }
  _set(s) { this.status = s; this.onStatus?.(s); }
}

/** Phone side: joins the room and keeps retrying until it gets through. */
export class PhoneLink {
  constructor(code, { onMessage, onStatus }) {
    this.code = code;
    this.onMessage = onMessage;
    this.onStatus = onStatus; // 'connecting' | 'connected' | 'lost'
    this.conn = null;
  }

  connect() {
    this.onStatus('connecting');
    this.peer = new Peer({ debug: 0 });
    this.peer.on('open', () => this._dial());
    this.peer.on('disconnected', () => { if (!this.peer.destroyed) this.peer.reconnect(); });
    this.peer.on('error', (err) => {
      console.warn('PeerJS:', err.type);
      if (err.type === 'peer-unavailable') this._retry();
    });
    setInterval(() => this.send({ t: 'ping' }), 1000);
  }

  _dial() {
    const conn = this.peer.connect(N.peerPrefix + this.code, { reliable: true, serialization: 'json' });
    this.conn = conn;
    conn.on('open', () => this.onStatus('connected'));
    conn.on('data', (msg) => this.onMessage(msg));
    conn.on('close', () => { if (this.conn === conn) { this.conn = null; this.onStatus('lost'); this._retry(); } });
    setTimeout(() => { if (this.conn === conn && !conn.open) { conn.close(); this.conn = null; this._retry(); } }, 7000);
  }

  _retry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { if (!this.conn?.open && this.peer.open) this._dial(); }, 2000);
  }

  send(msg) { if (this.conn?.open) this.conn.send(msg); }
}
