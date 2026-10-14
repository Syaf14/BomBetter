// Live voice over WebRTC (same PeerJS peers). Only Deaf and Blind have a mic; only Mute and Blind listen.
export function createTalker(peer, targetIds) {
  let stream = null;
  let on = false;
  return {
    supported: !!navigator.mediaDevices?.getUserMedia,
    get on() { return on; },
    async toggle() {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        targetIds.forEach((id) => peer.call(id, stream));
        on = true;
      } else {
        on = !on;
        stream.getAudioTracks().forEach((t) => (t.enabled = on));
      }
      return on;
    },
    stop() { stream?.getTracks().forEach((t) => t.stop()); stream = null; on = false; },
  };
}

// Each incoming call gets its own <audio> element so Blind can hear Deaf while Mute hears both.
export function answerVoice(call) {
  call.answer();
  call.on('stream', (s) => {
    const el = document.createElement('audio');
    el.autoplay = true;
    el.setAttribute('playsinline', '');
    el.srcObject = s;
    document.body.append(el);
    el.play().catch(() => {});
    const drop = () => el.remove();
    call.on('close', drop);
    call.on('error', drop);
  });
}
