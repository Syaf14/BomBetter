import { rrect, centeredText } from './draw.js';
// Keypad: press four symbols in the order they appear in the matching manual column.
const GLYPHS = [...'☺★☾♠♣♥♦¶ΩΨЖ☯✿☂✈☎✂⚓☠⚡♫✚❄☀⚙✉⌛♞☢'];

export default {
  type: 'keypad',
  title: 'Keypad',

  makeRules(rng) {
    const g = rng.shuffle(GLYPHS);
    return { cols: [0, 1, 2, 3].map((i) => g.slice(i * 7, i * 7 + 7)) };
  },

  manual(rules) {
    return `<h3>Keypad</h3>
      <p>Find the column that contains <b>all four</b> symbols on the keypad. Press the symbols in the order they
      appear in that column, <b>top to bottom</b>.</p>
      <div class="cols">${rules.cols.map((c) => `<div class="col">${c.map((x) => `<span>${x}</span>`).join('')}</div>`).join('')}</div>`;
  },

  create(rng, { rules }) {
    const col = rng.pick(rules.cols);
    const chosen = rng.shuffle(col).slice(0, 4);
    return {
      glyphs: chosen,
      order: chosen.slice().sort((a, b) => col.indexOf(a) - col.indexOf(b)),
      next: 0,
      lit: [false, false, false, false],
    };
  },

  view: (s) => ({ glyphs: s.glyphs, lit: s.lit }),
  blindView: (s) => ({ lit: s.lit }),

  act(s, a) {
    const i = a.press;
    if (!(i >= 0 && i < 4) || s.lit[i]) return;
    if (s.glyphs[i] !== s.order[s.next]) return 'strike';
    s.lit[i] = true;
    s.next++;
    return s.next === 4 ? 'solved' : undefined;
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="keypad">${v.glyphs.map((g, i) =>
      `<div class="key ${v.lit[i] ? 'lit' : ''}">${g}</div>`).join('')}</div>`;
  },

  draw3d(ctx, v, w, h) {
    const g = Math.min(w, h) * 0.04;
    const kw = (w * 0.78 - g) / 2;
    const kh = (h - g * 3) / 2;
    v.glyphs.forEach((glyph, i) => {
      const x = w * 0.11 + (i % 2) * (kw + g);
      const y = g + Math.floor(i / 2) * (kh + g);
      ctx.fillStyle = v.lit[i] ? '#30a46c' : '#e9e2cf';
      rrect(ctx, x, y, kw, kh, kh * 0.14); ctx.fill();
      centeredText(ctx, glyph, x + kw / 2, y + kh / 2 + kh * 0.04, kh * 0.62, v.lit[i] ? '#fff' : '#15151a', 700, '"Segoe UI Symbol", "Noto Sans Symbols", "Apple Symbols", system-ui, sans-serif');
    });
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="b-grid">${v.lit.map((l, i) =>
      `<button class="pad" data-i="${i}" aria-label="Key ${i + 1}" ${l ? 'disabled' : ''}></button>`).join('')}</div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () => ctx.send({ press: +b.dataset.i })));
  },
};
