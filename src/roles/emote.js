// Emote wheel for the Mute player: press X (or the ✋ button), then click or drag to a slot.
// EMOTES is plain data, also imported by the host to validate ids.
export const EMOTES = [
  { id: 'n1', label: '1', face: '☝️' },
  { id: 'n2', label: '2', face: '✌️' },
  { id: 'n3', label: '3', face: '🤟' },
  { id: 'n4', label: '4', face: '🖖' },
  { id: 'n5', label: '5', face: '🖐️' },
  { id: 'n6', label: '6', face: '🖐️☝️' },
  { id: 'n7', label: '7', face: '🖐️✌️' },
  { id: 'n8', label: '8', face: '🖐️🤟' },
  { id: 'n9', label: '9', face: '🖐️🖖' },
  { id: 'n10', label: '10', face: '🖐️🖐️' },
  { id: 'yes', label: 'Yes', face: '👍' },
  { id: 'no', label: 'No', face: '👎' },
  { id: 'higher', label: 'Higher', face: '👍' },
  { id: 'lower', label: 'Lower', face: '👎' },
];
// Blind's taunts aimed at the Deaf player (who can't hear the trash talk, so they have to be shown).
export const TAUNTS = [
  { id: 't_lol', label: 'LOL', face: '😂', taunt: true },
  { id: 't_deaf', label: "Can't hear me", face: '🙉', taunt: true },
  { id: 't_slow', label: 'Too slow', face: '🥱', taunt: true },
  { id: 't_tick', label: 'Tick tock', face: '💣', taunt: true },
  { id: 't_tongue', label: 'Nyah!', face: '😜', taunt: true },
  { id: 't_clown', label: 'Clown', face: '🤡', taunt: true },
  { id: 't_wave', label: 'Bye bye', face: '👋', taunt: true },
  { id: 't_cry', label: 'Cry more', face: '😭', taunt: true },
];
export const MUTE_EMOTE_IDS = new Set(EMOTES.map((e) => e.id));
export const TAUNT_IDS = new Set(TAUNTS.map((e) => e.id));
export const EMOTE_IDS = new Set([...MUTE_EMOTE_IDS, ...TAUNT_IDS]);
export const emoteById = (id) => EMOTES.find((e) => e.id === id) || TAUNTS.find((e) => e.id === id);

const RADIUS = 104;
const SLOT = 56;

export function createEmoteWheel(root, { onPick, list = EMOTES, button = '✋ Emote' }) {
  root.insertAdjacentHTML('beforeend', `
    <button type="button" class="emote-btn" aria-label="Open emote wheel">${button} <kbd>X</kbd></button>
    <div class="emote-wheel hidden" role="menu" aria-label="Emotes">
      ${list.map((e, i) => {
        const a = (i / list.length) * Math.PI * 2 - Math.PI / 2;
        return `<button type="button" role="menuitem" class="emote-slot" data-i="${i}"
          style="left:${Math.cos(a) * RADIUS}px;top:${Math.sin(a) * RADIUS}px" aria-label="${e.label}">
          <span>${e.face}</span><b>${e.label}</b></button>`;
      }).join('')}
      <div class="emote-hub">…</div>
    </div>`);
  const btn = root.querySelector('.emote-btn');
  const wheel = root.querySelector('.emote-wheel');
  const hub = root.querySelector('.emote-hub');
  const slots = [...wheel.querySelectorAll('.emote-slot')];
  let open = false;
  let dragging = false;
  let t0 = 0;
  let hot = -1;
  let cx = 0;
  let cy = 0;
  let mouse = { x: innerWidth / 2, y: innerHeight / 2 };

  function highlight(i) {
    hot = i;
    slots.forEach((s, k) => s.classList.toggle('hot', k === i));
    hub.textContent = i >= 0 ? list[i].label : '…';
  }

  function openAt(x, y) {
    const m = RADIUS + SLOT;
    cx = Math.min(innerWidth - m, Math.max(m, x));
    cy = Math.min(innerHeight - m, Math.max(m, y));
    wheel.style.left = `${cx}px`;
    wheel.style.top = `${cy}px`;
    wheel.classList.remove('hidden');
    open = true;
    highlight(-1);
  }

  function close() {
    wheel.classList.add('hidden');
    open = false;
    highlight(-1);
  }

  function pick(i) {
    if (i < 0) return;
    onPick(list[i].id);
    close();
  }

  // Which slot is the pointer pointing at, based on angle from the wheel's centre.
  function slotAt(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) < 34) return -1;
    const ang = (Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);
    return Math.round((ang / (Math.PI * 2)) * list.length) % list.length;
  }

  // Desktop: X toggles the wheel at the cursor; move to aim, click to choose.
  const onKey = (e) => {
    if (e.key === 'Escape' && open) return close();
    if (e.key.toLowerCase() !== 'x' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    open ? close() : openAt(mouse.x, mouse.y);
  };
  const onMove = (e) => {
    mouse = { x: e.clientX, y: e.clientY };
    if (open) highlight(slotAt(e.clientX, e.clientY));
  };
  const onDown = (e) => {
    const t = e.target instanceof Element ? e.target : null;
    if (!open || t?.closest('.emote-btn')) return;
    const i = slotAt(e.clientX, e.clientY);
    if (i >= 0) pick(i);
    else if (!t?.closest('.emote-wheel')) close();
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerdown', onDown);

  // Touch / mouse on the ✋ button: press, drag to a slot and release to send.
  // A plain tap leaves the wheel open so a slot can be tapped.
  btn.onpointerdown = (e) => {
    e.preventDefault();
    try { btn.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
    const r = btn.getBoundingClientRect();
    openAt(r.left + r.width / 2, r.top - RADIUS * 0.2);
    dragging = true;
    t0 = performance.now();
  };
  btn.onpointermove = (e) => {
    if (open && dragging) highlight(slotAt(e.clientX, e.clientY));
  };
  btn.onpointerup = (e) => {
    if (!dragging) return;
    dragging = false;
    try { btn.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    // Drag to a slot and release to send; a quick tap leaves the wheel open for tapping a slot.
    if (hot >= 0 && performance.now() - t0 > 200) pick(hot);
  };
  btn.onpointercancel = () => { dragging = false; close(); };

  slots.forEach((s, i) => (s.onclick = () => pick(i)));

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerdown', onDown);
    },
  };
}
