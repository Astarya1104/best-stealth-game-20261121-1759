// SEEDKEEPER — all sounds are synthesized with WebAudio. No audio files,
// no network: every effect is an oscillator or a short burst of noise.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.stepAlt = false;
  }

  // Created lazily on the first user gesture, so autoplay rules never block us.
  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  // A short tone: freq in Hz, dur in seconds, kind of wave, volume 0..1,
  // and an optional slide to a second frequency.
  tone(freq, dur, kind = 'sine', vol = 0.2, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = kind;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  // A burst of filtered noise — footsteps, rustles, the pebble's tok.
  noise(dur, vol, filterFreq, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t0);
  }

  // One footstep. Sneaking is a soft rustle, walking a light tap.
  // Alternate pitch so two steps never sound identical.
  footstep(sneaking) {
    this.stepAlt = !this.stepAlt;
    if (sneaking) {
      this.noise(0.09, 0.05, 700);
    } else {
      this.noise(0.06, 0.11, 1400);
      this.tone(this.stepAlt ? 150 : 130, 0.05, 'triangle', 0.05);
    }
  }

  // A pebble tossed onto gravel: a bright tok, then a faint rattle.
  pebble() {
    this.tone(1400, 0.05, 'square', 0.08, 900);
    this.noise(0.08, 0.07, 2400, 0.06);
  }

  // Picking up a seed packet: a warm two-note chime.
  pickup() {
    this.tone(660, 0.12, 'sine', 0.18);
    this.tone(990, 0.2, 'sine', 0.16, null, 0.09);
  }

  // Suspicion crossing the line: a short rising sting.
  alert() {
    this.tone(220, 0.28, 'sawtooth', 0.12, 440);
    this.tone(440, 0.2, 'square', 0.05, null, 0.05);
  }

  // Caught: a low thud and a falling note.
  caught() {
    this.tone(180, 0.35, 'sawtooth', 0.16, 70);
    this.noise(0.2, 0.12, 500);
  }

  // The gate opening: a soft latch click, then a rising arpeggio.
  gateOpen() {
    this.tone(500, 0.06, 'square', 0.08);
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'sine', 0.14, null, 0.1 + i * 0.09));
  }

  // Winning: a slow dawn arpeggio over a warm chord.
  win() {
    [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.14, null, i * 0.12));
    this.tone(196, 0.9, 'sine', 0.08, null, 0.1);
    this.tone(294, 0.9, 'sine', 0.06, null, 0.1);
  }
}
