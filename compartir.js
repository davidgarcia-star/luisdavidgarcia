/* Botón «Compartir» para los juegos de Luis David Esteban García (MIPROAA)
 * El MISMO archivo va en BIBLIXIA, BIBLIXIA 2, BIBLIXIA 3, Desafío Bíblico RD y Desafío Bíblico RD 2.
 * En el celular abre el menú de compartir del teléfono; si no lo tiene (o en la computadora),
 * muestra opciones: WhatsApp, Facebook, Telegram, X y Copiar enlace.
 * Uso:
 *   <script src="compartir.js" data-titulo="BIBLIXIA 2" data-url="https://..." data-despues="#btnWeb"
 *           data-clase="chip"></script>
 *   data-despues: el botón se pone justo después de ese elemento (o data-en: se agrega dentro de él)
 *   data-clase:   clases del botón para que se vea igual que los demás de la barra
 */
(function () {
  'use strict';
  var me = document.currentScript; if (!me) return;
  var at = function (k, d) { return me.getAttribute('data-' + k) || d; };
  var TITULO = at('titulo', document.title), URL_ = at('url', location.origin + location.pathname);
  var TEXTO = at('texto', '🎮 ¡Juega ' + TITULO + ', un juego bíblico gratis! Aprende la Biblia jugando:');
  var css = '' +
    '.shr-ov{position:fixed;inset:0;z-index:99996;background:rgba(5,8,20,.6);display:none;align-items:flex-start;justify-content:center;padding:70px 14px 14px}' +
    '.shr-ov.on{display:flex}.shr-box{width:100%;max-width:340px;background:#141a33;color:#eef1ff;border:1px solid rgba(255,215,120,.45);border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:15px/1.4 system-ui,sans-serif}' +
    '.shr-box h3{margin:0 0 4px;font-size:18px;color:#ffd778}.shr-box p{margin:0 0 12px;font-size:13px;color:#c9cfee;word-break:break-all}' +
    '.shr-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.shr-grid a,.shr-grid button{display:flex;align-items:center;justify-content:center;gap:6px;padding:11px 8px;border-radius:12px;border:1px solid #3a4475;background:#1b2350;color:#fff;font:inherit;font-weight:700;font-size:14px;text-decoration:none;cursor:pointer}' +
    '.shr-grid .wa{background:#1f8f4f;border-color:#2fbf71}.shr-grid .fb{background:#1d4fa8;border-color:#3e7bff}.shr-grid .cp{grid-column:1/-1;background:linear-gradient(180deg,#ffe08a,#f2b93b);color:#1a1a2e;border:0}' +
    '.shr-x{display:block;width:100%;margin-top:10px;padding:8px;background:none;border:0;color:#aab2dd;font:inherit;text-decoration:underline;cursor:pointer}' +
    '.shr-flot{position:absolute;top:10px;right:10px;z-index:5;padding:8px 13px;border-radius:999px;border:1px solid rgba(255,215,120,.6);background:rgba(18,22,40,.82);color:#fff;font:700 14px system-ui,sans-serif;cursor:pointer}' +
    '@media (max-width:600px){.shr-flot{top:6px;right:6px;padding:7px 10px;font-size:16px}.shr-flot span{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var b = document.createElement('button'); b.type = 'button';
  b.className = at('clase', 'shr-flot'); b.title = 'Compartir el enlace del juego'; b.setAttribute('aria-label', 'Compartir el juego');
  b.innerHTML = '📤 <span class="' + at('clase-texto', 'chip-lbl') + '">Compartir</span>';
  function poner() {
    var ref = at('despues', ''), dentro = at('en', '');
    var r = ref && document.querySelector(ref), d = dentro && document.querySelector(dentro);
    if (r && r.parentNode) r.parentNode.insertBefore(b, r.nextSibling);
    else if (d) d.appendChild(b);
    else { b.className = 'shr-flot'; b.style.position = 'fixed'; document.body.appendChild(b); }
  }

  var ov = document.createElement('div'); ov.className = 'shr-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Compartir');
  var t = encodeURIComponent(TEXTO + ' ' + URL_), u = encodeURIComponent(URL_);
  ov.innerHTML = '<div class="shr-box"><h3>📤 Compartir ' + TITULO.replace(/</g, '&lt;') + '</h3><p>' + URL_ + '</p><div class="shr-grid">' +
    '<a class="wa" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + t + '">💬 WhatsApp</a>' +
    '<a class="fb" target="_blank" rel="noopener noreferrer" href="https://www.facebook.com/sharer/sharer.php?u=' + u + '">👍 Facebook</a>' +
    '<a target="_blank" rel="noopener noreferrer" href="https://t.me/share/url?url=' + u + '&text=' + encodeURIComponent(TEXTO) + '">✈️ Telegram</a>' +
    '<a target="_blank" rel="noopener noreferrer" href="https://twitter.com/intent/tweet?text=' + t + '">✖️ X</a>' +
    '<button class="cp" type="button">📋 Copiar enlace</button></div><button class="shr-x" type="button">Cerrar</button></div>';
  var cerrar = function () { ov.classList.remove('on'); };
  ov.addEventListener('click', function (e) { if (e.target === ov || e.target.classList.contains('shr-x')) cerrar(); else if (e.target.closest('a')) setTimeout(cerrar, 300); });
  ov.querySelector('.cp').onclick = function () {
    var btn = this, ok = function () { btn.textContent = '✅ ¡Enlace copiado!'; setTimeout(function () { btn.textContent = '📋 Copiar enlace'; }, 1800); };
    var txt = TEXTO + ' ' + URL_;
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, viejo); else viejo();
    function viejo() { var a = document.createElement('textarea'); a.value = txt; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); ok(); } catch (e) {} a.remove(); }
  };
  b.addEventListener('click', function (e) {
    e.stopPropagation();
    try { if (window.Sound && Sound.click) Sound.click(); } catch (er) {}
    if (navigator.share && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) {
      navigator.share({ title: TITULO, text: TEXTO, url: URL_ }).catch(function (er) { if (er && er.name !== 'AbortError') ov.classList.add('on'); });
    } else ov.classList.add('on');
  });
  function iniciar() { poner(); document.body.appendChild(ov); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
