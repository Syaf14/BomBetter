import { rrect, centeredText } from './draw.js';
// Simon Says: the Deaf player SEES colors flash, the Blind player HEARS pitches and taps positions.
// Color index = position index: 0 red (top), 1 blue (right), 2 green (bottom), 3 yellow (left).
export const COLORS = ['red', 'blue', 'green', 'yellow'];
export const POSITIONS = ['top', 'right', 'bottom', 'left'];
export const PITCH = [262, 330, 392, 523];
export const CSS = { red: '#e5484d', blue: '#3e63dd', green: '#30a46c', yellow: '#f5c518' };

export default {
  type: 'simon',
  title: 'Simon Says',

  makeRules(rng) {
    // table[serialHasVowel][strikes 0..2][flashedColor] = color to press
    const table = [0, 1].map(() => [0, 1, 2].map(() => rng.shuffle([0, 1, 2, 3])));
    return { table };
  },

  manual(rules) {
    const block = (v) => `<table><tr><th>Strikes</th>${COLORS.map((c) => `<th>${c}</th>`).join('')}</tr>` +
      [0, 1, 2].map((st) => `<tr><td>${st === 2 ? '2+' : st}</td>${rules.table[v][st]
        .map((p) => `<td>${COLORS[p]}</td>`).join('')}</tr>`).join('') + '</table>';
    return `<h3>Simon Says</h3>
      <p>A color flashes. Press the color the table says <b>for that flash</b> (read across: flashed color on top, color to press below).
      Each stage replays the sequence with one more flash. Re-enter the <b>whole</b> sequence translated each time.
      The table depends on the serial number and the current strike count.</p>
      <h4>Serial number contains a vowel (A, E or U)</h4>${block(1)}
      <h4>No vowel in the serial number</h4>${block(0)}`;
  },

  create(rng, { now }) {
    return {
      seq: Array.from({ length: rng.int(3, 5) }, () => rng.int(0, 3)),
      stage: 1, input: [], lit: null, phase: 'idle', i: 0, nextAt: now + 1500,
    };
  },

  view: (s) => ({ lit: s.lit, stage: s.stage, total: s.seq.length }),
  blindView: (s) => ({ tone: s.lit }),

  tick(s, ctx) {
    if (ctx.t < s.nextAt) return false;
    if (s.phase === 'idle') { s.i = 0; s.lit = s.seq[0]; s.phase = 'on'; s.nextAt = ctx.t + 500; }
    else if (s.phase === 'on') { s.lit = null; s.phase = 'gap'; s.nextAt = ctx.t + 250; }
    else if (++s.i < s.stage) { s.lit = s.seq[s.i]; s.phase = 'on'; s.nextAt = ctx.t + 500; }
    else { s.phase = 'idle'; s.nextAt = ctx.t + 4500; }
    return true;
  },

  act(s, a, ctx) {
    const p = a.press;
    if (!(p >= 0 && p < 4)) return;
    s.phase = 'idle';
    s.lit = null;
    const map = ctx.rules.table[ctx.bomb.serialVowel ? 1 : 0][Math.min(ctx.strikes, 2)];
    if (p !== map[s.seq[s.input.length]]) {
      s.input = [];
      s.nextAt = ctx.t + 1500;
      return 'strike';
    }
    s.input.push(p);
    s.nextAt = ctx.t + 5000;
    if (s.input.length < s.stage) return;
    s.input = [];
    s.stage++;
    s.nextAt = ctx.t + 1500;
    return s.stage > s.seq.length ? 'solved' : undefined;
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="simon">${COLORS.map((c, i) =>
      `<div class="sq ${POSITIONS[i]} ${v.lit === i ? 'on' : ''}" style="--c:${CSS[c]}"></div>`).join('')}
      <div class="simon-stage">${v.stage}/${v.total}</div></div>`;
  },

  draw3d(ctx, v, w, h) {
    const s = Math.min(w, h) * 0.34;
    const cx = w / 2;
    const cy = h / 2;
    const off = s * 0.96;
    const spots = [[0, -off], [off, 0], [0, off], [-off, 0]]; // top, right, bottom, left = red, blue, green, yellow
    COLORS.forEach((c, i) => {
      const [dx, dy] = spots[i];
      const on = v.lit === i;
      ctx.save();
      ctx.globalAlpha = on ? 1 : 0.3;
      if (on) { ctx.shadowColor = CSS[c]; ctx.shadowBlur = s * 0.6; }
      ctx.fillStyle = CSS[c];
      rrect(ctx, cx + dx - s / 2, cy + dy - s / 2, s, s, s * 0.22); ctx.fill();
      ctx.restore();
    });
    centeredText(ctx, `${v.stage}/${v.total}`, cx, cy, s * 0.42, '#8c8b99');
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="simon blind">${POSITIONS.map((p, i) =>
      `<button class="pad sq ${p}" data-i="${i}" aria-label="${p}"></button>`).join('')}</div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () => ctx.send({ press: +b.dataset.i })));
    if (v.tone == null) ctx.audio.stopTone();
    else ctx.audio.startTone(PITCH[v.tone]);
  },
};
