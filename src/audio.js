// Sound is only ever played on the Blind player's device (the Deaf player gets visual cues instead).
let ctx = null;
let toneNode = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur = 0.08, type = 'square', vol = 0.12) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

const buzz = (p) => navigator.vibrate?.(p);

export const audio = {
  unlock: ac,
  beep,
  tick: (fast) => beep(fast ? 1400 : 1000, 0.05, 'square', 0.07),
  click: () => { beep(500, 0.03, 'triangle', 0.1); buzz(15); },
  strike() { beep(140, 0.5, 'sawtooth', 0.25); buzz([200, 80, 200]); },
  solved() { beep(660, 0.1, 'sine', 0.2); setTimeout(() => beep(990, 0.2, 'sine', 0.2), 110); buzz(60); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sine', 0.2), i * 140)); },
  boom() {
    const c = ac();
    if (!c) return;
    const len = c.sampleRate * 1.5;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = c.createBufferSource();
    const g = c.createGain();
    g.gain.value = 0.5;
    src.buffer = buf;
    src.connect(g).connect(c.destination);
    src.start();
    buzz([400, 100, 400]);
  },
  startTone(freq) {
    audio.stopTone();
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.18;
    o.connect(g).connect(c.destination);
    o.start();
    toneNode = o;
  },
  stopTone() {
    if (toneNode) { try { toneNode.stop(); } catch { /* already stopped */ } toneNode = null; }
  },
  speak(text) {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  },
};
