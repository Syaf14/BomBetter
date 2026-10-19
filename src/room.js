// A small decorated room. Same seed => same room for everyone, so players can refer to
// "the ball" or "the red painting". Purely cosmetic, unrelated to the bomb or manual.
import { makeRng } from './rng.js';

const PAINTINGS = ['#30a46c', '#3e63dd', '#f5c518', '#e5484d'];
const FRAME = '#6b4a2b';
const PROPS = {
  ball: (x, c) => `<circle cx="${x}" cy="102" r="14" fill="${c}"/><path d="M${x - 10} 96q10 6 20 0" stroke="#0003" fill="none"/>`,
  crate: (x, c) => `<rect x="${x - 13}" y="89" width="26" height="26" fill="${c}" stroke="#0004"/><path d="M${x - 13} 89l26 26M${x + 13} 89l-26 26" stroke="#0003"/>`,
  cone: (x, c) => `<path d="M${x} 86l15 29h-30z" fill="${c}"/><rect x="${x - 15}" y="112" width="30" height="4" fill="#0005"/>`,
  star: (x, c) => `<path d="M${x} 88l4.5 9.5 10.5 1.4-7.7 7.2 2 10.4-9.3-5.2-9.3 5.2 2-10.4-7.7-7.2 10.5-1.4z" fill="${c}"/>`,
  plant: (x) => `<path d="M${x - 10} 100h20l-3 16h-14z" fill="#a0522d"/><path d="M${x} 100c-14-6-14-20-4-26 2 10 6 14 4 26zM${x} 100c14-6 14-20 4-26-2 10-6 14-4 26z" fill="#30a46c"/>`,
  lamp: (x, c) => `<path d="M${x - 9} 84h18l6 14h-30z" fill="${c}"/><rect x="${x - 2}" y="98" width="4" height="16" fill="#888"/><rect x="${x - 9}" y="113" width="18" height="3" fill="#888"/>`,
  triangle: (x, c) => `<path d="M${x - 15} 115h30l-15-28z" fill="${c}"/>`,
};
const TINTS = ['#e5484d', '#3e63dd', '#f5c518', '#30a46c', '#ff8a3d', '#b35fe8', '#f2f2f2'];

/**
 * The seeded layout, in the 400x124 SVG coordinate space. Shared by the SVG room below and the 3D room
 * (src/3d/room3d.js). The rng calls must stay in this exact order so every player gets the same room.
 */
export function roomLayout(seed) {
  const rng = makeRng(`room:${seed}`);
  const order = rng.shuffle(PAINTINGS);
  const paintings = order.map((color, i) => ({
    color, x: 22 + i * 92 + rng.int(-4, 4), w: rng.pick([48, 56, 64]), h: rng.pick([36, 44, 52]),
  }));
  const names = rng.shuffle(Object.keys(PROPS)).slice(0, 4);
  const props = names.map((name, i) => ({ name, x: 50 + i * 95 + rng.int(-18, 18), tint: rng.pick(TINTS) }));
  const rug = rng.chance(0.6) ? { cx: rng.int(120, 280), rx: rng.int(55, 90), tint: rng.pick(TINTS) } : null;
  return { paintings, props, rug };
}

export const roomSvg = (seed) => {
  const layout = roomLayout(seed);
  const paintings = layout.paintings.map(({ x, w, h, color }) =>
    `<rect x="${x - 3}" y="${12 - 3}" width="${w + 6}" height="${h + 6}" fill="${FRAME}"/>` +
    `<rect x="${x}" y="12" width="${w}" height="${h}" fill="${color}"/>`).join('');
  const props = layout.props.map((p) => PROPS[p.name](p.x, p.tint)).join('');
  const rug = layout.rug
    ? `<ellipse cx="${layout.rug.cx}" cy="116" rx="${layout.rug.rx}" ry="5" fill="${layout.rug.tint}" opacity=".35"/>` : '';
  return `<svg viewBox="0 0 400 124" role="img" aria-label="A decorated room" preserveAspectRatio="xMidYMax slice">
    <rect width="400" height="84" fill="#2a2433"/><rect y="84" width="400" height="40" fill="#3b2f27"/>
    <rect y="82" width="400" height="4" fill="#00000055"/>${paintings}${rug}${props}</svg>`;
};

const KEY = 'bombetter-room';
const read = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
const write = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ } };

/** Mounts a collapsible room strip into `el`. */
export function mountRoom(el, seed) {
  let on = read();
  el.classList.add('room');
  el.innerHTML = `<button type="button" class="room-toggle" aria-expanded="${on}">🖼 Room</button><div class="room-view">${roomSvg(seed)}</div>`;
  const view = el.querySelector('.room-view');
  const btn = el.querySelector('.room-toggle');
  const sync = () => { view.hidden = !on; btn.setAttribute('aria-expanded', String(on)); };
  btn.onclick = () => { on = !on; write(on); sync(); };
  sync();
}
