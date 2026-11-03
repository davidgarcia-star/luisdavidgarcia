/* Desafío Bíblico RD – Audio
 * Música instrumental y efectos generados con Web Audio API (sin archivos externos,
 * sin derechos de autor). */
const Sound = (() => {
  let ctx = null;
  let master, musicGain, sfxGain;
  let musicOn = true;
  let sfxOn = true;
  let started = false;
  let schedulerId = null;
  let nextTime = 0;
  let step = 0;

  const BPM = 72;
  const STEP = 60 / BPM / 2; // corchea
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Progresión: C - Am - F - G (ambiente suave, estilo adoración instrumental)
  const CHORDS = [
    { notes: [60, 64, 67, 71], bass: 36 },
    { notes: [57, 60, 64, 67], bass: 33 },
    { notes: [53, 57, 60, 64], bass: 41 },
    { notes: [55, 59, 62, 67], bass: 43 },
  ];
  const ARP = [0, 1, 2, 3, 2, 1, 2, 1];

  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = musicOn ? 0.5 : 0;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.8;
    sfxGain.connect(master);
    return true;
  }

  function tone(freq, when, dur, type, vol, dest, attack = 0.01) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    g.connect(dest);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  function scheduleStep(time, s) {
    const barStep = s % 8;
    const chord = CHORDS[Math.floor(s / 8) % CHORDS.length];
    if (barStep === 0) {
      // Colchón de acordes y bajo
      chord.notes.forEach((n) => tone(midi(n), time, STEP * 8, "sine", 0.07, musicGain, 0.8));
      tone(midi(chord.bass), time, STEP * 8, "triangle", 0.12, musicGain, 0.1);
    }
    // Arpegio suave
    const n = chord.notes[ARP[barStep] % chord.notes.length] + 12;
    tone(midi(n), time, STEP * 2.2, "triangle", 0.09, musicGain, 0.02);
    // Melodía ocasional una octava más arriba
    if (barStep === 0 || barStep === 4) {
      tone(midi(chord.notes[(barStep / 4 + 2) % chord.notes.length] + 24), time + STEP * 0.5, STEP * 3, "sine", 0.05, musicGain, 0.05);
    }
  }

  function scheduler() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.6) {
      scheduleStep(nextTime, step);
      nextTime += STEP;
      step++;
    }
  }

  function startMusic() {
    if (schedulerId) return;
    nextTime = ctx.currentTime + 0.1;
    step = 0;
    schedulerId = setInterval(scheduler, 100);
  }

  // Debe llamarse dentro de un gesto del usuario (clic o tecla).
  function start() {
    if (!ensureCtx()) return;
    if (ctx.state === "suspended") ctx.resume();
    if (!started) {
      started = true;
      startMusic();
    }
  }

  function setMusic(on) {
    musicOn = on;
    if (ctx) musicGain.gain.setTargetAtTime(on ? 0.5 : 0, ctx.currentTime, 0.15);
    return musicOn;
  }
  function setSfx(on) {
    sfxOn = on;
    return sfxOn;
  }

  const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

  const api = {
    start,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    toggleMusic() { return setMusic(!musicOn); },
    toggleSfx() { return setSfx(!sfxOn); },

    // Suena al presionar cualquier tecla (si "Sonidos" está activado)
    key() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      const f = PENTA[Math.floor(Math.random() * PENTA.length)];
      tone(f, t, 0.18, "sine", 0.22, sfxGain, 0.005);
      tone(f * 2, t, 0.1, "triangle", 0.06, sfxGain, 0.005);
    },
    click() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      tone(660, t, 0.08, "triangle", 0.18, sfxGain, 0.003);
    },
    correct() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.09, 0.3, "sine", 0.22, sfxGain, 0.01));
    },
    wrong() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      tone(220, t, 0.35, "sawtooth", 0.1, sfxGain, 0.01);
      tone(165, t + 0.15, 0.45, "sawtooth", 0.1, sfxGain, 0.01);
    },
    tick() {
      if (!sfxOn || !ensureCtx()) return;
      tone(880, ctx.currentTime, 0.05, "square", 0.05, sfxGain, 0.002);
    },
    fanfare() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      [523.25, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.16, 0.4, "triangle", 0.22, sfxGain, 0.01));
    },
  };
  return api;
})();
