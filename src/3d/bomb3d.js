// The bomb on the table, leaning back so the player can see over it. Always built facing the viewer.
//   'full'  (Deaf)  timer, strike LEDs, serial/battery/indicator strip, and every module drawn in real colour
//                   by its draw3d() function.
//   'blank' (Blind) a featureless box: grey plates marked only with touch dots for their number. Nothing here
//                   may reveal what the Blind player is not meant to see, so it takes no timer, strike,
//                   edgework or module-view data.
import { clock } from '../clock.js';
import { MODULES } from '../modules/index.js';

export const TABLE_TOP = 1.02;
const W = 4.6;
const H = 2.5;
const D = 0.4;
const TILT = 1.34; // radians from vertical
const PIVOT_Z = 4.7; // bottom edge of the case, on the table
const FACE = D / 2 + 0.01;
const AREA = { w: 4.2, top: 0.65, h: 1.5, gap: 0.1 };

/** Where the viewer's camera should look: the middle of the case. */
export const BOMB_CENTER = { x: 0, y: TABLE_TOP + (H / 2) * Math.cos(TILT), z: PIVOT_Z - (H / 2) * Math.sin(TILT) };

function canvasTexture(THREE, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { ctx: canvas.getContext('2d'), tex, w, h };
}

export function makeBomb(THREE, pal, { mode }) {
  const full = mode === 'full';
  const group = new THREE.Group();

  // hinge sits on the table at the case's bottom edge; the case leans back from it
  const hinge = new THREE.Group();
  hinge.position.set(0, TABLE_TOP, PIVOT_Z);
  hinge.rotation.x = -TILT;
  group.add(hinge);
  const bomb = new THREE.Group(); // origin = centre of the case
  bomb.position.y = H / 2;
  hinge.add(bomb);

  const casing = pal.outline(new THREE.Mesh(new THREE.BoxGeometry(W, H, D), pal.lambert('#2b2b36')), 1.025);
  casing.userData.index = -1; // clicking the case itself zooms back out
  bomb.add(casing);

  // Timer display and strike LEDs (full only)
  let timerCtx = null;
  let timerTex = null;
  let timerText = '';
  const leds = [];
  let edge = null;
  if (full) {
    const t = canvasTexture(THREE, 256, 64);
    timerCtx = t.ctx; timerTex = t.tex;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.46, 0.04), pal.basic('#0b0b0e'));
    bezel.position.set(-1.2, 0.97, FACE);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.78, 0.34), new THREE.MeshBasicMaterial({ map: t.tex }));
    screen.position.set(-1.2, 0.97, FACE + 0.03);
    bomb.add(bezel, screen);
    for (let i = 0; i < 3; i++) {
      const m = pal.own('#3a1214');
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), m);
      led.position.set(0.7 + i * 0.42, 0.97, FACE + 0.01);
      bomb.add(led);
      leds.push(m);
    }
    edge = canvasTexture(THREE, 1024, 64);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(4.16, 0.26), new THREE.MeshBasicMaterial({ map: edge.tex }));
    strip.position.set(0, -1.08, FACE + 0.005);
    bomb.add(strip);
  }

  // Module plates
  const plates = [];
  const plateGroup = new THREE.Group();
  bomb.add(plateGroup);
  const tmp = new THREE.Vector3();
  let count = 0;
  let selected = -1;
  let won = false;

  function clearPlates() {
    for (const p of plates) {
      plateGroup.remove(p.mesh); plateGroup.remove(p.halo);
      p.mesh.geometry.dispose(); p.mat.dispose();
      p.halo.geometry.dispose(); p.haloMat.dispose();
      p.face.geometry.dispose(); p.face.material.map.dispose(); p.face.material.dispose();
    }
    plates.length = 0;
  }

  function buildPlates(n) {
    clearPlates();
    count = n;
    const cols = Math.min(3, n);
    const rows = Math.ceil(n / cols);
    const { w: aw, top, h: ah, gap } = AREA;
    const pw = (aw - gap * (cols - 1)) / cols;
    const ph = Math.min(1.0, (ah - gap * (rows - 1)) / rows);
    for (let i = 0; i < n; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      // the last row is centred when it is not full
      const inRow = r === rows - 1 ? n - r * cols : cols;
      const x = (c - (inRow - 1) / 2) * (pw + gap);
      const y = top - ph / 2 - r * (ph + gap);
      const mat = pal.own('#15151a');
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.07), mat);
      mesh.position.set(x, y, FACE + 0.035);
      mesh.userData.index = i;
      const canvas = canvasTexture(THREE, 512, Math.max(128, Math.round((512 * ph) / pw)));
      const face = new THREE.Mesh(new THREE.PlaneGeometry(pw - 0.04, ph - 0.04), new THREE.MeshBasicMaterial({ map: canvas.tex }));
      face.position.z = 0.037;
      mesh.add(face);
      const haloMat = pal.own('#ffb020');
      const halo = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.14, ph + 0.14, 0.05), haloMat);
      halo.position.set(x, y, FACE + 0.015);
      halo.visible = false;
      plateGroup.add(halo, mesh);
      plates.push({ mesh, mat, face, halo, haloMat, canvas, key: '', solved: false });
    }
    paint();
  }

  function drawFull(p, m, i) {
    const { ctx, tex, w, h } = p.canvas;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = m.solved ? '#1f3d2b' : '#23232d';
    ctx.fillRect(0, 0, w, h);
    const head = Math.round(h * 0.17);
    ctx.fillStyle = '#c9c9d4';
    ctx.font = `700 ${Math.round(head * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${i + 1}. ${MODULES[m.type].title.toUpperCase()}`, 16, head * 0.55);
    ctx.save();
    ctx.translate(0, head);
    MODULES[m.type].draw3d?.(ctx, m.view, w, h - head);
    ctx.restore();
    if (m.solved) {
      ctx.fillStyle = 'rgba(31,61,43,.6)';
      ctx.fillRect(0, head, w, h - head);
      ctx.fillStyle = '#30e07c';
      ctx.font = `800 ${Math.round(h * 0.55)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', w / 2, head + (h - head) / 2);
    }
    ctx.lineWidth = 8;
    ctx.strokeStyle = m.solved ? '#30a46c' : '#3a3a48';
    ctx.strokeRect(4, 4, w - 8, h - 8);
    tex.needsUpdate = true;
  }

  function drawBlank(p, m, i) {
    const { ctx, tex, w, h } = p.canvas;
    ctx.fillStyle = m.solved ? '#2a2a2a' : '#6a6a6a';
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 8;
    ctx.strokeStyle = m.solved ? '#444' : '#9a9a9a';
    ctx.strokeRect(4, 4, w - 8, h - 8);
    // touch dots: i + 1 raised bumps, in rows of three
    const n = i + 1;
    const r = h * 0.065;
    const rows = Math.ceil(n / 3);
    for (let k = 0; k < n; k++) {
      const row = Math.floor(k / 3);
      const inRow = row === rows - 1 ? n - row * 3 : 3;
      const x = w / 2 + ((k % 3) - (inRow - 1) / 2) * r * 3.2;
      const y = h / 2 + (row - (rows - 1) / 2) * r * 3.2;
      ctx.fillStyle = m.solved ? '#555' : '#f0f0f0';
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    tex.needsUpdate = true;
  }

  function paint() {
    plates.forEach((p, i) => { p.halo.visible = i === selected && !won; });
  }

  function drawTimer() {
    const s = clock.format();
    if (s === timerText) return;
    timerText = s;
    const c = timerCtx;
    c.fillStyle = '#080406'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = clock.get() < 30000 ? '#ff4a50' : '#e5484d';
    c.font = '800 54px ui-monospace, Consolas, monospace';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(s, 128, 36);
    timerTex.needsUpdate = true;
  }

  let edgeKey = '';
  function drawEdge(b) {
    const key = JSON.stringify(b);
    if (key === edgeKey) return;
    edgeKey = key;
    const c = edge.ctx;
    c.fillStyle = '#17171d'; c.fillRect(0, 0, 1024, 64);
    c.font = '700 34px ui-monospace, Consolas, monospace';
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = '#ecebf1';
    c.fillText(`S/N ${b.serial}`, 18, 34);
    c.fillStyle = '#c9c9d4';
    c.fillText(`BAT ${b.batteries}`, 330, 34);
    let x = 500;
    for (const ind of b.indicators) {
      c.fillStyle = ind.lit ? '#ffd84a' : '#8c8b99';
      c.fillText(`${ind.lit ? '●' : '○'}${ind.label}`, x, 34);
      x += 170;
    }
    edge.tex.needsUpdate = true;
  }

  // Effects
  let shake = 0;
  let boomT = -1;
  let flash = null;

  function update(dt) {
    if (full) drawTimer();
    if (shake > 0) {
      shake -= dt;
      hinge.position.x = shake > 0 ? Math.sin(shake * 70) * 0.12 * (shake / 0.45) : 0;
    }
    if (boomT >= 0) {
      boomT += dt;
      const k = Math.min(1, boomT / 0.9);
      flash.scale.setScalar(0.3 + k * 5);
      flash.material.opacity = 1 - k;
      if (k >= 1) flash.visible = false;
    }
  }

  return {
    group,
    pickables: () => [casing, ...plates.map((p) => p.mesh)],
    plateWorld(i) {
      const p = plates[i];
      return p ? p.mesh.getWorldPosition(tmp).clone() : null;
    },
    update,
    /** state: { modules: [{ type, solved, view }], strikes, strikesMax, bomb }; Blind passes only { modules: [{ solved }] } */
    set(state) {
      const n = state.modules.length;
      if (n !== count) buildPlates(n);
      state.modules.forEach((m, i) => {
        const p = plates[i];
        const key = full ? JSON.stringify([m.type, m.view, m.solved]) : String(!!m.solved);
        p.solved = !!m.solved;
        if (key === p.key) return;
        p.key = key;
        (full ? drawFull : drawBlank)(p, m, i);
      });
      if (full) {
        leds.forEach((m, i) => m.color.copy(pal.col(i < state.strikes ? '#ff2a30' : '#3a1214')));
        if (state.bomb) drawEdge(state.bomb);
      }
      paint();
    },
    select(i) { selected = i; paint(); },
    shake() { shake = 0.45; },
    win() { won = true; paint(); },
    explode() {
      hinge.visible = false;
      if (!flash) {
        flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: pal.col('#ffb020'), transparent: true }));
        flash.position.set(BOMB_CENTER.x, BOMB_CENTER.y, BOMB_CENTER.z);
        group.add(flash);
      }
      flash.visible = true;
      boomT = 0;
    },
  };
}
