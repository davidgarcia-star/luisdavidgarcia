/* =====================================================================
   COMBATE DE LA FE 🥊 — modo en línea 1 contra 1
   «Pelea la buena batalla de la fe» (1 Timoteo 6:12, LBLA)
   El MISMO archivo va en Desafío Bíblico RD (parte 1) y Desafío Bíblico RD 2.

   Cómo funciona:
   - Un jugador crea el combate (nivel Básico, Intermedio o Avanzado y 10, 20 o 35 preguntas)
     y comparte el código de 6 letras o el enlace (?combate=CÓDIGO).
   - El otro entra con el código o tocando el enlace.
   - Los dos responden las MISMAS preguntas, en el mismo orden, con 20 segundos cada una.
     Cada uno ve en vivo cuántas lleva y cuántas ha acertado el rival.
   - Gana quien acierte más; si empatan, gana quien respondió más rápido en total.
   - Los datos van en Firestore (proyecto "juegos-miproaa", colección "duelos"). Ver firestore.rules.

   Uso:  <script src="../duelo.js" data-juego="Desafío Bíblico RD"></script>
         y un botón con id="btnCombate" (opcional) que abre el menú del combate.
   ===================================================================== */
(function () {
  'use strict';
  var PROJECT = 'juegos-miproaa', KEY = 'AIzaSyCnYkLEbVg6xqcMUcoqFGHnVTKy2TBRgLQ';
  var BASE = 'https://firestore.googleapis.com/v1/projects/' + PROJECT + '/databases/(default)/documents/duelos/';
  var NIVELES = [
    { id: 'basico', name: 'Básico', emoji: '🌱' },
    { id: 'intermedio', name: 'Intermedio', emoji: '📗' },
    { id: 'avanzado', name: 'Avanzado', emoji: '🔥' }
  ];
  var LARGOS = [[10, 'Pocas preguntas'], [20, 'Intermedio'], [35, 'Muchas preguntas']];
  var TIEMPO = 20;              // segundos por pregunta
  var POLL = 1500;              // cada cuánto se mira al rival (ms)
  var LETRAS = ['A', 'B', 'C', 'D'];
  // Reacciones y mensajes rápidos (no se puede escribir libre: así todo queda con respeto)
  var REAC = [['😂', 'risa'], ['😭', 'llanto'], ['💕', 'amor'], ['😡', 'enojo'], ['👏', 'aplauso'], ['🔥', 'fuego'], ['😱', 'susto'], ['🙏', 'amen'], ['💪', 'fuerza'], ['🥊', 'golpe'], ['😎', 'fresco'], ['🤔', 'pensar']];
  var MSGS = ['¡Hola! 👋', '¡Bendiciones! 🙌', '¡Shalom! 🕊️', '¿Cómo estás?', 'Bien, ¿y tú?', '¡Hoy voy a ganar! 🏆', '¡Te voy a vencer! 🥊', 'Siento que perderás 😏', '¡Buena respuesta! 👍', '¡Uy, casi! 😅', '¡Esa estaba difícil!', '¡Gloria a Dios! 🙌', '¡Amén! 🙏', '¡Vamos, tú puedes!', '¡Buen combate! 🤝', '¿La revancha? 🔁', '¡Dios te bendiga! ✨', '¡Me ganaste esta vez! 😄'];

  /* ---------------- sonidos propios del combate (sintetizados, sin archivos) ---------------- */
  var AC = null;
  function ac() { if (window.Sound && Sound.sfxOn === false) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch (e) { return null; } }
  function tono(f0, f1, dur, tipo, vol, t0) {
    var a = ac(); if (!a) return; var t = a.currentTime + (t0 || 0), o = a.createOscillator(), g = a.createGain();
    o.type = tipo || 'sine'; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || .2, t + .02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .05);
  }
  function ruido(dur, frec, vol, t0, tipo) {
    var a = ac(); if (!a) return; var t = a.currentTime + (t0 || 0), n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); src.buffer = b; f.type = tipo || 'lowpass'; f.frequency.value = frec || 1200; g.gain.value = vol || .3;
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(t);
  }
  // Voz sintetizada: cuerdas vocales (diente de sierra con vibrato) + aire, pasadas por "formantes"
  // (las resonancias de la boca) para que suene como una vocal humana: a, e, o, u, m…
  var VOC = { a: [[800, 7, 1], [1200, 9, .5], [2600, 12, .12]], e: [[500, 7, 1], [1800, 10, .45], [2600, 12, .15]],
    o: [[480, 7, 1], [820, 8, .5], [2500, 12, .08]], u: [[320, 7, 1], [800, 8, .3], [2400, 12, .05]], m: [[260, 5, 1], [1100, 12, .08], [2300, 14, .03]] };
  function voz(o) {
    var a = ac(); if (!a) return; var t = a.currentTime + (o.t0 || 0), d = o.dur || .3, src = a.createOscillator(), env = a.createGain(), sal = a.createGain();
    src.type = 'sawtooth'; var f = o.f || [[0, 220]];
    src.frequency.setValueAtTime(f[0][1], t); for (var k = 1; k < f.length; k++) src.frequency.linearRampToValueAtTime(f[k][1], t + f[k][0] * d);
    var lfo = a.createOscillator(), lg = a.createGain(); lfo.frequency.value = o.vibF || 5.5; lg.gain.value = o.vib || 4; lfo.connect(lg); lg.connect(src.frequency);
    var ent = a.createGain(); ent.gain.value = 1; src.connect(ent);
    if (o.aire) { var n = Math.floor(a.sampleRate * (d + .1)), b = a.createBuffer(1, n, a.sampleRate), cd = b.getChannelData(0); for (var q = 0; q < n; q++) cd[q] = Math.random() * 2 - 1; var ns = a.createBufferSource(), ng = a.createGain(); ns.buffer = b; ng.gain.value = o.aire; ns.connect(ng); ng.connect(ent); ns.start(t); ns.stop(t + d + .1); }
    if (o.trem) { var tl = a.createOscillator(), tg = a.createGain(), tm = a.createGain(); tl.frequency.value = o.trem; tg.gain.value = .5; tm.gain.value = .5; tl.connect(tg); tg.connect(tm.gain); ent.connect(tm); ent = tm; tl.start(t); tl.stop(t + d + .1); }
    (VOC[o.v] || VOC.a).forEach(function (fm) { var bp = a.createBiquadFilter(), g = a.createGain(); bp.type = 'bandpass'; bp.frequency.value = fm[0] * (o.boca || 1); bp.Q.value = fm[1]; g.gain.value = fm[2] * 3; ent.connect(bp); bp.connect(g); g.connect(env); });
    var at = o.at || .025, v = o.vol || .25;
    env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(v, t + at); env.gain.setValueAtTime(v, t + Math.max(at, d * .6)); env.gain.exponentialRampToValueAtTime(0.0001, t + d);
    env.connect(sal); sal.connect(a.destination); src.start(t); src.stop(t + d + .1); lfo.start(t); lfo.stop(t + d + .1);
  }
  // golpe de aire/consonante (j, ch, ff…) y palmada
  function soplo(dur, frec, vol, t0, q) {
    var a = ac(); if (!a) return; var t = a.currentTime + (t0 || 0), n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = frec; f.Q.value = q || 1.2; g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(a.destination); s.start(t);
  }
  var SFX = {
    // «¡ja, ja, ja, ja!»: cada sílaba con su "j" de aire y una "a" que va bajando de tono
    risa: function () { var p = 300 + Math.random() * 60; for (var i = 0; i < 6; i++) { var t = i * .15; soplo(.04, 1600, .18, t); voz({ t0: t + .03, dur: .11, f: [[0, p - i * 12], [1, p - i * 12 - 30]], v: 'a', vol: .2, aire: .15, vib: 2 }); } },
    // sollozo: «¡buaaa!» con la voz temblando, respiración entrecortada y otro llanto
    llanto: function () { voz({ dur: .9, f: [[0, 430], [.25, 520], [1, 330]], v: 'a', boca: .9, vol: .2, vib: 14, vibF: 7, aire: .25, at: .08 }); soplo(.18, 900, .12, .95, .8); soplo(.14, 900, .1, 1.18, .8); voz({ t0: 1.35, dur: 1, f: [[0, 400], [.2, 480], [1, 290]], v: 'u', vol: .17, vib: 16, vibF: 6.5, aire: .3, at: .1 }); },
    // beso «mua» y campanitas de corazón
    amor: function () { soplo(.03, 2500, .3, 0, 3); voz({ t0: .03, dur: .22, f: [[0, 360], [1, 300]], v: 'u', vol: .14, aire: .2 }); [1047, 1319, 1568, 2093].forEach(function (fq, i) { tono(fq, 0, .6, 'sine', .07, .25 + i * .1); }); },
    // gruñido «¡grrr!» (voz grave con vibración rápida de la garganta) y resoplido
    enojo: function () { voz({ dur: .75, f: [[0, 95], [.5, 120], [1, 85]], v: 'o', vol: .28, trem: 32, aire: .5, vib: 6 }); soplo(.35, 500, .25, .7, .7); },
    // aplausos de un grupo: muchas palmadas sueltas a distinto tiempo y tono
    aplauso: function () { for (var i = 0; i < 46; i++) soplo(.022 + Math.random() * .02, 900 + Math.random() * 1800, .22 + Math.random() * .25, Math.random() * 1.7 * Math.pow(Math.random(), .3), 1.5); },
    // fuego: rugido de llama (ruido grave) y chasquidos de leña
    fuego: function () { ruido(1.2, 500, .35); ruido(1, 1800, .08, .1, 'highpass'); for (var i = 0; i < 16; i++) soplo(.006 + Math.random() * .01, 2500 + Math.random() * 3000, .35 + Math.random() * .4, Math.random() * 1.1, .7); },
    // «¡aaah!» de susto que sube de golpe
    susto: function () { soplo(.05, 1200, .2, 0); voz({ t0: .02, dur: .6, f: [[0, 320], [.2, 760], [1, 640]], v: 'a', boca: 1.15, vol: .2, vib: 10, vibF: 8, aire: .3 }); },
    // coro «¡Amén!»: varias voces en acorde, entrada suave
    amen: function () { [[220, 0], [277, .5], [330, -.5], [440, .3]].forEach(function (x, i) { voz({ dur: .55, f: [[0, x[0] + x[1]]], v: 'a', vol: .07, vib: 3, at: .15, t0: i * .01 }); voz({ t0: .55, dur: 1.3, f: [[0, x[0] * 1.0 + x[1]]], v: 'e', vol: .07, vib: 4, at: .12 }); voz({ t0: 1.5, dur: .5, f: [[0, x[0] + x[1]]], v: 'm', vol: .06, vib: 3 }); }); },
    // «¡uff!» de esfuerzo y fanfarria corta
    fuerza: function () { soplo(.08, 700, .25, 0, .8); voz({ t0: .04, dur: .25, f: [[0, 150], [1, 110]], v: 'u', vol: .25, aire: .4 }); tono(392, 0, .14, 'square', .07, .3); tono(523, 0, .14, 'square', .07, .44); tono(784, 0, .4, 'square', .08, .58); },
    // puñetazo: golpe sordo en el cuerpo + chasquido
    golpe: function () { soplo(.03, 3000, .35, 0, .8); tono(140, 45, .25, 'sine', .45); ruido(.2, 500, .4); },
    // silbido de "qué fresco" (fiu-fiuuu)
    fresco: function () { tono(1300, 2400, .18, 'sine', .12); tono(1200, 2600, .1, 'sine', .1, .3); tono(2600, 1100, .5, 'sine', .11, .4); },
    // «mmm…» pensando, tono que sube como pregunta
    pensar: function () { voz({ dur: 1.1, f: [[0, 140], [.6, 150], [1, 195]], v: 'm', vol: .3, vib: 2, at: .1 }); },
    msg: function () { tono(880, 0, .07, 'sine', .14); tono(1320, 0, .14, 'sine', .12, .08); },
    pum: function () { soplo(.025, 3000, .3, 0, .8); ruido(.15, 700, .45); tono(180, 55, .2, 'sine', .3); },
    duele: function () { ruido(.12, 300, .3); voz({ t0: .05, dur: .3, f: [[0, 380], [1, 260]], v: 'a', vol: .14, aire: .3 }); },
    combo: function () { tono(660, 0, .08, 'square', .08); tono(880, 0, .08, 'square', .08, .08); tono(1320, 0, .2, 'square', .08, .16); },
    campana: function () { [0, .35].forEach(function (d) { tono(1046, 0, 1.4, 'triangle', .18, d); tono(2093, 0, .7, 'sine', .05, d); tono(2794, 0, .4, 'sine', .03, d); }); },
    // K.O.: golpe, campana y el público aplaudiendo
    ko: function () { SFX.golpe(); tono(523, 0, .3, 'square', .1, .6); tono(659, 0, .3, 'square', .1, .8); tono(784, 0, .6, 'square', .1, 1); setTimeout(function () { SFX.aplauso(); }, 900); },
    // perder: «ay…» triste y trombón que baja (wah-wah-wah-waaa)
    pierde: function () { [392, 370, 349].forEach(function (fq, i) { voz({ t0: i * .42, dur: .38, f: [[0, fq], [1, fq * .96]], v: 'o', vol: .16, vib: 3, at: .04 }); }); voz({ t0: 1.26, dur: 1.2, f: [[0, 330], [1, 300]], v: 'o', vol: .17, vib: 9, vibF: 5, at: .05 }); },
    alerta: function () { tono(784, 0, .12, 'triangle', .14); tono(1047, 0, .25, 'triangle', .14, .13); }
  };
  var sfx = function (n) { try { SFX[n] && SFX[n](); } catch (e) {} };
  var script = document.currentScript;
  var JUEGO = (script && script.getAttribute('data-juego')) || 'Desafío Bíblico RD';
  var BANCO = (typeof QUESTIONS !== 'undefined') ? QUESTIONS : null;
  if (!BANCO) return;

  /* ---------------- utilidades ---------------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var snd = function (n) { try { if (window.Sound && Sound[n]) Sound[n](); } catch (e) {} };
  var ls = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  function rng(seed) { var s = seed >>> 0 || 1; return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function barajar(a, r) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function nuevoCodigo() { var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = ''; var b = new Uint32Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach(function (_, i) { b[i] = Math.random() * 1e9; }); for (var i = 0; i < 6; i++) c += A[b[i] % A.length]; return c; }

  /* ---------------- Firestore (REST) ---------------- */
  function aFS(v) {
    if (typeof v === 'string') return { stringValue: v };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return { integerValue: String(Math.round(v)) };
    var f = {}; for (var k in v) f[k] = aFS(v[k]); return { mapValue: { fields: f } };
  }
  function deFS(x) {
    if (!x) return null;
    if ('stringValue' in x) return x.stringValue;
    if ('booleanValue' in x) return x.booleanValue;
    if ('integerValue' in x) return +x.integerValue;
    if ('mapValue' in x) { var o = {}, f = x.mapValue.fields || {}; for (var k in f) o[k] = deFS(f[k]); return o; }
    return null;
  }
  function pedir(url, op) {
    return fetch(url, op).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) { var e = new Error((j && j.error && j.error.status) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function leer(code) {
    return pedir(BASE + code + '?key=' + KEY).then(function (j) { var f = j.fields || {}, o = {}; for (var k in f) o[k] = deFS(f[k]); return o; });
  }
  function crearDoc(code, data) {
    var f = {}; for (var k in data) f[k] = aFS(data[k]);
    return pedir(BASE.replace(/\/$/, '') + '?documentId=' + code + '&key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) });
  }
  function guardarLado(code, lado, datos) {
    var f = {}; f[lado] = aFS(datos);
    return pedir(BASE + code + '?updateMask.fieldPaths=' + lado + '&currentDocument.exists=true&key=' + KEY, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) });
  }
  function msgError(e) {
    if (!navigator.onLine || /fetch|network/i.test(e.message)) return 'Sin conexión a internet. Revisa tu conexión e intenta otra vez.';
    if (e.status === 404) return 'No existe un combate con ese código. Revisa las letras.';
    if (e.status === 403) return 'Firebase no dio permiso (PERMISSION_DENIED): hay que publicar las reglas nuevas de «firestore.rules» en Firebase → Firestore Database → Reglas.';
    if (e.status === 400 || e.status === 412) return 'Firebase rechazó la solicitud (' + e.message + '). Revisa que las reglas publicadas sean las más nuevas.';
    return 'No se pudo conectar con Firebase (' + e.message + '). Intenta otra vez.';
  }

  /* ---------------- estilos ---------------- */
  var css = '' +
    '.cmb{position:fixed;inset:0;z-index:99991;display:none;align-items:flex-start;justify-content:center;overflow:auto;padding:18px 12px;background:radial-gradient(ellipse at top,#1b2550 0%,#0a0f22 70%);color:#eef1ff;font:15px/1.45 Inter,system-ui,sans-serif}' +
    '.cmb.on{display:flex}.cmb *{box-sizing:border-box}' +
    '.cmb-box{width:100%;max-width:560px;margin:auto 0;background:rgba(20,26,51,.92);border:1px solid rgba(255,215,120,.4);border-radius:20px;padding:20px 18px;box-shadow:0 18px 50px rgba(0,0,0,.5)}' +
    '.cmb h2{margin:0 0 4px;font-size:24px;color:#ffd778;display:flex;align-items:center;gap:8px}.cmb h3{margin:14px 0 8px;font-size:15px;color:#ffe4a3}' +
    '.cmb p{margin:0 0 10px;color:#c9cfee}.cmb .ver{font-style:italic;font-size:13px;color:#aab2dd;margin-bottom:12px}' +
    '.cmb-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
    '.cmb-opt{padding:10px 8px;border-radius:12px;border:1px solid #3a4475;background:#141b3a;color:#eef1ff;font:inherit;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center}' +
    '.cmb-opt small{font-weight:500;font-size:12px;opacity:.75}.cmb-opt.sel{background:rgba(255,215,120,.18);border-color:#ffd778;box-shadow:0 0 0 2px rgba(255,215,120,.35) inset}' +
    '.cmb-btn{display:block;width:100%;margin-top:10px;padding:13px;border:0;border-radius:14px;font:inherit;font-weight:800;font-size:16px;cursor:pointer;background:linear-gradient(180deg,#ffe08a,#f2b93b);color:#1a1a2e}' +
    '.cmb-btn.sec{background:#252d52;color:#eef1ff}.cmb-btn.ter{background:transparent;color:#aab2dd;text-decoration:underline;font-weight:600;font-size:14px}.cmb-btn:disabled{opacity:.55;cursor:wait}' +
    '.cmb input{width:100%;padding:12px;border-radius:12px;border:1px solid #3a4475;background:#0c1124;color:#fff;font:inherit;font-size:17px}' +
    '.cmb input.code{text-transform:uppercase;letter-spacing:.3em;text-align:center;font-weight:800;font-size:22px}' +
    '.cmb-err{min-height:18px;margin-top:8px;color:#ff8f8f;font-size:13px;font-weight:600}' +
    '.cmb-code{font-size:38px;font-weight:900;letter-spacing:.25em;text-align:center;color:#ffd778;padding:10px;border:2px dashed rgba(255,215,120,.5);border-radius:14px;margin:8px 0;user-select:all}' +
    '.cmb-row{display:flex;gap:8px}.cmb-row>*{flex:1}' +
    '.cmb-vs{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center;margin-bottom:10px}' +
    '.cmb-p{background:#121a38;border:1px solid #2c3566;border-radius:12px;padding:8px 10px;min-width:0}.cmb-p b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.cmb-p .pts{font-size:22px;font-weight:900;color:#7be38f}.cmb-p.riv .pts{color:#ff9a7a}.cmb-p small{opacity:.7;font-size:12px}' +
    '.cmb-glove{font-size:28px}' +
    '.cmb-bar{height:6px;border-radius:4px;background:#2a3263;overflow:hidden;margin:6px 0 12px}.cmb-bar i{display:block;height:100%;background:linear-gradient(90deg,#ffd778,#f28a3b);transition:width .25s linear}' +
    '.cmb-q{font-size:18px;font-weight:700;margin:6px 0 12px}' +
    '.cmb-ans{display:grid;gap:8px}.cmb-a{display:flex;gap:10px;align-items:center;padding:12px;border-radius:12px;border:1px solid #3a4475;background:#141b3a;color:#eef1ff;font:inherit;text-align:left;cursor:pointer}' +
    '.cmb-a .l{flex:none;width:28px;height:28px;border-radius:8px;background:#252d52;display:flex;align-items:center;justify-content:center;font-weight:800;color:#ffd778}' +
    '.cmb-a.ok{background:rgba(54,201,138,.25);border-color:#36c98a}.cmb-a.bad{background:rgba(239,90,90,.25);border-color:#ef5a5a}' +
    '.cmb-big{font-size:30px;font-weight:900;text-align:center;margin:6px 0}.cmb-c{text-align:center}' +
    '.cmb-wait{display:inline-block;width:14px;height:14px;border:3px solid #ffd778;border-right-color:transparent;border-radius:50%;animation:cmbspin 1s linear infinite;vertical-align:-2px;margin-right:6px}' +
    '@keyframes cmbspin{to{transform:rotate(360deg)}}' +
    '.modes #btnCombate{grid-column:1/-1}' +
    '.cmb-rx{position:fixed;left:0;right:0;bottom:0;z-index:99993;display:none;padding:8px 10px calc(8px + env(safe-area-inset-bottom));background:linear-gradient(0deg,rgba(8,11,28,.97),rgba(8,11,28,.85));border-top:1px solid rgba(255,215,120,.35)}' +
    '.cmb-rx.on{display:block}.cmb-rx .fila{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;max-width:620px;margin:0 auto}.cmb-rx .fila::-webkit-scrollbar{display:none}' +
    '.cmb-rx .em{flex:none;width:46px;height:46px;border-radius:14px;border:1px solid #3a4475;background:#151c3c;font-size:25px;cursor:pointer;transition:transform .1s}.cmb-rx .em:active{transform:scale(.88)}' +
    '.cmb-rx .msg{flex:none;padding:0 13px;height:38px;border-radius:999px;border:1px solid #3a4475;background:#1b2350;color:#eef1ff;font:inherit;font-size:14px;font-weight:600;cursor:pointer;white-space:nowrap}' +
    '.cmb-rx .msg:active{transform:scale(.93)}.cmb-rx .fila+.fila{margin-top:7px}.cmb-rx .tit{max-width:620px;margin:0 auto 5px;font-size:11px;letter-spacing:.08em;color:#aab2dd;text-transform:uppercase}' +
    '.cmb.rxon .cmb-box{margin-bottom:130px}' +
    '.cmb-fx{position:fixed;inset:0;z-index:99994;pointer-events:none;overflow:hidden}' +
    '.cmb-fl{position:absolute;font-size:46px;animation:cmbfl 2.2s ease-out forwards;filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}' +
    '@keyframes cmbfl{0%{transform:translate(-50%,0) scale(.3);opacity:0}15%{transform:translate(-50%,-30px) scale(1.25);opacity:1}100%{transform:translate(calc(-50% + var(--dx)),-260px) scale(1);opacity:0}}' +
    '.cmb-bub{position:absolute;max-width:240px;padding:9px 14px;border-radius:16px;font-weight:700;font-size:15px;color:#1a1a2e;background:#fff;box-shadow:0 8px 24px rgba(0,0,0,.45);animation:cmbbub 3s ease forwards;transform:translateX(-50%)}' +
    '.cmb-bub.yo{background:#ffe08a}.cmb-bub small{display:block;font-size:11px;font-weight:600;opacity:.6}' +
    '@keyframes cmbbub{0%{opacity:0;transform:translate(-50%,10px) scale(.7)}10%{opacity:1;transform:translate(-50%,0) scale(1.05)}18%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-18px)}}' +
    '.cmb-shake{animation:cmbsh .45s}@keyframes cmbsh{0%,100%{transform:none}20%{transform:translateX(-8px) rotate(-1deg)}40%{transform:translateX(7px) rotate(1deg)}60%{transform:translateX(-5px)}80%{transform:translateX(3px)}}' +
    '.cmb-hit{animation:cmbhit .5s}@keyframes cmbhit{0%{background:#121a38}30%{background:rgba(239,90,90,.45);transform:scale(.95)}100%{background:#121a38;transform:none}}' +
    '.cmb-pum{position:absolute;font-size:30px;font-weight:900;color:#ffd778;text-shadow:0 0 12px #f28a3b,-2px 0 #000,2px 0 #000,0 2px #000;animation:cmbpum .8s ease-out forwards}' +
    '@keyframes cmbpum{0%{transform:translate(-50%,-50%) scale(.2) rotate(-12deg);opacity:0}30%{transform:translate(-50%,-50%) scale(1.3) rotate(6deg);opacity:1}100%{transform:translate(-50%,-90%) scale(1);opacity:0}}' +
    '.cmb-glove.punch{display:inline-block;animation:cmbpunch .5s}@keyframes cmbpunch{0%{transform:none}40%{transform:translateX(22px) scale(1.4) rotate(-15deg)}100%{transform:none}}' +
    '.cmb-glove.bump{display:inline-block;animation:cmbbump .9s infinite}@keyframes cmbbump{0%,100%{transform:scale(1)}50%{transform:scale(1.35) rotate(10deg)}}' +
    '.cmb-combo{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:999px;background:linear-gradient(90deg,#f28a3b,#ef3b3b);color:#fff;font-size:12px;font-weight:800;animation:cmbpop .4s}' +
    '@keyframes cmbpop{0%{transform:scale(.3)}70%{transform:scale(1.2)}100%{transform:scale(1)}}' +
    '.cmb-ko{font-size:clamp(40px,12vw,64px);white-space:nowrap;font-weight:900;text-align:center;color:#ffd778;text-shadow:0 0 22px #f28a3b,-3px 0 #000,3px 0 #000,0 3px #000;animation:cmbko .9s cubic-bezier(.2,1.6,.4,1)}' +
    '.cmb-cara{font-size:72px;line-height:1;text-align:center;margin:4px 0 0;animation:cmbCara 1s cubic-bezier(.2,1.6,.4,1) both,cmbSalta 1.6s ease-in-out 1s infinite}.cmb-cara.triste{animation:cmbCara 1s cubic-bezier(.2,1.6,.4,1) both,cmbTriste 2.4s ease-in-out 1s infinite}' +
    '@keyframes cmbCara{from{transform:scale(0) rotate(-30deg);opacity:0}to{transform:none;opacity:1}}@keyframes cmbSalta{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px) rotate(6deg)}}@keyframes cmbTriste{0%,100%{transform:rotate(0)}30%{transform:rotate(-8deg) translateY(3px)}70%{transform:rotate(8deg) translateY(3px)}}' +
    '.cmb-inv{display:none;margin:12px 0 0;padding:12px;border-radius:14px;border:1px solid #ffd778;background:rgba(255,215,120,.12);text-align:center;color:#ffe9b8;animation:cmbCara .5s ease both}.cmb-inv.on{display:block}.cmb-inv .cmb-btn{margin-top:10px}' +
    '@media (prefers-reduced-motion:reduce){.cmb-cara,.cmb-cara.triste{animation:none}}' +
    '.cmb-ko.pierde{color:#ff8f8f;text-shadow:0 0 22px #b3122e,-3px 0 #000,3px 0 #000,0 3px #000}' +
    '@keyframes cmbko{0%{transform:scale(4) rotate(-20deg);opacity:0}100%{transform:none;opacity:1}}' +
    '.cmb-conf{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:cmbconf linear forwards}' +
    '@keyframes cmbconf{to{transform:translate(var(--dx),110vh) rotate(var(--r));opacity:.8}}' +
    'html.cmb-abierto .cta-btn,html.cmb-abierto .cta-tip{display:none!important}' +
    '.cmb-x{float:right;background:none;border:0;color:#aab2dd;font-size:22px;cursor:pointer;line-height:1}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var root = document.createElement('div'); root.className = 'cmb'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Combate de la Fe');
  root.innerHTML = '<div class="cmb-box" id="cmbBox"></div>'; document.body.appendChild(root);
  var fx = document.createElement('div'); fx.className = 'cmb-fx'; document.body.appendChild(fx);
  var barra = document.createElement('div'); barra.className = 'cmb-rx';
  barra.innerHTML = '<div class="tit">Reacciona y saluda a tu rival</div><div class="fila">' +
    REAC.map(function (r, i) { return '<button class="em" type="button" data-r="' + i + '" aria-label="' + r[1] + '">' + r[0] + '</button>'; }).join('') + '</div>' +
    '<div class="fila">' + MSGS.map(function (m, i) { return '<button class="msg" type="button" data-m="' + i + '">' + m + '</button>'; }).join('') + '</div>';
  document.body.appendChild(barra);
  var box = $('#cmbBox', root);

  /* ---------------- estado ---------------- */
  var S = null, pollT = 0, qT = 0, stepT = 0, revT = 0;
  function limpiar() { clearTimeout(pollT); clearInterval(qT); clearTimeout(stepT); clearTimeout(revT); pollT = 0; qT = 0; stepT = 0; revT = 0; }
  function barraOn(on) { barra.classList.toggle('on', !!on); root.classList.toggle('rxon', !!on); }
  function cerrar() {
    limpiar(); S = null; barraOn(false); fx.innerHTML = ''; root.classList.remove('on'); document.documentElement.style.overflow = ''; document.documentElement.classList.remove('cmb-abierto');
    if (/[?&]combate=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  }
  function abrir() { root.classList.add('on'); document.documentElement.style.overflow = 'hidden'; document.documentElement.classList.add('cmb-abierto'); }
  function nombre() { return (ls.get('combate_nombre') || '').slice(0, 20); }
  var cab = '<button class="cmb-x" type="button" data-x aria-label="Cerrar">✕</button><h2><span class="cmb-glove">🥊</span> Combate de la Fe</h2>';
  function pintar(html) { box.innerHTML = cab + html; var x = $('[data-x]', box); if (x) x.onclick = function () { snd('click'); salir(); }; root.scrollTop = 0; }
  function salir() {
    if (S && S.jugando && !S.yo.fin && !confirm('¿Salir del combate? Tu rival ganará.')) return;
    if (S && S.terminado) avisarSalida();
    if (S && S.code && S.yo && !S.yo.fin && S.lado) { S.yo.fin = true; S.yo.t = Date.now(); guardarLado(S.code, S.lado, S.yo).catch(function () {}); }
    cerrar();
  }

  /* ---------------- menú ---------------- */
  var elegido = { lvl: ls.get('combate_lvl') || 'basico', n: +(ls.get('combate_n') || 10) };
  function menu(codeInicial) {
    limpiar(); abrir();
    var lv = NIVELES.map(function (l) { return '<button type="button" class="cmb-opt' + (l.id === elegido.lvl ? ' sel' : '') + '" data-lvl="' + l.id + '">' + l.emoji + ' ' + l.name + '</button>'; }).join('');
    var ln = LARGOS.map(function (x) { return '<button type="button" class="cmb-opt' + (x[0] === elegido.n ? ' sel' : '') + '" data-n="' + x[0] + '">' + x[1] + '<small>' + x[0] + ' preguntas</small></button>'; }).join('');
    pintar(
      '<p class="ver">«Pelea la buena batalla de la fe» — 1 Timoteo 6:12</p>' +
      '<p>Reta a otra persona en línea: los dos responden las mismas preguntas y gana quien más sepa de la Palabra. ¡Con respeto y amor!</p>' +
      '<h3>Tu nombre</h3><input id="cmbNom" maxlength="20" placeholder="Escribe tu nombre" value="' + esc(nombre()) + '">' +
      '<h3>1. Crea un combate e invita</h3><div class="cmb-grid" id="cmbLvl">' + lv + '</div><div class="cmb-grid" id="cmbN" style="margin-top:8px">' + ln + '</div>' +
      '<button class="cmb-btn" type="button" id="cmbCrear">🥊 Crear combate</button>' +
      '<h3>2. ¿Te invitaron? Escribe el código</h3><div class="cmb-row"><input id="cmbCode" class="code" maxlength="6" placeholder="CÓDIGO" value="' + esc(codeInicial || '') + '"><button class="cmb-btn sec" style="margin-top:0;flex:.6" type="button" id="cmbUnir">Entrar</button></div>' +
      '<div class="cmb-err" id="cmbErr"></div>' +
      '<button class="cmb-btn ter" type="button" data-x2>Volver al juego</button>'
    );
    $('[data-x2]', box).onclick = function () { snd('click'); cerrar(); };
    $('#cmbLvl', box).onclick = function (e) { var b = e.target.closest('[data-lvl]'); if (!b) return; snd('click'); elegido.lvl = b.dataset.lvl; ls.set('combate_lvl', elegido.lvl); [].forEach.call(this.children, function (c) { c.classList.toggle('sel', c === b); }); };
    $('#cmbN', box).onclick = function (e) { var b = e.target.closest('[data-n]'); if (!b) return; snd('click'); elegido.n = +b.dataset.n; ls.set('combate_n', elegido.n); [].forEach.call(this.children, function (c) { c.classList.toggle('sel', c === b); }); };
    var err = $('#cmbErr', box);
    var tomaNombre = function () { var n = $('#cmbNom', box).value.trim().slice(0, 20); if (!n) { err.textContent = 'Escribe tu nombre para que tu rival sepa quién eres.'; $('#cmbNom', box).focus(); return null; } ls.set('combate_nombre', n); return n; };
    $('#cmbCrear', box).onclick = function () { snd('click'); var n = tomaNombre(); if (n) crear(n, this, err); };
    $('#cmbUnir', box).onclick = function () { snd('click'); var n = tomaNombre(); if (!n) return; var c = $('#cmbCode', box).value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6) { err.textContent = 'El código tiene 6 letras o números.'; return; } unir(n, c, this, err); };
    if (codeInicial && nombre()) $('#cmbUnir', box).focus();
  }

  function preguntas(lvl, n, seed) {
    var r = rng(seed), lista = BANCO[lvl].map(function (_, i) { return i; });
    return barajar(lista, r).slice(0, n);
  }
  function jugadorNuevo(nom) { return { nom: nom, pts: 0, i: 0, ms: 0, fin: false, t: Date.now(), rx: '' }; }

  function crear(nom, btn, err, intento) {
    btn.disabled = true; err.textContent = '';
    var code = nuevoCodigo(), seed = Math.floor(Math.random() * 2147483647);
    var qs = preguntas(elegido.lvl, elegido.n, seed);
    var data = { lvl: elegido.lvl, n: elegido.n, qs: qs.join(','), seed: seed, h: jugadorNuevo(nom), t: Date.now() };
    crearDoc(code, data).then(function () {
      S = { code: code, lado: 'h', otro: 'g', lvl: data.lvl, n: data.n, qs: qs, seed: seed, yo: data.h, riv: null };
      esperar();
    }).catch(function (e) {
      if (e.status === 409 && (intento || 0) < 3) return crear(nom, btn, err, (intento || 0) + 1);
      btn.disabled = false; err.textContent = msgError(e);
    });
  }

  function enlace(code) { return location.origin + location.pathname + '?combate=' + code; }
  function esperar() {
    var url = enlace(S.code), lv = NIVELES.filter(function (l) { return l.id === S.lvl; })[0];
    var texto = '🥊 Te reto a un Combate de la Fe en ' + JUEGO + ' (' + lv.name + ', ' + S.n + ' preguntas). Entra con este enlace o con el código ' + S.code + ': ' + url;
    pintar(
      '<p>Comparte este código o el enlace con la persona que quieres retar:</p>' +
      '<div class="cmb-code">' + S.code + '</div>' +
      '<p class="cmb-c">' + lv.emoji + ' ' + lv.name + ' · ' + S.n + ' preguntas</p>' +
      '<div class="cmb-row"><button class="cmb-btn" type="button" id="cmbShare">📤 Compartir enlace</button><button class="cmb-btn sec" type="button" id="cmbCopy">📋 Copiar</button></div>' +
      '<a class="cmb-btn sec" style="text-align:center;text-decoration:none" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(texto) + '">💬 Enviar por WhatsApp</a>' +
      '<p class="cmb-c" style="margin-top:14px"><span class="cmb-wait"></span>Esperando a tu rival…</p>' +
      '<button class="cmb-btn ter" type="button" id="cmbCancel">Cancelar combate</button>'
    );
    $('#cmbShare', box).onclick = function () { snd('click'); if (navigator.share) navigator.share({ title: 'Combate de la Fe', text: texto }).catch(function () {}); else copiar(texto, this); };
    $('#cmbCopy', box).onclick = function () { snd('click'); copiar(texto, this); };
    $('#cmbCancel', box).onclick = function () { snd('click'); salir(); };
    var mira = function () {
      leer(S.code).then(function (d) {
        if (!S) return;
        if (d.g && d.g.nom) { S.riv = d.g; snd('triumph'); cuentaAtras(); return; }
        pollT = setTimeout(mira, 2000);
      }).catch(function () { if (S) pollT = setTimeout(mira, 3000); });
    };
    pollT = setTimeout(mira, 1500);
  }
  function copiar(t, b) {
    var ok = function () { var o = b.textContent; b.textContent = '✅ Copiado'; setTimeout(function () { b.textContent = o; }, 1800); };
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(ok, function () {}); else { var a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) {} a.remove(); }
  }

  function unir(nom, code, btn, err) {
    btn.disabled = true; err.textContent = '';
    leer(code).then(function (d) {
      if (!d.lvl || !BANCO[d.lvl]) throw Object.assign(new Error('x'), { status: 404 });
      if (d.g && d.g.nom) { btn.disabled = false; err.textContent = 'Ese combate ya tiene dos jugadores. Pide un código nuevo.'; return; }
      if (Date.now() - (d.t || 0) > 6 * 3600 * 1000) { btn.disabled = false; err.textContent = 'Ese combate ya venció. Pide un código nuevo.'; return; }
      var yo = jugadorNuevo(nom);
      return guardarLado(code, 'g', yo).then(function () {
        S = { code: code, lado: 'g', otro: 'h', lvl: d.lvl, n: d.n, qs: String(d.qs).split(',').map(Number), seed: d.seed, yo: yo, riv: d.h };
        snd('triumph'); cuentaAtras();
      });
    }).catch(function (e) { btn.disabled = false; err.textContent = msgError(e); });
  }

  /* ---------------- reacciones, mensajes y efectos ---------------- */
  function posPanel(rival) {
    var el = $(rival ? '.cmb-p.riv' : '.cmb-p', box);
    if (!el) return { x: innerWidth * (rival ? .75 : .25), y: innerHeight * .3 };
    var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function flotar(emoji, rival, n) {
    var p = posPanel(rival);
    for (var i = 0; i < (n || 5); i++) (function (i) {
      setTimeout(function () {
        var e = document.createElement('div'); e.className = 'cmb-fl'; e.textContent = emoji;
        e.style.left = (p.x + (Math.random() - .5) * 60) + 'px'; e.style.top = (p.y + 10) + 'px';
        e.style.setProperty('--dx', ((Math.random() - .5) * 140) + 'px'); e.style.fontSize = (34 + Math.random() * 26) + 'px';
        fx.appendChild(e); setTimeout(function () { e.remove(); }, 2300);
      }, i * 110);
    })(i);
  }
  function burbuja(texto, rival, quien) {
    var p = posPanel(rival), e = document.createElement('div'); e.className = 'cmb-bub' + (rival ? '' : ' yo');
    e.innerHTML = '<small>' + esc(quien) + '</small>' + esc(texto);
    e.style.left = Math.max(130, Math.min(innerWidth - 130, p.x)) + 'px'; e.style.top = Math.max(8, p.y - 80) + 'px';
    [].forEach.call(fx.querySelectorAll('.cmb-bub' + (rival ? ':not(.yo)' : '.yo')), function (b) { b.remove(); });
    fx.appendChild(e); setTimeout(function () { e.remove(); }, 3100);
  }
  function mostrarRx(rx, rival) {
    var m = /^([rm]):(\d+):/.exec(rx || ''); if (!m) return;
    var i = +m[2], quien = rival ? (S.riv && S.riv.nom) || 'Rival' : 'Tú';
    if (m[1] === 'r' && REAC[i]) { flotar(REAC[i][0], rival, rival ? 7 : 4); sfx(REAC[i][1]); if (REAC[i][1] === 'enojo' || REAC[i][1] === 'golpe') sacudir(); }
    else if (m[1] === 'm' && MSGS[i]) { burbuja(MSGS[i], rival, quien); sfx('msg'); }
  }
  var ultimoEnvio = 0;
  function enviar(tipo, i) {
    if (!S || !S.code || !S.riv) return;
    var ahora = Date.now(); if (ahora - ultimoEnvio < 900) return; ultimoEnvio = ahora;
    S.yo.rx = tipo + ':' + i + ':' + ahora.toString(36); S.yo.t = ahora;
    mostrarRx(S.yo.rx, false);
    guardarLado(S.code, S.lado, S.yo).catch(function () {});
  }
  barra.addEventListener('click', function (e) {
    var b = e.target.closest('[data-r],[data-m]'); if (!b) return;
    if (b.dataset.r != null) enviar('r', +b.dataset.r); else enviar('m', +b.dataset.m);
  });
  function sacudir() { box.classList.remove('cmb-shake'); void box.offsetWidth; box.classList.add('cmb-shake'); }
  function pum(texto, rival) {
    var p = posPanel(rival), e = document.createElement('div'); e.className = 'cmb-pum'; e.textContent = texto;
    e.style.left = p.x + 'px'; e.style.top = p.y + 'px'; fx.appendChild(e); setTimeout(function () { e.remove(); }, 850);
  }
  function golpeGuante() { var g = $('#cmbVs .cmb-glove', box); if (g) { g.classList.remove('punch'); void g.offsetWidth; g.classList.add('punch'); } }
  function confeti() {
    var cs = ['#ffd778', '#f28a3b', '#36c98a', '#3e8bff', '#ef5a5a', '#a970ff'];
    for (var i = 0; i < 90; i++) {
      var c = document.createElement('div'); c.className = 'cmb-conf'; c.style.left = (Math.random() * 100) + 'vw'; c.style.background = cs[i % cs.length];
      c.style.setProperty('--dx', ((Math.random() - .5) * 200) + 'px'); c.style.setProperty('--r', (Math.random() * 900) + 'deg');
      c.style.animationDuration = (2.2 + Math.random() * 2) + 's'; c.style.animationDelay = (Math.random() * .6) + 's';
      fx.appendChild(c); (function (c) { setTimeout(function () { c.remove(); }, 5000); })(c);
    }
  }
  // lo que llega del rival en cada consulta: reacciones nuevas y sus aciertos (te "golpean")
  function alLeer(d) {
    var r = d[S.otro]; if (!r) return;
    var antes = S.riv || {};
    if (r.rx && r.rx !== S.vistoRx) {
      var primera = S.vistoRx === undefined; S.vistoRx = r.rx;
      var mv = /^v:([A-Z0-9]{6}):/.exec(r.rx);
      if (mv) { S.riv = r; if (S.terminado) invitacion(mv[1]); else S.invPendiente = mv[1]; }
      else if (/^x:/.test(r.rx)) { S.riv = r; if (S.terminado) rivalSalio(); }
      else if (!primera) mostrarRx(r.rx, true);
    }
    if (S.jugando && (r.pts || 0) > (antes.pts || 0)) {
      setTimeout(function () { var me = $('#cmbVs .cmb-p:not(.riv)', box); if (me) { me.classList.remove('cmb-hit'); void me.offsetWidth; me.classList.add('cmb-hit'); } pum('¡Ay!', false); sfx('duele'); }, 50);
    }
    S.riv = r;
  }

  /* ---------------- partida ---------------- */
  function cuentaAtras() {
    limpiar(); barraOn(true); S.vistoRx = S.riv && S.riv.rx ? S.riv.rx : undefined; if (S.vistoRx === undefined) S.vistoRx = '';
    sondear();
    var n = 3, lv = NIVELES.filter(function (l) { return l.id === S.lvl; })[0];
    var paso = function () {
      pintar('<div class="cmb-vs"><div class="cmb-p"><b>' + esc(S.yo.nom) + '</b><small>Tú</small></div><span class="cmb-glove bump">🥊</span><div class="cmb-p riv"><b>' + esc(S.riv.nom) + '</b><small>Rival</small></div></div>' +
        '<p class="cmb-c">' + lv.emoji + ' ' + lv.name + ' · ' + S.n + ' preguntas · ' + TIEMPO + ' s cada una</p><div class="cmb-big">' + (n ? n : '¡A pelear la buena batalla!') + '</div>');
      if (n) tono(440, 0, .15, 'square', .1); else sfx('campana');
      if (n-- <= 0) { stepT = setTimeout(empezar, 900); return; }
      stepT = setTimeout(paso, 900);
    };
    paso();
  }
  function empezar() {
    S.jugando = true; S.idx = 0; S.r = rng(S.seed ^ 0x5bd1e995);
    S.yo.i = 0; S.yo.pts = 0; S.yo.ms = 0; S.yo.fin = false;
    S.racha = 0;
    pregunta();
  }
  function sondear() {
    clearTimeout(pollT);
    pollT = setTimeout(function () {
      if (!S) return;
      leer(S.code).then(function (d) { if (!S) return; alLeer(d); marcador(); revisarFin(); }).catch(function () {}).then(function () { if (S) sondear(); });
    }, S && S.terminado ? 2500 : POLL);
  }
  function marcador() {
    var el = $('#cmbVs', box); if (!el || !S.riv) return;
    var r = S.riv;
    el.innerHTML = '<div class="cmb-p"><b>' + esc(S.yo.nom) + '</b><span class="pts">' + S.yo.pts + '</span> <small>' + S.yo.i + ' / ' + S.n + '</small>' + (S.racha >= 3 ? '<span class="cmb-combo">🔥 x' + S.racha + '</span>' : '') + '</div><span class="cmb-glove">🥊</span>' +
      '<div class="cmb-p riv"><b>' + esc(r.nom) + '</b><span class="pts">' + (r.pts || 0) + '</span> <small>' + (r.fin && r.i < S.n ? 'salió' : (r.i || 0) + ' / ' + S.n) + '</small></div>';
  }
  function pregunta() {
    clearInterval(qT);
    if (S.idx >= S.n) return terminarYo();
    var q = BANCO[S.lvl][S.qs[S.idx]] || BANCO[S.lvl][S.idx % BANCO[S.lvl].length];
    var ops = barajar(q.a, S.r), correcta = q.a[0];
    pintar('<div class="cmb-vs" id="cmbVs"></div>' +
      '<div class="cmb-row" style="align-items:center"><small style="flex:1">Pregunta ' + (S.idx + 1) + ' de ' + S.n + '</small><b id="cmbT" style="flex:none">' + TIEMPO + '</b></div>' +
      '<div class="cmb-bar"><i id="cmbBar" style="width:100%"></i></div>' +
      '<div class="cmb-q">' + esc(q.q) + '</div><div class="cmb-ans" id="cmbAns">' +
      ops.map(function (o, i) { return '<button class="cmb-a" type="button" data-i="' + i + '"><span class="l">' + LETRAS[i] + '</span><span>' + esc(o) + '</span></button>'; }).join('') + '</div>' +
      '<p class="cmb-c" id="cmbRef" style="min-height:20px;margin-top:8px;font-size:13px"></p>');
    marcador();
    var t0 = Date.now(), listo = false;
    var responder = function (i) {
      if (listo) return; listo = true; clearInterval(qT);
      var ms = Math.min(TIEMPO * 1000, Date.now() - t0), ok = i != null && ops[i] === correcta;
      [].forEach.call($('#cmbAns', box).children, function (b, j) { b.disabled = true; if (ops[j] === correcta) b.classList.add('ok'); else if (j === i) b.classList.add('bad'); });
      $('#cmbRef', box).textContent = (ok ? '✅ ¡Correcto!' : (i == null ? '⏰ Se acabó el tiempo.' : '❌ Era: ' + correcta)) + (q.r ? ' · ' + q.r : '');
      snd(ok ? 'correct' : 'wrong');
      S.yo.i = S.idx + 1; S.yo.ms += ms; if (ok) S.yo.pts++; S.yo.t = Date.now();
      S.racha = ok ? (S.racha || 0) + 1 : 0;
      guardarLado(S.code, S.lado, S.yo).catch(function () {});
      marcador();
      if (ok) { golpeGuante(); sfx('pum'); pum(S.racha >= 3 ? '¡COMBO x' + S.racha + '!' : ['¡PUM!', '¡ZAS!', '¡BAM!'][S.idx % 3], true); if (S.racha >= 3) sfx('combo'); }
      else sacudir();
      S.idx++; setTimeout(function () { if (S) pregunta(); }, ok ? 1100 : 1900);
    };
    $('#cmbAns', box).onclick = function (e) { var b = e.target.closest('[data-i]'); if (b) responder(+b.dataset.i); };
    S.tecla = function (e) { var k = e.key.toUpperCase(), i = '1234'.indexOf(k); if (i < 0) i = 'ABCD'.indexOf(k); if (i >= 0 && i < ops.length) responder(i); };
    qT = setInterval(function () {
      var left = Math.max(0, TIEMPO - (Date.now() - t0) / 1000);
      var T = $('#cmbT', box), B = $('#cmbBar', box); if (T) T.textContent = Math.ceil(left); if (B) B.style.width = (left / TIEMPO * 100) + '%';
      if (left <= 0) responder(null);
    }, 200);
  }
  function terminarYo() {
    S.yo.fin = true; S.yo.i = S.n; S.yo.t = Date.now(); S.tecla = null;
    guardarLado(S.code, S.lado, S.yo).catch(function () {});
    pintar('<div class="cmb-vs" id="cmbVs"></div><p class="cmb-c"><span class="cmb-wait"></span>Terminaste. Esperando a que ' + esc(S.riv ? S.riv.nom : 'tu rival') + ' termine…</p>' +
      '<button class="cmb-btn ter" type="button" id="cmbLeave">Salir</button>');
    $('#cmbLeave', box).onclick = function () { snd('click'); cerrar(); };
    marcador(); revisarFin();
  }
  function revisarFin() {
    if (!S || !S.yo.fin || S.terminado) return;
    var r = S.riv || {}, caido = !r.fin && Date.now() - (r.t || 0) > 75000; // el rival dejó de responder
    if (!r.fin && !caido) return;
    S.terminado = true; S.jugando = false; clearInterval(qT); clearTimeout(stepT);
    var yo = S.yo, abandono = caido || (r.fin && (r.i || 0) < S.n), gano, empate = false;
    if (abandono) gano = true;
    else if (yo.pts !== r.pts) gano = yo.pts > r.pts;
    else if (yo.ms !== r.ms) gano = yo.ms < r.ms;
    else { empate = true; gano = false; }
    var titulo = empate ? '🤝 ¡Empate!' : gano ? '🏆 ¡Ganaste el combate!' : '¡Perdiste!';
    var cara = empate ? '🤝' : gano ? '😄' : '😢';
    var detalle = abandono ? esc(r.nom || 'Tu rival') + ' salió del combate antes de terminar.' :
      (yo.pts === r.pts && !empate ? 'Empataron en aciertos; ganó quien respondió más rápido.' : '');
    // letrero grande en inglés, como en los juegos de pelea: YOU WIN / YOU LOSE / DRAW
    if (gano) { confeti(); sfx('ko'); } else if (empate) sfx('amor'); else sfx('pierde');
    var letrero = empate ? 'DRAW' : gano ? 'YOU WIN!' : 'YOU LOSE';
    pintar('<div class="cmb-ko' + (gano || empate ? '' : ' pierde') + '">' + letrero + '</div><div class="cmb-cara' + (gano || empate ? '' : ' triste') + '" aria-hidden="true">' + cara + '</div><div class="cmb-big">' + titulo + '</div>' +
      '<div class="cmb-vs"><div class="cmb-p"><b>' + esc(yo.nom) + '</b><span class="pts">' + yo.pts + '</span> <small>de ' + S.n + ' · ' + (yo.ms / 1000).toFixed(1) + ' s</small></div><span class="cmb-glove">🥊</span>' +
      '<div class="cmb-p riv"><b>' + esc(r.nom || 'Rival') + '</b><span class="pts">' + (r.pts || 0) + '</span> <small>de ' + S.n + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : '') + '</small></div></div>' +
      (detalle ? '<p class="cmb-c">' + detalle + '</p>' : '') +
      '<p class="ver cmb-c">«Pero gracias a Dios, que nos da la victoria por medio de nuestro Señor Jesucristo» — 1 Corintios 15:57</p>' +
      '<div class="cmb-inv" id="cmbInv"></div>' +
      (abandono ? '' : '<button class="cmb-btn" type="button" id="cmbRe">🔁 Jugar de nuevo con ' + esc(r.nom || 'esta persona') + '</button>') +
      '<button class="cmb-btn' + (abandono ? '' : ' sec') + '" type="button" id="cmbOtra">🥊 Otro combate</button><button class="cmb-btn ter" type="button" id="cmbFin">Volver al juego</button>');
    S.abandono = abandono;
    if ($('#cmbRe', box)) $('#cmbRe', box).onclick = function () { snd('click'); revancha(this); };
    $('#cmbOtra', box).onclick = function () { snd('click'); avisarSalida(); S = null; menu(); };
    $('#cmbFin', box).onclick = function () { snd('click'); avisarSalida(); cerrar(); };
    if (S.invPendiente) invitacion(S.invPendiente);
  }
  /* ---------------- jugar de nuevo con la misma persona ----------------
     Se crea un combate nuevo (mismo nivel y cantidad, preguntas nuevas) y se avisa al rival
     por el campo «rx» del combate anterior ("v:CÓDIGO:hora"); así no hay que cambiar las reglas.
     Si los dos piden la revancha a la vez, el que creó el primer combate se queda con la suya. */
  function avisarSalida() { if (S && S.code && S.terminado) { S.yo.rx = 'x:0:' + Date.now().toString(36); S.yo.t = Date.now(); guardarLado(S.code, S.lado, S.yo).catch(function () {}); } }
  function revancha(btn) {
    if (!S || !S.terminado) return;
    if (S.invPendiente) return aceptar(S.invPendiente, btn);
    var viejo = S, nom = S.yo.nom, inv = $('#cmbInv', box);
    btn.disabled = true; btn.textContent = '⏳ Preparando…';
    var code = nuevoCodigo(), seed = Math.floor(Math.random() * 2147483647), qs = preguntas(viejo.lvl, viejo.n, seed);
    var data = { lvl: viejo.lvl, n: viejo.n, qs: qs.join(','), seed: seed, h: jugadorNuevo(nom), t: Date.now() };
    crearDoc(code, data).then(function () {
      if (S !== viejo) return;
      viejo.miRevancha = code;
      viejo.yo.rx = 'v:' + code + ':' + Date.now().toString(36); viejo.yo.t = Date.now();
      guardarLado(viejo.code, viejo.lado, viejo.yo).catch(function () {});
      btn.textContent = '⏳ Esperando a que ' + (viejo.riv.nom || 'tu rival') + ' acepte…';
      if (inv && !viejo.rivSalio) { inv.className = 'cmb-inv on'; inv.innerHTML = '🔁 Le enviaste la invitación a <b>' + esc(viejo.riv.nom || 'tu rival') + '</b>. Empezará cuando acepte.'; }
      var mira = function () {
        leer(code).then(function (d) {
          if (S !== viejo || viejo.miRevancha !== code) return;
          if (d.g && d.g.nom) { limpiar(); S = { code: code, lado: 'h', otro: 'g', lvl: data.lvl, n: data.n, qs: qs, seed: seed, yo: data.h, riv: d.g }; snd('triumph'); cuentaAtras(); return; }
          revT = setTimeout(mira, 1800);
        }).catch(function () { if (S === viejo) revT = setTimeout(mira, 3000); });
      };
      revT = setTimeout(mira, 1500);
    }).catch(function (e) { btn.disabled = false; btn.textContent = '🔁 Jugar de nuevo'; if (inv) { inv.className = 'cmb-inv on'; inv.textContent = msgError(e); } });
  }
  function aceptar(code, btn) {
    var inv = $('#cmbInv', box) || document.createElement('div');
    if (btn) btn.disabled = true;
    clearTimeout(revT); var viejo = S; viejo.miRevancha = null;
    unir(viejo.yo.nom, code, btn || document.createElement('button'), inv);
  }
  function invitacion(code) {
    if (!S || !S.terminado) return;
    S.invPendiente = code;
    if (S.miRevancha) { if (S.lado === 'h') return; return aceptar(code, $('#cmbRe', box)); } // los dos la pidieron a la vez
    var inv = $('#cmbInv', box); if (!inv) return;
    inv.className = 'cmb-inv on';
    inv.innerHTML = '🔁 <b>' + esc(S.riv.nom || 'Tu rival') + '</b> quiere jugar de nuevo contigo.<button class="cmb-btn" type="button" id="cmbSi">✅ ¡Aceptar la revancha!</button>';
    sfx('alerta'); burbuja('¿Jugamos otra vez? 🔁', true, S.riv.nom || 'Rival');
    var re = $('#cmbRe', box); if (re) re.style.display = 'none';
    $('#cmbSi', box).onclick = function () { snd('click'); aceptar(code, this); };
  }
  function rivalSalio() {
    if (!S || !S.terminado || S.rivSalio) return; S.rivSalio = true;
    var re = $('#cmbRe', box), inv = $('#cmbInv', box);
    if (re) { re.disabled = true; re.textContent = '🚪 ' + (S.riv.nom || 'Tu rival') + ' ya salió del combate'; }
    if (inv) { inv.className = 'cmb-inv on'; inv.innerHTML = (S.riv.nom ? '<b>' + esc(S.riv.nom) + '</b>' : 'Tu rival') + ' ya salió. Crea «Otro combate» y envíale el código nuevo.'; }
    if (S.miRevancha) { clearTimeout(revT); S.miRevancha = null; }
  }
  document.addEventListener('keydown', function (e) { if (root.classList.contains('on') && S && S.tecla && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) S.tecla(e); });
  addEventListener('pagehide', function () { if (S && S.jugando && !S.yo.fin && S.code) { try { S.yo.fin = true; S.yo.t = Date.now(); var f = {}; f[S.lado] = aFS(S.yo); fetch(BASE + S.code + '?updateMask.fieldPaths=' + S.lado + '&key=' + KEY, { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) }); } catch (e) {} } });

  /* ---------------- entrada ---------------- */
  window.Combate = { abrir: function () { snd('click'); menu(); } };
  var b = document.getElementById('btnCombate'); if (b) b.addEventListener('click', function () { window.Combate.abrir(); });
  var m = location.search.match(/[?&]combate=([A-Za-z0-9]{6})/);
  if (m) setTimeout(function () { menu(m[1].toUpperCase()); }, 400);
})();
