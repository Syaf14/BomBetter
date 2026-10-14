// Peer-to-peer networking via PeerJS (WebRTC). The host's browser is the server;
// PeerJS's public broker is only used for the initial handshake.
const PREFIX = 'bombetter-';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const makeCode = () => Array.from({ length: 4 }, () => CODE_CHARS[(Math.random() * CODE_CHARS.length) | 0]).join('');

function whenOpen(peer) {
  return new Promise((resolve, reject) => {
    peer.on('open', resolve);
    peer.on('error', reject);
  });
}

export class HostNet {
  conns = new Map();
  onMessage = () => {};
  onJoin = () => {};
  onLeave = () => {};
  onError = () => {};
  onCall = null;

  async open() {
    if (typeof Peer === 'undefined') throw new Error('PeerJS failed to load (are you offline?)');
    for (let i = 0; i < 5 && !this.peer; i++) {
      const code = makeCode();
      const peer = new Peer(PREFIX + code);
      try {
        await whenOpen(peer);
        this.peer = peer;
        this.code = code;
      } catch (e) {
        peer.destroy();
        if (e.type !== 'unavailable-id') throw e;
      }
    }
    if (!this.peer) throw new Error('Could not create a room, try again.');
    this.peer.on('connection', (c) => {
      c.on('open', () => this.conns.set(c.peer, c));
      c.on('data', (d) => this.onMessage(c.peer, d));
      c.on('close', () => { this.conns.delete(c.peer); this.onLeave(c.peer); });
      c.on('error', () => {});
    });
    this.peer.on('call', (call) => this.onCall?.(call));
    this.peer.on('error', (e) => this.onError(e));
    return this.code;
  }

  get id() { return this.peer.id; }

  send(id, msg) {
    const c = this.conns.get(id);
    if (c && c.open) c.send(msg);
  }
}

/** Offline stand-in used for solo testing: no network at all. */
export class LocalNet {
  id = 'local';
  code = 'SOLO';
  onMessage = () => {};
  onLeave = () => {};
  onError = () => {};
  async open() { return this.code; }
  send() {}
}

export class ClientNet {
  onMessage = () => {};
  onClose = () => {};
  onCall = null;

  async connect(code) {
    if (typeof Peer === 'undefined') throw new Error('PeerJS failed to load (are you offline?)');
    this.peer = new Peer();
    await whenOpen(this.peer);
    const conn = this.peer.connect(PREFIX + code.toUpperCase(), { reliable: true });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out. Check the room code.')), 10000);
      conn.on('open', () => { clearTimeout(timer); resolve(); });
      conn.on('error', reject);
      this.peer.on('error', (e) => {
        clearTimeout(timer);
        reject(e.type === 'peer-unavailable' ? new Error('No room with that code.') : e);
      });
    });
    this.conn = conn;
    conn.on('data', (d) => this.onMessage(d));
    conn.on('close', () => this.onClose());
    this.peer.on('call', (call) => this.onCall?.(call));
  }

  get id() { return this.peer.id; }

  send(msg) {
    if (this.conn?.open) this.conn.send(msg);
  }
}
