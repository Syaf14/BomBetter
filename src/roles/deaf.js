// DEAF: sees the whole bomb, hears nothing. Talks to Blind (voice / spoken text), texts the Mute player.
import { MODULES } from '../modules/index.js';
import { clock } from '../clock.js';
import { createChat } from './chat.js';
import { emoteById } from './emote.js';
import { mountScene } from '../3d/stage.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function createDeaf(root, ctx) {
  root.innerHTML = `<section class="pane deaf">
    <header class="role-head"><b>🙉 DEAF</b><span>You see the bomb. Tell the Blind player what to do; ask the Mute player for the manual.</span></header>
    <div class="seat-slot"></div>
    <div class="hand-pop hidden" id="d-hand" aria-live="assertive"></div>
    <div class="bomb">
      <div class="bomb-top"><div class="timer" id="d-timer">--:--</div><div class="strikes" id="d-strikes"></div></div>
      <div class="edgework" id="d-edge"></div>
      <div class="modules" id="d-mods"></div>
    </div>
    <div class="talk">
      ${ctx.voice ? '<button class="btn" id="d-mic" type="button">🎤 Start voice to Blind</button>' : ''}
      <form id="d-say"><input maxlength="200" placeholder="…or type: spoken aloud on the Blind device" autocomplete="off"><button class="btn">Speak</button></form>
      <p class="hint" id="d-voice-note">🔇 You are Deaf: the game never plays voice or sound on this device. Mute Discord output too if you hear anything.</p>
    </div>
    <div id="d-chat"></div></section>`;

  const chat = createChat(root.querySelector('#d-chat'), {
    me: 'deaf', other: 'Mute', send: ctx.send,
    quick: ['Say again', 'Which module?', 'Wait', 'Done ✓'],
  });
  let selected = -1;
  const scene = ctx.roomSeed ? mountScene(root.querySelector('.seat-slot'), {
    seed: ctx.roomSeed, seat: 'deaf', bomb: 'full',
    onSelect: (i) => select(i),
    onMode: (is3d) => root.firstElementChild.classList.toggle('has3d', is3d), // the 3D bomb replaces the module cards
  }) : null;
  function select(i) {
    selected = i;
    if (i < 0) scene?.zoomOut(); else scene?.setSelected(i);
    [...modsEl.children].forEach((c, j) => c.classList.toggle('sel', j === i));
    modsEl.children[i]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const hand = root.querySelector('#d-hand');
  let handTimer = 0;
  const modsEl = root.querySelector('#d-mods');
  const shown = [];
  let raf = 0;

  const mic = root.querySelector('#d-mic');
  if (mic) {
    mic.onclick = async () => {
      try {
        const on = await ctx.voice.toggle();
        mic.textContent = on ? '🎤 Voice ON (tap to mute)' : '🔇 Voice muted (tap to talk)';
        mic.classList.toggle('live', on);
      } catch {
        root.querySelector('#d-voice-note').textContent =
          'Microphone unavailable (needs HTTPS and permission). Use the text box instead.';
      }
    };
  }
  root.querySelector('#d-say').onsubmit = (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    if (input.value.trim()) ctx.send({ t: 'say', as: 'deaf', text: input.value.trim() });
    input.value = '';
  };

  function frame() {
    root.querySelector('#d-timer').textContent = clock.format();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    update(v) {
      root.querySelector('#d-strikes').textContent = '✖'.repeat(v.strikes) + '◻'.repeat(v.strikesMax - v.strikes);
      const b = v.bomb;
      root.querySelector('#d-edge').innerHTML =
        `<span class="serial">S/N <b>${esc(b.serial)}</b></span>
         <span>🔋 ${b.batteries}</span>
         ${b.indicators.map((i) => `<span class="ind ${i.lit ? 'lit' : ''}">${i.lit ? '●' : '○'} ${i.label}</span>`).join('')}`;
      if (modsEl.children.length !== v.modules.length) {
        modsEl.innerHTML = v.modules.map((m, i) =>
          `<div class="mod"><div class="mod-label">${i + 1}. ${MODULES[m.type].title}</div><div class="mod-body"></div></div>`).join('');
        shown.length = 0;
      }
      scene?.setBomb({ modules: v.modules, strikes: v.strikes, strikesMax: v.strikesMax, bomb: b });
      v.modules.forEach((m, i) => {
        const key = JSON.stringify(m);
        if (shown[i] === key) return;
        shown[i] = key;
        const card = modsEl.children[i];
        card.classList.toggle('solved', m.solved);
        MODULES[m.type].renderDeaf(card.querySelector('.mod-body'), m.view);
      });
    },
    event(ev) {
      if (ev.e === 'strike') {
        root.classList.add('flash');
        setTimeout(() => root.classList.remove('flash'), 450);
      }
      scene?.react(ev.e);
    },
    chat: (msg) => chat.add(msg),
    emote(msg) {
      const e = emoteById(msg.id);
      if (!e) return;
      const from = msg.from || 'mute';
      scene?.emote(e, from);
      hand.classList.toggle('taunt', !!e.taunt);
      hand.innerHTML = `<span class="hand-face">${e.face}</span><b>${e.label}</b>${e.taunt ? '<small>Blind is taunting you!</small>' : ''}`;
      hand.classList.remove('hidden', 'pop');
      void hand.offsetWidth; // restart the pop animation
      hand.classList.add('pop');
      clearTimeout(handTimer);
      handTimer = setTimeout(() => hand.classList.add('hidden'), 4000);
      chat.add({ from, text: `${e.face} ${e.label}` });
    },
    destroy() {
      clearTimeout(handTimer); cancelAnimationFrame(raf); scene?.destroy(); },
  };
}
