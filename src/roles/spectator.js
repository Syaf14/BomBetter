// SPECTATOR: watches the whole table and hears Deaf and Blind, but cannot speak, type, emote or act.
import { MODULES } from '../modules/index.js';
import { clock } from '../clock.js';
import { createChat } from './chat.js';
import { emoteById } from './emote.js';
import { mountScene } from '../3d/stage.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export function createSpectator(root, ctx) {
  root.innerHTML = `<section class="pane spectator">
    <header class="role-head"><b>👁️ SPECTATOR</b><span>You can watch and listen, nothing else.</span></header>
    <div class="spec-banner">Spectating: you hear Deaf and Blind, but you can't speak, type or act.</div>
    <div class="bomb-top"><div class="timer" id="s-timer">--:--</div><div class="strikes" id="s-strikes"></div></div>
    <div class="edgework" id="s-edge"></div>
    <div class="seat-slot"></div>
    <div class="spec-mods modules" id="s-mods"></div>
    <div id="s-chat"></div></section>`;

  const chat = createChat(root.querySelector('#s-chat'), { me: 'spectator', other: '', send: () => {}, readOnly: true });
  const scene = ctx.roomSeed ? mountScene(root.querySelector('.seat-slot'), { seed: ctx.roomSeed, seat: 'spectator', bomb: 'full' }) : null;
  const modsEl = root.querySelector('#s-mods');
  const shown = [];
  let raf = 0;
  const frame = () => {
    root.querySelector('#s-timer').textContent = clock.format();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    update(v) {
      root.querySelector('#s-strikes').textContent = '✖'.repeat(v.strikes) + '◻'.repeat(v.strikesMax - v.strikes);
      const b = v.bomb;
      root.querySelector('#s-edge').innerHTML =
        `<span class="serial">S/N <b>${esc(b.serial)}</b></span><span>🔋 ${b.batteries}</span>
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
    event: (ev) => scene?.react(ev.e),
    chat: (msg) => chat.add(msg),
    emote(msg) {
      const e = emoteById(msg.id);
      if (!e) return;
      const from = msg.from || 'mute';
      scene?.emote(e, from);
      chat.add({ from, text: `${e.face} ${e.label}` });
    },
    destroy() { cancelAnimationFrame(raf); scene?.destroy(); },
  };
}
