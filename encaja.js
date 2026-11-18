/* Encajar la pantalla de juego (Desafío Bíblico RD 1 y 2)
 * Hace que la pregunta y las 4 respuestas se vean completas en la pantalla, aunque no esté en
 * pantalla completa (con la barra del navegador visible). Si no caben, la tarjeta del juego se
 * reduce un poco (sin deformarse) hasta que quepa todo; nunca deja respuestas escondidas abajo.
 * Uso: <script src="../encaja.js" data-panel="#screen-play > .panel"></script>
 */
(function () {
  'use strict';
  var me = document.currentScript;
  var SEL = (me && me.getAttribute('data-panel')) || '#screen-play > .panel';
  var MIN = 0.55, MARGEN = 8;
  var puedeZoom = window.CSS && CSS.supports && CSS.supports('zoom', '0.5');
  var pend = 0;

  function alto() { return (window.visualViewport && visualViewport.height) || innerHeight; }
  function encajar() {
    pend = 0;
    var p = document.querySelector(SEL);
    if (!p || !p.getClientRects().length) return;
    // medir a tamaño normal
    if (puedeZoom) p.style.zoom = ''; else { p.style.transform = ''; p.style.marginBottom = ''; }
    var r = p.getBoundingClientRect(), top = r.top + (window.scrollY || 0);
    var disponible = alto() - Math.max(0, top) - MARGEN, h = p.scrollHeight || r.height;
    if (h <= disponible || disponible < 120) return;
    var s = Math.max(MIN, Math.floor((disponible / h) * 100) / 100);
    if (puedeZoom) p.style.zoom = String(s);
    else { p.style.transformOrigin = 'top center'; p.style.transform = 'scale(' + s + ')'; p.style.marginBottom = (-(1 - s) * h) + 'px'; }
    if (window.scrollY) window.scrollTo(0, 0);
  }
  function pedir() { if (!pend) pend = requestAnimationFrame(encajar); }

  addEventListener('resize', pedir);
  if (window.visualViewport) visualViewport.addEventListener('resize', pedir);
  addEventListener('orientationchange', function () { setTimeout(pedir, 300); });
  addEventListener('hashchange', function () { setTimeout(pedir, 60); });
  document.addEventListener('fullscreenchange', function () { setTimeout(pedir, 200); });
  // cada vez que cambia la pregunta o las respuestas, volver a medir
  function observar() {
    var p = document.querySelector(SEL);
    if (!p || !window.MutationObserver) return;
    new MutationObserver(pedir).observe(p, { childList: true, subtree: true, characterData: true });
    var sc = p.closest('.screen');
    if (sc) new MutationObserver(pedir).observe(sc, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { observar(); pedir(); });
  else { observar(); pedir(); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(pedir);
})();
