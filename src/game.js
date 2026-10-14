// Authoritative game state. Runs only in the HOST's browser.
import { makeRng } from './rng.js';
import { MODULES, TYPES } from './modules/index.js';

const SERIAL_POOL = [...'ABCDEFGHJKLMNPQRSTUVWXZ0123456789'];
const INDICATORS = ['SND', 'CLR', 'CAR', 'IND', 'FRQ', 'SIG', 'NSA', 'MSA', 'TRN', 'BOB', 'FRK'];

export function buildBomb(seed, moduleCount) {
  const rng = makeRng(seed);
  let serial = '';
  for (let i = 0; i < 5; i++) serial += rng.pick(SERIAL_POOL);
  serial += rng.int(0, 9);
  const bomb = {
    serial,
    serialOdd: Number(serial.slice(-1)) % 2 === 1,
    serialVowel: /[AEU]/.test(serial),
    batteries: rng.int(0, 4),
    indicators: rng.shuffle(INDICATORS).slice(0, rng.int(0, 3)).map((label) => ({ label, lit: rng.chance(0.5) })),
  };

  // Every module type appears before any repeats.
  const types = [];
  let pool = [];
  while (types.length < moduleCount) {
    if (!pool.length) pool = rng.shuffle(TYPES);
    types.push(pool.pop());
  }
  const rules = {};
  for (const t of new Set(types)) rules[t] = MODULES[t].makeRules(rng);
  const modules = types.map((type) => ({
    type,
    solved: false,
    state: MODULES[type].create(rng, { bomb, rules: rules[type], now: 0 }),
  }));
  return { bomb, rules, modules };
}

export class Game {
  /** opts: { seed, modules, minutes, onState(), onEvent(ev), onEnd(result) } */
  constructor(opts) {
    this.opts = opts;
    Object.assign(this, buildBomb(opts.seed, opts.modules));
    this.rng = makeRng(opts.seed + ':run');
    this.remaining = opts.minutes * 60000;
    this.strikes = 0;
    this.strikesMax = 3;
    this.rate = 1;
    this.t = 0;
    this.phase = 'ready';
    this.dirty = true;
    this.lastSend = 0;
  }

  get types() {
    return [...new Set(this.modules.map((m) => m.type))];
  }

  manualPages() {
    return this.types.map((t) => ({ type: t, title: MODULES[t].title, html: MODULES[t].manual(this.rules[t]) }));
  }

  ctx(m) {
    return {
      bomb: this.bomb, rules: this.rules[m.type], t: this.t, remaining: this.remaining,
      strikes: this.strikes, rng: this.rng,
    };
  }

  start() {
    this.phase = 'playing';
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  }

  stop() {
    clearInterval(this.timer);
    this.phase = 'stopped';
  }

  tick() {
    const now = performance.now();
    const dt = now - this.last;
    this.last = now;
    this.t += dt;
    this.remaining -= dt * this.rate;
    if (this.remaining <= 0) {
      this.remaining = 0;
      return this.end('exploded', 'The timer ran out.');
    }
    for (const m of this.modules) {
      if (!m.solved && MODULES[m.type].tick?.(m.state, this.ctx(m))) this.dirty = true;
    }
    if (this.dirty || this.t - this.lastSend >= 1000) {
      this.dirty = false;
      this.lastSend = this.t;
      this.opts.onState();
    }
  }

  act(index, a) {
    const m = this.modules[index];
    if (this.phase !== 'playing' || !m || m.solved || !a || typeof a !== 'object') return;
    const res = MODULES[m.type].act(m.state, a, this.ctx(m));
    this.dirty = true;
    if (res === 'strike') {
      this.strikes++;
      this.rate = 1 + 0.25 * this.strikes;
      this.opts.onEvent({ e: 'strike' });
      if (this.strikes >= this.strikesMax) return this.end('exploded', 'Too many strikes.');
    } else if (res === 'solved') {
      m.solved = true;
      this.opts.onEvent({ e: 'solved', mod: index });
      if (this.modules.every((x) => x.solved)) return this.end('defused', 'Every module is disarmed.');
    }
    this.opts.onState();
  }

  end(result, reason) {
    if (this.phase !== 'playing') return;
    clearInterval(this.timer);
    this.phase = result;
    this.opts.onEvent({ e: result === 'defused' ? 'win' : 'boom' });
    this.opts.onState();
    this.opts.onEnd({ result, reason, summary: this.summary() });
  }

  summary() {
    return {
      solved: this.modules.filter((m) => m.solved).length,
      total: this.modules.length,
      strikes: this.strikes,
      remaining: Math.round(this.remaining),
    };
  }

  viewFor(role) {
    const base = {
      phase: this.phase, remaining: this.remaining, rate: this.rate,
      strikes: this.strikes, strikesMax: this.strikesMax,
    };
    const mods = (fn) => this.modules.map((m) => ({ type: m.type, solved: m.solved, view: MODULES[m.type][fn](m.state) }));
    if (role === 'deaf') {
      const b = this.bomb;
      return { ...base, bomb: { serial: b.serial, batteries: b.batteries, indicators: b.indicators }, modules: mods('view') };
    }
    if (role === 'blind') return { ...base, modules: mods('blindView') };
    return { ...base, solved: this.modules.filter((m) => m.solved).length, total: this.modules.length };
  }
}
