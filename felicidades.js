/* =========================================================
   Portada de FELICIDADES al aprobar todos los niveles
   (BIBLIXIA, BIBLIXIA 2, BIBLIXIA 3, Desafío Bíblico RD y Desafío Bíblico RD 2)

   Uso:  window.Felicidades.mostrar({
           juego: 'BIBLIXIA',                       // nombre del juego
           titulo: '¡Has aprobado todos los niveles!', // opcional
           niveles: ['Básico', 'Intermedio', ...],  // opcional: insignias que aparecen una a una
           texto: 'Recogiste todas las monedas…',    // opcional
           jugador: 'DAVID',                        // opcional
           siguiente: { nombre: 'BIBLIXIA 2', url: 'https://…' }, // opcional: botón al siguiente juego
           sonido: true,                            // opcional: fanfarria corta
           alCerrar: function () {}                 // opcional
         });
   Liviano: solo CSS y un lienzo pequeño de confeti que se apaga solo (sirve en celulares viejos).
   © Luis David Esteban García · MIPROAA
   ========================================================= */
(function () {
  'use strict'; // archivo en UTF-8 (las páginas lo cargan con <meta charset="utf-8">)
  if (window.Felicidades) return;
  var CSS = '' +
    '.flc{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;overflow:hidden;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#fff;' +
      'background:radial-gradient(ellipse at 50% 38%,#1d3f8f 0%,#0b1d4a 45%,#040b1f 100%);opacity:0;transition:opacity .45s ease;-webkit-tap-highlight-color:transparent}' +
    '.flc.on{opacity:1}.flc.off{opacity:0;pointer-events:none}' +
    '.flc-rays{position:absolute;left:50%;top:40%;width:220vmax;height:220vmax;margin:-110vmax 0 0 -110vmax;opacity:.55;' +
      'background:repeating-conic-gradient(from 0deg,rgba(255,211,77,.20) 0deg 7deg,rgba(255,211,77,0) 7deg 20deg);animation:flcSpin 26s linear infinite;will-change:transform}' +
    '.flc-glow{position:absolute;left:50%;top:40%;width:80vmin;height:80vmin;margin:-40vmin 0 0 -40vmin;border-radius:50%;' +
      'background:radial-gradient(circle,rgba(255,214,90,.55),rgba(255,140,40,.18) 45%,transparent 70%);animation:flcPulse 2.2s ease-in-out infinite}' +
    '.flc canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}' +
    '.flc-in{position:relative;width:min(560px,92vw);max-height:94vh;overflow:auto;text-align:center;padding:22px 18px 18px;border-radius:28px;' +
      'background:linear-gradient(160deg,rgba(255,255,255,.12),rgba(255,255,255,.03));border:1px solid rgba(255,211,77,.55);' +
      'box-shadow:0 0 0 1px rgba(255,255,255,.06) inset,0 20px 70px rgba(0,0,0,.55),0 0 60px rgba(255,190,60,.25);' +
      'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);animation:flcPop .7s cubic-bezier(.2,1.4,.4,1) both}' +
    '.flc-game{display:inline-block;padding:5px 14px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;' +
      'background:rgba(255,211,77,.14);border:1px solid rgba(255,211,77,.5);color:#ffe08a}' +
    '.flc-cup{position:relative;width:118px;height:118px;margin:12px auto 4px;display:flex;align-items:center;justify-content:center}' +
    '.flc-cup b{font-size:78px;line-height:1;filter:drop-shadow(0 6px 18px rgba(255,190,40,.7));animation:flcBounce 1.6s ease-in-out infinite;display:block}' +
    '.flc-cup i{position:absolute;inset:0;border-radius:50%;border:3px solid rgba(255,211,77,.8);animation:flcRing 2s ease-out infinite}' +
    '.flc-cup i:nth-child(2){animation-delay:.66s}.flc-cup i:nth-child(3){animation-delay:1.33s}' +
    '.flc-t{margin:4px 0 2px;font-size:clamp(34px,9.5vw,60px);font-weight:900;letter-spacing:.02em;line-height:1.05;white-space:nowrap}' +
    '.flc-t span{display:inline-block;background:linear-gradient(180deg,#fff6c9 0%,#ffd34d 45%,#ff9a2e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;' +
      'filter:drop-shadow(0 3px 0 rgba(120,60,0,.55));animation:flcDrop .6s cubic-bezier(.2,1.6,.4,1) both,flcWave 2.4s ease-in-out infinite}' +
    '.flc-s{margin:6px 0 4px;font-size:clamp(17px,4.6vw,23px);font-weight:800;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.5);animation:flcUp .6s .9s both}' +
    '.flc-p{margin:2px 0 8px;font-size:15px;color:#cfe0ff;animation:flcUp .6s 1.05s both}' +
    '.flc-lv{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin:10px 0 6px}' +
    '.flc-lv span{padding:6px 11px;border-radius:12px;font-size:13px;font-weight:800;background:rgba(95,224,138,.16);border:1px solid rgba(95,224,138,.6);color:#c9ffd9;animation:flcBadge .5s both}' +
    '.flc-v{margin:10px 6px 12px;font-size:14px;font-style:italic;color:#ffe9a8;line-height:1.45;animation:flcUp .6s 1.3s both}' +
    '.flc-v small{display:block;font-style:normal;opacity:.8;margin-top:2px}' +
    '.flc-b{display:flex;flex-direction:column;gap:9px;align-items:center;animation:flcUp .6s 1.5s both}' +
    '.flc-b a,.flc-b button{display:block;width:min(320px,86%);padding:13px 16px;border-radius:14px;font:800 16px system-ui,sans-serif;cursor:pointer;text-decoration:none;border:0;box-sizing:border-box}' +
    '.flc-go{background:linear-gradient(180deg,#ffe27a,#f4b72f);color:#2a1900;box-shadow:0 6px 0 #a8720e,0 10px 24px rgba(244,183,47,.45);animation:flcBeat 1.4s ease-in-out infinite}' +
    '.flc-ok{background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.35)!important}' +
    '.flc-b a:active,.flc-b button:active{transform:translateY(3px)}' +
    '@keyframes flcSpin{to{transform:rotate(360deg)}}' +
    '@keyframes flcPulse{0%,100%{transform:scale(.9);opacity:.75}50%{transform:scale(1.12);opacity:1}}' +
    '@keyframes flcPop{0%{transform:scale(.4) rotate(-6deg);opacity:0}100%{transform:none;opacity:1}}' +
    '@keyframes flcBounce{0%,100%{transform:translateY(0) rotate(-4deg) scale(1)}50%{transform:translateY(-12px) rotate(4deg) scale(1.08)}}' +
    '@keyframes flcRing{0%{transform:scale(.5);opacity:1}100%{transform:scale(1.9);opacity:0}}' +
    '@keyframes flcDrop{0%{transform:translateY(-90px) scale(.3) rotate(-20deg);opacity:0}100%{transform:none;opacity:1}}' +
    '@keyframes flcWave{0%,100%{translate:0 0}50%{translate:0 -5px}}' +
    '@keyframes flcUp{0%{transform:translateY(18px);opacity:0}100%{transform:none;opacity:1}}' +
    '@keyframes flcBadge{0%{transform:scale(0) rotate(-12deg);opacity:0}70%{transform:scale(1.15)}100%{transform:none;opacity:1}}' +
    '@keyframes flcBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}' +
    '@media (prefers-reduced-motion:reduce){.flc *{animation:none!important}.flc-rays{display:none}}' +
    '@media (max-height:560px){.flc-cup{width:56px;height:56px;margin:2px auto 0}.flc-cup b{font-size:40px}.flc-t{font-size:min(9.5vw,13vh)}.flc-s{margin:2px 0}.flc-p{margin:0 0 4px;font-size:13px}.flc-lv{margin:6px 0 4px}.flc-lv span{padding:4px 9px;font-size:12px}.flc-v{display:none}.flc-in{padding:10px 14px 12px}.flc-b{flex-direction:row;justify-content:center}.flc-b a,.flc-b button{width:auto;flex:1;max-width:260px;padding:10px 12px}}';

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var abierta = null;

  function fanfarria() {
    try {
      var C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      var ac = new C(), t0 = ac.currentTime + .05, g = ac.createGain();
      g.gain.value = .16; g.connect(ac.destination);
      // Do-Mi-Sol-Do (arriba) y un acorde final brillante
      [[523.25, 0, .16], [659.25, .16, .16], [783.99, .32, .16], [1046.5, .48, .5], [783.99, .48, .5], [659.25, .48, .5]].forEach(function (n) {
        var o = ac.createOscillator(), e = ac.createGain();
        o.type = 'triangle'; o.frequency.value = n[0];
        e.gain.setValueAtTime(0, t0 + n[1]); e.gain.linearRampToValueAtTime(1, t0 + n[1] + .02); e.gain.exponentialRampToValueAtTime(.001, t0 + n[1] + n[2] + .35);
        o.connect(e); e.connect(g); o.start(t0 + n[1]); o.stop(t0 + n[1] + n[2] + .4);
      });
      setTimeout(function () { try { ac.close(); } catch (e) {} }, 2500);
    } catch (e) {}
  }

  function confeti(cv) {
    var ctx = cv.getContext('2d'); if (!ctx) return function () {};
    var pocos = (navigator.hardwareConcurrency || 4) <= 4 || (navigator.deviceMemory || 4) <= 2;
    var dpr = Math.min(window.devicePixelRatio || 1, pocos ? 1 : 1.5), W = 0, H = 0, P = [], vivo = true, t0 = performance.now(), last = t0;
    var COL = ['#ffd34d', '#ff9a2e', '#ffffff', '#5fe08a', '#4db5ff', '#ff5e7a', '#ce1126', '#002d62'];
    function size() { W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    size(); window.addEventListener('resize', size);
    function nuevo(x, y, fuerza) {
      var a = Math.random() * Math.PI * 2, v = (fuerza || 1) * (180 + Math.random() * 420);
      P.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 260, r: Math.random() * 6.28, vr: (Math.random() - .5) * 12,
        w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, c: COL[(Math.random() * COL.length) | 0], s: Math.random() < .22, vida: 3 + Math.random() * 2.5 });
    }
    function estallido(x, y, n) { for (var i = 0; i < n; i++) nuevo(x, y, .7 + Math.random() * .6); }
    estallido(W / 2, H * .38, pocos ? 70 : 130);
    var lluvia = 0, fuegos = 0, MAX = pocos ? 160 : 300;
    function cuadro(now) {
      if (!vivo) return;
      var dt = Math.min(.05, (now - last) / 1000), edad = (now - t0) / 1000; last = now;
      // lluvia de confeti desde arriba durante 7 s y estallidos tipo fuegos artificiales
      if (edad < 7) {
        lluvia += dt * (pocos ? 26 : 50);
        while (lluvia > 1 && P.length < MAX) { lluvia--; P.push({ x: Math.random() * W, y: -12, vx: (Math.random() - .5) * 60, vy: 40 + Math.random() * 90, r: Math.random() * 6.28, vr: (Math.random() - .5) * 8, w: 6 + Math.random() * 7, h: 4 + Math.random() * 5, c: COL[(Math.random() * COL.length) | 0], s: false, vida: 6 }); }
        fuegos -= dt; if (fuegos <= 0 && P.length < MAX) { fuegos = .9 + Math.random() * .6; estallido(W * (.15 + Math.random() * .7), H * (.15 + Math.random() * .35), pocos ? 30 : 55); }
      }
      ctx.clearRect(0, 0, W, H);
      for (var i = P.length - 1; i >= 0; i--) {
        var p = P[i]; p.vida -= dt;
        if (p.vida <= 0 || p.y > H + 30) { P.splice(i, 1); continue; }
        p.vx *= .985; p.vy = p.vy * .985 + 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        ctx.globalAlpha = Math.min(1, p.vida);
        if (p.s) { // destello
          ctx.fillStyle = '#fff6c9'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.2, 0, 6.28); ctx.fill();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(1, Math.abs(Math.cos(p.r * 1.7)) + .15);
          ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
      if (edad < 7 || P.length) requestAnimationFrame(cuadro); else ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(cuadro);
    return function (x, y) { if (x === undefined) { vivo = false; window.removeEventListener('resize', size); } else { estallido(x, y, pocos ? 25 : 45); if (!vivo) return; } };
  }

  function mostrar(o) {
    o = o || {};
    if (abierta) cerrar();
    if (!document.getElementById('flcCss')) { var st = document.createElement('style'); st.id = 'flcCss'; st.textContent = CSS; document.head.appendChild(st); }
    var titulo = '¡FELICIDADES!', letras = '';
    for (var i = 0; i < titulo.length; i++) letras += '<span style="animation-delay:' + (.25 + i * .06).toFixed(2) + 's,' + (1.2 + i * .08).toFixed(2) + 's">' + esc(titulo[i]) + '</span>';
    var niveles = (o.niveles || []).map(function (n, k) { return '<span style="animation-delay:' + (1.2 + k * .18).toFixed(2) + 's">✅ ' + esc(n) + '</span>'; }).join('');
    var el = document.createElement('div');
    el.className = 'flc'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '¡Felicidades! ' + (o.titulo || 'Has aprobado todos los niveles'));
    el.innerHTML = '<div class="flc-rays"></div><div class="flc-glow"></div><canvas></canvas>' +
      '<div class="flc-in">' +
        (o.juego ? '<div class="flc-game">' + esc(o.juego) + '</div>' : '') +
        '<div class="flc-cup"><i></i><i></i><i></i><b>🏆</b></div>' +
        '<h2 class="flc-t">' + letras + '</h2>' +
        '<p class="flc-s">' + esc(o.titulo || '¡Has aprobado todos los niveles!') + '</p>' +
        (o.jugador || o.texto ? '<p class="flc-p">' + (o.jugador ? '👏 <b>' + esc(o.jugador) + '</b>' + (o.texto ? ' · ' : '') : '') + esc(o.texto || '') + '</p>' : '') +
        (niveles ? '<div class="flc-lv">' + niveles + '</div>' : '') +
        '<p class="flc-v">«He peleado la buena batalla, he terminado la carrera, he guardado la fe.»<small>2 Timoteo 4:7 (LBLA)</small></p>' +
        '<div class="flc-b">' +
          (o.siguiente && o.siguiente.url ? '<a class="flc-go" href="' + esc(o.siguiente.url) + '" rel="noopener">▶ Jugar ' + esc(o.siguiente.nombre || 'el siguiente juego') + '</a>' : '') +
          '<button type="button" class="' + (o.siguiente && o.siguiente.url ? 'flc-ok' : 'flc-go') + '" data-flc-cerrar>Continuar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fx = reduce ? function () {} : confeti(el.querySelector('canvas'));
    // tocar la pantalla lanza más confeti
    el.addEventListener('pointerdown', function (e) { if (!e.target.closest('a,button')) fx(e.clientX, e.clientY); });
    el.querySelector('[data-flc-cerrar]').addEventListener('click', cerrar);
    var tecla = function (e) { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', tecla);
    abierta = { el: el, fx: fx, tecla: tecla, alCerrar: o.alCerrar };
    requestAnimationFrame(function () { el.classList.add('on'); });
    if (o.sonido !== false) fanfarria();
    try { if (navigator.vibrate) navigator.vibrate([60, 40, 60, 40, 160]); } catch (e) {}
    setTimeout(function () { var b = el.querySelector('.flc-b a, .flc-b button'); if (b) try { b.focus({ preventScroll: true }); } catch (e) {} }, 1600);
    return el;
  }

  function cerrar() {
    if (!abierta) return;
    var a = abierta; abierta = null;
    a.fx(); document.removeEventListener('keydown', a.tecla);
    a.el.classList.add('off');
    setTimeout(function () { if (a.el.parentNode) a.el.parentNode.removeChild(a.el); }, 500);
    if (typeof a.alCerrar === 'function') try { a.alCerrar(); } catch (e) {}
  }

  window.Felicidades = { mostrar: mostrar, cerrar: cerrar };
})();
