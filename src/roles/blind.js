// BLIND: acts on the bomb but cannot see it. Dim, label-free controls; audio + haptic feedback.
import { MODULES } from '../modules/index.js';
import { audio } from '../audio.js';
import { clock } from '../clock.js';

export function createBlind(root, ctx) {
  root.innerHTML = `<section class="pane blind">
    <header class="role-head"><b>🙈 BLIND</b><span>Listen to the Deaf player. You can't see the bomb.</span></header>
    <div class="blind-status"><span id="b-idx"></span><span id="b-str"></span></div>
    <div class="blind-stage" id="b-stage"></div>
    <nav class="blind-nav">
      <button class="pad" id="b-prev" aria-label="Previous module">◀</button>
      <button class="pad" id="b-next" aria-label="Next module">▶</button>
    </nav></section>`;
  const stage = root.querySelector('#b-stage');
  let mods = [];
  let cur = 0;
  let shown = null;
  let lastSec = null;
  let raf = 0;

  function renderCur() {
    const m = mods[cur];
    if (!m) return;
    root.querySelector('#b-idx').textContent = `${cur + 1} / ${mods.length}`;
    const key = JSON.stringify(m);
    if (key === shown) return;
    shown = key;
    MODULES[m.type].renderBlind(stage, m.view, {
      audio,
      send: (a) => { audio.click(); ctx.send({ t: 'act', as: 'blind', mod: cur, a }); },
    });
    stage.classList.toggle('solved', m.solved);
    if (m.solved) { audio.stopTone(); stage.querySelectorAll('.pad').forEach((p) => (p.disabled = true)); }
  }

  function go(d) {
    audio.stopTone();
    audio.unlock();
    cur = (cur + d + mods.length) % mods.length;
    shown = null;
    renderCur();
    audio.speak(`Module ${cur + 1}`);
  }
  root.querySelector('#b-prev').onclick = () => go(-1);
  root.querySelector('#b-next').onclick = () => go(1);

  function frame() {
    if (clock.running) {
      const s = Math.ceil(clock.get() / 1000);
      if (s !== lastSec) { lastSec = s; audio.tick(s <= 30); }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    update(view) {
      mods = view.modules;
      root.querySelector('#b-str').textContent = '✖'.repeat(view.strikes);
      renderCur();
    },
    event(ev) {
      if (ev.e === 'strike') audio.strike();
      else if (ev.e === 'solved') audio.solved();
      else if (ev.e === 'boom') { audio.stopTone(); audio.boom(); }
      else if (ev.e === 'win') { audio.stopTone(); audio.win(); }
    },
    say(text) { audio.speak(text); },
    destroy() { cancelAnimationFrame(raf); audio.stopTone(); },
  };
}
