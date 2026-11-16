/* =========================================================
   NAVIDAD – adornos y música navideña de temporada
   Creado para los juegos de Luis David Esteban García · MIPROAA
   - Se activa solo del 1 de noviembre al 9 de enero; desde el 10 de enero se quita sola.
   - Para probar en otra fecha: agrega ?navidad=1 a la dirección (o ?navidad=0 para quitarla).
   - Adornos: nieve suave, gorro navideño en el logo y cartel "¡Feliz Navidad!"
     con versículos (LBLA) en el portal de inicio. (Sin guirnalda arriba para no tapar los iconos.)
   - Música: villancicos tradicionales de dominio público (Noche de paz, Cascabeles,
     Al mundo paz) tocados con Web Audio, sin archivos externos.
   Configuración opcional antes de cargar este archivo:
     window.NAVIDAD_CFG = {
       portal: '#splash',               // dónde va el cartel de Feliz Navidad
       logo: '.sp-logo',                // dónde va el gorro navideño
       jugando: () => false,            // true mientras se juega (oculta nieve y adornos grandes)
       arriba: 0                        // separación de la guirnalda desde arriba (px)
     };
   ========================================================= */
(function () {
  'use strict';
  var hoy = new Date(), mes = hoy.getMonth(), dia = hoy.getDate();
  // Del 1 de noviembre al 9 de enero. Desde el 10 de enero se quita todo lo navideño solo (sin tocar nada)
  var activo = mes === 10 || mes === 11 || (mes === 0 && dia < 10);
  try {
    var q = new URLSearchParams(location.search).get('navidad');
    if (q === '1') activo = true; else if (q === '0') activo = false;
  } catch (e) {}
  var anoNuevo = (mes === 11 && dia >= 26) || (mes === 0 && dia < 10);
  var anio = mes === 0 ? hoy.getFullYear() : hoy.getFullYear() + 1;

  /* ---------------- Música navideña ----------------
     Cada nota: [midi, tiempos]; 0 = silencio. Bajo: [midi, tiempos]. */
  var VILLANCICOS = [
    { nombre: 'Noche de paz', bpm: 150, campanas: false,
      mel: [[67,1.5],[69,.5],[67,1],[64,3],[67,1.5],[69,.5],[67,1],[64,3],[74,2],[74,1],[71,3],[72,2],[72,1],[67,3],
            [69,2],[69,1],[72,1.5],[71,.5],[69,1],[67,1.5],[69,.5],[67,1],[64,3],[69,2],[69,1],[72,1.5],[71,.5],[69,1],[67,1.5],[69,.5],[67,1],[64,3],
            [74,2],[74,1],[77,1.5],[74,.5],[71,1],[72,3],[76,3],[72,1],[67,1],[64,1],[67,1.5],[65,.5],[62,1],[60,6]],
      bajo: [[48,6],[48,6],[43,6],[48,6],[41,6],[48,6],[41,6],[48,6],[43,6],[48,6],[48,3],[43,3],[48,6]] },
    { nombre: 'Cascabeles', bpm: 200, campanas: true,
      mel: [[76,1],[76,1],[76,2],[76,1],[76,1],[76,2],[76,1],[79,1],[72,1.5],[74,.5],[76,4],
            [77,1],[77,1],[77,1.5],[77,.5],[77,1],[76,1],[76,1],[76,.5],[76,.5],[76,1],[74,1],[74,1],[76,1],[74,2],[79,2],
            [76,1],[76,1],[76,2],[76,1],[76,1],[76,2],[76,1],[79,1],[72,1.5],[74,.5],[76,4],
            [77,1],[77,1],[77,1.5],[77,.5],[77,1],[76,1],[76,1],[76,.5],[76,.5],[79,1],[79,1],[77,1],[74,1],[72,4]],
      bajo: [[48,4],[48,4],[48,4],[48,4],[41,4],[48,4],[43,4],[43,4],[48,4],[48,4],[48,4],[48,4],[41,4],[48,4],[43,4],[48,4]] },
    { nombre: 'Al mundo paz', bpm: 120, campanas: false,
      mel: [[72,2],[71,1.5],[69,.5],[67,3],[65,1],[64,2],[62,2],[60,3],[67,1],[69,3],[69,1],[71,3],[71,1],[72,6],[0,1],
            [72,1],[72,1],[71,1],[69,1],[67,1],[67,1.5],[65,.5],[64,1],[72,1],[72,1],[71,1],[69,1],[67,1],[67,1.5],[65,.5],[64,1],
            [64,1],[64,1],[64,1],[64,1],[64,.5],[65,.5],[67,3],[65,.5],[64,.5],[62,1],[62,1],[62,1],[62,.5],[64,.5],[65,3],[64,.5],[62,.5],
            [60,1],[72,2],[69,1],[67,1.5],[65,.5],[64,1],[65,1],[64,2],[62,2],[60,4]],
      bajo: [[48,4],[48,4],[41,2],[43,2],[48,4],[41,4],[43,4],[48,4],[48,4],[48,4],[48,4],[48,4],[48,4],[43,4],[43,4],[48,4],[41,4],[48,2],[43,2],[48,12]] }
  ];

  var hz = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var ruido = null;
  function tono(ctx, dest, f, t, dur, tipo, vol, ataque) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (ataque || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function cascabel(ctx, dest, t, vol) {
    if (!ruido) {
      ruido = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.15), ctx.sampleRate);
      var d = ruido.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = 'bandpass'; f.frequency.value = 9000; f.Q.value = 1.2;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + 0.15);
  }
  // Toca los villancicos en bucle en "dest" (un nodo de ganancia del juego, así respeta su botón de música).
  // Devuelve { id, stop } — id es el setInterval, por si el juego lo detiene con clearInterval.
  function musica(ctx, dest, vol) {
    vol = vol || 1;
    var cancion = Math.floor(Math.random() * VILLANCICOS.length), iM = 0, iB = 0;
    var tM = ctx.currentTime + 0.2, tB = tM, fin = tM, ultimoCasc = tM;
    function avanzar() {
      var v = VILLANCICOS[cancion], b = 60 / v.bpm;
      while (tM < ctx.currentTime + 0.5) {
        if (iM >= v.mel.length) { // siguiente villancico tras una pausa
          cancion = (cancion + 1) % VILLANCICOS.length; iM = 0; iB = 0;
          tM = tB = ultimoCasc = Math.max(tM, tB) + 1.6; v = VILLANCICOS[cancion]; b = 60 / v.bpm; continue;
        }
        var n = v.mel[iM++], d = n[1] * b;
        if (n[0]) {
          // timbre de campanita (celesta): triángulo + brillo una octava arriba
          tono(ctx, dest, hz(n[0]), tM, Math.max(0.35, d * 1.6), 'triangle', 0.09 * vol, 0.01);
          tono(ctx, dest, hz(n[0] + 12), tM, Math.max(0.25, d), 'sine', 0.03 * vol, 0.005);
        }
        tM += d;
      }
      while (iB < v.bajo.length && tB < ctx.currentTime + 0.5) {
        var bn = v.bajo[iB++], bd = bn[1] * b;
        tono(ctx, dest, hz(bn[0]), tB, bd * 0.95, 'sine', 0.08 * vol, 0.04);
        tono(ctx, dest, hz(bn[0] + 16), tB, bd * 0.9, 'sine', 0.018 * vol, 0.3); // colchón suave (tercera)
        tono(ctx, dest, hz(bn[0] + 19), tB, bd * 0.9, 'sine', 0.018 * vol, 0.3);
        tB += bd;
      }
      if (v.campanas) {
        while (ultimoCasc < Math.min(tM, ctx.currentTime + 0.5)) {
          cascabel(ctx, dest, ultimoCasc, 0.05 * vol); cascabel(ctx, dest, ultimoCasc + b / 2, 0.025 * vol);
          ultimoCasc += b;
        }
      } else ultimoCasc = tM;
      fin = tM;
    }
    avanzar();
    var id = setInterval(avanzar, 120);
    return { id: id, stop: function () { clearInterval(id); } };
  }

  window.Navidad = { activo: activo, anoNuevo: anoNuevo, musica: musica, villancicos: VILLANCICOS };
  if (!activo) return;

  /* ---------------- Adornos ---------------- */
  var cfg = window.NAVIDAD_CFG || {};
  var css = '' +
    '.nv-guirnalda{position:fixed;left:0;right:0;top:' + (cfg.arriba || 0) + 'px;height:26px;z-index:9998;pointer-events:none;overflow:hidden}' +
    '.nv-guirnalda svg{width:100%;height:26px;display:block}' +
    '.nv-guirnalda .cable{fill:none;stroke:#1d5e2a;stroke-width:2.5}' +
    '.nv-luz{animation:nvBrilla 1.6s ease-in-out infinite}' +
    '.nv-luz:nth-of-type(3n){animation-delay:.5s}.nv-luz:nth-of-type(3n+1){animation-delay:1s}' +
    '@keyframes nvBrilla{0%,100%{opacity:1}50%{opacity:.35}}' +
    '#nvNieve{position:fixed;inset:0;width:100%;height:100%;z-index:9997;pointer-events:none;transition:opacity .6s}' +
    '.nv-esquina{position:fixed;bottom:6px;z-index:9996;pointer-events:none;font-size:clamp(34px,6vw,60px);filter:drop-shadow(0 4px 8px rgba(0,0,0,.4));transition:opacity .6s}' +
    '.nv-esquina.izq{left:6px}.nv-esquina.der{right:6px}' +
    'body.nv-jugando #nvNieve,body.nv-jugando .nv-esquina{opacity:0}' +
    '.nv-cartel{margin:10px auto 6px;max-width:560px;padding:10px 16px 12px;border-radius:18px;text-align:center;' +
      'background:linear-gradient(180deg,rgba(176,18,36,.92),rgba(120,8,22,.94));border:2px solid #ffd34d;' +
      'box-shadow:0 10px 30px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,.25);color:#fff;position:relative;z-index:2}' +
    '.nv-cartel b{display:block;font-size:clamp(22px,5vw,34px);letter-spacing:.5px;color:#ffe27a;text-shadow:0 2px 0 rgba(0,0,0,.35);' +
      'font-family:Georgia,"Times New Roman",serif;animation:nvLatido 2.4s ease-in-out infinite}' +
    '.nv-cartel p{margin:4px 0 0;font-size:clamp(12px,2.8vw,14px);line-height:1.35;opacity:.95}' +
    '.nv-cartel small{display:block;margin-top:2px;font-size:11px;opacity:.8}' +
    '@keyframes nvLatido{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}' +
    '.nv-gorro{position:absolute;width:62%;max-width:70px;left:50%;top:-30%;transform:translateX(-30%) rotate(18deg);z-index:5;pointer-events:none;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))}' +
    '.nv-esquina.der{pointer-events:auto;cursor:pointer;background:none;border:0;padding:0;line-height:1;font-family:inherit;animation:nvRegalo 3s ease-in-out infinite}' +
    '@keyframes nvRegalo{0%,78%,100%{transform:rotate(0) scale(1)}82%{transform:rotate(-12deg) scale(1.12)}86%{transform:rotate(10deg) scale(1.12)}90%{transform:rotate(-6deg) scale(1.05)}94%{transform:rotate(4deg)}}' +
    '.nv-esquina.der:focus-visible{outline:3px solid #ffd34d;outline-offset:4px;border-radius:12px}' +
    'body.nv-jugando .nv-esquina.der{pointer-events:none}' +
    'html.navidad .sg-btn{bottom:84px!important}' +
    '.nv-rf{position:fixed;inset:0;z-index:99997;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(5,8,20,.72)}' +
    '.nv-rf.on{display:flex}' +
    '.nv-rc{width:100%;max-width:400px;padding:22px 20px 18px;border-radius:22px;text-align:center;color:#fff;font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
      'background:linear-gradient(180deg,#b01224,#78081a);border:2px solid #ffd34d;box-shadow:0 24px 60px rgba(0,0,0,.55);animation:nvAbre .45s cubic-bezier(.2,.9,.3,1.3)}' +
    '@keyframes nvAbre{from{opacity:0;transform:scale(.6) rotate(-6deg)}to{opacity:1;transform:none}}' +
    '.nv-rc .ico{font-size:52px;line-height:1;animation:nvSalta .8s ease}' +
    '@keyframes nvSalta{0%{transform:translateY(20px) scale(.5)}60%{transform:translateY(-10px) scale(1.15)}100%{transform:none}}' +
    '.nv-rc h3{margin:6px 0 10px;font:700 22px/1.2 Georgia,"Times New Roman",serif;color:#ffe27a}' +
    '.nv-rc blockquote{margin:0 0 6px;font:italic 17px/1.5 Georgia,"Times New Roman",serif}' +
    '.nv-rc cite{display:block;font-style:normal;font-weight:700;color:#ffe27a;font-size:14px;margin-bottom:14px}' +
    '.nv-rc .acc{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}' +
    '.nv-rc button{padding:10px 22px;border-radius:999px;border:0;background:linear-gradient(135deg,#ffe08a,#f4c542);color:#5a0a14;font-weight:700;font-size:14px;line-height:1;font-family:inherit;cursor:pointer}' +
    '.nv-rc button:focus-visible{outline:3px solid #fff;outline-offset:2px}' +
    '@media (prefers-reduced-motion:reduce){.nv-luz,.nv-cartel b,.nv-esquina.der,.nv-rc,.nv-rc .ico{animation:none}}';
  var st = document.createElement('style'); st.id = 'nvEstilos'; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  function guirnalda() {
    var w = 1200, n = 30, colores = ['#ff3b3b', '#ffd34d', '#3bd16f', '#3b9dff', '#ff8ad8'];
    var s = '<svg viewBox="0 0 ' + w + ' 26" preserveAspectRatio="none" aria-hidden="true"><path class="cable" d="';
    var seg = w / n;
    for (var i = 0; i < n; i++) s += (i ? '' : 'M0 4 ') + 'Q' + (i * seg + seg / 2) + ' 16 ' + ((i + 1) * seg) + ' 4 ';
    s += '"/>';
    for (var j = 0; j < n; j++) {
      var x = j * seg + seg / 2;
      s += '<rect x="' + (x - 2.5) + '" y="9" width="5" height="4" fill="#2b4d2f"/>' +
           '<ellipse class="nv-luz" cx="' + x + '" cy="17" rx="4.2" ry="6" fill="' + colores[j % colores.length] + '"/>';
    }
    var d = document.createElement('div'); d.className = 'nv-guirnalda'; d.innerHTML = s + '</svg>';
    return d;
  }
  var GORRO = '<svg class="nv-gorro" viewBox="0 0 100 80" aria-hidden="true">' +
    '<path d="M14 62 C22 30 48 6 78 14 C70 26 76 40 86 52 Z" fill="#d6142b"/>' +
    '<path d="M30 40 C42 22 60 14 74 16" stroke="#a50d1f" stroke-width="4" fill="none" opacity=".5"/>' +
    '<rect x="6" y="56" width="84" height="16" rx="8" fill="#fff"/>' +
    '<circle cx="86" cy="54" r="10" fill="#fff"/></svg>';

  function nieve() {
    var cv = document.createElement('canvas'); cv.id = 'nvNieve'; cv.setAttribute('aria-hidden', 'true');
    var cx = cv.getContext('2d'), copos = [], W = 0, H = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    var reducido = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var N = reducido ? 0 : (innerWidth < 700 ? 28 : 50);
    function medir() { W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    medir(); addEventListener('resize', medir);
    for (var i = 0; i < N; i++) copos.push({ x: Math.random() * W, y: Math.random() * H, r: 1 + Math.random() * 2.6, v: 18 + Math.random() * 30, f: Math.random() * 6 });
    var antes = performance.now();
    function cuadro(t) {
      var dt = Math.min(0.05, (t - antes) / 1000); antes = t;
      var jugando = false; try { jugando = !!(cfg.jugando && cfg.jugando()); } catch (e) {}
      document.body.classList.toggle('nv-jugando', jugando);
      if (!jugando && !document.hidden) {
        cx.clearRect(0, 0, W, H); cx.fillStyle = 'rgba(255,255,255,.85)'; cx.beginPath();
        for (var i = 0; i < copos.length; i++) {
          var c = copos[i]; c.y += c.v * dt; c.f += dt; c.x += Math.sin(c.f) * 12 * dt;
          if (c.y > H + 5) { c.y = -5; c.x = Math.random() * W; }
          cx.moveTo(c.x + c.r, c.y); cx.arc(c.x, c.y, c.r, 0, 6.2832);
        }
        cx.fill();
      }
      requestAnimationFrame(cuadro);
    }
    requestAnimationFrame(cuadro);
    return cv;
  }

  function cartel() {
    var d = document.createElement('div'); d.className = 'nv-cartel'; d.setAttribute('role', 'note');
    var verso = '<p>«He aquí, la virgen concebirá y dará a luz un hijo, y le pondrán por nombre Emmanuel, que traducido significa: Dios con nosotros.»</p><small>Mateo 1:23 (LBLA)</small>';
    d.innerHTML = (anoNuevo ? '<b>🎄 ¡Feliz Navidad y próspero ' + anio + '! 🎆</b>' : '<b>🎄 ¡Feliz Navidad! 🎁</b>') + verso;
    return d;
  }

  /* El regalo de la esquina: al tocarlo muestra un versículo bíblico (LBLA) al azar */
  var REGALOS = [
    ['He aquí, la virgen concebirá y dará a luz un hijo, y le pondrán por nombre Emmanuel, que traducido significa: Dios con nosotros.', 'Mateo 1:23'],
    ['Porque os ha nacido hoy, en la ciudad de David, un Salvador, que es Cristo el Señor.', 'Lucas 2:11'],
    ['Gloria a Dios en las alturas, y en la tierra paz entre los hombres en quienes Él se complace.', 'Lucas 2:14'],
    ['Y el Verbo se hizo carne, y habitó entre nosotros, y vimos su gloria, gloria como del unigénito del Padre, lleno de gracia y de verdad.', 'Juan 1:14'],
    ['Porque un niño nos ha nacido, un hijo nos ha sido dado, y la soberanía reposará sobre sus hombros; y se llamará su nombre Admirable Consejero, Dios Poderoso, Padre Eterno, Príncipe de Paz.', 'Isaías 9:6'],
    ['Porque de tal manera amó Dios al mundo, que dio a su Hijo unigénito, para que todo aquel que cree en Él, no se pierda, mas tenga vida eterna.', 'Juan 3:16'],
    ['El SEÑOR es mi pastor, nada me faltará.', 'Salmos 23:1'],
    ['Todo lo puedo en Cristo que me fortalece.', 'Filipenses 4:13'],
    ['Confía en el SEÑOR con todo tu corazón, y no te apoyes en tu propio entendimiento.', 'Proverbios 3:5'],
    ['¡Sé fuerte y valiente! No temas ni te acobardes, porque el SEÑOR tu Dios estará contigo dondequiera que vayas.', 'Josué 1:9'],
    ['Y sabemos que para los que aman a Dios, todas las cosas cooperan para bien, esto es, para los que son llamados conforme a su propósito.', 'Romanos 8:28'],
    ['No temas, porque yo estoy contigo; no te desalientes, porque yo soy tu Dios. Te fortaleceré, ciertamente te ayudaré.', 'Isaías 41:10'],
    ['Dios es nuestro refugio y fortaleza, nuestro pronto auxilio en las tribulaciones.', 'Salmos 46:1'],
    ['Venid a mí, todos los que estáis cansados y cargados, y yo os haré descansar.', 'Mateo 11:28'],
    ['Que las misericordias del SEÑOR jamás terminan, pues nunca fallan sus bondades; son nuevas cada mañana; ¡grande es tu fidelidad!', 'Lamentaciones 3:22-23'],
    ['Porque yo sé los planes que tengo para vosotros —declara el SEÑOR— planes de bienestar y no de calamidad, para daros un futuro y una esperanza.', 'Jeremías 29:11'],
    ['Lámpara es a mis pies tu palabra, y luz para mi camino.', 'Salmos 119:105'],
    ['Pero buscad primero su reino y su justicia, y todas estas cosas os serán añadidas.', 'Mateo 6:33'],
    ['Yo soy el camino, y la verdad, y la vida; nadie viene al Padre sino por mí.', 'Juan 14:6'],
    ['Porque por gracia habéis sido salvados por medio de la fe, y esto no de vosotros, sino que es don de Dios.', 'Efesios 2:8'],
    ['Pon tu delicia en el SEÑOR, y Él te dará las peticiones de tu corazón.', 'Salmos 37:4'],
    ['El que no ama no conoce a Dios, porque Dios es amor.', '1 Juan 4:8'],
    ['Ahora bien, la fe es la certeza de lo que se espera, la convicción de lo que no se ve.', 'Hebreos 11:1'],
    ['Este es el día que el SEÑOR ha hecho; regocijémonos y alegrémonos en él.', 'Salmos 118:24'],
    ['Pero los que esperan en el SEÑOR renovarán sus fuerzas; se remontarán con alas como las águilas, correrán y no se cansarán, caminarán y no se fatigarán.', 'Isaías 40:31'],
    ['Vosotros sois la luz del mundo. Una ciudad situada sobre un monte no se puede ocultar.', 'Mateo 5:14'],
    ['El nombre del SEÑOR es torre fuerte, a ella corre el justo y está a salvo.', 'Proverbios 18:10'],
    ['El SEÑOR es mi luz y mi salvación; ¿a quién temeré? El SEÑOR es la fortaleza de mi vida; ¿de quién tendré temor?', 'Salmos 27:1'],
    ['Porque no nos ha dado Dios espíritu de timidez, sino de poder, de amor y de dominio propio.', '2 Timoteo 1:7'],
    ['Acercaos a Dios, y Él se acercará a vosotros.', 'Santiago 4:8'],
    ['Echando toda vuestra ansiedad sobre Él, porque Él tiene cuidado de vosotros.', '1 Pedro 5:7'],
    ['Mi socorro viene del SEÑOR, que hizo los cielos y la tierra.', 'Salmos 121:2'],
    ['Y conoceréis la verdad, y la verdad os hará libres.', 'Juan 8:32'],
    ['El que habita al amparo del Altísimo morará a la sombra del Omnipotente.', 'Salmos 91:1'],
    ['Y ahora permanecen la fe, la esperanza y el amor, estos tres; pero el mayor de ellos es el amor.', '1 Corintios 13:13'],
    ['El SEÑOR peleará por vosotros mientras vosotros os quedáis callados.', 'Éxodo 14:14'],
    ['El SEÑOR te bendiga y te guarde; el SEÑOR haga resplandecer su rostro sobre ti, y tenga de ti misericordia; el SEÑOR alce sobre ti su rostro, y te dé paz.', 'Números 6:24-26'],
    ['Y el SEÑOR irá delante de ti; Él estará contigo, no te dejará ni te desamparará; no temas ni te acobardes.', 'Deuteronomio 31:8'],
    ['Dad gracias al SEÑOR, porque Él es bueno; porque para siempre es su misericordia.', '1 Crónicas 16:34'],
    ['No os entristezcáis, porque la alegría del SEÑOR es vuestra fortaleza.', 'Nehemías 8:10']
  ];
  function regalo(boton) {
    var fondo = document.createElement('div'); fondo.className = 'nv-rf';
    fondo.innerHTML = '<div class="nv-rc" role="dialog" aria-modal="true" aria-labelledby="nvRT"><div class="ico" aria-hidden="true">🎁</div>' +
      '<h3 id="nvRT">¡Un regalo para ti!</h3><blockquote id="nvRV"></blockquote><cite id="nvRR"></cite>' +
      '<div class="acc"><button type="button" class="cerrar">Cerrar</button></div></div>';
    document.body.appendChild(fondo);
    // UN SOLO versículo por cada entrada al juego: se elige una vez y no se puede pedir otro.
    // En la próxima entrada sale el siguiente de la bolsa (recorre todos sin repetir, entre los 4 juegos).
    var K = 'nv_regalo_bolsa_v1', elegido = -1;
    function siguiente() {
      var b = null; try { b = JSON.parse(localStorage.getItem(K)); } catch (e) {}
      if (!b || !b.o || b.n !== REGALOS.length || b.i >= b.o.length) {
        var antes = b && b.o ? b.o[b.o.length - 1] : -1, o = [];
        for (var k = 0; k < REGALOS.length; k++) o.push(k);
        for (var j = o.length - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)), t = o[j]; o[j] = o[r]; o[r] = t; }
        if (o[0] === antes && o.length > 1) { o[0] = o[1]; o[1] = antes; }
        b = { o: o, i: 0, n: REGALOS.length };
      }
      var i = b.o[b.i++];
      try { localStorage.setItem(K, JSON.stringify(b)); } catch (e) {}
      return i;
    }
    function mostrar() {
      if (elegido < 0) {
        elegido = siguiente();
        fondo.querySelector('#nvRV').textContent = '«' + REGALOS[elegido][0] + '»';
        fondo.querySelector('#nvRR').textContent = REGALOS[elegido][1] + ' (LBLA)';
      }
    }
    function cerrar() { fondo.classList.remove('on'); try { boton.focus(); } catch (e) {} }
    boton.addEventListener('click', function (e) { e.stopPropagation(); mostrar(); fondo.classList.add('on'); fondo.querySelector('.cerrar').focus(); });
    fondo.querySelector('.cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrar(); });
    ['keydown', 'keyup', 'pointerdown', 'mousedown', 'touchstart'].forEach(function (t) {
      fondo.addEventListener(t, function (e) { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') cerrar(); }, { passive: true });
    });
  }

  function montar() {
    document.body.appendChild(nieve());
    var a = document.createElement('div'); a.className = 'nv-esquina izq'; a.textContent = '🎄'; a.setAttribute('aria-hidden', 'true');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'nv-esquina der'; b.textContent = '🎁';
    b.setAttribute('aria-label', 'Regalo sorpresa: toca para ver un versículo de la Biblia'); b.title = '¡Tócame! Tengo un versículo para ti';
    document.body.appendChild(a); document.body.appendChild(b);
    regalo(b);
    if (cfg.portal) {
      var p = document.querySelector(cfg.portal);
      if (p) { var dentro = cfg.portalDentro ? p.querySelector(cfg.portalDentro) : null; (dentro || p).insertBefore(cartel(), cfg.portalAntes ? (dentro || p).querySelector(cfg.portalAntes) : (dentro || p).firstChild); }
    }
    if (cfg.logo) {
      var l = document.querySelector(cfg.logo);
      if (l) { if (getComputedStyle(l).position === 'static') l.style.position = 'relative'; l.insertAdjacentHTML('beforeend', GORRO); }
    }
    document.documentElement.classList.add('navidad');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
})();
