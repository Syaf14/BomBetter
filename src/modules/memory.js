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

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="b-row">${[0, 1, 2, 3].map((i) =>
      `<button class="pad" data-i="${i}" aria-label="Position ${i + 1}"></button>`).join('')}</div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () => ctx.send({ press: +b.dataset.i })));
  },
};
