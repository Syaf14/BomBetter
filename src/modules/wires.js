// Wires: cut the right wire. The rule set per wire-count is randomized every game.
const COLORS = ['red', 'blue', 'yellow', 'black', 'white'];
const POS = ['first', 'second', 'third', 'last'];
const KINDS = ['none', 'one', 'many', 'last', 'odd'];
export const WIRE_CSS = { red: '#e5484d', blue: '#3e63dd', yellow: '#f5c518', black: '#1b1b1f', white: '#f2f2f2' };

const condText = (c) => ({
  none: `there are no ${c.c} wires`,
  one: `there is exactly one ${c.c} wire`,
  many: `there is more than one ${c.c} wire`,
  last: `the last wire is ${c.c}`,
  odd: 'the last digit of the serial number is odd',
})[c.k];

const actText = (a) =>
  a.pos ? `cut the ${a.pos} wire` : a.which === 'only' ? `cut the ${a.color} wire` : `cut the ${a.which} ${a.color} wire`;

function matches(c, wires, odd) {
  const n = wires.filter((w) => w === c.c).length;
  switch (c.k) {
    case 'none': return n === 0;
    case 'one': return n === 1;
    case 'many': return n > 1;
    case 'last': return wires[wires.length - 1] === c.c;
    case 'odd': return odd;
  }
}

function actIndex(a, wires) {
  if (a.pos) return { first: 0, second: 1, third: 2, last: wires.length - 1 }[a.pos];
  return a.which === 'last' ? wires.lastIndexOf(a.color) : wires.indexOf(a.color);
}

function solve(rules, wires, odd) {
  const set = rules[wires.length];
  for (const r of set.list) if (matches(r.cond, wires, odd)) return actIndex(r.act, wires);
  return actIndex(set.def, wires);
}

export default {
  type: 'wires',
  title: 'Wires',

  makeRules(rng) {
    const rules = {};
    for (let n = 3; n <= 6; n++) {
      const kinds = rng.shuffle(KINDS).slice(0, n <= 4 ? 2 : 3);
      const list = kinds.map((k) => {
        const c = rng.pick(COLORS);
        const act = k === 'one' ? { color: c, which: 'only' }
          : k === 'many' ? { color: c, which: rng.pick(['first', 'last']) }
          : { pos: rng.pick(POS) };
        return { cond: { k, c }, act };
      });
      rules[n] = { list, def: { pos: rng.pick(POS) } };
    }
    return rules;
  },

  manual(rules) {
    return `<h3>Wires</h3>
      <p>Count the wires, jump to that section, and follow the <b>first</b> rule that is true.</p>` +
      [3, 4, 5, 6].map((n) => `<h4>${n} wires</h4><ol>${rules[n].list
        .map((r) => `<li>If ${condText(r.cond)}, ${actText(r.act)}.</li>`).join('')}
        <li>Otherwise, ${actText(rules[n].def)}.</li></ol>`).join('');
  },

  create(rng, { bomb, rules }) {
    const n = rng.int(3, 6);
    const wires = Array.from({ length: n }, () => rng.pick(COLORS));
    return { wires, cut: wires.map(() => false), answer: solve(rules, wires, bomb.serialOdd) };
  },

  view: (s) => ({ wires: s.wires, cut: s.cut }),
  blindView: (s) => ({ n: s.wires.length, cut: s.cut }),

  act(s, a) {
    if (typeof a.cut !== 'number' || s.cut[a.cut] !== false) return;
    s.cut[a.cut] = true;
    return a.cut === s.answer ? 'solved' : 'strike';
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="wires">${v.wires.map((c, i) =>
      `<div class="wire ${v.cut[i] ? 'cut' : ''}" style="--w:${WIRE_CSS[c]}"></div>`).join('')}</div>`;
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="b-wires">${Array.from({ length: v.n }, (_, i) =>
      `<button class="pad" data-i="${i}" aria-label="Wire ${i + 1}" ${v.cut[i] ? 'disabled' : ''}></button>`).join('')}</div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () => ctx.send({ cut: +b.dataset.i })));
  },
};
