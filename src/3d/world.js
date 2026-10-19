// First-person seat scenes. Each player gets their own scene, built from where they sit, so the bomb always
// faces them (no mirrored left/right between Deaf and Blind):
//   deaf  : bomb on the table in colour, Blind across the table, Mute sitting beside them (turn your head)
//   blind : black & white, grey bomb with touch dots, Deaf across the table
//   mute  : Deaf across a desk with the manual in front of you; your own hand rises when you emote
import { buildRoom } from './room3d.js';
import { makeStickman, makeBubble } from './stickman.js';
import { makeBomb, BOMB_CENTER, TABLE_TOP } from './bomb3d.js';
import { createLook } from './look.js';
import { roomLayout } from '../room.js';

const ROLE_NAMES = { deaf: 'DEAF', mute: 'MUTE', blind: 'BLIND' };
const TABLE = { w: 6.4, d: 3.0, z: 3.5 };
const ACROSS = { x: 0, z: 1.2 }; // the person facing you, behind the far edge of the table
const SIDE = { x: -2.6, z: 5.3 }; // Mute, next to Deaf and slightly ahead of them

export function addLights(THREE, scene) {
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 7, 8);
  scene.add(sun);
}

function makeTable(THREE, pal) {
  const g = new THREE.Group();
  const wood = pal.lambert('#6b4a2b');
  const top = pal.outline(new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 0.14, TABLE.d), wood), 1.02);
  top.position.set(0, TABLE_TOP - 0.07, TABLE.z);
  g.add(top);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, TABLE_TOP - 0.14, 0.18), wood);
      leg.position.set(sx * (TABLE.w / 2 - 0.2), (TABLE_TOP - 0.14) / 2, TABLE.z + sz * (TABLE.d / 2 - 0.2));
      g.add(leg);
    }
  }
  return g;
}

function makeChair(THREE, pal, x, z, rotY) {
  const g = new THREE.Group();
  const mat = pal.lambert('#3a3a46');
  const seat = pal.outline(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.12, 1.1), mat), 1.03);
  seat.position.y = 1.02;
  const back = pal.outline(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 0.12), mat), 1.03);
  back.position.set(0, 1.6, -0.55);
  g.add(seat, back);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.02, 0.1), mat);
    leg.position.set(sx * 0.47, 0.51, sz * 0.47);
    g.add(leg);
  }
  g.position.set(x, 0, z);
  g.rotation.y = rotY;
  return g;
}

function makeBook(THREE, pal) {
  const g = new THREE.Group();
  const cover = pal.outline(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.2), pal.lambert('#6a2f2f')), 1.03);
  const pages = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.07, 1.1), pal.lambert('#f4efe3'));
  pages.position.y = 0.06;
  g.add(cover, pages);
  g.rotation.x = -0.18;
  return g;
}

/**
 * Builds the seat scene for `seat` into eng.scene and registers the per-frame update.
 * opts: { seat, seed, bomb: 'full'|'blank'|'none', onSelect(index) }
 */
export function buildSeatWorld(THREE, eng, pal, opts) {
  const { seat, seed, bomb: bombMode = 'none' } = opts;
  const { scene, camera } = eng;
  scene.add(camera);
  camera.fov = 52;
  camera.near = 0.05;
  camera.updateProjectionMatrix();
  eng.view.manual = true;

  addLights(THREE, scene);
  scene.add(buildRoom(THREE, pal, roomLayout(seed)));
  scene.add(makeTable(THREE, pal));

  const men = {};
  const sitter = (role, x, z, rotY) => {
    const m = makeStickman(THREE, pal, role);
    m.sit();
    m.label(ROLE_NAMES[role]);
    const holder = new THREE.Group();
    holder.position.set(x, 0.1, z); // sits on a raised stool, so the person across shows above the bomb
    holder.rotation.y = rotY;
    holder.add(m.group);
    scene.add(holder, makeChair(THREE, pal, x, z, rotY));
    men[role] = m;
  };

  let bomb = null;
  let target;
  let camY;
  let fitHalfW;
  if (seat === 'mute') {
    sitter('deaf', ACROSS.x, ACROSS.z, 0);
    const book = makeBook(THREE, pal);
    book.position.set(0, TABLE_TOP + 0.05, TABLE.z + 0.9);
    scene.add(book);
    target = new THREE.Vector3(0, 1.5, 2.6);
    camY = 2.7;
    fitHalfW = 2.2;
  } else {
    sitter(seat === 'deaf' ? 'blind' : 'deaf', ACROSS.x, ACROSS.z, 0);
    if (seat === 'deaf') sitter('mute', SIDE.x, SIDE.z, Math.atan2(-SIDE.x, 6.4 - SIDE.z));
    bomb = makeBomb(THREE, pal, { mode: bombMode });
    scene.add(bomb.group);
    // look slightly past the case so the person across the table stays in frame above it
    target = new THREE.Vector3(BOMB_CENTER.x, BOMB_CENTER.y + 0.35, BOMB_CENTER.z - 0.6);
    camY = 3.5;
    fitHalfW = 3.3;
  }

  const look = createLook(THREE, eng, {
    target, camY, fitHalfW,
    yawMax: seat === 'deaf' ? 1.15 : 0.9,
    pickables: () => bomb?.pickables() ?? [],
    onPick: (i) => opts.onSelect?.(i),
  });

  // Mute's own hand and emote bubble, attached to the camera so they stay in view
  let arm = null;
  let ownBubble = null;
  let armLeft = 0;
  if (seat === 'mute') {
    arm = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 1.6, 10), pal.basic('#111111'));
    sleeve.position.y = 0.8;
    const hand = pal.outline(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), pal.basic('#f4f4f4')), 1.1);
    hand.position.y = 1.7;
    arm.add(sleeve, hand);
    arm.position.set(0.8, -2.6, -1.9);
    arm.rotation.z = -0.15;
    camera.add(arm);
    ownBubble = makeBubble(THREE, 1.0);
    ownBubble.sprite.position.set(-0.55, 0.45, -2.0);
    camera.add(ownBubble.sprite);
  }

  eng.onFrame((dt, t) => {
    for (const m of Object.values(men)) m.update(dt, t);
    bomb?.update(dt, t);
    look.update(dt);
    if (arm) {
      armLeft -= dt;
      const goal = armLeft > 0 ? -1.15 : -2.6;
      arm.position.y += (goal - arm.position.y) * (1 - Math.exp(-dt * 10));
      arm.rotation.z = -0.15 + (armLeft > 0 ? Math.sin(t * 9) * 0.04 : 0);
      ownBubble.update(dt);
    }
  });

  return {
    setBomb: (s) => bomb?.set(s),
    highlight: (i) => bomb?.select(i),
    setSelected(i) {
      bomb?.select(i);
      look.focus(i >= 0 ? bomb?.plateWorld(i) : null);
    },
    zoomOut: () => look.focus(null),
    setPlayers() {},
    react(ev) {
      if (ev === 'strike') {
        for (const m of Object.values(men)) m.pose('flinch', 0.7);
        bomb?.shake();
        look.shake(0.1, 0.45);
      } else if (ev === 'solved') {
        for (const m of Object.values(men)) if (m.role === 'blind' || seat === 'blind') m.pose('cheer', 1.3);
      } else if (ev === 'win') {
        for (const m of Object.values(men)) m.pose('cheer');
        bomb?.win();
        look.focus(null);
      } else if (ev === 'boom') {
        for (const m of Object.values(men)) m.pose('slump');
        bomb?.explode();
        look.shake(0.3, 0.9);
      }
    },
    emote(e) {
      men.mute?.bubble(e.face, e.label);
      men.mute?.pose('raise', 4);
      if (arm) { armLeft = 4; ownBubble.show(e.face, e.label); }
    },
  };
}
