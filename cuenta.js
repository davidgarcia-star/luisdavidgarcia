/* =====================================================================
   CUENTA DE JUGADOR (opcional) — Juegos de Luis David Esteban García
   Guarda el avance en la nube con un usuario y una clave (sin correo),
   para seguir jugando desde cualquier teléfono, tablet o computadora.
   El MISMO archivo va en los 4 juegos: BIBLIXIA, BIBLIXIA 2,
   Desafío Bíblico RD y Desafío Bíblico RD 2. Como todos están en
   davidgarcia-star.github.io, al entrar en uno quedas conectado en todos.

   Uso:  <script src="cuenta.js" data-pantallas="#splash,#otra"></script>
         data-pantallas = pantallas del menú donde se muestra el botón.
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Configuración de Firebase (plan gratis). Ver README / instrucciones ---- */
  var CONFIG = {
    apiKey: 'AIzaSyCnYkLEbVg6xqcMUcoqFGHnVTKy2TBRgLQ',  // Firebase → Configuración del proyecto → "Clave de API web"
    projectId: 'juegos-miproaa'                        // Firebase → Configuración del proyecto → "ID del proyecto"
  };
  var PRUEBA = /[?&]cuenta=probar\b/.test(location.search);
  if ((!CONFIG.apiKey || !CONFIG.projectId) && !PRUEBA) return; // hasta configurarlo no se muestra nada

  var ls;
  try { ls = window.localStorage; ls.getItem('x'); } catch (e) { return; }

  var DOMINIO = '@jugadores.miproaa.game';           // correo interno ficticio (nunca se usa ni se envía nada)
  var K_SES = 'cuenta_sesion_v1';                     // sesión (compartida por los 4 juegos)
  var K_T = 'cuenta_cambio_t';                        // hora del último avance en este equipo
  // Claves de avance de los 4 juegos (las preferencias del equipo, como sonido o calidad, no se suben)
  var AVANCE = /^(monedasDeFe3D_v1|biblixia2_v1|dbrd_best_.+|dbrd_passed_.+|dbrd2_won_.+)$/;
  // Campos de "dónde me quedé": aquí gana el equipo usado más recientemente (no el mayor)
  var ESTADO = { pos: 1, mission: 1, fuel: 1, time: 1, player: 1 };

  var script = document.currentScript;
  var PANTALLAS = ((script && script.getAttribute('data-pantallas')) || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  var getRaw = Storage.prototype.getItem, setRaw = Storage.prototype.setItem;
  var leer = function (k) { try { return getRaw.call(ls, k); } catch (e) { return null; } };
  var escribir = function (k, v) { try { setRaw.call(ls, k, v); } catch (e) {} };
  var sesion = (function () { try { return JSON.parse(leer(K_SES)) || null; } catch (e) { return null; } })();
  var guardarSesion = function () { if (sesion) escribir(K_SES, JSON.stringify(sesion)); else try { ls.removeItem(K_SES); } catch (e) {} };

  /* ---------------- Servidor (Firebase por REST, sin librerías pesadas) ---------------- */
  function pedir(url, opciones) {
    return fetch(url, opciones).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) { var err = new Error((j && j.error && (j.error.message || j.error.status)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
        return j;
      });
    });
  }
  function auth(accion, usuario, clave) {
    return pedir('https://identitytoolkit.googleapis.com/v1/accounts:' + accion + '?key=' + CONFIG.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: usuario.indexOf('@') > 0 ? usuario : usuario + DOMINIO, password: clave, returnSecureToken: true })
    }).then(function (j) {
      sesion = { u: usuario, uid: j.localId, id: j.idToken, rt: j.refreshToken, exp: Date.now() + (+j.expiresIn || 3600) * 1000 };
      guardarSesion();
    });
  }
  function token() {
    if (!sesion) return Promise.reject(new Error('SIN_SESION'));
    if (sesion.exp - 60000 > Date.now()) return Promise.resolve(sesion.id);
    return pedir('https://securetoken.googleapis.com/v1/token?key=' + CONFIG.apiKey, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(sesion.rt)
    }).then(function (j) {
      sesion.id = j.id_token; sesion.rt = j.refresh_token; sesion.exp = Date.now() + (+j.expires_in || 3600) * 1000;
      guardarSesion(); return sesion.id;
    }, function (e) {
      if (e.status === 400) { sesion = null; guardarSesion(); pintar(); } // la sesión ya no es válida
      throw e;
    });
  }
  var docUrl = function () { return 'https://firestore.googleapis.com/v1/projects/' + CONFIG.projectId + '/databases/(default)/documents/jugadores/' + sesion.uid; };
  function bajar() {
    return token().then(function (tk) {
      return pedir(docUrl(), { headers: { Authorization: 'Bearer ' + tk } }).then(function (j) {
        var f = (j && j.fields) || {};
        var datos = {}; try { datos = JSON.parse((f.datos && f.datos.stringValue) || '{}') || {}; } catch (e) {}
        return { datos: datos, t: +((f.t && f.t.integerValue) || 0) };
      }, function (e) { if (e.status === 404) return null; throw e; });
    });
  }
  function subir(datos, rapido) {
    return token().then(function (tk) {
      return pedir(docUrl(), {
        method: 'PATCH', keepalive: !!rapido,
        headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: {
          datos: { stringValue: JSON.stringify(datos) },
          usuario: { stringValue: sesion.u },
          t: { integerValue: String(Date.now()) }
        } })
      });
    });
  }

  /* ---------------- Unir el avance de dos equipos sin perder nada ---------------- */
  function unir(a, b, bNuevo, campo) {
    if (a === undefined || a === null) return b;
    if (b === undefined || b === null) return a;
    if (campo && ESTADO[campo]) return bNuevo ? b : a;
    if (typeof a === 'number' && typeof b === 'number') return Math.max(a, b);
    if (typeof a === 'boolean' && typeof b === 'boolean') return a || b;
    if (Array.isArray(a) && Array.isArray(b)) {
      var nums = a.concat(b).every(function (x) { return typeof x === 'number'; });
      if (nums && campo === 'stars') { // estrellas por nivel: la mejor de cada una
        var r = []; for (var i = 0; i < Math.max(a.length, b.length); i++) r.push(Math.max(a[i] || 0, b[i] || 0)); return r;
      }
      if (a.concat(b).every(function (x) { return typeof x !== 'object'; })) { // listas (versículos, tesoros): juntar
        var u = a.slice(); b.forEach(function (x) { if (u.indexOf(x) < 0) u.push(x); }); return u;
      }
      return bNuevo ? b : a;
    }
    if (typeof a === 'object' && typeof b === 'object') {
      var o = {}, k;
      for (k in a) o[k] = a[k];
      for (k in b) o[k] = unir(a[k], b[k], bNuevo, k);
      return o;
    }
    return bNuevo ? b : a;
  }
  function unirTodo(local, nube, nubeNueva) {
    var r = {}, k;
    for (k in local) r[k] = local[k];
    for (k in nube) {
      if (!AVANCE.test(k)) continue;
      if (r[k] === undefined) { r[k] = nube[k]; continue; }
      var a, b; try { a = JSON.parse(r[k]); b = JSON.parse(nube[k]); } catch (e) { r[k] = nubeNueva ? nube[k] : r[k]; continue; }
      // "Empezar desde cero" (BIBLIXIA 2): si un lado se reinició después que el otro, gana ese lado completo
      var ra = (a && a.reinicio) || 0, rb = (b && b.reinicio) || 0;
      var v = ra !== rb ? (ra > rb ? a : b) : unir(a, b, nubeNueva, null);
      r[k] = typeof v === 'string' ? v : JSON.stringify(v);
    }
    return r;
  }
  function avanceLocal() {
    var d = {};
    for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (k && AVANCE.test(k)) d[k] = leer(k); }
    return d;
  }
  var igual = function (x, y) { return JSON.stringify(orden(x)) === JSON.stringify(orden(y)); };
  function orden(o) { var r = {}; Object.keys(o || {}).sort().forEach(function (k) { r[k] = o[k]; }); return r; }

  /* ---------------- Sincronizar ---------------- */
  var ultimaNube = null, ocupado = null, pendiente = false, temporizador = 0, ultimoOk = 0, errorMsg = '';
  function sincronizar() {
    if (!sesion) return Promise.resolve(false);
    if (ocupado) return ocupado.then(sincronizar);
    pendiente = false;
    ocupado = bajar().then(function (nube) {
      var local = avanceLocal(), tLocal = +leer(K_T) || 0;
      var unido = nube ? unirTodo(local, nube.datos, nube.t > tLocal) : local;
      var cambioLocal = !igual(unido, local);
      if (cambioLocal) for (var k in unido) if (unido[k] !== local[k]) escribir(k, unido[k]);
      var p = (!nube || !igual(unido, nube.datos)) ? subir(unido) : Promise.resolve();
      return p.then(function () { ultimaNube = unido; ultimoOk = Date.now(); errorMsg = ''; return cambioLocal; });
    }).catch(function (e) {
      errorMsg = /fetch|network|Failed/i.test(e.message) ? 'Sin conexión: se guardará cuando vuelva el internet.' : 'No se pudo guardar ahora (' + e.message + ').';
      pendiente = true; return false;
    }).then(function (r) { ocupado = null; pintar(); return r; });
    return ocupado;
  }
  function programar() { pendiente = true; clearTimeout(temporizador); temporizador = setTimeout(sincronizar, 5000); }
  // Cada vez que un juego guarda su avance, también se sube a la nube (unos segundos después)
  Storage.prototype.setItem = function (k, v) {
    setRaw.call(this, k, v);
    if (this === ls && AVANCE.test(k)) { escribir(K_T, String(Date.now())); if (sesion) programar(); }
  };
  function alSalir() {
    if (!sesion || !pendiente || !sesion.id || sesion.exp - 60000 < Date.now()) return;
    clearTimeout(temporizador); pendiente = false;
    var d = ultimaNube ? unirTodo(avanceLocal(), ultimaNube, false) : avanceLocal();
    subir(d, true).catch(function () {});
  }
  addEventListener('pagehide', alSalir);
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') alSalir(); else if (sesion) sincronizar(); });
  addEventListener('online', function () { if (pendiente) sincronizar(); });

  /* ---------------- Interfaz ---------------- */
  var css = '' +
    '.cta-btn{position:fixed;left:12px;bottom:12px;z-index:99990;display:none;align-items:center;gap:6px;padding:8px 12px;border-radius:999px;border:1px solid rgba(255,215,120,.65);background:rgba(18,22,40,.82);color:#fff;font:600 14px/1.1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}' +
    '.cta-btn.on{display:inline-flex}.cta-btn:hover{background:rgba(35,42,72,.92)}.cta-btn .ok{color:#7be38f}' +
    '.cta-fondo{position:fixed;inset:0;z-index:99995;background:rgba(5,8,20,.72);display:none;align-items:center;justify-content:center;padding:16px}' +
    '.cta-fondo.on{display:flex}' +
    '.cta-caja{width:100%;max-width:380px;max-height:92vh;overflow:auto;background:#141a33;color:#eef1ff;border:1px solid rgba(255,215,120,.45);border-radius:18px;padding:22px 20px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}' +
    '.cta-caja h2{margin:0 0 6px;font-size:21px;color:#ffd778}.cta-caja p{margin:0 0 12px;color:#c9cfee;font-size:14px}' +
    '.cta-tabs{display:flex;gap:6px;margin:12px 0}.cta-tabs button{flex:1;padding:9px;border-radius:10px;border:1px solid #3a4475;background:transparent;color:#c9cfee;font:inherit;font-weight:600;cursor:pointer}' +
    '.cta-tabs button.sel{background:#ffd778;color:#1a1a2e;border-color:#ffd778}' +
    '.cta-caja label{display:block;font-size:13px;font-weight:600;margin:10px 0 4px;color:#dfe3ff}' +
    '.cta-caja input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #3a4475;background:#0c1124;color:#fff;font:inherit;font-size:16px}' +
    '.cta-sel{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid #3a4475;background:#0c1124;color:#fff;font:inherit;font-size:16px}' +
    '.cta-caja input:focus{outline:2px solid #ffd778;border-color:transparent}' +
    '.cta-ver{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:13px;color:#c9cfee;cursor:pointer}.cta-ver input{width:auto}' +
    '.cta-nota{margin-top:12px;padding:9px 11px;border-radius:10px;background:rgba(255,215,120,.1);color:#ffe4a3;font-size:13px}' +
    '.cta-err{min-height:18px;margin-top:10px;color:#ff8f8f;font-size:13px;font-weight:600}.cta-err.bien{color:#7be38f}' +
    '.cta-acc{display:flex;flex-direction:column;gap:8px;margin-top:12px}.cta-acc button{padding:12px;border-radius:12px;border:0;font:inherit;font-weight:700;cursor:pointer}' +
    '.cta-pri{background:linear-gradient(180deg,#ffe08a,#f2b93b);color:#1a1a2e}.cta-pri:disabled{opacity:.6;cursor:wait}' +
    '.cta-sec{background:#252d52;color:#eef1ff}.cta-ter{background:transparent;color:#aab2dd;text-decoration:underline}' +
    '.cta-intro{position:fixed;inset:0;z-index:99993;display:none;align-items:center;justify-content:center;padding:18px;overflow:auto;' +
      'background:radial-gradient(70% 50% at 50% 0%,rgba(40,80,184,.35),transparent 70%),radial-gradient(60% 40% at 50% 100%,rgba(244,183,63,.18),transparent 70%),linear-gradient(180deg,#071433,#030817);' +
      'font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#eef1ff;text-align:center}' +
    '.cta-intro.on{display:flex}' +
    '.cta-ic{width:100%;max-width:420px;padding:26px 22px 20px;border-radius:24px;background:linear-gradient(160deg,rgba(255,255,255,.08),rgba(255,255,255,.02));border:1px solid rgba(255,215,120,.45);box-shadow:0 30px 80px rgba(0,0,0,.55);animation:ctaEntra .35s ease}' +
    '@keyframes ctaEntra{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}' +
    '.cta-ic .ico{font-size:46px;line-height:1;margin-bottom:6px}.cta-ic h2{margin:0 0 8px;font-size:24px;line-height:1.2;color:#ffd778}' +
    '.cta-ic p{margin:0 0 16px;color:#cfd6f5;font-size:14.5px}' +
    '.cta-op{display:flex;align-items:center;gap:12px;width:100%;margin:0 0 10px;padding:13px 15px;border-radius:16px;text-align:left;cursor:pointer;font:inherit;border:1px solid transparent;transition:transform .15s ease}' +
    '.cta-op:active{transform:scale(.98)}.cta-op .e{font-size:26px;flex:none}.cta-op b{display:block;font-size:16px}.cta-op small{display:block;font-size:12.5px;line-height:1.35;margin-top:2px}' +
    '.cta-op.a{background:linear-gradient(135deg,#ffe08a,#f2b93b);color:#1a1a2e;box-shadow:0 10px 26px -10px rgba(244,183,63,.8)}.cta-op.a small{color:#3b2f0e}' +
    '.cta-op.b{background:#1d2a55;color:#fff;border-color:#3a4c8c}.cta-op.b small{color:#b9c3ec}' +
    '.cta-op.c{background:transparent;color:#eef1ff;border-color:rgba(255,255,255,.25)}.cta-op.c small{color:#ffb3b3}' +
    '.cta-destacado{position:relative;overflow:visible;margin-top:12px;animation:ctaLate 1.6s ease-in-out infinite}' +
    '.cta-destacado:before{content:"";position:absolute;inset:-4px;border-radius:20px;border:2px solid rgba(255,224,138,.9);animation:ctaAro 1.6s ease-out infinite;pointer-events:none}' +
    '.cta-destacado:after{content:"";position:absolute;inset:0;border-radius:16px;background:linear-gradient(100deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%) no-repeat;background-size:250% 100%;animation:ctaBrillo 2.4s ease-in-out infinite;pointer-events:none}' +
    '.cta-reco{position:absolute;top:-11px;right:12px;z-index:2;padding:3px 9px;border-radius:999px;background:linear-gradient(135deg,#ce1126,#ff5a3c);color:#fff;font-size:11.5px;font-weight:800;letter-spacing:.02em;box-shadow:0 4px 12px rgba(206,17,38,.5)}' +
    '@keyframes ctaLate{0%,100%{transform:scale(1);box-shadow:0 10px 26px -10px rgba(244,183,63,.8)}50%{transform:scale(1.035);box-shadow:0 0 0 6px rgba(244,183,63,.18),0 14px 34px -8px rgba(244,183,63,1)}}' +
    '@keyframes ctaAro{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.08)}}' +
    '@keyframes ctaBrillo{0%,50%{background-position:130% 0}100%{background-position:-30% 0}}' +
    '@media (prefers-reduced-motion:reduce){.cta-destacado,.cta-destacado:before,.cta-destacado:after{animation:none}}' +
    '.cta-op:focus-visible{outline:3px solid #ffe066;outline-offset:2px}' +
    '.cta-ic .pie{margin:8px 0 0;font-size:12.5px;color:#9aa6d6}' +
    '@media (prefers-reduced-motion:reduce){.cta-ic{animation:none}}' +
    '.cta-cab{display:flex;align-items:center;justify-content:space-between;gap:10px}.cta-cab h2{margin:0}' +
    '.cta-q{flex:none;width:34px;height:34px;border-radius:50%;border:2px solid #ffd778;background:rgba(255,215,120,.12);color:#ffd778;font:800 18px/1 system-ui,sans-serif;cursor:pointer}' +
    '.cta-q[aria-expanded=true]{background:#ffd778;color:#1a1a2e}.cta-q:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '.cta-ayuda{margin:12px 0 4px;padding:12px 14px;border-radius:12px;background:#0c1124;border:1px solid rgba(255,215,120,.4);font-size:13.5px;line-height:1.55}' +
    '.cta-ayuda h3{margin:0 0 8px;font-size:15px;color:#ffd778}.cta-ayuda p{margin:0 0 8px;color:#dfe3ff;font-size:13.5px}.cta-ayuda ul{margin:0 0 8px;padding-left:18px;color:#dfe3ff}' +
    '.cta-ayuda code,.cta-caja label small{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:1px 5px;border-radius:5px;color:#ffe4a3}.cta-caja label small{font-family:inherit;background:none;color:#aab2dd;font-weight:400}' +
    '.cta-aviso{margin:4px 0 12px;padding:10px 12px;border-radius:12px;background:rgba(120,170,255,.12);border:1px solid rgba(120,170,255,.35);color:#dfe8ff;font-size:13.5px;line-height:1.5}' +
    '.cta-req{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:2px;font-size:12.5px;color:#ffb3b3}.cta-req li.si{color:#7be38f}' +
    '.cta-tip{position:fixed;left:12px;bottom:58px;z-index:99991;max-width:min(300px,calc(100vw - 24px));padding:10px 32px 10px 12px;border-radius:12px;background:#1d2547;color:#eef1ff;border:1px solid rgba(255,215,120,.55);box-shadow:0 8px 24px rgba(0,0,0,.45);font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;display:none}' +
    '.cta-tip.on{display:block}.cta-tip b{color:#ffd778}.cta-tip button{position:absolute;top:4px;right:6px;border:0;background:none;color:#aab2dd;font-size:18px;cursor:pointer;line-height:1}' +
    '.cta-tip:after{content:"";position:absolute;left:22px;bottom:-7px;width:12px;height:12px;background:#1d2547;border-right:1px solid rgba(255,215,120,.55);border-bottom:1px solid rgba(255,215,120,.55);transform:rotate(45deg)}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'cta-btn'; btn.setAttribute('aria-haspopup', 'dialog');
  var fondo = document.createElement('div');
  fondo.className = 'cta-fondo'; fondo.setAttribute('role', 'dialog'); fondo.setAttribute('aria-modal', 'true'); fondo.setAttribute('aria-label', 'Guardar mi avance');
  fondo.innerHTML = '<div class="cta-caja"></div>';
  var caja = fondo.firstChild;
  // Que las teclas escritas en el formulario no muevan al personaje ni suenen en el juego
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (t) {
    fondo.addEventListener(t, function (e) { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') cerrar(); }, { passive: true });
  });
  fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
  btn.addEventListener('click', function (e) { e.stopPropagation(); abrir(); });

  var modo = 'entrar';
  // Clave fuerte: mínimo 8 caracteres, con mayúscula, minúscula, número y carácter especial
  var REQ = [
    ['8 caracteres o más', function (c) { return c.length >= 8; }],
    ['una MAYÚSCULA', function (c) { return /[A-ZÁÉÍÓÚÑ]/.test(c); }],
    ['una minúscula', function (c) { return /[a-záéíóúñ]/.test(c); }],
    ['un número', function (c) { return /\d/.test(c); }],
    ['un carácter especial: ! ? # $ % & * @ . - _', function (c) { return /[^A-Za-z0-9ÁÉÍÓÚÑáéíóúñ\s]/.test(c); }]
  ];
  var claveFuerte = function (c) { return REQ.every(function (r) { return r[1](c); }); };
  function pintarReq() {
    var l = caja.querySelector('#cta-req'), i = caja.querySelector('#cta-c'); if (!l || !i) return;
    l.innerHTML = REQ.map(function (r) { var ok = r[1](i.value); return '<li class="' + (ok ? 'si' : '') + '">' + (ok ? '✓ ' : '• ') + r[0] + '</li>'; }).join('');
  }
  var AVISO_K = 'cuenta_aviso_visto';
  var ayuda = false;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function hace(t) { var s = Math.round((Date.now() - t) / 1000); return s < 60 ? 'hace unos segundos' : s < 3600 ? 'hace ' + Math.round(s / 60) + ' min' : 'hoy'; }

  function pintar() {
    if (sesion && introActiva) quitarIntro('cuenta');
    btn.innerHTML = sesion ? '👤 ' + esc(sesion.u) + ' <span class="ok">✓</span>' : '💾 Guardar avance';
    btn.title = sesion ? 'Tu avance se guarda en la nube' : 'Opcional: crea un usuario para seguir tu juego en otro equipo';
    if (!fondo.classList.contains('on')) return;
    if (sesion) {
      caja.innerHTML = '<h2>👤 ' + esc(sesion.u) + '</h2>' +
        '<p>Tu avance se guarda en este equipo y también en la nube. En otro teléfono, tablet o computadora, entra con este mismo usuario y clave y seguirás donde te quedaste. Sirve para los 4 juegos.</p>' +
        '<div class="cta-err' + (errorMsg ? '' : ' bien') + '">' + (errorMsg ? esc(errorMsg) : ultimoOk ? '✓ Avance guardado ' + hace(ultimoOk) : '') + '</div>' +
        '<div class="cta-acc"><button class="cta-pri" data-a="ya">☁️ Guardar ahora</button>' +
        '<button class="cta-sec" data-a="cerrar">Seguir jugando</button>' +
        '<button class="cta-ter" data-a="salir">Salir de la cuenta</button></div>';
    } else {
      var crear = modo === 'crear';
      caja.innerHTML = '<div class="cta-cab"><h2>💾 Guarda tu avance</h2><button type="button" class="cta-q" aria-expanded="' + (ayuda ? 'true' : 'false') + '" aria-controls="cta-ayuda" title="Ayuda: cómo registrarte">?</button></div>' +
        '<div class="cta-ayuda" id="cta-ayuda"' + (ayuda ? '' : ' hidden') + '>' +
          '<h3>❓ Cómo registrarte</h3>' +
          '<p><b>1. Usuario o correo</b><br>Escribe un nombre de usuario de 3 a 20 letras o números, sin espacios ni acentos (puedes usar <code>.</code> <code>_</code> <code>-</code>).<br>Ejemplos: <code>david_rd</code> · <code>maria.2026</code><br>O, si prefieres, un correo <b>aunque sea inventado</b>: no tiene que existir y no te enviaremos nada. Ej.: <code>davidjuega@juego.com</code></p>' +
          '<p><b>2. Clave</b> (mínimo 8 caracteres). Debe tener:</p><ul>' +
          '<li>una <b>MAYÚSCULA</b>: A B C … Z</li><li>una <b>minúscula</b>: a b c … z</li><li>un <b>número</b>: 0 1 2 … 9</li>' +
          '<li>un <b>carácter especial</b>: <code>! ? # $ % &amp; * @ . - _ + =</code></li></ul>' +
          '<p>Ejemplos de claves válidas: <code>Biblia#2026</code> · <code>Moises!25</code> · <code>David_Rd7</code><br>El espacio no cuenta como carácter especial.</p>' +
          '<p><b>3. Anótalos.</b> Guarda tu usuario y clave en un lugar seguro: si los olvidas no se pueden recuperar.</p>' +
          '<p><b>4. En otro equipo</b>, toca «Ya tengo usuario» y entra con los mismos datos.</p>' +
        '</div>' +
        '<div class="cta-aviso"><b>📱 Sin usuario:</b> tu avance se guarda <b>solo en este equipo</b> (este teléfono o computadora), mientras no borres los datos del navegador.<br><b>☁️ Con usuario y clave:</b> tu avance te sigue a <b>cualquier equipo</b>.</div>' +
        '<p>Es <b>opcional</b> y <b>no necesitas correo</b>: solo un usuario y una clave. Sirve para los 4 juegos.</p>' +
        '<div class="cta-tabs" role="tablist"><button data-m="entrar" class="' + (crear ? '' : 'sel') + '">Ya tengo usuario</button><button data-m="crear" class="' + (crear ? 'sel' : '') + '">Crear usuario</button></div>' +
        '<form novalidate><label for="cta-u">Usuario o correo <small>(puede ser inventado)</small></label><input id="cta-u" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="60" placeholder="ej. david_rd o david@juego.com">' +
        '<label for="cta-c">Clave</label><input id="cta-c" type="password" autocomplete="' + (crear ? 'new-password' : 'current-password') + '" maxlength="40" placeholder="' + (crear ? 'mínimo 8, ej. Fe2026!' : 'tu clave') + '">' +
        (crear ? '<ul class="cta-req" id="cta-req" aria-live="polite"></ul>' : '') +
        (crear ? '<label for="cta-g">Soy <small>(obligatorio, solo para estadísticas)</small></label><select id="cta-g" class="cta-sel" required><option value="" selected disabled>— Elige hombre o mujer —</option><option value="hombre">Hombre</option><option value="mujer">Mujer</option></select>' : '') +
        (crear ? '<label for="cta-c2">Repite la clave</label><input id="cta-c2" type="password" autocomplete="new-password" maxlength="40">' : '') +
        '<label class="cta-ver"><input type="checkbox" id="cta-ver"> Mostrar clave</label>' +
        (crear ? '<div class="cta-nota">✍️ Anota tu usuario y clave. Como no usamos correo, si los olvidas no se pueden recuperar.</div>' : '') +
        '<div class="cta-err" id="cta-err"></div>' +
        '<div class="cta-acc"><button class="cta-pri" type="submit">' + (crear ? 'Crear usuario y guardar' : 'Entrar y recuperar mi avance') + '</button>' +
        '<button class="cta-ter" type="button" data-a="cerrar">Ahora no</button></div></form>';
      var f = caja.querySelector('form');
      if (crear) { caja.querySelector('#cta-c').addEventListener('input', pintarReq); pintarReq(); }
      f.addEventListener('submit', function (e) { e.preventDefault(); enviar(); });
      caja.querySelector('#cta-ver').addEventListener('change', function () {
        var t = this.checked ? 'text' : 'password';
        [].forEach.call(caja.querySelectorAll('input[type=password],input.cta-pw'), function (i) { i.type = t; i.classList.add('cta-pw'); });
      });
    }
    var q = caja.querySelector('.cta-q');
    if (q) q.onclick = function () { ayuda = !ayuda; q.setAttribute('aria-expanded', String(ayuda)); caja.querySelector('#cta-ayuda').hidden = !ayuda; if (ayuda) caja.querySelector('#cta-ayuda').scrollIntoView({ block: 'nearest' }); };
    [].forEach.call(caja.querySelectorAll('[data-m]'), function (b) { b.onclick = function () { modo = b.getAttribute('data-m'); pintar(); }; });
    [].forEach.call(caja.querySelectorAll('[data-a]'), function (b) { b.onclick = function () { accion(b.getAttribute('data-a'), b); }; });
  }

  function mensaje(t, bien) { var e = caja.querySelector('#cta-err') || caja.querySelector('.cta-err'); if (e) { e.textContent = t; e.classList.toggle('bien', !!bien); } }
  function traducir(m) {
    if (/EMAIL_EXISTS/.test(m)) return 'Ese usuario o correo ya existe. Elige otro o entra con "Ya tengo usuario".';
    if (/INVALID_EMAIL/.test(m)) return 'Ese correo no está bien escrito. Ej.: david@juego.com (puede ser inventado).';
    if (/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND/.test(m)) return 'Usuario o clave incorrectos.';
    if (/WEAK_PASSWORD|PASSWORD_DOES_NOT_MEET/.test(m)) return 'La clave debe tener 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.';
    if (/TOO_MANY/.test(m)) return 'Demasiados intentos. Espera unos minutos y vuelve a intentar.';
    if (/USER_DISABLED/.test(m)) return 'Este usuario fue desactivado.';
    if (/fetch|network|Failed/i.test(m)) return 'Sin conexión a internet. Intenta de nuevo.';
    return 'No se pudo completar (' + m + ').';
  }
  function enviar() {
    var u = (caja.querySelector('#cta-u').value || '').trim().toLowerCase();
    var c = caja.querySelector('#cta-c').value || '';
    var c2 = caja.querySelector('#cta-c2');
    if (u.indexOf('@') >= 0) {
      if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(u) || u.length > 60) return mensaje('Ese correo no está bien escrito. Debe tener @ y un punto, ej. david@juego.com (puede ser inventado).');
    } else if (!/^[a-z0-9._-]{3,20}$/.test(u)) return mensaje('El usuario debe tener de 3 a 20 letras o números, sin espacios, ñ ni acentos (puedes usar . _ -). O escribe un correo, aunque sea inventado.');
    if (modo === 'crear' && !claveFuerte(c)) { pintarReq(); return mensaje('La clave debe tener 8 caracteres o más, con mayúscula, minúscula, número y carácter especial.'); }
    if (!c) return mensaje('Escribe tu clave.');
    if (c2 && c2.value !== c) return mensaje('Las dos claves no son iguales.');
    var gSel0 = caja.querySelector('#cta-g');
    if (modo === 'crear' && gSel0 && !/^(hombre|mujer)$/.test(gSel0.value)) { gSel0.focus(); return mensaje('Elige si eres hombre o mujer para crear tu usuario.'); }
    var b = caja.querySelector('.cta-pri'); b.disabled = true; mensaje(modo === 'crear' ? 'Creando tu usuario…' : 'Entrando…', true);
    var gSel = caja.querySelector('#cta-g'), genero = gSel ? gSel.value : '';
    auth(modo === 'crear' ? 'signUp' : 'signInWithPassword', u, c).then(function () {
      // Estadística anónima: solo se suma 1 a «hombre» o «mujer» (sin unirlo al usuario)
      if (modo === 'crear' && /^(hombre|mujer)$/.test(genero)) fetch('https://abacus.jasoncameron.dev/hit/miproaa-estadisticas/genero-' + genero, { cache: 'no-store' }).catch(function () {});
      mensaje('Buscando tu avance…', true);
      return sincronizar();
    }).then(function (cambio) {
      if (cambio) { mensaje('¡Avance recuperado! Cargando…', true); setTimeout(function () { location.reload(); }, 900); }
      else pintar();
    }).catch(function (e) { b.disabled = false; mensaje(traducir(e.message)); });
  }
  function accion(a, b) {
    if (a === 'cerrar') return cerrar();
    if (a === 'salir') { sesion = null; ultimaNube = null; guardarSesion(); pintar(); return; } // el avance sigue en este equipo
    if (a === 'ya') { b.disabled = true; sincronizar().then(function (cambio) { if (cambio) location.reload(); }); }
  }
  function abrir() { escribir(AVISO_K, '1'); tip.classList.remove('on'); fondo.classList.add('on'); pintar(); var i = caja.querySelector('input'); if (i && matchMedia('(pointer:fine)').matches) i.focus(); }
  function cerrar() { fondo.classList.remove('on'); pintar(); if (introActiva && !sesion) intro.classList.add('on'); }

  // Mostrar el botón solo cuando se ve una pantalla del menú (no durante el juego)
  function visible(sel) {
    var el; try { el = document.querySelector(sel); } catch (e) { return false; }
    if (!el || el.classList.contains('hidden')) return false;
    var s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > 0.05;
  }
  var enMenu = function () { return !PANTALLAS.length || PANTALLAS.some(visible); };
  var intro = document.createElement('div'); intro.className = 'cta-intro'; intro.setAttribute('role', 'dialog'); intro.setAttribute('aria-modal', 'true'); intro.setAttribute('aria-labelledby', 'cta-intro-t');
  intro.innerHTML = '<div class="cta-ic"><div class="ico" aria-hidden="true">💾</div>' +
    '<h2 id="cta-intro-t">¿Quieres guardar tu avance?</h2>' +
    '<p>Entra con tu usuario y tu <b>historial y avance del juego se guardarán</b>, y te seguirán a cualquier teléfono, tablet o computadora. Es <b>opcional</b> y no necesitas correo. Sirve para los 4 juegos.</p>' +
    '<button type="button" class="cta-op a cta-destacado" data-i="crear"><span class="cta-reco">⭐ Recomendado</span><span class="e" aria-hidden="true">✨</span><span><b>Crear mi usuario</b><small>Guarda tu historial y avance · gratis y sin correo</small></span></button>' +
    '<button type="button" class="cta-op b" data-i="entrar"><span class="e" aria-hidden="true">🔐</span><span><b>Ya tengo usuario: entrar</b><small>Mi historial y avance se guardan</small></span></button>' +
    '<button type="button" class="cta-op c" data-i="invitado"><span class="e" aria-hidden="true">▶</span><span><b>Jugar sin registrarme</b><small>⚠️ Mi historial y avance del juego NO se guardarán en una cuenta</small></span></button>' +
    '<p class="pie">Sin usuario, el avance solo queda en este equipo y se pierde si cambias de equipo o borras los datos del navegador.</p></div>';
  var INTRO_K = 'cuenta_eleccion';
  var introActiva = false;
  function mostrarIntro() { introActiva = true; intro.classList.add('on'); setTimeout(function () { var b = intro.querySelector('.cta-op'); if (b && matchMedia('(pointer:fine)').matches) b.focus(); }, 60); }
  function quitarIntro(eleccion) { introActiva = false; intro.classList.remove('on'); try { sessionStorage.setItem(INTRO_K, eleccion); } catch (e) {} }
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'mousedown', 'touchstart', 'wheel'].forEach(function (t) { intro.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true }); });
  [].forEach.call(intro.querySelectorAll('[data-i]'), function (b) {
    b.addEventListener('click', function (e) {
      e.stopPropagation(); var i = b.getAttribute('data-i');
      if (i === 'invitado') { escribir(AVISO_K, '1'); quitarIntro('invitado'); return; }
      modo = i; intro.classList.remove('on'); abrir();
    });
  });
  var tip = document.createElement('div'); tip.className = 'cta-tip'; tip.setAttribute('role', 'status');
  tip.innerHTML = '<button type="button" aria-label="Cerrar aviso">×</button><b>💾 Tu avance se guarda solo en este equipo.</b> Para seguir jugando en otro teléfono o computadora sin perderlo, toca «Guardar avance» y crea tu usuario y clave (sin correo).';
  tip.firstChild.addEventListener('click', function (e) { e.stopPropagation(); escribir(AVISO_K, '1'); tip.classList.remove('on'); });
  tip.addEventListener('click', function () { escribir(AVISO_K, '1'); tip.classList.remove('on'); abrir(); });
  function revisar() {
    var m = enMenu(); btn.classList.toggle('on', m);
    tip.classList.toggle('on', m && !sesion && !leer(AVISO_K) && !fondo.classList.contains('on') && !introActiva);
  }

  function iniciar() {
    document.body.appendChild(btn); document.body.appendChild(tip); document.body.appendChild(intro); document.body.appendChild(fondo);
    pintar(); revisar(); setInterval(revisar, 700);
    // Pantalla de inicio: sale al abrir el juego si no se ha entrado con usuario (una vez por visita)
    var elegido = null; try { elegido = sessionStorage.getItem(INTRO_K); } catch (e) {}
    if (!sesion && !elegido) mostrarIntro();
    // Enlaces opcionales en las páginas: <button data-cuenta-abrir hidden>…</button>
    [].forEach.call(document.querySelectorAll('[data-cuenta-abrir]'), function (el) {
      el.hidden = false; el.addEventListener('click', function (e) { e.preventDefault(); abrir(); });
    });
    if (sesion) sincronizar().then(function (cambio) {
      // Se jugó en otro equipo: si todavía está en el menú, recargar para mostrar el avance nuevo
      var ultimo = 0; try { ultimo = +sessionStorage.getItem('cuenta_recarga') || 0; } catch (e) {}
      if (cambio && enMenu() && Date.now() - ultimo > 30000) {
        try { sessionStorage.setItem('cuenta_recarga', String(Date.now())); } catch (e) {}
        location.reload();
      }
    });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);

  window.CuentaJugador = { sincronizar: sincronizar, abrir: abrir, get usuario() { return sesion && sesion.u; } };
})();
