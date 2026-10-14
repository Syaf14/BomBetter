// The Big Button: tap, or hold and release on a timer digit. Rules randomized per game.
const COLORS = ['red', 'blue', 'white', 'yellow'];
const LABELS = ['ABORT', 'DETONATE', 'HOLD', 'PRESS'];
const STRIPS = ['blue', 'white', 'yellow', 'red', 'green'];
const INDS = ['SND', 'CLR', 'CAR', 'IND', 'FRQ', 'SIG', 'NSA', 'MSA', 'TRN', 'BOB', 'FRK'];
export const CSS = { red: '#e5484d', blue: '#3e63dd', white: '#f2f2f2', yellow: '#f5c518', green: '#30a46c' };

const condText = (c) => ({
  label: `the button says <b>${c.v}</b>`,
  color: `the button is <b>${c.v}</b>`,
  both: `the button is <b>${c.color}</b> and says <b>${c.label}</b>`,
  batt: `there are more than <b>${c.n}</b> batteries`,
  lit: `there is a <b>lit</b> indicator labeled <b>${c.v}</b>`,
  odd: 'the last digit of the serial number is odd',
})[c.k];

function matches(c, b, bomb) {
  switch (c.k) {
    case 'label': return b.label === c.v;
    case 'color': return b.color === c.v;
    case 'both': return b.color === c.color && b.label === c.label;
    case 'batt': return bomb.batteries > c.n;
    case 'lit': return bomb.indicators.some((i) => i.lit && i.label === c.v);
    case 'odd': return bomb.serialOdd;
  }
}

function decide(rules, b, bomb) {
  for (const r of rules.list) if (matches(r.cond, b, bomb)) return r.action;
  return rules.def;
}

const timeStr = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default {
  type: 'button',
  title: 'Big Button',

  makeRules(rng) {
    const digits = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, STRIPS.length);
    const digitFor = Object.fromEntries(STRIPS.map((s, i) => [s, digits[i]]));
    const conds = [
      () => ({ k: 'label', v: rng.pick(LABELS) }),
      () => ({ k: 'color', v: rng.pick(COLORS) }),
      () => ({ k: 'both', color: rng.pick(COLORS), label: rng.pick(LABELS) }),
      () => ({ k: 'batt', n: rng.int(0, 2) }),
      () => ({ k: 'lit', v: rng.pick(INDS) }),
      () => ({ k: 'odd' }),
    ];
    const list = rng.shuffle(conds).slice(0, 4).map((mk) => ({ cond: mk(), action: rng.pick(['tap', 'hold']) }));
    return { list, def: rng.pick(['tap', 'hold']), digitFor };
  },

  manual(rules) {
    return `<h3>The Big Button</h3>
      <p><b>Tap</b> = press and release immediately. <b>Hold</b> = keep it pressed; a colored strip lights up.
      Release when the countdown timer shows the strip's digit <i>anywhere</i> in the time (e.g. 3 matches 4:03, 3:45 and 1:31).</p>
      <p>Follow the <b>first</b> rule that is true:</p>
      <ol>${rules.list.map((r) => `<li>If ${condText(r.cond)}: <b>${r.action}</b>.</li>`).join('')}
      <li>Otherwise: <b>${rules.def}</b>.</li></ol>
      <h4>Strip color → release digit</h4>
      <table>${STRIPS.map((s) => `<tr><td>${s}</td><td><b>${rules.digitFor[s]}</b></td></tr>`).join('')}</table>`;
  },

  create(rng) {
    return { color: rng.pick(COLORS), label: rng.pick(LABELS), strip: rng.pick(STRIPS), held: false };
  },

  view: (s) => ({ color: s.color, label: s.label, held: s.held, strip: s.held ? s.strip : null }),
  blindView: () => ({}),

  act(s, a, ctx) {
    if (a.down) { s.held = true; return; }
    if (!a.up || !s.held) return;
    s.held = false;
    const action = decide(ctx.rules, s, ctx.bomb);
    const heldMs = Number(a.heldMs) || 0;
    if (heldMs < 500) return action === 'tap' ? 'solved' : 'strike';
    if (action === 'tap') return 'strike';
    const digit = String(ctx.rules.digitFor[s.strip]);
    // Allow one second of network lag: the player saw the display slightly earlier than the host.
    const ok = [ctx.remaining, ctx.remaining + 1000].some((ms) => timeStr(ms).includes(digit));
    return ok ? 'solved' : 'strike';
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="bigbtn-wrap">
      <div class="bigbtn" style="--c:${CSS[v.color]};${v.color === 'white' || v.color === 'yellow' ? 'color:#111' : ''}"><span>${v.label}</span></div>
      <div class="strip" style="background:${v.strip ? CSS[v.strip] : '#2a2a30'}"></div></div>`;
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = '<button class="pad round" aria-label="Big button"></button>';
    const b = el.firstChild;
    let t0 = 0;
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      t0 = performance.now();
      ctx.send({ down: true });
    };
    const up = () => {
      if (!t0) return;
      const heldMs = performance.now() - t0;
      t0 = 0;
      ctx.send({ up: true, heldMs });
    };
    b.onpointerup = up;
    b.onpointercancel = up;
  },
};
