/* =========================================================
   ÁNIMO – emojis animados con sonido en medio del juego
   Creado para los juegos de Luis David Esteban García · MIPROAA
   - No salen siempre: aparecen a veces al responder (más seguido en rachas).
   - Cada emoji tiene su propia animación y su propio sonido (Web Audio, sin archivos).
   - Respeta el botón de sonidos del juego (Sound.sfxOn) y "reducir movimiento".
   Uso:  Animo.acierto(racha)   ·   Animo.fallo(seAcaboElTiempo)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Catálogo: emoji, frase, animación y sonido ---------- */
  var ACIERTO = [
    { e: '🔥', t: '¡Estás en fuego!',       a: 'fuego',   s: 'fuego'   },
    { e: '🎉', t: '¡Excelente!',            a: 'salto',   s: 'fiesta'  },
    { e: '👏', t: '¡Bravo, bravo!',         a: 'aplauso', s: 'aplauso' },
    { e: '⭐', t: '¡Brillante!',            a: 'giro',    s: 'brillo'  },
    { e: '🚀', t: '¡Imparable!',            a: 'cohete',  s: 'cohete'  },
    { e: '😎', t: '¡Qué nivel!',            a: 'salto',   s: 'cool'    },
    { e: '🙌', t: '¡Gloria a Dios!',        a: 'salto',   s: 'coro'    },
    { e: '📖', t: '¡Conoces la Palabra!',   a: 'giro',    s: 'pagina'  },
    { e: '💯', t: '¡Perfecto!',             a: 'latido',  s: 'brillo'  },
    { e: '🤩', t: '¡Wow, qué bien!',        a: 'latido',  s: 'fiesta'  }
  ];
  var RACHA = {
    3:  { e: '🔥', t: '¡Racha de 3!',              a: 'fuego',  s: 'fuego'  },
    5:  { e: '🚀', t: '¡5 seguidas, imparable!',   a: 'cohete', s: 'cohete' },
    7:  { e: '👑', t: '¡7 seguidas, eres realeza!', a: 'giro',   s: 'trompeta' },
    10: { e: '🏆', t: '¡10 seguidas, campeón!',    a: 'latido', s: 'trompeta' },
    15: { e: '🦁', t: '¡15! ¡Valiente como un león!', a: 'salto', s: 'rugido' },
    20: { e: '👑', t: '¡20 seguidas! ¡Máster total!', a: 'giro', s: 'trompeta' }
  };
  var FALLO = [
    { e: '💪', t: '¡Tú puedes!',                 a: 'latido',  s: 'fuerza' },
    { e: '🤗', t: '¡Sigue adelante!',            a: 'salto',   s: 'suave'  },
    { e: '🙏', t: '¡La próxima es tuya!',        a: 'flota',   s: 'suave'  },
    { e: '😅', t: '¡Casi! Inténtalo otra vez',   a: 'temblor', s: 'casi'   }
  ];
  var TIEMPO = [
    { e: '⏰', t: '¡Rápido, que el tiempo vuela!', a: 'temblor', s: 'reloj' },
    { e: '🐢', t: '¡Ánimo, un poco más rápido!',   a: 'flota',   s: 'casi'  }
  ];

  /* ---------- Cuándo aparecer (a veces, no siempre) ---------- */
  var sinMostrar = 99, ultimo = '';
  function toca(prob) {
    if (sinMostrar < 2) return false;           // nunca dos preguntas seguidas
    return Math.random() < prob + Math.min(sinMostrar - 2, 4) * 0.05;
  }
  function elegir(lista) {
    var op = lista.filter(function (x) { return x.e !== ultimo; });
    return op[Math.floor(Math.random() * op.length)];
  }

  /* ---------- Estilos (se inyectan una vez) ---------- */
  var reduce = false;
  try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var css = '' +
    '.an-capa{position:fixed;inset:0;pointer-events:none;z-index:9990;overflow:hidden}' +
    '.an-box{position:absolute;left:50%;top:26%;transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px}' +
    '.an-emoji{font-size:clamp(76px,18vw,132px);line-height:1;filter:drop-shadow(0 10px 24px rgba(0,0,0,.45));will-change:transform,opacity}' +
    '.an-txt{font:800 clamp(1.05rem,3.6vw,1.45rem)/1.1 "Barlow Condensed","Inter",system-ui,sans-serif;letter-spacing:.02em;color:#fff;' +
      'padding:9px 18px;border-radius:999px;background:linear-gradient(135deg,rgba(255,196,64,.95),rgba(255,120,40,.95));' +
      'box-shadow:0 10px 30px -8px rgba(255,140,40,.7),inset 0 1px 0 rgba(255,255,255,.4);text-shadow:0 1px 2px rgba(0,0,0,.35);white-space:nowrap;' +
      'animation:an-txt 1.9s cubic-bezier(.2,.8,.2,1) both}' +
    '.an-box.flojo .an-txt{background:linear-gradient(135deg,rgba(90,140,255,.95),rgba(140,90,255,.95));box-shadow:0 10px 30px -8px rgba(110,110,255,.7),inset 0 1px 0 rgba(255,255,255,.4)}' +
    '.an-mini{position:absolute;left:50%;top:26%;font-size:26px;opacity:0;animation:an-mini 1.3s ease-out forwards}' +
    '@keyframes an-txt{0%{opacity:0;transform:translateY(14px) scale(.7)}18%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}' +
    '@keyframes an-mini{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}15%{opacity:1}100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1) rotate(var(--rot))}}' +
    /* animaciones del emoji grande */
    '.an-salto{animation:an-salto 1.9s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes an-salto{0%{opacity:0;transform:scale(.2) translateY(60px)}22%{opacity:1;transform:scale(1.25) translateY(-14px)}36%{transform:scale(.95) translateY(0)}48%{transform:scale(1.06) translateY(-6px)}60%{transform:scale(1)}82%{opacity:1}100%{opacity:0;transform:scale(.9) translateY(-40px)}}' +
    '.an-giro{animation:an-giro 1.9s cubic-bezier(.2,.8,.2,1) both}' +
    '@keyframes an-giro{0%{opacity:0;transform:scale(.1) rotate(-200deg)}30%{opacity:1;transform:scale(1.2) rotate(15deg)}45%{transform:scale(1) rotate(-6deg)}60%{transform:rotate(0)}82%{opacity:1}100%{opacity:0;transform:scale(1.3)}}' +
    '.an-latido{animation:an-latido 1.9s ease both}' +
    '@keyframes an-latido{0%{opacity:0;transform:scale(.3)}15%{opacity:1;transform:scale(1.2)}28%{transform:scale(.92)}40%{transform:scale(1.15)}52%{transform:scale(.96)}64%{transform:scale(1.05)}82%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.6)}}' +
    '.an-cohete{animation:an-cohete 1.9s cubic-bezier(.5,0,.75,0) both}' +
    '@keyframes an-cohete{0%{opacity:0;transform:translate(-80px,120px) rotate(0) scale(.6)}20%{opacity:1;transform:translate(0,0) scale(1.1)}30%,55%{transform:translate(0,0) rotate(-4deg) scale(1)}42%{transform:translate(2px,-3px) rotate(4deg)}100%{opacity:0;transform:translate(160px,-70vh) scale(.7)}}' +
    '.an-fuego{animation:an-fuego 1.9s ease both}' +
    '@keyframes an-fuego{0%{opacity:0;transform:scale(.2) translateY(50px)}20%{opacity:1;transform:scale(1.15,1.3)}30%{transform:scale(1,.92)}40%{transform:scale(1.08,1.15) skewX(-4deg)}50%{transform:scale(1,.96) skewX(4deg)}60%{transform:scale(1.05,1.1) skewX(-3deg)}70%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:scale(1.1,1.5) translateY(-30px)}}' +
    '.an-aplauso{animation:an-aplauso 1.9s ease both}' +
    '@keyframes an-aplauso{0%{opacity:0;transform:scale(.3)}15%{opacity:1;transform:scale(1.15)}22%,38%,54%{transform:scale(.88) rotate(-6deg)}30%,46%,62%{transform:scale(1.1) rotate(6deg)}72%{transform:scale(1)}85%{opacity:1}100%{opacity:0;transform:translateY(-30px)}}' +
    '.an-temblor{animation:an-temblor 1.9s ease both}' +
    '@keyframes an-temblor{0%{opacity:0;transform:scale(.4)}15%{opacity:1;transform:scale(1.1)}20%,30%,40%,50%{transform:translateX(-10px) rotate(-8deg)}25%,35%,45%,55%{transform:translateX(10px) rotate(8deg)}65%{transform:none}85%{opacity:1}100%{opacity:0;transform:scale(.8)}}' +
    '.an-flota{animation:an-flota 2.1s ease-in-out both}' +
    '@keyframes an-flota{0%{opacity:0;transform:translateY(40px) scale(.6)}25%{opacity:1;transform:translateY(0) scale(1)}50%{transform:translateY(-12px) rotate(-5deg)}70%{transform:translateY(-4px) rotate(4deg)}85%{opacity:1}100%{opacity:0;transform:translateY(-50px)}}' +
    '@media (prefers-reduced-motion: reduce){.an-emoji,.an-txt{animation:an-suave 1.8s ease both!important}.an-mini{display:none}@keyframes an-suave{0%,100%{opacity:0}15%,80%{opacity:1}}}';
  var listo = false, capa = null;
  function preparar() {
    if (listo) return;
    listo = true;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    capa = document.createElement('div'); capa.className = 'an-capa'; capa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(capa);
  }

  /* ---------- Sonidos (uno por tipo de emoji) ---------- */
  var ctx = null, sal = null, ruidoBuf = null;
  function audio() {
    if (window.Sound && window.Sound.sfxOn === false) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
      sal = ctx.createGain(); sal.gain.value = .55; sal.connect(ctx.destination);
      ruidoBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var d = ruidoBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function nota(t, f, dur, tipo, vol, f2) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(sal); o.start(t); o.stop(t + dur + .05);
  }
  function ruido(t, dur, vol, tipo, f, f2, q) {
    var s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruidoBuf; fl.type = tipo || 'bandpass'; fl.Q.value = q || 1;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + .008);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(sal);
    s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  }
  var SONIDOS = {
    fuego: function (t) {   // llamarada: soplido que sube + chisporroteo
      ruido(t, .7, .35, 'bandpass', 300, 2400, .8);
      for (var i = 0; i < 9; i++) ruido(t + .1 + Math.random() * .6, .04, .25, 'highpass', 3000 + Math.random() * 3000, 0, 1);
      nota(t + .05, hz(60), .5, 'triangle', .12, hz(72));
    },
    fiesta: function (t) {  // matasuegras: ¡pop! + confeti + arpegio alegre
      ruido(t, .09, .6, 'lowpass', 1800, 0, 1);
      for (var i = 0; i < 6; i++) ruido(t + .08 + i * .05, .05, .12, 'highpass', 5000, 0, 1);
      [72, 76, 79, 84].forEach(function (m, i) { nota(t + .1 + i * .08, hz(m), .25, 'square', .07); nota(t + .1 + i * .08, hz(m + 12), .2, 'sine', .05); });
    },
    aplauso: function (t) { // aplausos de público
      for (var i = 0; i < 26; i++) ruido(t + Math.random() * 1.1, .035 + Math.random() * .03, .18 + Math.random() * .2, 'bandpass', 1200 + Math.random() * 1400, 0, 1.4);
    },
    brillo: function (t) {  // destellos de estrella
      [88, 91, 96, 93, 100].forEach(function (m, i) { nota(t + i * .07, hz(m), .5, 'sine', .09); nota(t + i * .07, hz(m) * 2.01, .3, 'sine', .025); });
    },
    cohete: function (t) {  // despegue: zumbido que sube + escape
      nota(t, 120, 1.2, 'sawtooth', .07, 1600);
      ruido(t, 1.2, .3, 'bandpass', 400, 4000, .7);
      nota(t + .9, hz(84), .3, 'sine', .08);
    },
    cool: function (t) {    // deslizado “cool” de dos tonos
      nota(t, hz(67), .18, 'triangle', .14, hz(74)); nota(t + .2, hz(79), .35, 'triangle', .13, hz(77));
      ruido(t + .2, .06, .12, 'highpass', 6000, 0, 1);
    },
    coro: function (t) {    // acorde de coro: “¡Aaah!”
      [60, 64, 67, 72].forEach(function (m) {
        [-6, 6].forEach(function (c) {
          var o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
          o.type = 'sawtooth'; o.frequency.value = hz(m); o.detune.value = c;
          f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.2;
          g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.035, t + .25); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
          o.connect(f); f.connect(g); g.connect(sal); o.start(t); o.stop(t + 1.5);
        });
      });
    },
    pagina: function (t) {  // pasar página + campanita
      ruido(t, .18, .3, 'bandpass', 2500, 900, 1.5);
      nota(t + .16, hz(84), .6, 'sine', .1); nota(t + .16, hz(91), .5, 'sine', .04);
    },
    trompeta: function (t) {// fanfarria de campeón
      [[67, .12], [67, .12], [67, .12], [72, .5]].forEach(function (n, i) {
        nota(t + i * .14, hz(n[0]), n[1] + .1, 'sawtooth', .07); nota(t + i * .14, hz(n[0] + 7), n[1] + .1, 'square', .03);
      });
      ruido(t + .42, .25, .15, 'highpass', 7000, 0, 1);
    },
    rugido: function (t) {  // rugido de león
      nota(t, 110, .9, 'sawtooth', .14, 60);
      ruido(t, .9, .3, 'lowpass', 700, 200, 1);
      nota(t + .9, hz(79), .3, 'triangle', .08); nota(t + 1.0, hz(84), .4, 'triangle', .08);
    },
    fuerza: function (t) {  // golpe fuerte + subida decidida
      nota(t, 90, .25, 'sine', .3, 45); ruido(t, .08, .3, 'lowpass', 600, 0, 1);
      [60, 64, 67].forEach(function (m, i) { nota(t + .22 + i * .1, hz(m), .3, 'triangle', .1); });
    },
    suave: function (t) {   // tonos cálidos de ánimo
      [64, 67, 72].forEach(function (m, i) { nota(t + i * .12, hz(m), .7, 'sine', .1); nota(t + i * .12, hz(m - 12), .7, 'triangle', .04); });
    },
    casi: function (t) {    // “¡uy, casi!” (wobble)
      nota(t, hz(72), .25, 'triangle', .12, hz(67)); nota(t + .25, hz(69), .35, 'triangle', .11, hz(74));
    },
    reloj: function (t) {   // tic-tac + timbre
      for (var i = 0; i < 4; i++) ruido(t + i * .12, .03, .4, 'highpass', i % 2 ? 2500 : 3500, 0, 4);
      for (var k = 0; k < 6; k++) nota(t + .5 + k * .05, hz(88), .05, 'square', .05);
    }
  };
  function sonar(clave) {
    if (!audio() || !SONIDOS[clave]) return;
    try { SONIDOS[clave](ctx.currentTime + .03); } catch (e) {}
  }

  /* ---------- Mostrar el emoji ---------- */
  var tFuera = 0;
  function mostrar(item, flojo) {
    preparar();
    sinMostrar = 0; ultimo = item.e;
    clearTimeout(tFuera);
    capa.innerHTML = '';
    var box = document.createElement('div'); box.className = 'an-box' + (flojo ? ' flojo' : '');
    var em = document.createElement('div'); em.className = 'an-emoji an-' + item.a; em.textContent = item.e;
    var tx = document.createElement('div'); tx.className = 'an-txt'; tx.textContent = item.t;
    box.appendChild(em); box.appendChild(tx); capa.appendChild(box);
    if (!reduce) {
      var n = flojo ? 6 : 12;
      for (var i = 0; i < n; i++) {
        var m = document.createElement('span'); m.className = 'an-mini'; m.textContent = item.e;
        var ang = (i / n) * Math.PI * 2 + Math.random() * .4, r = 110 + Math.random() * 90;
        m.style.setProperty('--dx', Math.round(Math.cos(ang) * r) + 'px');
        m.style.setProperty('--dy', Math.round(Math.sin(ang) * r * .8) + 'px');
        m.style.setProperty('--rot', Math.round(Math.random() * 360 - 180) + 'deg');
        m.style.animationDelay = (.15 + Math.random() * .2) + 's';
        m.style.fontSize = (18 + Math.random() * 16) + 'px';
        capa.appendChild(m);
      }
    }
    sonar(item.s);
    tFuera = setTimeout(function () { capa.innerHTML = ''; }, 2300);
  }

  window.Animo = {
    acierto: function (racha) {
      sinMostrar++;
      if (RACHA[racha] && sinMostrar >= 1) { mostrar(RACHA[racha]); return; }
      if (toca(racha >= 2 ? .32 : .22)) mostrar(elegir(ACIERTO));
    },
    fallo: function (tiempo) {
      sinMostrar++;
      if (toca(.3)) mostrar(elegir(tiempo ? TIEMPO : FALLO), true);
    },
    reiniciar: function () { sinMostrar = 99; ultimo = ''; if (capa) capa.innerHTML = ''; },
    probar: function (clave) { // para probar: Animo.probar('fuego')
      var todos = ACIERTO.concat(FALLO, TIEMPO);
      for (var k in RACHA) todos.push(RACHA[k]);
      var it = todos.filter(function (x) { return x.s === clave || x.e === clave; })[0] || elegir(ACIERTO);
      mostrar(it);
    }
  };
})();
