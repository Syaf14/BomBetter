// Indie-style stickman: ink-black limbs, white round head, one accessory per role.
//   blind = blindfold + white cane, deaf = headphones with a red cross, mute = taped mouth.
// Everything is flat-shaded, so the Blind (mono) scene needs no special casing.

function textSprite(THREE, w, h, scaleX, scaleY) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.renderOrder = 10;
  return { sprite, ctx: canvas.getContext('2d'), tex };
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

/** Speech/emote bubble sprite: show(face, text) pops it up for a few seconds, update(dt) animates it. */
export function makeBubble(THREE, size = 1.5) {
  const t = textSprite(THREE, 160, 160, size, size);
  t.sprite.visible = false;
  let left = 0;
  return {
    sprite: t.sprite,
    show(face, text) {
      const { ctx, tex } = t;
      ctx.clearRect(0, 0, 160, 160);
      ctx.fillStyle = '#fff';
      roundRect(ctx, 6, 6, 148, 148, 30); ctx.fill();
      ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.stroke();
      ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `${face.length > 3 ? 54 : 74}px "Segoe UI Emoji", "Apple Color Emoji", system-ui, sans-serif`;
      ctx.fillText(face, 80, 70, 136);
      ctx.font = '800 32px system-ui, sans-serif';
      ctx.fillText(text, 80, 132, 136);
      tex.needsUpdate = true;
      t.sprite.visible = true;
      t.sprite.scale.set(size * 0.13, size * 0.13, 1);
      left = 4;
    },
    update(dt) {
      if (left <= 0) return;
      left -= dt;
      const s = Math.min(size, t.sprite.scale.x + dt * size * 4);
      t.sprite.scale.set(s, s, 1);
      if (left <= 0) t.sprite.visible = false;
    },
  };
}

export function makeStickman(THREE, pal, role) {
  const root = new THREE.Group();
  const ink = pal.basic('#111111');
  const white = pal.basic('#f4f4f4');

  const limb = (len, r = 0.055) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), ink);
    m.position.y = -len / 2;
    return m;
  };

  // Legs
  const legs = [-0.13, 0.13].map((x) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.95, 0);
    leg.add(limb(0.95));
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.2), ink);
    foot.position.set(x * 0.4, -0.95, 0.06);
    leg.add(foot);
    leg.rotation.z = x < 0 ? 0.06 : -0.06;
    root.add(leg);
    return leg;
  });

  // Body pivots at the hip so it can lean
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);
  const torso = limb(0.72);
  torso.position.y = 0.36;
  body.add(torso);

  const arms = [0, 1].map(() => {
    const arm = new THREE.Group();
    arm.position.set(0, 0.64, 0);
    arm.add(limb(0.7));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), ink);
    hand.position.y = -0.7;
    arm.add(hand);
    body.add(arm);
    return arm;
  });

  // Head
  const head = new THREE.Group();
  head.position.y = 1.04;
  body.add(head);
  head.add(pal.outline(new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 16), white), 1.1));

  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 6);
  const mouthGeo = new THREE.BoxGeometry(0.13, 0.025, 0.02);
  const place = (mesh, x, y, z) => { mesh.position.set(x, y, z); head.add(mesh); return mesh; };

  if (role !== 'blind') for (const x of [-0.11, 0.11]) place(new THREE.Mesh(eyeGeo, ink), x, 0.05, 0.27);
  if (role !== 'mute') place(new THREE.Mesh(mouthGeo, ink), 0, -0.1, 0.287);

  if (role === 'blind') {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.15, 20, 1, true), pal.basic('#111111', { side: THREE.DoubleSide }));
    place(band, 0, 0.06, 0);
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), ink);
      place(tail, s * 0.07, -0.04, -0.32).rotation.z = s * 0.35;
    }
    const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.15, 6), pal.basic('#ffffff'));
    cane.position.y = -0.55;
    const holder = new THREE.Group();
    holder.position.y = -0.7;
    holder.rotation.x = -0.42; // tip leans forward to the floor
    holder.add(cane);
    for (const y of [-0.2, -0.6, -1.0]) {
      const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.12, 6), ink);
      stripe.position.y = y;
      holder.add(stripe);
    }
    arms[1].add(holder);
  }

  if (role === 'deaf') {
    place(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 20, Math.PI), pal.basic('#2b2b2b')), 0, 0, 0);
    for (const s of [-1, 1]) {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), pal.basic('#3a3a3a'));
      cup.rotation.z = Math.PI / 2;
      place(cup, s * 0.34, 0, 0);
      const cross = new THREE.Group();
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.012), pal.basic('#e5484d'));
        bar.rotation.z = a;
        cross.add(bar);
      }
      cross.rotation.y = s * Math.PI / 2;
      place(cross, s * 0.395, 0, 0);
    }
  }

  if (role === 'mute') {
    place(pal.outline(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.1, 0.03), pal.basic('#d8d8d8')), 1.12), 0, -0.1, 0.297);
    for (const a of [0.55, -0.55]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.018, 0.01), ink);
      line.rotation.z = a;
      place(line, 0, -0.1, 0.318);
    }
  }

  // Name label
  const lab = textSprite(THREE, 256, 64, 1.7, 0.425);
  lab.sprite.position.set(0, 2.62, 0);
  root.add(lab.sprite);
  function label(text, hot = false) {
    const { ctx, tex } = lab;
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = hot ? '#ff6b35' : 'rgba(0,0,0,.65)';
    roundRect(ctx, 4, 8, 248, 48, 22); ctx.fill();
    ctx.fillStyle = hot ? '#111' : '#f2f2f2';
    ctx.font = '700 28px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 33, 230);
    tex.needsUpdate = true;
  }

  // Emote bubble (Mute's hand signals)
  const bub = makeBubble(THREE, 1.1);
  bub.sprite.position.set(0, 3.2, 0);
  root.add(bub.sprite);
  const bubble = bub.show;

  /** Sit down: thighs forward. The caller lowers the figure onto its chair. */
  function sit() {
    for (const leg of legs) { leg.rotation.x = -Math.PI / 2; leg.rotation.z = 0; }
  }

  // Poses: target joint angles, eased every frame. arms[0] hangs at -x, arms[1] at +x.
  const phase = Math.random() * 6;
  const POSES = {
    idle: (t) => ({ a: -0.2 + Math.sin(t * 1.6 + phase) * 0.03, b: 0.2 - Math.sin(t * 1.6 + phase) * 0.03, lean: Math.sin(t * 1.2 + phase) * 0.012, hop: 0 }),
    wave: (t) => ({ a: -0.2, b: 2.6 + Math.sin(t * 8) * 0.35, lean: 0, hop: 0 }),
    raise: (t) => ({ a: -0.2, b: 2.95 + Math.sin(t * 5) * 0.06, lean: -0.04, hop: 0 }),
    taunt: (t) => ({ a: -0.2, b: 1.9 + Math.sin(t * 10) * 0.25, lean: -0.1 + Math.sin(t * 6) * 0.06, hop: Math.abs(Math.sin(t * 6)) * 0.08 }),
    flinch: () => ({ a: -2.2, b: 2.2, lean: -0.3, hop: 0.12 }),
    cheer: (t) => ({ a: -2.7 + Math.sin(t * 9) * 0.3, b: 2.7 - Math.sin(t * 9) * 0.3, lean: 0, hop: Math.abs(Math.sin(t * 5)) * 0.28 }),
    slump: () => ({ a: -0.05, b: 0.05, lean: 0.75, hop: 0 }),
  };
  const cur = { a: -0.2, b: 0.2, lean: 0, hop: 0 };
  let mode = 'idle';
  let until = Infinity;
  let modeT = 0;

  function pose(name, seconds = Infinity) {
    mode = POSES[name] ? name : 'idle';
    until = seconds;
    modeT = 0;
  }

  function update(dt, t) {
    modeT += dt;
    if (modeT > until) pose('idle');
    const want = POSES[mode](t);
    const k = 1 - Math.exp(-dt * 14);
    for (const key of ['a', 'b', 'lean', 'hop']) cur[key] += (want[key] - cur[key]) * k;
    arms[0].rotation.z = cur.a;
    arms[1].rotation.z = cur.b;
    body.rotation.x = cur.lean;
    root.position.y = cur.hop;
    bub.update(dt);
  }

  return { group: root, role, pose, label, bubble, update, legs, sit };
}
