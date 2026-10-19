// Material palette. With `mono` every colour is reduced to its grey value, so the Blind scene is
// black & white by construction (all lights are white, so rendered pixels stay R = G = B).
export function makePalette(THREE, mono) {
  const cache = new Map();
  const memo = (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  };

  const col = (hex) => {
    const c = new THREE.Color(hex);
    if (mono) {
      const g = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
      c.setRGB(g, g, g);
    }
    return c;
  };

  const ink = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });

  return {
    mono,
    col,
    /** Lit material (reacts to the scene lights). */
    lambert: (hex, o = {}) => memo(`l${hex}${JSON.stringify(o)}`, () => new THREE.MeshLambertMaterial({ color: col(hex), ...o })),
    /** Flat, unlit material (stickmen, displays, LEDs). */
    basic: (hex, o = {}) => memo(`b${hex}${JSON.stringify(o)}`, () => new THREE.MeshBasicMaterial({ color: col(hex), ...o })),
    /** A fresh, unshared basic material that can be recoloured at runtime. */
    own: (hex, o = {}) => new THREE.MeshBasicMaterial({ color: col(hex), ...o }),
    /** Cartoon outline: a slightly larger black back-face copy of the mesh. */
    outline(mesh, scale = 1.07) {
      const hull = new THREE.Mesh(mesh.geometry, ink);
      hull.scale.setScalar(scale);
      mesh.add(hull);
      return mesh;
    },
  };
}
