// The 3D scene shown on the role screens and in the lobby: decorated room, the three stickmen and
// (depending on the role) the bomb. `mountScene` is the entry point: it adds a 3D on/off toggle and falls
// back to the 2D room strip when three.js or WebGL is unavailable.
import { loadThree, createEngine } from './scene.js';
import { makePalette } from './mono.js';
import { buildRoom } from './room3d.js';
import { makeStickman } from './stickman.js';
import { makeBomb } from './bomb3d.js';
import { buildSeatWorld, addLights } from './world.js';
import { roomLayout, mountRoom } from '../room.js';

const ROLE_NAMES = { deaf: 'DEAF', mute: 'MUTE', blind: 'BLIND' };
// x, z, facing: Mute and Deaf stand behind the table, Blind stands beside the bomb and reaches for it.
const SPOT = { mute: [-4.4, 1.4, 0.3], deaf: [4.9, 1.2, -0.3], blind: [3.1, 3.4, -0.5] };
const PREF = 'bombetter-3d';
const readPref = () => { try { return localStorage.getItem(PREF) !== 'off'; } catch { return true; } };
const writePref = (on) => { try { localStorage.setItem(PREF, on ? 'on' : 'off'); } catch { /* storage blocked */ } };

/**
 * opts: { seed, mono, seat: 'lobby' | 'deaf' | 'mute' | 'blind' | 'spectator', bomb: 'full' | 'blank' | 'none', onSelect(i), onFail() }
 * seat 'lobby' (default) is the third-person overview of the room; the others are first-person seats (world.js).
 * mono = black & white (Blind). Returns a handle whose methods are safe to call before the scene is ready.
 */
export function mountStage(el, opts) {
  const { seed, mono = false, bomb: bombMode = 'none', seat = 'lobby' } = opts;
  let impl = null;
  let dead = false;
  const pending = {};
  el.classList.add('stage3d');
  el.dataset.state = 'loading';
  el.dataset.seat = seat;

  const call = (name, ...args) => {
    pending[name] = args;
    impl?.[name](...args);
  };

  const ready = (async () => {
    const THREE = await loadThree();
    if (dead || !THREE) return false;
    const eng = createEngine(THREE, el, { background: mono ? '#101010' : '#14121a' });
    if (!eng) return false;
    const pal = makePalette(THREE, mono);
    const { scene } = eng;

    if (seat !== 'lobby') {
      const world = buildSeatWorld(THREE, eng, pal, opts);
      el.insertAdjacentHTML('beforeend', '<div class="look-hint" aria-hidden="true">Drag to look around · click a module</div>');
      const hint = el.querySelector('.look-hint');
      setTimeout(() => hint?.remove(), 6000);
      impl = { ...world, destroy: () => eng.destroy() };
      for (const [name, args] of Object.entries(pending)) impl[name](...args);
      el.dataset.state = 'ready';
      return true;
    }

    addLights(THREE, scene);

    scene.add(buildRoom(THREE, pal, roomLayout(seed)));

    const men = {};
    for (const role of ['mute', 'deaf', 'blind']) {
      const m = makeStickman(THREE, pal, role);
      m.group.position.set(SPOT[role][0], 0, SPOT[role][1]);
      m.group.rotation.y = SPOT[role][2];
      m.label(ROLE_NAMES[role]);
      scene.add(m.group);
      men[role] = m;
    }

    let bomb = null;
    if (bombMode !== 'none') {
      bomb = makeBomb(THREE, pal, { mode: bombMode });
      bomb.group.position.set(0, 0, 3.4);
      scene.add(bomb.group);
    }
    eng.view.halfW = 5.6;
    eng.view.halfH = 3.0;
    eng.view.target.set(0, 1.45, 1.6);
    eng.view.camY = 3.4;
    eng.refit();

    eng.onFrame((dt, t) => {
      for (const m of Object.values(men)) m.update(dt, t);
      bomb?.update(dt, t);
    });

    // Tap a plate to select that module
    if (opts.onSelect && bomb) {
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pick = (e) => {
        const r = eng.canvas.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, eng.camera);
        return ray.intersectObjects(bomb.pickables(), false)[0]?.object.userData.index;
      };
      eng.canvas.addEventListener('pointerdown', (e) => {
        const i = pick(e);
        if (i !== undefined) opts.onSelect(i);
      });
      eng.canvas.addEventListener('pointermove', (e) => {
        eng.canvas.style.cursor = pick(e) !== undefined ? 'pointer' : '';
      });
    }

    impl = {
      setBomb: (s) => bomb?.set(s),
      highlight: (i) => bomb?.select(i),
      setSelected: (i) => bomb?.select(i),
      zoomOut() {},
      /** players: { role: { name, state: 'free' | 'taken' | 'mine' } } for the lobby */
      setPlayers(players) {
        for (const [role, p] of Object.entries(players)) {
          const m = men[role];
          if (!m) continue;
          m.label(p.state === 'free' ? `${ROLE_NAMES[role]}: free` : p.name, p.state === 'mine');
          m.pose(p.state === 'free' ? 'idle' : 'wave');
        }
      },
      react(ev) {
        if (ev === 'strike') {
          for (const m of Object.values(men)) m.pose('flinch', 0.7);
          bomb?.shake();
        } else if (ev === 'solved') {
          men.blind.pose('cheer', 1.3);
        } else if (ev === 'win') {
          for (const m of Object.values(men)) m.pose('cheer');
          bomb?.win();
        } else if (ev === 'boom') {
          for (const m of Object.values(men)) m.pose('slump');
          bomb?.explode();
        }
      },
      emote(e, from = 'mute') {
        men[from]?.bubble(e.face, e.label);
        men[from]?.pose(e.taunt ? 'taunt' : 'raise', 4);
      },
      destroy: () => eng.destroy(),
    };
    for (const [name, args] of Object.entries(pending)) impl[name](...args);
    el.dataset.state = 'ready';
    return true;
  })().then((ok) => {
    if (!ok && !dead) { el.dataset.state = 'failed'; opts.onFail?.(); }
    return ok;
  });

  return {
    ready,
    setBomb: (s) => call('setBomb', s),
    highlight: (i) => call('highlight', i),
    setSelected: (i) => call('setSelected', i),
    zoomOut: () => impl?.zoomOut(),
    setPlayers: (p) => call('setPlayers', p),
    react: (ev) => impl?.react(ev),
    emote: (e, from) => impl?.emote(e, from),
    destroy() {
      dead = true;
      impl?.destroy();
      impl = null;
      el.classList.remove('stage3d');
      el.querySelector('.look-hint')?.remove();
      delete el.dataset.state;
    },
  };
}

/**
 * Scene slot with a 3D toggle. `opts` as mountStage plus `fallback` (default true): show the 2D room strip
 * when 3D is off or unavailable (Blind passes false because it must not see the coloured room), and
 * `onMode(is3d)`, called whenever the slot switches between the 3D scene and the 2D fallback.
 */
export function mountScene(el, opts) {
  const { fallback = true, onMode } = opts;
  el.classList.add('scene-wrap');
  el.innerHTML = '<button type="button" class="room-toggle scene-toggle"></button><div class="scene-view"></div>';
  const btn = el.querySelector('.scene-toggle');
  const view = el.querySelector('.scene-view');
  const last = {};
  let stage = null;
  let on = readPref();
  let gen = 0;

  function mount() {
    const mine = ++gen;
    stage?.destroy();
    stage = null;
    view.innerHTML = '';
    view.className = 'scene-view';
    btn.textContent = on ? '🎲 3D' : '🎲 2D';
    btn.setAttribute('aria-pressed', String(on));
    const showFallback = () => {
      if (mine !== gen) return;
      el.classList.add('is2d');
      onMode?.(false);
      view.className = 'scene-view';
      view.innerHTML = '';
      if (fallback) mountRoom(view, opts.seed);
      else view.classList.add('empty');
    };
    el.classList.remove('is2d');
    if (!on) return showFallback();
    onMode?.(true);
    const holder = document.createElement('div');
    view.append(holder);
    stage = mountStage(holder, { ...opts, onFail: () => { stage = null; btn.textContent = '🎲 2D (3D unavailable)'; showFallback(); } });
    for (const [name, args] of Object.entries(last)) stage[name](...args);
  }
  btn.onclick = () => { on = !on; writePref(on); mount(); };
  mount();

  const remember = (name) => (...args) => { last[name] = args; stage?.[name](...args); };
  return {
    setBomb: remember('setBomb'),
    highlight: remember('highlight'),
    setSelected: remember('setSelected'),
    zoomOut: () => stage?.zoomOut(),
    setPlayers: remember('setPlayers'),
    react: (ev) => stage?.react(ev),
    emote: (e, from) => stage?.emote(e, from),
    destroy() { gen++; stage?.destroy(); stage = null; },
  };
}
