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
    if (e.status === 403) return 'El combate en línea todavía no está activado en el servidor (faltan las reglas de Firebase).';
    return 'No se pudo conectar (' + e.message + '). Intenta otra vez.';
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
    '.cmb-x{float:right;background:none;border:0;color:#aab2dd;font-size:22px;cursor:pointer;line-height:1}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  var root = document.createElement('div'); root.className = 'cmb'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Combate de la Fe');
  root.innerHTML = '<div class="cmb-box" id="cmbBox"></div>'; document.body.appendChild(root);
  var box = $('#cmbBox', root);

  /* ---------------- estado ---------------- */
  var S = null, pollT = 0, qT = 0;
  function limpiar() { clearTimeout(pollT); clearInterval(qT); pollT = 0; qT = 0; }
  function cerrar() {
    limpiar(); S = null; root.classList.remove('on'); document.documentElement.style.overflow = '';
    if (/[?&]combate=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
  }
  function abrir() { root.classList.add('on'); document.documentElement.style.overflow = 'hidden'; }
  function nombre() { return (ls.get('combate_nombre') || '').slice(0, 20); }
  var cab = '<button class="cmb-x" type="button" data-x aria-label="Cerrar">✕</button><h2><span class="cmb-glove">🥊</span> Combate de la Fe</h2>';
  function pintar(html) { box.innerHTML = cab + html; var x = $('[data-x]', box); if (x) x.onclick = function () { snd('click'); salir(); }; root.scrollTop = 0; }
  function salir() {
    if (S && S.jugando && !S.yo.fin && !confirm('¿Salir del combate? Tu rival ganará.')) return;
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
  function jugadorNuevo(nom) { return { nom: nom, pts: 0, i: 0, ms: 0, fin: false, t: Date.now() }; }

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

  /* ---------------- partida ---------------- */
  function cuentaAtras() {
    limpiar();
    var n = 3, lv = NIVELES.filter(function (l) { return l.id === S.lvl; })[0];
    var paso = function () {
      pintar('<div class="cmb-vs"><div class="cmb-p"><b>' + esc(S.yo.nom) + '</b><small>Tú</small></div><span class="cmb-glove">🥊</span><div class="cmb-p riv"><b>' + esc(S.riv.nom) + '</b><small>Rival</small></div></div>' +
        '<p class="cmb-c">' + lv.emoji + ' ' + lv.name + ' · ' + S.n + ' preguntas · ' + TIEMPO + ' s cada una</p><div class="cmb-big">' + (n ? n : '¡A pelear la buena batalla!') + '</div>');
      snd('tick');
      if (n-- <= 0) { setTimeout(empezar, 700); return; }
      pollT = setTimeout(paso, 900);
    };
    paso();
  }
  function empezar() {
    S.jugando = true; S.idx = 0; S.r = rng(S.seed ^ 0x5bd1e995);
    S.yo.i = 0; S.yo.pts = 0; S.yo.ms = 0; S.yo.fin = false;
    sondear();
    pregunta();
  }
  function sondear() {
    clearTimeout(pollT);
    pollT = setTimeout(function () {
      if (!S) return;
      leer(S.code).then(function (d) { if (!S) return; if (d[S.otro]) S.riv = d[S.otro]; marcador(); revisarFin(); }).catch(function () {}).then(function () { if (S && !S.terminado) sondear(); });
    }, POLL);
  }
  function marcador() {
    var el = $('#cmbVs', box); if (!el || !S.riv) return;
    var r = S.riv;
    el.innerHTML = '<div class="cmb-p"><b>' + esc(S.yo.nom) + '</b><span class="pts">' + S.yo.pts + '</span> <small>' + S.yo.i + ' / ' + S.n + '</small></div><span class="cmb-glove">🥊</span>' +
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
      guardarLado(S.code, S.lado, S.yo).catch(function () {});
      marcador();
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
    S.terminado = true; S.jugando = false; limpiar();
    var yo = S.yo, abandono = caido || (r.fin && (r.i || 0) < S.n), gano, empate = false;
    if (abandono) gano = true;
    else if (yo.pts !== r.pts) gano = yo.pts > r.pts;
    else if (yo.ms !== r.ms) gano = yo.ms < r.ms;
    else { empate = true; gano = false; }
    var titulo = empate ? '🤝 ¡Empate!' : gano ? '🏆 ¡Ganaste el combate!' : '🥊 ¡Buen combate!';
    var detalle = abandono ? esc(r.nom || 'Tu rival') + ' salió del combate antes de terminar.' :
      (yo.pts === r.pts && !empate ? 'Empataron en aciertos; ganó quien respondió más rápido.' : '');
    snd(gano || empate ? 'triumph' : 'wrong');
    pintar('<div class="cmb-big">' + titulo + '</div>' +
      '<div class="cmb-vs"><div class="cmb-p"><b>' + esc(yo.nom) + '</b><span class="pts">' + yo.pts + '</span> <small>de ' + S.n + ' · ' + (yo.ms / 1000).toFixed(1) + ' s</small></div><span class="cmb-glove">🥊</span>' +
      '<div class="cmb-p riv"><b>' + esc(r.nom || 'Rival') + '</b><span class="pts">' + (r.pts || 0) + '</span> <small>de ' + S.n + (r.ms ? ' · ' + (r.ms / 1000).toFixed(1) + ' s' : '') + '</small></div></div>' +
      (detalle ? '<p class="cmb-c">' + detalle + '</p>' : '') +
      '<p class="ver cmb-c">«Pero gracias a Dios, que nos da la victoria por medio de nuestro Señor Jesucristo» — 1 Corintios 15:57</p>' +
      '<button class="cmb-btn" type="button" id="cmbOtra">🥊 Otro combate</button><button class="cmb-btn ter" type="button" id="cmbFin">Volver al juego</button>');
    $('#cmbOtra', box).onclick = function () { snd('click'); S = null; menu(); };
    $('#cmbFin', box).onclick = function () { snd('click'); cerrar(); };
  }
  document.addEventListener('keydown', function (e) { if (root.classList.contains('on') && S && S.tecla && !/INPUT|TEXTAREA/.test((e.target || {}).tagName || '')) S.tecla(e); });
  addEventListener('pagehide', function () { if (S && S.jugando && !S.yo.fin && S.code) { try { S.yo.fin = true; S.yo.t = Date.now(); var f = {}; f[S.lado] = aFS(S.yo); fetch(BASE + S.code + '?updateMask.fieldPaths=' + S.lado + '&key=' + KEY, { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: f }) }); } catch (e) {} } });

  /* ---------------- entrada ---------------- */
  window.Combate = { abrir: function () { snd('click'); menu(); } };
  var b = document.getElementById('btnCombate'); if (b) b.addEventListener('click', function () { window.Combate.abrir(); });
  var m = location.search.match(/[?&]combate=([A-Za-z0-9]{6})/);
  if (m) setTimeout(function () { menu(m[1].toUpperCase()); }, 400);
})();
