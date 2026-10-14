import { HostNet, ClientNet, LocalNet } from './net.js';
import { HostController, ROLES } from './host.js';
import { createBlind } from './roles/blind.js';
import { createDeaf } from './roles/deaf.js';
import { createMute } from './roles/mute.js';
import { createTalker, answerVoice } from './voice.js';
import { clock } from './clock.js';
import { mountRoom } from './room.js';
import { audio } from './audio.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const ROLE_INFO = {
  blind: { icon: '🙈', title: 'Blind', text: 'Defuse the bomb on a dark screen. You hear the bomb and the Deaf player, but see nothing.' },
  deaf: { icon: '🙉', title: 'Deaf', text: 'See the whole bomb but hear nothing. Talk to the Blind player, text the Mute player.' },
  mute: { icon: '🤐', title: 'Mute', text: 'Read the manual. You cannot speak: text only.' },
};

const app = { mode: null, net: null, host: null, send: () => {}, lobby: null, panes: {}, role: null };

function show(name) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('hidden', s.id !== `screen-${name}`);
  $('#leave').classList.toggle('hidden', name === 'home');
}

function setError(text) { $('#home-err').textContent = text || ''; }

// ---------- server messages (same handler for host and clients) ----------
function onServer(msg) {
  switch (msg.t) {
    case 'lobby':
      app.lobby = msg;
      stopGame();
      $('#overlay').classList.add('hidden');
      show('lobby');
      renderLobby();
      break;
    case 'start': startGame(msg); break;
    case 'state':
      for (const [role, view] of Object.entries(msg.views)) {
        clock.set(view.remaining, view.rate, view.phase === 'playing');
        app.panes[role]?.update(view);
      }
      break;
    case 'ev': for (const p of Object.values(app.panes)) p.event?.(msg); break;
    case 'chat': app.panes.deaf?.chat(msg); app.panes.mute?.chat(msg); break;
    case 'emote': app.panes.deaf?.emote(msg); app.panes.mute?.emote(msg); break;
    case 'say': app.panes.blind?.say(msg.text); if (app.role === 'mute') audio.speak(msg.text); break;
    case 'end': showEnd(msg); break;
    case 'error': app.lobby ? ($('#lobby-err').textContent = msg.text) : setError(msg.text); break;
  }
}

// ---------- lobby ----------
function renderLobby() {
  const L = app.lobby;
  const isHost = app.mode === 'host';
  const mine = L.players.find((p) => p.id === L.you)?.role;
  const taken = Object.fromEntries(L.players.filter((p) => p.role).map((p) => [p.role, p]));
  const solo = app.net instanceof LocalNet;
  const link = `${location.origin}${location.pathname}?room=${L.code}`;

  $('#screen-lobby').innerHTML = `
    <h2>${solo ? 'Solo test' : 'Room'} ${solo ? '' : `<span class="code">${L.code}</span>`}</h2>
    <div class="room" id="lobby-room"></div>
    ${solo ? '' : `<p class="hint">Share this link or code: <a href="${link}">${link}</a></p>`}
    <p class="hint">Players: ${L.players.map((p) => esc(p.name)).join(', ')} (${L.players.length}/3)</p>
    <div class="roles">${ROLES.map((r) => {
      const t = taken[r];
      const cls = t ? (t.id === L.you ? 'mine' : 'taken') : '';
      return `<button class="role ${cls}" data-r="${r}" ${t && t.id !== L.you ? 'disabled' : ''}>
        <span class="ico">${ROLE_INFO[r].icon}</span><b>${ROLE_INFO[r].title}</b>
        <small>${ROLE_INFO[r].text}</small>
        <div class="badge mt-2" style="
          display: inline-block;
          padding: 2px 8px;
          width: fit-content;
          border-radius: 12px;
          background: linear-gradient(135deg, #ffd700, #ff8c00);
          box-shadow: 0 0 10px rgba(255, 165, 0, 0.5);
          font-weight: bold;
          color: #111;
          font-size: 0.75rem;
        ">
          ${t ? esc(t.name) : 'free'}
        </div></button>`;
    }).join('')}</div>
    ${isHost ? `<div class="settings">
      <label>Modules <select id="set-mod">${[3, 4, 5, 6].map((n) => `<option ${n === 4 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Minutes <select id="set-min">${[2, 3, 5, 7, 10].map((n) => `<option ${n === 5 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    <div class="actions">
      <button class="btn" id="btn-start" ${ROLES.every((r) => taken[r]) ? '' : 'disabled'}>Start game</button>
      <button class="btn ghost" id="btn-solo" ${L.players.length === 1 ? '' : 'disabled'}>Play all 3 roles on this device</button>
    </div>
    <p class="hint">Keep this tab open and in the foreground: it runs the game for everyone.</p>`
    : '<p class="hint">Waiting for the host to start…</p>'}
    <p class="err" id="lobby-err"></p>`;

  mountRoom($('#lobby-room'), L.code);
  document.querySelectorAll('.role').forEach((b) => (b.onclick = () => {
    audio.unlock();
    app.send({ t: 'pick', role: mine === b.dataset.r ? null : b.dataset.r });
  }));
  if (isHost) {
    const settings = () => ({ modules: +$('#set-mod').value, minutes: +$('#set-min').value });
    $('#btn-start').onclick = () => { audio.unlock(); app.send({ t: 'start', ...settings() }); };
    $('#screen-lobby #btn-solo').onclick = () => { audio.unlock(); app.send({ t: 'start', solo: true, ...settings() }); };
  }
}

// ---------- game ----------
function stopGame() {
  for (const p of Object.values(app.panes)) p.destroy?.();
  app.panes = {};
  $('#panes').innerHTML = '';
  app.talker?.stop();
  app.talker = null;
}

function startGame(msg) {
  stopGame();
  $('#overlay').classList.add('hidden');
  app.role = msg.role;
  const solo = msg.role === 'solo';
  const roles = solo ? ROLES : [msg.role];
  const panes = $('#panes');
  panes.className = solo ? 'solo' : 'single';
  clock.set(0, 1, false);

  const base = { send: (m) => app.send(m), roomSeed: msg.roomSeed };
  const makers = {
    blind: (el) => {
      let voice = null;
      if (!solo && msg.roster.mute) { // Deaf cannot hear, so Blind's mic only goes to Mute
        app.talker = createTalker(app.net.peer, [msg.roster.mute]);
        voice = { toggle: () => app.talker.toggle() };
      }
      return createBlind(el, { ...base, voice });
    },
    deaf: (el) => {
      let voice = null;
      const listeners = [msg.roster.blind, msg.roster.mute].filter(Boolean);
      if (!solo && listeners.length) {
        app.talker = createTalker(app.net.peer, listeners);
        voice = { toggle: () => app.talker.toggle() };
      }
      return createDeaf(el, { ...base, voice });
    },
    mute: (el) => createMute(el, { ...base, manual: msg.manual }),
  };
  for (const r of roles) {
    const wrap = document.createElement('div');
    wrap.className = 'pane-wrap';
    panes.append(wrap);
    app.panes[r] = makers[r](wrap);
  }
  show('game');
}

function showEnd(msg) {
  clock.running = false;
  const s = msg.summary;
  const win = msg.result === 'defused';
  const title = win ? '✅ BOMB DEFUSED' : msg.result === 'aborted' ? '⚠️ GAME ABORTED' : '💥 BOOM';
  const stats = s ? `<p>${s.solved}/${s.total} modules · ${s.strikes} strike${s.strikes === 1 ? '' : 's'}${win ? ` · ${Math.ceil(s.remaining / 1000)}s left` : ''}</p>` : '';
  const o = $('#overlay');
  o.className = `overlay ${win ? 'win' : 'lose'}`;
  o.innerHTML = `<div class="card"><h2>${title}</h2><p>${esc(msg.reason)}</p>${stats}
    ${app.mode === 'host' ? '<button class="btn" id="btn-again">Back to lobby</button>' : '<p class="hint">Waiting for the host…</p>'}</div>`;
  $('#btn-again')?.addEventListener('click', () => app.send({ t: 'restart' }));
}

// ---------- entry points ----------
const playerName = () => $('#name').value.trim().slice(0, 16);

async function hostGame(solo) {
  setError('');
  audio.unlock();
  try {
    const net = solo ? new LocalNet() : new HostNet();
    await net.open();
    app.net = net;
    app.mode = 'host';
    app.send = (m) => app.host.onMessage(net.id, m);
    net.onCall = (call) => (app.role === 'blind' || app.role === 'mute') && answerVoice(call);
    net.onError = (e) => console.warn('peer error', e);
    app.host = new HostController({ net, name: playerName() || 'Host', deliverLocal: onServer });
  } catch (e) {
    setError(e.message || String(e));
  }
}

async function joinGame(code) {
  setError('');
  audio.unlock();
  if (!/^[A-Za-z]{4}$/.test(code)) return setError('Enter the 4-letter room code.');
  try {
    const net = new ClientNet();
    await net.connect(code);
    app.net = net;
    app.mode = 'client';
    app.send = (m) => net.send(m);
    net.onMessage = onServer;
    net.onCall = (call) => (app.role === 'blind' || app.role === 'mute') && answerVoice(call);
    net.onClose = () => {
      stopGame();
      show('home');
      $('#overlay').classList.add('hidden');
      setError('Disconnected: the host left the game.');
    };
    net.send({ t: 'join', name: playerName() || 'Player' });
  } catch (e) {
    setError(e.message || 'Could not connect.');
  }
}

$('#btn-host').onclick = () => hostGame(false);
$('#btn-solo').onclick = () => hostGame(true);
$('#btn-join').onclick = () => joinGame($('#join-code').value);
$('#join-code').oninput = (e) => (e.target.value = e.target.value.toUpperCase());
$('#leave').onclick = () => (location.href = location.pathname);

const room = new URLSearchParams(location.search).get('room');
if (room) $('#join-code').value = room.slice(0, 4).toUpperCase();
show('home');
