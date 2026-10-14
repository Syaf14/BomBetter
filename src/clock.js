// Shared countdown. The host sends `remaining` + `rate`; clients extrapolate locally between snapshots.
export const clock = {
  remaining: 0,
  rate: 1,
  at: 0,
  running: false,
  set(remaining, rate, running) {
    this.remaining = remaining;
    this.rate = rate;
    this.running = running;
    this.at = performance.now();
  },
  get() {
    const elapsed = this.running ? (performance.now() - this.at) * this.rate : 0;
    return Math.max(0, this.remaining - elapsed);
  },
  format() {
    const s = Math.ceil(this.get() / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  },
};
