// Minimal three.js engine: renderer, camera framing, render loop and clean-up.
// three.js is loaded lazily so a CDN failure only costs the 3D view (callers fall back to the 2D UI).
let threePromise = null;

export const loadThree = () => (threePromise ??= import('three').catch((e) => {
  console.warn('three.js failed to load, using the 2D view', e);
  return null;
}));

/**
 * Creates a renderer inside `container` (which CSS must give a size). Returns null when WebGL is unavailable.
 * `engine.view` describes what the camera must keep in frame: half width/height of the content, the point
 * to look at and the camera height. The camera distance is derived from the container's aspect ratio.
 */
export function createEngine(THREE, container, { background = '#14121a' } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = 'stage-canvas';
  container.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(background);
  const camera = new THREE.PerspectiveCamera(36, 2, 0.1, 100);
  const view = { halfW: 7, halfH: 2.8, target: new THREE.Vector3(0, 1.4, 1.5), camY: 3.2 };
  const frameFns = new Set();
  const size = { w: 0, h: 0 };
  let raf = 0;
  let last = performance.now();
  let dead = false;

  function fit() {
    if (view.manual) return; // first-person seats position the camera themselves (look.js)
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(view.halfW / (tan * camera.aspect), view.halfH / tan);
    camera.position.set(view.target.x, view.camY, view.target.z + dist);
    camera.lookAt(view.target);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h || (w === size.w && h === size.h)) return;
    size.w = w; size.h = h;
    renderer.setSize(w, h, false); // CSS owns the displayed size
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    fit();
  }

  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (document.hidden || !container.offsetParent) { last = now; return; } // hidden tab or display:none
    resize();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    for (const fn of frameFns) fn(dt, now / 1000);
    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(loop);

  return {
    scene, camera, renderer, canvas, view,
    refit: fit,
    onFrame(fn) { frameFns.add(fn); },
    destroy() {
      if (dead) return;
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      frameFns.clear();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); }
      });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
