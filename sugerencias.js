/* =====================================================================
   SUGERENCIAS Y QUEJAS — Sitio y juegos de Luis David Esteban García
   Un botón «💬 Sugerencias» abre un cuadro para escribir y un botón «Enviar».
   El mensaje llega al correo del creador por medio de Web3Forms (gratis).
   El correo NO aparece en la página: solo se usa una clave de acceso.

   El MISMO archivo va en el sitio y en los 4 juegos.
   Uso:  <script src="sugerencias.js" data-origen="Desafío Bíblico RD"
                 data-pantallas="#screen-welcome,#screen-menu"   (opcional: solo en esas pantallas)
                 data-lado="right" data-abajo="12"></script>     (opcional: posición del botón)
   ===================================================================== */
(function () {
  'use strict';

  /* ---- Clave de acceso de Web3Forms (web3forms.com → se recibe en tu correo) ---- */
  var CLAVE = '';
  var probar = /[?&]sugerencias=probar\b/.test(location.search);
  if (!CLAVE && !probar) return; // hasta poner la clave no se muestra nada

  var script = document.currentScript;
  var at = function (n, d) { return (script && script.getAttribute(n)) || d; };
  var ORIGEN = at('data-origen', document.title);
  var LADO = at('data-lado', 'right') === 'left' ? 'left' : 'right';
  var ABAJO = parseInt(at('data-abajo', '12'), 10) || 12;
  var PANTALLAS = at('data-pantallas', '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  var css = '' +
    '.sg-btn{position:fixed;' + LADO + ':12px;bottom:calc(' + ABAJO + 'px + env(safe-area-inset-bottom,0px));z-index:99980;display:none;align-items:center;gap:6px;' +
      'padding:8px 13px;border-radius:999px;border:1px solid rgba(255,215,120,.65);background:rgba(12,14,24,.82);color:#ffe7a8;' +
      'font:700 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.45);' +
      '-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .2s ease,background-color .2s ease}' +
    '.sg-btn:hover{transform:translateY(-2px);background:rgba(30,26,12,.92)}' +
    '.sg-btn:focus-visible,.sg-caja :focus-visible{outline:3px solid #ffe066;outline-offset:2px}' +
    '.sg-fondo{position:fixed;inset:0;z-index:99996;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(5,8,20,.72)}' +
    '.sg-fondo.abierto{display:flex}' +
    '.sg-caja{width:min(440px,100%);max-height:calc(100dvh - 32px);overflow:auto;padding:22px 20px 18px;border-radius:18px;color:#f3f0e8;' +
      'background:linear-gradient(160deg,#1b2136,#0d1120);border:1px solid rgba(255,215,120,.35);box-shadow:0 30px 80px rgba(0,0,0,.6);' +
      'font:400 15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;animation:sgEntra .25s ease}' +
    '@keyframes sgEntra{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
    '.sg-caja h2{margin:0 0 4px;font-size:21px;color:#ffd77a}' +
    '.sg-caja p.sg-intro{margin:0 0 14px;color:#c9c4b8;font-size:14px}' +
    '.sg-caja label{display:block;margin:10px 0 5px;font-weight:600;font-size:14px}' +
    '.sg-caja label small{font-weight:400;color:#a9a397}' +
    '.sg-caja select,.sg-caja textarea,.sg-caja input[type=text]{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:12px;' +
      'border:1px solid rgba(255,255,255,.18);background:rgba(0,0,0,.35);color:#fff;font:inherit}' +
    '.sg-caja textarea{min-height:120px;resize:vertical}' +
    '.sg-cont{display:block;text-align:right;font-size:12px;color:#a9a397;margin-top:3px}' +
    '.sg-trampa{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}' +
    '.sg-acciones{display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}' +
    '.sg-acciones button{padding:11px 18px;border-radius:999px;font-weight:700;font-size:15px;line-height:1;font-family:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff}' +
    '.sg-enviar{background:linear-gradient(135deg,#ffe08a,#f4b73f)!important;color:#1a1205!important;border-color:transparent!important;box-shadow:0 8px 22px -8px rgba(244,183,63,.8)}' +
    '.sg-enviar[disabled]{opacity:.6;cursor:wait}' +
    '.sg-estado{margin:12px 0 0;font-size:14px;min-height:1em}' +
    '.sg-estado.ok{color:#7ef0b4}.sg-estado.mal{color:#ff9a9a}' +
    '@media (prefers-reduced-motion:reduce){.sg-caja{animation:none}.sg-btn{transition:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'sg-btn';
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = '<span aria-hidden="true">💬</span> Sugerencias';

  var fondo = document.createElement('div');
  fondo.className = 'sg-fondo';
  fondo.innerHTML =
    '<div class="sg-caja" role="dialog" aria-modal="true" aria-labelledby="sg-titulo">' +
      '<h2 id="sg-titulo">💬 Sugerencias y quejas</h2>' +
      '<p class="sg-intro">Escríbenos lo que quieras: una idea, una queja o un error que encontraste. Tu mensaje llega directamente al creador.</p>' +
      '<form novalidate>' +
        '<label for="sg-tipo">Tipo de mensaje</label>' +
        '<select id="sg-tipo"><option>Sugerencia</option><option>Queja</option><option>Error en el juego o el sitio</option><option>Felicitación</option><option>Otro</option></select>' +
        '<label for="sg-msg">Tu mensaje</label>' +
        '<textarea id="sg-msg" maxlength="1000" required></textarea>' +
        '<span class="sg-cont" id="sg-cont">0 / 1000</span>' +
        '<label for="sg-nombre">Tu nombre <small>(opcional)</small></label>' +
        '<input type="text" id="sg-nombre" maxlength="60" autocomplete="name">' +
        '<label for="sg-contacto">WhatsApp o correo para responderte <small>(opcional)</small></label>' +
        '<input type="text" id="sg-contacto" maxlength="80" autocomplete="email">' +
        '<input type="checkbox" class="sg-trampa" name="botcheck" tabindex="-1" aria-hidden="true">' +
        '<p class="sg-estado" id="sg-estado" role="status"></p>' +
        '<div class="sg-acciones"><button type="button" class="sg-cerrar">Cancelar</button><button type="submit" class="sg-enviar">Enviar</button></div>' +
      '</form>' +
    '</div>';

  var $ = function (s) { return fondo.querySelector(s); };
  var anterior = null;
  function abrir() {
    anterior = document.activeElement;
    fondo.classList.add('abierto');
    $('#sg-estado').textContent = ''; $('#sg-estado').className = 'sg-estado';
    setTimeout(function () { $('#sg-msg').focus(); }, 30);
  }
  function cerrar() {
    fondo.classList.remove('abierto');
    if (anterior && anterior.focus) try { anterior.focus(); } catch (e) {}
  }
  btn.addEventListener('click', abrir);
  $('.sg-cerrar').addEventListener('click', cerrar);
  fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
  fondo.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
    if (e.key === 'Tab') { // el foco se queda dentro del cuadro
      var f = fondo.querySelectorAll('select,textarea,input[type=text],button'); var a = f[0], z = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    }
    e.stopPropagation(); // que las teclas no muevan el juego mientras se escribe
  });
  fondo.addEventListener('keyup', function (e) { e.stopPropagation(); });
  $('#sg-msg').addEventListener('input', function () { $('#sg-cont').textContent = this.value.length + ' / 1000'; });

  $('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var estado = $('#sg-estado'), msg = $('#sg-msg').value.trim();
    if (msg.length < 5) { estado.className = 'sg-estado mal'; estado.textContent = 'Escribe tu mensaje (al menos 5 letras).'; $('#sg-msg').focus(); return; }
    if ($('.sg-trampa').checked) { cerrar(); return; } // robot
    if (!CLAVE) { estado.className = 'sg-estado mal'; estado.textContent = 'Modo de prueba: falta la clave de Web3Forms, el mensaje no se envió.'; return; }
    var tipo = $('#sg-tipo').value, enviar = $('.sg-enviar');
    enviar.disabled = true; enviar.textContent = 'Enviando…';
    estado.className = 'sg-estado'; estado.textContent = '';
    fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: CLAVE,
        subject: tipo + ' – ' + ORIGEN,
        from_name: $('#sg-nombre').value.trim() || 'Visitante',
        'Tipo': tipo,
        'Mensaje': msg,
        'Nombre': $('#sg-nombre').value.trim() || '(no lo puso)',
        'Contacto': $('#sg-contacto').value.trim() || '(no lo puso)',
        'Enviado desde': ORIGEN + ' – ' + location.href.split('?')[0],
        'Equipo': navigator.userAgent
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.success) throw new Error((j && j.message) || 'error');
      estado.className = 'sg-estado ok'; estado.textContent = '✅ ¡Gracias! Tu mensaje fue enviado. Dios te bendiga.';
      $('#sg-msg').value = ''; $('#sg-cont').textContent = '0 / 1000';
      setTimeout(cerrar, 2600);
    }).catch(function () {
      estado.className = 'sg-estado mal'; estado.textContent = 'No se pudo enviar. Revisa tu conexión a internet e inténtalo otra vez.';
    }).then(function () { enviar.disabled = false; enviar.textContent = 'Enviar'; });
  });

  /* ---- Mostrar el botón solo en las pantallas indicadas (menús), no mientras se juega ---- */
  function visible(sel) {
    var el = document.querySelector(sel); if (!el) return false;
    var cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (el.classList.contains('hidden')) return false;
    var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  }
  var mostrar = function () { return !PANTALLAS.length || PANTALLAS.some(visible); };
  function montar() {
    document.body.appendChild(btn); document.body.appendChild(fondo);
    var revisar = function () { btn.style.display = mostrar() ? 'inline-flex' : 'none'; };
    revisar(); if (PANTALLAS.length) setInterval(revisar, 700);
  }
  if (document.body) montar(); else document.addEventListener('DOMContentLoaded', montar);
})();
