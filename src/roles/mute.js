// MUTE: holds the manual, cannot speak. Text only.
import { clock } from '../clock.js';
import { createChat } from './chat.js';
import { createEmoteWheel, emoteById } from './emote.js';
import { mountScene } from '../3d/stage.js';

const BASICS = `<h3>Basics</h3>
  <p>You can't see the bomb, and the Deaf player can't hear you: <b>text them</b>. Ask for the details you need.</p>
  <ul>
    <li><b>Serial number</b>: ask whether it contains a vowel (A, E, U) and whether the last digit is odd or even.</li>
    <li><b>Batteries</b> and <b>indicators</b> (lit ● or unlit ○, with a 3-letter label): some rules depend on them.</li>
    <li><b>Strikes</b>: three strikes and the bomb explodes. Every strike also speeds up the timer.</li>
  </ul>
  <p>Open each module's tab, ask the Deaf player what it looks like, then tell them what the Blind player should press.</p>`;

export function createMute(root, ctx) {
  const pages = [{ title: 'Basics', html: BASICS }, ...ctx.manual];
  root.innerHTML = `<section class="pane mute">
    <header class="role-head"><b>🤐 MUTE</b><span>You hold the manual. You can hear Deaf and Blind, but you can only send text.</span></header>
    <div class="seat-slot"></div>
    <div class="mute-top"><span class="timer sm" id="m-timer">--:--</span><span id="m-prog"></span><span class="strikes" id="m-str"></span></div>
    <nav class="tabs">${pages.map((p, i) => `<button type="button" data-i="${i}" class="${i ? '' : 'on'}">${p.title}</button>`).join('')}</nav>
    <article class="manual" id="m-page">${pages[0].html}</article>
    <div id="m-chat"></div></section>`;

  const scene = ctx.roomSeed ? mountScene(root.querySelector('.seat-slot'), { seed: ctx.roomSeed, seat: 'mute', bomb: 'none' }) : null;
  root.querySelector('#m-chat').insertAdjacentHTML('beforebegin', '<div class="emote-bar"><span id="m-echo" class="hint">Hold ✋ and drag, or press X</span></div>');
  const wheel = createEmoteWheel(root.querySelector('.emote-bar'), {
    onPick: (id) => ctx.send({ t: 'emote', as: 'mute', id }),
  });
  const page = root.querySelector('#m-page');
  root.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => {
    root.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('on', x === b));
    page.innerHTML = pages[+b.dataset.i].html;
    page.scrollTop = 0;
  }));

  const chat = createChat(root.querySelector('#m-chat'), {
    me: 'mute', other: 'Deaf', send: ctx.send,
    quick: ['Go ahead', 'Repeat that', 'Wait…', 'Cut it!', 'Hold on, checking'],
  });
  let raf = 0;
  const frame = () => {
    root.querySelector('#m-timer').textContent = clock.format();
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  return {
    update(v) {
      root.querySelector('#m-prog').textContent = `${v.solved}/${v.total} solved`;
      root.querySelector('#m-str').textContent = '✖'.repeat(v.strikes) + '◻'.repeat(v.strikesMax - v.strikes);
    },
    event: (ev) => scene?.react(ev.e),
    chat: (msg) => chat.add(msg),
    emote(msg) {
      const e = emoteById(msg.id);
      if (!e) return;
      const from = msg.from || 'mute';
      scene?.emote(e, from);
      root.querySelector('#m-echo').textContent = from === 'mute' ? `You showed: ${e.face} ${e.label}` : `Blind taunts Deaf: ${e.face} ${e.label}`;
    },
    destroy() { cancelAnimationFrame(raf); wheel.destroy(); scene?.destroy(); },
  };
}
