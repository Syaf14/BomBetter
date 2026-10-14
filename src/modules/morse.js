// Morse: a lamp blinks a word (Deaf SEES it, Blind HEARS it). The manual maps word -> frequency.
// The Blind player tunes the frequency and transmits.
const WORDS = ['shell', 'halls', 'slick', 'trick', 'boxes', 'leaks', 'strobe', 'bistro',
  'flick', 'bombs', 'break', 'brick', 'steak', 'sting', 'vector', 'beats'];
const FREQS = Array.from({ length: 16 }, (_, k) => 3505 + 5 * k);
const fmt = (f) => (f / 1000).toFixed(3);
const MORSE = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.', g: '--.', h: '....', i: '..', j: '.---',
  k: '-.-', l: '.-..', m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.', s: '...', t: '-',
  u: '..-', v: '...-', w: '.--', x: '-..-', y: '-.--', z: '--..',
};

function buildSteps(word) {
  const out = [];
  [...word].forEach((ch, li, arr) => {
    const code = MORSE[ch];
    [...code].forEach((sym, si) => {
      out.push({ on: true, d: sym === '.' ? 250 : 750 });
      const lastSym = si === code.length - 1;
      out.push({ on: false, d: lastSym ? (li === arr.length - 1 ? 2500 : 750) : 250 });
    });
  });
  return out;
}

export default {
  type: 'morse',
  title: 'Morse Code',

  makeRules(rng) {
    const fr = rng.shuffle(FREQS);
    return { freq: Object.fromEntries(WORDS.map((w, i) => [w, fr[i]])) };
  },

  manual(rules) {
    const words = WORDS.slice().sort();
    return `<h3>Morse Code</h3>
      <p>A lamp blinks a word in Morse, over and over. A short blink is a <b>dot</b>, a long blink a <b>dash</b>.
      A longer pause separates letters, and the biggest pause marks where the word restarts.
      Decode the word, then tell the defuser which frequency to tune to and transmit.</p>
      <table>${words.map((w) => `<tr><td>${w}</td><td>${fmt(rules.freq[w])} MHz</td></tr>`).join('')}</table>
      <h4>Morse chart</h4>
      <div class="morse-chart">${Object.entries(MORSE).map(([k, v]) => `<span><b>${k}</b> ${v}</span>`).join('')}</div>`;
  },

  create(rng, { rules, now }) {
    const word = rng.pick(WORDS);
    let idx;
    do idx = rng.int(0, FREQS.length - 1); while (FREQS[idx] === rules.freq[word]);
    return { word, idx, steps: buildSteps(word), i: 0, lamp: false, nextAt: now + 1000 };
  },

  view: (s) => ({ lamp: s.lamp, freq: fmt(FREQS[s.idx]) }),
  blindView: (s) => ({ tone: s.lamp }),

  tick(s, ctx) {
    if (ctx.t < s.nextAt) return false;
    const st = s.steps[s.i];
    s.lamp = st.on;
    s.nextAt = ctx.t + st.d;
    s.i = (s.i + 1) % s.steps.length;
    return true;
  },

  act(s, a, ctx) {
    if (a.move === 1 || a.move === -1) {
      s.idx = Math.min(FREQS.length - 1, Math.max(0, s.idx + a.move));
      return;
    }
    if (a.tx) return FREQS[s.idx] === ctx.rules.freq[s.word] ? 'solved' : 'strike';
  },

  renderDeaf(el, v) {
    el.innerHTML = `<div class="morse"><div class="lamp ${v.lamp ? 'on' : ''}"></div>
      <div class="freq">${v.freq}<small> MHz</small></div></div>`;
  },

  renderBlind(el, v, ctx) {
    el.innerHTML = `<div class="b-row">
      <button class="pad" data-a="-1" aria-label="Lower frequency"></button>
      <button class="pad" data-a="tx" aria-label="Transmit"></button>
      <button class="pad" data-a="1" aria-label="Higher frequency"></button></div>`;
    el.querySelectorAll('.pad').forEach((b) => (b.onclick = () =>
      ctx.send(b.dataset.a === 'tx' ? { tx: true } : { move: +b.dataset.a })));
    if (v.tone) ctx.audio.startTone(640); else ctx.audio.stopTone();
  },
};
