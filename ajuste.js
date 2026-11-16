/* Ajuste a la pantalla (pantalla completa incluida)
 * Hace que los menús quepan completos en la pantalla para que ningún botón se vea cortado.
 * Si el contenido no cabe, lo reduce un poco (sin deformarlo); si aun así no cabe, se puede desplazar.
 * Uso: <script src="ajuste.js" data-ajuste="CONTENEDOR => HIJOS => HASTA ; ..."></script>
 *   CONTENEDOR: la caja visible que tiene el contenido (la pantalla o el panel)
 *   HIJOS (opcional): lo que se reduce; por defecto, sus hijos directos
 *   HASTA (opcional): lo que como mínimo debe verse completo sin desplazar; por defecto, todo
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var spec = (me && me.getAttribute('data-ajuste')) || '';
  var barSel = (me && me.getAttribute('data-barra')) || '.topbar';
  var reglas = spec.split(';').map(function (r) {
    var p = r.split('=>').map(function (s) { return s.trim(); });
    return p[0] ? { caja: p[0], hijos: p[1] || '', hasta: p[2] || '' } : null;
  }).filter(Boolean);
  var root = document.documentElement;
  var puedeZoom = window.CSS && CSS.supports && CSS.supports('zoom', '0.5');

  function visible(el) { return el.getClientRects().length > 0; }
  function enFlujo(el) {
    var cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
  }
  function minimo() {
    // En celular vertical se prefiere desplazar antes que achicar demasiado las letras
    return (innerWidth < 600 && innerHeight > innerWidth) ? 0.86 : 0.62;
  }

  function medirBarra() {
    var h = 0;
    document.querySelectorAll(barSel).forEach(function (b) { if (visible(b)) h = Math.max(h, b.getBoundingClientRect().bottom); });
    root.style.setProperty('--tb-h', Math.round(h) + 'px');
  }

  function ajustar(regla) {
    document.querySelectorAll(regla.caja).forEach(function (caja) {
      if (!visible(caja)) return;
      var hijos = regla.hijos ? [].slice.call(caja.querySelectorAll(regla.hijos)) : [].slice.call(caja.children);
      hijos = hijos.filter(function (h) { return visible(h) && enFlujo(h); });
      if (!hijos.length) return;
      hijos.forEach(function (h) { h.style.zoom = ''; });
      if (!puedeZoom) return;
      var cs = getComputedStyle(caja);
      var padB = parseFloat(cs.paddingBottom) || 0;
      var fin = (regla.hasta && caja.querySelector(regla.hasta)) || hijos[hijos.length - 1];
      var z = 1, min = minimo();
      for (var i = 0; i < 6; i++) {
        var rc = caja.getBoundingClientRect();
        var bar = parseFloat(root.style.getPropertyValue('--tb-h')) || 0;
        var arriba = Math.max(rc.top, 0);
        var limite = Math.min(rc.top + caja.clientHeight, innerHeight) - (fin === hijos[hijos.length - 1] ? padB : 14);
        var rf = fin.getBoundingClientRect();
        var r0 = hijos[0].getBoundingClientRect();
        var mb = parseFloat(getComputedStyle(fin).marginBottom) || 0;
        var abajo = rf.bottom + mb + caja.scrollTop;
        var sobra = abajo - limite;                       // lo que se sale por abajo
        var tapa = Math.max(0, Math.max(arriba, bar) - (r0.top + caja.scrollTop) - 2); // lo tapado arriba
        if (tapa > 0 && caja.scrollHeight <= caja.clientHeight + 1) sobra = Math.max(sobra, tapa);
        if (sobra <= 1) break;
        var alto = rf.bottom - r0.top;
        if (alto <= 0) break;
        var nz = Math.max(min, z * (alto - sobra) / alto);
        if (Math.abs(nz - z) < 0.004) break;
        z = nz;
        hijos.forEach(function (h) { h.style.zoom = z.toFixed(3); });
        if (z <= min) break;
      }
    });
  }

  var t = 0, pend = false;
  function todo() {
    pend = false; t = Date.now();
    try { medirBarra(); reglas.forEach(ajustar); } catch (e) { /* nunca romper el juego */ }
  }
  function pronto() {
    if (pend) return;
    pend = true;
    setTimeout(function () { requestAnimationFrame(todo); }, Math.max(60, 220 - (Date.now() - t)));
  }

  ['resize', 'orientationchange', 'load', 'pageshow'].forEach(function (ev) { addEventListener(ev, pronto); });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) {
    document.addEventListener(ev, function () { pronto(); setTimeout(pronto, 350); setTimeout(pronto, 900); });
  });
  if (window.visualViewport) visualViewport.addEventListener('resize', pronto);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pronto);
  function iniciar() {
    pronto();
    new MutationObserver(pronto).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden'] });
    // Las animaciones de entrada cambian tamaños durante unos segundos
    [600, 1500, 3000].forEach(function (ms) { setTimeout(pronto, ms); });
  }
  if (document.body) iniciar(); else document.addEventListener('DOMContentLoaded', iniciar);
})();
