// BLIND: acts on the bomb but cannot see it. Dim, label-free controls; audio + haptic feedback.
import { MODULES } from '../modules/index.js';
import { audio } from '../audio.js';
import { clock } from '../clock.js';
import { mountScene } from '../3d/stage.js';

export function createBlind(root, ctx) {
  root.innerHTML = `<section class="pane blind">
    <header class="role-head"><b>🙈 BLIND</b><span>Listen to the Deaf player. You can't see the bomb.</span></header>
    <div class="blind-status"><span id="b-idx"></span>${ctx.voice ? '<button class="pad mic" id="b-mic" type="button" aria-label="Microphone to Mute player: off">🎤</button>' : ''}<span id="b-str"></span></div>
    <div class="seat-slot b-scene"></div>
    <div class="blind-stage" id="b-stage"></div>
    <nav class="blind-nav">
      <button class="pad" id="b-prev" aria-label="Previous module">◀</button>
      <button class="pad" id="b-next" aria-label="Next module">▶</button>
    </nav></section>`;
  const stage = root.querySelector('#b-stage');
  // Black & white 3D room. Built only from what Blind may know: the room seed and which modules are done.
  const scene = ctx.roomSeed ? mountScene(root.querySelector('.b-scene'), { seed: ctx.roomSeed, seat: 'blind', mono: true, bomb: 'blank', fallback: false, onSelect: pick3d }) : null;
  let mods = [];
  let cur = 0;
  let shown = null;
  let lastSec = null;
  let raf = 0;

  function renderCur() {
    const m = mods[cur];
    if (!m) return;
    root.querySelector('#b-idx').textContent = `${cur + 1} / ${mods.length}`;
    scene?.highlight(cur);
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
    scene?.setSelected(cur);
    audio.speak(`Module ${cur + 1}`);
  }
  // Clicking a plate on the 3D bomb selects that module; clicking the case itself sits back.
  function pick3d(i) {
    if (i < 0) return scene?.zoomOut();
    audio.stopTone();
    audio.unlock();
    cur = i;
    shown = null;
    renderCur();
    scene?.setSelected(cur);
    audio.speak(`Module ${cur + 1}`);
  }
  const mic = root.querySelector('#b-mic');
  if (mic) {
    mic.onclick = async () => {
      try {
        const on = await ctx.voice.toggle();
        mic.classList.toggle('live', on);
        mic.setAttribute('aria-label', `Microphone to Mute player: ${on ? 'on' : 'off'}`);
        audio.speak(on ? 'Mic on' : 'Mic off');
      } catch {
        audio.speak('Microphone unavailable');
      }
    };
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
      scene?.setBomb({ modules: mods.map((m) => ({ solved: m.solved })) });
      renderCur();
    },
    event(ev) {
      scene?.react(ev.e);
      if (ev.e === 'strike') audio.strike();
      else if (ev.e === 'solved') audio.solved();
      else if (ev.e === 'boom') { audio.stopTone(); audio.boom(); }
      else if (ev.e === 'win') { audio.stopTone(); audio.win(); }
    },
    say(text) { audio.speak(text); },
    destroy() { cancelAnimationFrame(raf); audio.stopTone(); scene?.destroy(); },
  };
}
