import { rrect, centeredText } from './draw.js';
// Memory: four stages. A display digit tells you which button to press, using a randomized table.
// Later stages can refer back to earlier presses ("same position as stage 1" etc.).
const ORD = ['', '1st', '2nd', '3rd', '4th'];

function actionText(a) {
  if (a.pos) return `press the button in the <b>${ORD[a.pos]}</b> position`;
  if (a.label) return `press the button labeled <b>${a.label}</b>`;
  if (a.posOf) return `press the button in the <b>same position</b> as you pressed in stage <b>${a.posOf}</b>`;
  return `press the button with the <b>same label</b> as you pressed in stage <b>${a.labelOf}</b>`;
}

function target(s, rules) {
  const a = rules.table[s.stage][s.display - 1];
  if (a.pos) return a.pos - 1;
  if (a.label) return s.labels.indexOf(a.label);
  if (a.posOf) return s.history[a.posOf - 1].pos;
  return s.labels.indexOf(s.history[a.labelOf - 1].label);
}

function newRound(s, rng) {
  s.display = rng.int(1, 4);
  s.labels = rng.shuffle([1, 2, 3, 4]);
}

export default {
  type: 'memory',
  title: 'Memory',

  makeRules(rng) {
    const table = [0, 1, 2, 3].map((stage) => [1, 2, 3, 4].map(() => {
      const opts = [{ pos: rng.int(1, 4) }, { label: rng.int(1, 4) }];
      if (stage > 0) {
        const earlier = rng.int(1, stage);
        opts.push({ posOf: earlier }, { labelOf: earlier });
      }
      return rng.pick(opts);
    }));
    return { table };
  },

  manual(rules) {
    return `<h3>Memory</h3>
      <p>There are 4 stages. At each stage, find the row for the <b>display number</b> and follow it. Positions count 1–4 from the left.
      Remember what you pressed: later stages refer back. A strike restarts from stage 1.</p>` +
      rules.table.map((rows, st) => `<h4>Stage ${st + 1}</h4><ul>${rows
        .map((a, d) => `<li>Display <b>${d + 1}</b>: ${actionText(a)}.</li>`).join('')}</ul>`).join('');
  },

  create(rng) {
    const s = { stage: 0, history: [] };
    newRound(s, rng);
    return s;
  },

  view: (s) => ({ display: s.display, labels: s.labels, stage: s.stage }),
  blindView: () => ({}),

  act(s, a, ctx) {
    if (!(a.press >= 0 && a.press < 4)) return;
    if (a.press !== target(s, ctx.rules)) {
      s.stage = 0;
      s.history = [];
      newRound(s, ctx.rng);
      return 'strike';
    }
    s.history.push({ pos: a.press, label: s.labels[a.press] });
    s.stage++;
    if (s.stage === 4) return 'solved';
    newRound(s, ctx.rng);
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="memory">
      <div class="mem-display">${v.display}</div>
      <div class="mem-btns">${v.labels.map((l) => `<div class="mem-btn">${l}</div>`).join('')}</div>
      <div class="pips">${[0, 1, 2, 3].map((i) => `<i class="${i < v.stage ? 'on' : ''}"></i>`).join('')}</div></div>`;
  },

  draw3d(ctx, v, w, h) {
    ctx.fillStyle = '#0a2a14';
    rrect(ctx, w * 0.1, h * 0.04, w * 0.8, h * 0.44, h * 0.06); ctx.fill();
    centeredText(ctx, String(v.display), w / 2, h * 0.27, h * 0.38, '#5dff8a', 800, 'ui-monospace, Consolas, monospace');
    const bw = (w * 0.8 - 3 * (w * 0.03)) / 4;
    v.labels.forEach((l, i) => {
      const x = w * 0.1 + i * (bw + w * 0.03);
      ctx.fillStyle = '#e9e2cf';
      rrect(ctx, x, h * 0.54, bw, h * 0.28, h * 0.05); ctx.fill();
      centeredText(ctx, String(l), x + bw / 2, h * 0.68, h * 0.2, '#15151a');
    });
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i < v.stage ? '#30a46c' : '#333';
      ctx.beginPath(); ctx.arc(w / 2 + (i - 1.5) * h * 0.1, h * 0.92, h * 0.032, 0, Math.PI * 2); ctx.fill();
    }
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="b-row">${[0, 1, 2, 3].map((i) =>
      `<button class="pad" data-i="${i}" aria-label="Position ${i + 1}"></button>`).join('')}</div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () => ctx.send({ press: +b.dataset.i })));
  },
};
