// First-person camera for a seated player: a fixed eye position with a limited head-turn arc.
// Drag (mouse or touch) or the arrow keys turn the head; a tap/click without dragging picks a 3D object.
// focus(point) leans the camera in towards a module, focus(null) sits back.
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * opts: { target: Vector3 (what the camera looks at when centred), camY, fitHalfW (half width of the content that
 *         must fit in view), yawMax, pitchMax, pickables(): Object3D[], onPick(index) }
 */
export function createLook(THREE, eng, opts) {
  const { target, camY, fitHalfW, yawMax = 1.15, pitchMax = 0.4 } = opts;
  const cam = eng.camera;
  const canvas = eng.canvas;
  cam.rotation.order = 'YXZ';
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const base = new THREE.Vector3();
  let yaw0 = 0;
  let pitch0 = 0;
  let aspect = 0;
  function layout() {
    const tan = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = Math.max(2.8, fitHalfW / (tan * cam.aspect));
    base.set(target.x, camY, target.z + dist);
    const dx = target.x - base.x;
    const dy = target.y - base.y;
    const dz = target.z - base.z;
    yaw0 = Math.atan2(-dx, -dz);
    pitch0 = Math.atan2(dy, Math.hypot(dx, dz));
    aspect = cam.aspect;
  }
  layout();

  let yaw = 0; let goalYaw = 0;
  let pitch = 0; let goalPitch = 0;
  let lean = 0; let leanGoal = 0;
  const leanPos = new THREE.Vector3();
  let leanPitch = 0;
  let shakeT = 0; let shakeAmp = 0;

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickIndex(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.intersectObjects(opts.pickables?.() ?? [], false)[0]?.object.userData.index;
  }

  let drag = null;
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, yaw: goalYaw, pitch: goalPitch, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) {
      canvas.style.cursor = pickIndex(e) !== undefined ? 'pointer' : 'grab';
      return;
    }
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; canvas.style.cursor = 'grabbing'; }
    if (!drag.moved) return;
    goalYaw = clamp(drag.yaw + dx * 0.006, -yawMax, yawMax);
    goalPitch = clamp(drag.pitch + dy * 0.004, -pitchMax, pitchMax);
  });
  const end = (e) => {
    if (drag && !drag.moved && e.type === 'pointerup') {
      const i = pickIndex(e);
      if (i !== undefined) opts.onPick?.(i);
    }
    drag = null;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [0.18, 0], ArrowRight: [-0.18, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (step) {
      goalYaw = clamp(goalYaw + step[0], -yawMax, yawMax);
      goalPitch = clamp(goalPitch + step[1], -pitchMax, pitchMax);
      e.preventDefault();
    } else if (e.key === 'Escape') opts.onPick?.(-1);
  });

  const api = {
    /** Lean in towards a world point (or sit back with null). */
    focus(point) {
      if (!point) { leanGoal = 0; return; }
      leanPos.set(point.x, point.y + 0.9, point.z + 1.3);
      leanPitch = Math.atan2(point.y - leanPos.y, Math.hypot(point.x - leanPos.x, point.z - leanPos.z)) - pitch0;
      leanGoal = 1;
      goalYaw = 0; goalPitch = 0;
    },
    shake(amp = 0.12, secs = 0.45) { shakeT = secs; shakeAmp = amp; },
    update(dt) {
      if (cam.aspect !== aspect) layout();
      const k = reduce ? 1 : 1 - Math.exp(-dt * 9);
      yaw += (goalYaw - yaw) * k;
      pitch += (goalPitch - pitch) * k;
      lean += (leanGoal - lean) * k;
      cam.position.lerpVectors(base, leanPos, lean);
      if (shakeT > 0 && !reduce) {
        shakeT -= dt;
        cam.position.x += Math.sin(shakeT * 80) * shakeAmp * Math.max(0, shakeT);
        cam.position.y += Math.cos(shakeT * 67) * shakeAmp * 0.6 * Math.max(0, shakeT);
      }
      cam.rotation.set(pitch0 + pitch + leanPitch * lean, yaw0 + yaw, 0);
    },
  };
  api.update(0);
  return api;
}
