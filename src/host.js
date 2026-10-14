// Lobby + message routing, run by the host. Enforces who is allowed to do what.
import { Game } from './game.js';
import { EMOTE_IDS } from './roles/emote.js';

export const ROLES = ['blind', 'deaf', 'mute'];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number(v) || lo));

export class HostController {
  players = new Map();
  game = null;
  phase = 'lobby';

  /** deliverLocal(msg) hands a message to the host's own UI. */
  constructor({ net, name, deliverLocal }) {
    this.net = net;
    this.localId = net.id;
    this.deliverLocal = deliverLocal;
    net.onMessage = (id, msg) => this.onMessage(id, msg);
    net.onLeave = (id) => this.onLeave(id);
    this.players.set(this.localId, { id: this.localId, name: name || 'Host', role: null });
    this.broadcastLobby();
  }

  sendTo(id, msg) {
    if (id === this.localId) this.deliverLocal(msg);
    else this.net.send(id, msg);
  }

  broadcast(msg) {
    for (const id of this.players.keys()) this.sendTo(id, msg);
  }

  broadcastLobby() {
    const players = [...this.players.values()];
    for (const p of players) {
      this.sendTo(p.id, { t: 'lobby', players, code: this.net.code, hostId: this.localId, you: p.id });
    }
  }

  onLeave(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    if (this.phase === 'playing') {
      this.game.stop();
      this.phase = 'ended';
      this.broadcast({ t: 'end', result: 'aborted', reason: `${p.name} disconnected.` });
    } else if (this.phase === 'lobby') {
      this.broadcastLobby();
    }
  }

  onMessage(id, msg) {
    const p = this.players.get(id);
    if (!msg || typeof msg !== 'object') return;
    const asRole = p && (p.role === 'solo' || p.role === msg.as) ? msg.as : null;

    switch (msg.t) {
      case 'join':
        if (this.phase !== 'lobby') return this.net.send(id, { t: 'error', text: 'A game is already in progress.' });
        if (this.players.size >= 3) return this.net.send(id, { t: 'error', text: 'Room is full (3 players).' });
        this.players.set(id, { id, name: String(msg.name || 'Player').slice(0, 16), role: null });
        this.broadcastLobby();
        break;

      case 'pick': {
        if (this.phase !== 'lobby' || !p) return;
        const taken = [...this.players.values()].some((q) => q.id !== id && q.role === msg.role);
        if (msg.role === null || (ROLES.includes(msg.role) && !taken)) p.role = msg.role;
        this.broadcastLobby();
        break;
      }

      case 'start':
        if (id === this.localId && this.phase === 'lobby') this.start(msg);
        break;

      case 'act':
        if (this.phase === 'playing' && asRole === 'blind') this.game.act(msg.mod, msg.a);
        break;

      case 'chat':
        if (this.phase !== 'playing' || (asRole !== 'deaf' && asRole !== 'mute')) return;
        for (const q of this.players.values()) {
          if (['deaf', 'mute', 'solo'].includes(q.role)) this.sendTo(q.id, { t: 'chat', from: asRole, text: String(msg.text).slice(0, 200) });
        }
        break;

      case 'emote': { // number/gesture emote: Mute -> Deaf (and Mute's own echo)
        if (this.phase !== 'playing' || asRole !== 'mute' || !EMOTE_IDS.has(msg.id)) return;
        const now = Date.now();
        if (now - (p.lastEmote || 0) < 400) return;
        p.lastEmote = now;
        for (const q of this.players.values()) {
          if (['deaf', 'mute', 'solo'].includes(q.role)) this.sendTo(q.id, { t: 'emote', id: msg.id });
        }
        break;
      }

      case 'say': // typed text spoken aloud on the Blind player's device
        if (this.phase !== 'playing' || asRole !== 'deaf') return;
        for (const q of this.players.values()) {
          if (q.role === 'blind' || q.role === 'solo') this.sendTo(q.id, { t: 'say', text: String(msg.text).slice(0, 200) });
        }
        break;

      case 'restart':
        if (id !== this.localId || this.phase === 'lobby') return;
        this.game?.stop();
        this.phase = 'lobby';
        for (const q of this.players.values()) if (q.role === 'solo') q.role = null;
        this.broadcastLobby();
        break;
    }
  }

  start(msg) {
    const me = this.players.get(this.localId);
    if (msg.solo) {
      if (this.players.size > 1) return this.sendTo(this.localId, { t: 'error', text: 'Solo mode needs an empty room.' });
      me.role = 'solo';
    } else {
      const roles = [...this.players.values()].map((q) => q.role);
      if (!ROLES.every((r) => roles.includes(r))) {
        return this.sendTo(this.localId, { t: 'error', text: 'All three roles must be claimed first.' });
      }
    }
    this.game = new Game({
      seed: Math.random().toString(36).slice(2),
      modules: clamp(msg.modules, 3, 6),
      minutes: clamp(msg.minutes, 2, 10),
      onState: () => this.pushState(),
      onEvent: (e) => this.broadcast({ t: 'ev', ...e }),
      onEnd: (r) => { this.phase = 'ended'; this.broadcast({ t: 'end', ...r }); },
    });
    const roster = {};
    for (const q of this.players.values()) roster[q.role] = q.id;
    const manual = this.game.manualPages();
    const roomSeed = Math.random().toString(36).slice(2, 8);
    for (const q of this.players.values()) {
      this.sendTo(q.id, {
        t: 'start', role: q.role, roster, roomSeed,
        manual: q.role === 'mute' || q.role === 'solo' ? manual : null,
      });
    }
    this.phase = 'playing';
    this.game.start();
    this.pushState();
  }

  pushState() {
    for (const q of this.players.values()) {
      const roles = q.role === 'solo' ? ROLES : [q.role];
      const views = {};
      for (const r of roles) views[r] = this.game.viewFor(r);
      this.sendTo(q.id, { t: 'state', views });
    }
  }
}
