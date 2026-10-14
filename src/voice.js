// Live voice from the Deaf player to the Blind player (WebRTC audio via the same PeerJS peers).
export function createTalker(peer, targetId) {
  let stream = null;
  let on = false;
  return {
    supported: !!navigator.mediaDevices?.getUserMedia,
    get on() { return on; },
    async toggle() {
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        peer.call(targetId, stream);
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

export function answerVoice(call, audioEl) {
  call.answer();
  call.on('stream', (s) => {
    audioEl.srcObject = s;
    audioEl.play().catch(() => {});
  });
}
