// 3D version of the decorated room (see roomLayout in ../room.js). Same seed => same paintings and props
// for everyone. Layout units are the SVG's 400x124 pixels; K converts them to world units.
const K = 0.04;
const WALL_H = 84 * K;
const ROOM_W = 400 * K;
const FRAME = '#6b4a2b';

export function buildRoom(THREE, pal, layout) {
  const room = new THREE.Group();
  const wx = (x) => (x - 200) * K;
  const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); room.add(mesh); return mesh; };
  const box = (w, h, d, hex, outline = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), pal.lambert(hex));
    return outline ? pal.outline(m, 1.04) : m;
  };

  // Walls and floor
  const wallH = WALL_H + 2.2;
  add(new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 8, wallH), pal.lambert('#2a2433')), 0, wallH / 2, -0.5);
  add(new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W + 8, 12), pal.lambert('#3b2f27')).rotateX(-Math.PI / 2), 0, 0, 5.5);
  add(box(ROOM_W + 8, 0.14, 0.12, '#1b1722', false), 0, 0.07, -0.44);

  // Paintings
  for (const p of layout.paintings) {
    const w = p.w * K;
    const h = p.h * K;
    const x = wx(p.x + p.w / 2);
    const y = (84 - 12 - p.h / 2) * K;
    add(box(w + 0.24, h + 0.24, 0.08, FRAME), x, y, -0.44);
    add(box(w, h, 0.05, p.color, false), x, y, -0.39);
  }

  // Rug
  if (layout.rug) {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 40), pal.lambert(layout.rug.tint, { transparent: true, opacity: 0.45 }));
    rug.rotation.x = -Math.PI / 2;
    rug.scale.set(layout.rug.rx * K * 1.4, layout.rug.rx * K * 0.55, 1); // x radius, z radius (after the flat rotation)
    add(rug, wx(layout.rug.cx), 0.012, 2.6);
  }

  // Props, standing along the back wall
  const star = () => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.28 : 0.62;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
  };
  const PROPS = {
    ball: (c) => {
      const m = pal.outline(new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 14), pal.lambert(c)), 1.06);
      m.position.y = 0.56;
      const g = new THREE.Group();
      g.add(m);
      return g;
    },
    crate: (c) => {
      const m = box(1.04, 1.04, 1.04, c);
      m.position.y = 0.52;
      const g = new THREE.Group();
      g.add(m);
      return g;
    },
    cone: (c) => {
      const m = pal.outline(new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.16, 4, 1), pal.lambert(c)), 1.06);
      m.rotation.y = Math.PI / 4;
      m.position.y = 0.58;
      const g = new THREE.Group();
      g.add(m);
      g.add(box(1.3, 0.1, 1.3, '#222', false));
      return g;
    },
    star: (c) => {
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(star(), { depth: 0.22, bevelEnabled: false }), pal.lambert(c));
      pal.outline(m, 1.06);
      m.position.set(0, 0.85, -0.1);
      const g = new THREE.Group();
      g.add(m);
      return g;
    },
    plant: () => {
      const g = new THREE.Group();
      const pot = pal.outline(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.64, 12), pal.lambert('#a0522d')), 1.06);
      pot.position.y = 0.32;
      g.add(pot);
      for (const [x, z, s] of [[0, 0, 1], [-0.22, 0.05, 0.75], [0.22, -0.05, 0.8]]) {
        const leaf = pal.outline(new THREE.Mesh(new THREE.ConeGeometry(0.3 * s, 1.1 * s, 7), pal.lambert('#30a46c')), 1.08);
        leaf.position.set(x, 0.64 + 0.5 * s, z);
        g.add(leaf);
      }
      return g;
    },
    lamp: (c) => {
      const g = new THREE.Group();
      const base = box(0.7, 0.1, 0.7, '#888', false);
      base.position.y = 0.05;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.0, 8), pal.lambert('#888'));
      pole.position.y = 0.55;
      const shade = pal.outline(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.55, 12, 1, true), pal.lambert(c, { side: THREE.DoubleSide })), 1.04);
      shade.position.y = 1.3;
      g.add(base, pole, shade);
      return g;
    },
    triangle: (c) => {
      const t = new THREE.Shape();
      t.moveTo(-0.6, 0); t.lineTo(0.6, 0); t.lineTo(0, 1.1); t.closePath();
      const m = pal.outline(new THREE.Mesh(new THREE.ExtrudeGeometry(t, { depth: 0.5, bevelEnabled: false }), pal.lambert(c)), 1.05);
      m.position.z = -0.25;
      const g = new THREE.Group();
      g.add(m);
      return g;
    },
  };
  for (const p of layout.props) add(PROPS[p.name](p.tint), wx(p.x), 0, 0.5);

  return room;
}
