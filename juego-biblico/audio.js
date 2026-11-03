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

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  // Dos pistas instrumentales: "menu" (calmada, adoración) y "game" (más enérgica, para jugar)
  const TRACKS = {
    menu: {
      bpm: 72, wave: "triangle", drums: false,
      chords: [
        { notes: [60, 64, 67, 71], bass: 36 }, // C
        { notes: [57, 60, 64, 67], bass: 33 }, // Am
        { notes: [53, 57, 60, 64], bass: 41 }, // F
        { notes: [55, 59, 62, 67], bass: 43 }, // G
      ],
      arp: [0, 1, 2, 3, 2, 1, 2, 1],
    },
    game: {
      bpm: 108, wave: "square", drums: true,
      chords: [
        { notes: [62, 65, 69, 72], bass: 38 }, // Dm
        { notes: [58, 62, 65, 69], bass: 34 }, // Bb
        { notes: [60, 64, 67, 72], bass: 36 }, // C
        { notes: [57, 60, 64, 69], bass: 33 }, // Am
      ],
      arp: [0, 2, 1, 3, 0, 2, 3, 1],
    },
  };
  let trackName = "menu";
  const track = () => TRACKS[trackName];
  const stepLen = () => 60 / track().bpm / 2; // corchea

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

  let noiseBuf = null;
  function hat(when, vol) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    src.connect(f); f.connect(g); g.connect(musicGain);
    src.start(when); src.stop(when + 0.1);
  }
  function kick(when) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, when);
    o.frequency.exponentialRampToValueAtTime(45, when + 0.12);
    g.gain.setValueAtTime(0.35, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    o.connect(g); g.connect(musicGain);
    o.start(when); o.stop(when + 0.2);
  }

  function scheduleStep(time, s) {
    const t = track();
    const L = stepLen();
    const barStep = s % 8;
    const chord = t.chords[Math.floor(s / 8) % t.chords.length];
    if (barStep === 0) {
      // Colchón de acordes y bajo
      chord.notes.forEach((n) => tone(midi(n), time, L * 8, "sine", 0.06, musicGain, 0.4));
      tone(midi(chord.bass), time, L * 8, "triangle", 0.13, musicGain, 0.05);
    }
    if (t.drums) {
      if (barStep % 2 === 0) kick(time);
      hat(time + (barStep % 2 ? 0 : L / 2), barStep % 2 ? 0.05 : 0.025);
      if (barStep === 4) tone(midi(chord.bass + 12), time, L * 1.5, "triangle", 0.1, musicGain, 0.01);
    }
    // Arpegio
    const n = chord.notes[t.arp[barStep] % chord.notes.length] + 12;
    tone(midi(n), time, L * 2.2, t.wave, t.drums ? 0.06 : 0.09, musicGain, 0.02);
    // Melodía ocasional una octava más arriba
    if (barStep === 0 || barStep === 4) {
      tone(midi(chord.notes[(barStep / 4 + 2) % chord.notes.length] + 24), time + L * 0.5, L * 3, "sine", 0.05, musicGain, 0.05);
    }
  }

  function scheduler() {
    if (!ctx) return;
    while (nextTime < ctx.currentTime + 0.6) {
      scheduleStep(nextTime, step);
      nextTime += stepLen();
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
    // Cambia la música: "menu" (calmada) o "game" (para jugar)
    setTrack(name) {
      if (!TRACKS[name] || name === trackName) return;
      trackName = name;
      step = 0;
      if (ctx) nextTime = ctx.currentTime + 0.15;
    },
    get track() { return trackName; },
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
    // Efecto de triunfo (trompetas) al iniciar el juego
    triumph() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime + 0.05;
      const notas = [
        [392.00, 0.00, 0.14], [392.00, 0.16, 0.14], [392.00, 0.32, 0.14],
        [523.25, 0.48, 0.55], [659.25, 1.05, 0.22], [783.99, 1.30, 0.9],
      ];
      notas.forEach(([f, d, dur]) => {
        tone(f, t + d, dur, "sawtooth", 0.07, sfxGain, 0.02);
        tone(f, t + d, dur, "triangle", 0.2, sfxGain, 0.02);
        tone(f * 2, t + d, dur * 0.8, "sine", 0.05, sfxGain, 0.02);
      });
      // acorde final brillante
      [523.25, 659.25, 783.99, 1046.5].forEach((f) => tone(f, t + 1.3, 1.1, "triangle", 0.09, sfxGain, 0.03));
    },
    fanfare() {
      if (!sfxOn || !ensureCtx()) return;
      const t = ctx.currentTime;
      [523.25, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.16, 0.4, "triangle", 0.22, sfxGain, 0.01));
    },
  };
  return api;
})();
