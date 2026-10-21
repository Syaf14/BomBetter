// Live voice over WebRTC (same PeerJS peers). Only Deaf and Blind have a mic; Mute, Blind and Spectators listen.
// Deaf must never hear voice, so every incoming call goes through the gate below.
export function createTalker(peer, targetIds) {
  let stream = null;
  let calls = [];
  let on = false;
  return {
    supported: !!navigator.mediaDevices?.getUserMedia,
    get on() { return on; },
    async toggle() {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        calls = targetIds.map((id) => peer.call(id, stream));
        on = true;
      } else {
        on = !on;
        stream.getAudioTracks().forEach((t) => (t.enabled = on));
      }
      return on;
    },
    stop() {
      stream?.getTracks().forEach((t) => t.stop());
      calls.forEach((c) => { try { c.close(); } catch { /* already closed */ } });
      stream = null;
      calls = [];
      on = false;
    },
  };
}

/**
 * Gate for incoming voice. `allowed` is only true while the player holds a listening role in a running game.
 * Calls that arrive before the role is known are held, then answered or rejected once `setAllowed` is called.
 * Each answered call gets its own <audio> element so Mute can hear Deaf and Blind at once.
 */
export function createVoiceIn() {
  let allowed = false;
  const calls = new Set();
  const els = new Set();
  const waiting = new Set();

  function answer(call) {
    calls.add(call);
    call.answer();
    call.on('stream', (s) => {
      if (!allowed || !calls.has(call)) return drop(call);
      const el = document.createElement('audio');
      el.autoplay = true;
      el.setAttribute('playsinline', '');
      el.srcObject = s;
      el._call = call;
      document.body.append(el);
      els.add(el);
      el.play().catch(() => {});
    });
    call.on('close', () => drop(call));
    call.on('error', () => drop(call));
  }

  function drop(call) {
    calls.delete(call);
    waiting.delete(call);
    for (const el of els) {
      if (el._call !== call) continue;
      el.pause();
      el.srcObject = null;
      el.remove();
      els.delete(el);
    }
    try { call.close(); } catch { /* already closed */ }
  }

  function closeAll() {
    [...calls].forEach(drop); // calls still waiting for a role survive: the game's start message may be in flight
    for (const el of els) { el.pause(); el.srcObject = null; el.remove(); }
    els.clear();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  return {
    /** Called by the peer's 'call' event. */
    incoming(call) {
      if (allowed) answer(call);
      else {
        waiting.add(call);
        setTimeout(() => waiting.has(call) && drop(call), 10000); // no role arrived: reject
      }
    },
    setAllowed(v) {
      allowed = !!v;
      if (!allowed) return closeAll();
      for (const c of [...waiting]) { waiting.delete(c); answer(c); }
    },
    closeAll,
  };
}
