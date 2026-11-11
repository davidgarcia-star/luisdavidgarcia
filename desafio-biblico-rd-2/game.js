/* Desafío Bíblico RD 2 – Lógica del juego (8 modos de juego x 5 niveles)
 * Usa el mismo banco de preguntas (LBLA) y la música de Desafío Bíblico RD. */
(() => {
  const $ = (id) => document.getElementById(id);
  const TIME_PER_Q = 20;
  // Regla del 70 %: cada partida tiene 20 preguntas; se gana con 14 correctas (70 %)
  // y se pierde al llegar a 7 errores (ya no se puede alcanzar el 70 %).
  const NQ = 20, NEED = 14, MAXERR = NQ - NEED + 1;
  const LETTERS = ["A", "B", "C", "D"];
  const GROUND = 215;
  const ROUTE = { welcome: "inicio", modes: "modos", levels: "niveles", play: "juego", result: "resultados" };
  const SCREENS = Object.keys(ROUTE);

  /* ---------------- utilidades ---------------- */
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeIn = (t) => t * t;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function tween(ms, fn, ease) {
    return new Promise((res) => {
      const t0 = performance.now();
      (function f(n) { const t = Math.min(1, (n - t0) / ms); fn(ease ? ease(t) : t); if (t < 1) requestAnimationFrame(f); else res(); })(t0);
    });
  }
  const tr = (el, x, y, r, s) => el && el.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)})` + (r ? ` rotate(${r.toFixed(1)})` : "") + (s != null && s !== 1 ? ` scale(${s.toFixed(3)})` : ""));
  const q = (svg, sel) => svg.querySelector(sel);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };

  /* ---------------- efectos de sonido extra (respetan el botón de Sonidos) ---------------- */
  const fx = (() => {
    let ctx = null;
    function c() { if (!window.Sound || !Sound.sfxOn) return null; try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === "suspended") ctx.resume(); } catch (e) { return null; } return ctx; }
    function noise(dur, f, vol, type) {
      const a = c(); if (!a) return;
      const b = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
      s.buffer = b; fl.type = type || "lowpass"; fl.frequency.value = f; g.gain.value = vol;
      s.connect(fl); fl.connect(g); g.connect(a.destination); s.start();
    }
    function tone(f1, f2, dur, vol, type) {
      const a = c(); if (!a) return;
      const o = a.createOscillator(), g = a.createGain(), t = a.currentTime;
      o.type = type || "sine"; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + .02);
    }
    return {
      whoosh() { noise(.35, 2500, .25, "bandpass"); },
      thud() { tone(140, 50, .25, .35, "sine"); noise(.12, 600, .25); },
      pull() { tone(110, 70, .3, .18, "sawtooth"); noise(.2, 900, .12); },
      plop() { tone(600, 120, .25, .25, "sine"); },
      bounce() { tone(300, 500, .12, .2, "triangle"); },
      crumble() { noise(.5, 700, .35); },
    };
  })();

  /* ---------------- figuras (personas dibujadas en SVG) ---------------- */
  // Pies en (0,0). face: 1 mira a la derecha, -1 a la izquierda.
  function figure(o) {
    const big = !!o.big, w = big ? 46 : 28, sh = big ? -84 : -76, hip = -40, hr = big ? 15 : 12, lw = big ? 14 : 9, face = o.face || 1;
    const skin = o.skin || "#c68a5a", shirt = o.shirt || "#4f8cff", pants = o.pants || "#25324f", sleeve = o.sleeve || skin;
    const arms = o.arms || [[face * 16, -48], [face * 10, -46]];
    const legs = o.legs || [[-8, 0], [8, 0]];
    let s = "";
    const arm = ([x, y], i) => { const sx = (i ? 1 : -1) * (w / 2 - 5) * face * -1; return `<line x1="${sx}" y1="${sh + 6}" x2="${x}" y2="${y}" stroke="${sleeve}" stroke-width="${lw}" stroke-linecap="round"/><circle cx="${x}" cy="${y}" r="${lw * .62}" fill="${skin}"/>`; };
    s += arm(arms[1], 1); // brazo de atrás
    legs.forEach(([x, y], i) => {
      const hx = (i ? 1 : -1) * w / 4;
      s += `<line x1="${hx}" y1="${hip}" x2="${x}" y2="${y - 5}" stroke="${pants}" stroke-width="${lw + 3}" stroke-linecap="round"/><ellipse cx="${x + face * 4}" cy="${y - 3}" rx="${lw * .85}" ry="4.5" fill="#15161c"/>`;
    });
    s += `<rect x="${-w / 2}" y="${sh - 2}" width="${w}" height="${hip - sh + 8}" rx="${w / 3}" fill="${shirt}"/>`;
    if (big) s += `<path d="M${-w / 2 + 6} ${sh + 10} q${w / 4} 8 ${w / 2 - 6} 0 q${w / 4} 8 ${w / 2 - 6} 0" stroke="rgba(0,0,0,.25)" stroke-width="2" fill="none"/>`;
    s += `<rect x="-5" y="${sh - 10}" width="10" height="11" fill="${skin}"/>`;
    s += `<circle cx="0" cy="${sh - 9 - hr}" r="${hr}" fill="${skin}"/>`;
    if (o.hair) s += `<path d="M${-hr} ${sh - 9 - hr} a${hr} ${hr} 0 0 1 ${hr * 2} 0 q${-hr * .2} ${-hr * .55} ${-hr} ${-hr * .55} q${-hr * .8} 0 ${-hr} ${hr * .55}z" fill="${o.hair}"/>`;
    if (o.band) s += `<rect x="${-hr}" y="${sh - 13 - hr * 1.35}" width="${hr * 2}" height="5" rx="2" fill="${o.band}"/>`;
    if (o.beard) s += `<path d="M${-hr * .85} ${sh - 12 - hr * .6} q${hr * .85} ${hr * 1.5} ${hr * 1.7} 0 q-2 ${hr * .5} ${-hr * .85} ${hr * .55} q${-hr * .6} 0 ${-hr * .85} ${-hr * .55}z" fill="${o.beard}"/>`;
    s += `<circle cx="${face * hr * .45}" cy="${sh - 11 - hr}" r="${big ? 2.2 : 1.8}" fill="#111"/>`;
    s += `<path d="M${face * hr * .15} ${sh - 4 - hr} q${face * 4} 2 ${face * 7} 0" stroke="#5a2f1f" stroke-width="1.6" fill="none"/>`;
    s += arm(arms[0], 0); // brazo de adelante
    return s;
  }
  const PLAYER = { skin: "#c68a5a", shirt: "#2f6fe0", pants: "#1d2742", hair: "#1b1209" };
  const STRONG = { big: true, skin: "#a86a43", shirt: "#8f1d2c", pants: "#2b2b33", beard: "#2a1a10", band: "#d9b45a" };

  const sky = (top, bot) => `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bot}"/></linearGradient></defs><rect width="800" height="250" fill="url(#sky)"/>`;
  const groundSvg = (c1, c2) => `<rect y="${GROUND}" width="800" height="${250 - GROUND}" fill="${c1}"/><rect y="${GROUND}" width="800" height="3" fill="${c2}"/>`;
  const label = (x, y, t, anchor, size, color) => `<text x="${x}" y="${y}" text-anchor="${anchor || "middle"}" font-family="Inter,sans-serif" font-weight="700" font-size="${size || 12}" fill="${color || "rgba(255,255,255,.75)"}">${t}</text>`;

  /* =====================================================================
     LOS 6 MODOS DE JUEGO
     Cada modo: create(svg, k) → { tick(dt), frame(dt), correct(tf, streak), wrong(timeout),
                                    status(), final(), hud(), summary() }
     k = nivel 0..4 (Básico..Master). tf = fracción del tiempo que sobró (0..1).
     ===================================================================== */
  const MODES = [
    {
      id: "soga", ico: "🪢", name: "La Soga",
      desc: "Jala la soga contra el hombre fuerte. Si él la lleva a su lado, pierdes.",
      how: "<b>La Soga:</b> el hombre fuerte jala sin parar; cada respuesta correcta jala la soga hacia ti. Si la marca roja llega a tu línea, ganas.",
      man: { ok: ["¡Uf! ¡Qué fuerza!", "¡No puede ser!", "¡Aguanta, aguanta!"], bad: ["¡Jajá! ¡La soga es mía!", "¡Más fuerza, campeón!", "¡Te voy a ganar!"] },
      you: ["¡Jala!", "¡Con Dios todo!", "¡Fuerza!", "¡Amén!"],
      create(svg, k) {
        const drift = 0.8 + 0.25 * k, yank = 10 + 2 * k;
        let pos = 0, vis = 0, kick = 0, kickMan = 0;
        svg.innerHTML = sky("#1b2a4a", "#3a4f78") + groundSvg("#5b4a32", "#7a6442") +
          `<rect x="0" y="${GROUND + 3}" width="800" height="40" fill="rgba(0,0,0,.12)"/>` +
          `<line x1="400" y1="${GROUND - 6}" x2="400" y2="250" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="5 5"/>` +
          `<rect x="248" y="${GROUND}" width="5" height="35" fill="#36c98a"/>${label(250, 246, "TU LÍNEA", "middle", 10, "#7ef0b4")}` +
          `<rect x="548" y="${GROUND}" width="5" height="35" fill="#ef5a5a"/>${label(550, 246, "SU LÍNEA", "middle", 10, "#ff9a9a")}` +
          `<g id="tug"><line x1="170" y1="152" x2="630" y2="152" stroke="#c9a46a" stroke-width="7" stroke-linecap="round"/>` +
          `<line x1="170" y1="152" x2="630" y2="152" stroke="#8a6a3a" stroke-width="7" stroke-dasharray="3 9"/>` +
          `<path d="M400 148 l-9 22 l18 0z" fill="#ef3b3b" stroke="#fff" stroke-width="1.5"/>` +
          `<g id="you">${figure({ ...PLAYER, face: 1, arms: [[40, -64], [30, -60]], legs: [[-26, 0], [10, 0]] })}</g>` +
          `<g id="man">${figure({ ...STRONG, face: -1, arms: [[-48, -64], [-36, -60]], legs: [[30, 0], [-12, 0]] })}</g></g>` +
          `<g id="dust"></g>`;
        const tug = q(svg, "#tug"), you = q(svg, "#you"), man = q(svg, "#man");
        return {
          tick(dt) { pos = clamp(pos + drift * dt, -100, 100); },
          frame(dt) {
            vis += (pos - vis) * Math.min(1, dt * 5); kick = Math.max(0, kick - dt * 3); kickMan = Math.max(0, kickMan - dt * 3);
            const t = performance.now() / 1000;
            // pos negativo = la soga va hacia el jugador (izquierda)
            tug.setAttribute("transform", `translate(${(vis * 1.5).toFixed(1)} 0)`);
            tr(you, 170, GROUND + Math.sin(t * 9) * .8, -14 - kick * 10);
            tr(man, 630, GROUND + Math.cos(t * 9) * .8, 14 + kickMan * 10);
          },
          correct(tf, streak) { pos = clamp(pos - (18 + 9 * tf + Math.min(streak - 1, 4) * 2), -100, 100); kick = 1; fx.pull(); },
          wrong(timeout) { pos = clamp(pos + yank + (timeout ? 4 : 0), -100, 100); kickMan = 1; fx.pull(); },
          status() { return pos <= -100 ? "win" : pos >= 100 ? "lose" : null; },
          final() { return pos < 0 ? "win" : "lose"; },
          hud() { const p = (100 - pos) / 200; return { good: p, goodLbl: "Tu lado " + Math.round(p * 100) + "%", bad: 1 - p, badLbl: "Hombre fuerte " + Math.round((1 - p) * 100) + "%" }; },
          winTxt: "¡Le ganaste al hombre fuerte! La soga cruzó tu línea.",
          loseTxt: "El hombre fuerte llevó la soga a su lado.",
        };
      },
    },
    {
      id: "pelota", ico: "⚽", name: "La Pelota al Hoyo",
      desc: "La barra de abajo le da a la pelota. Si aciertas, entra por el hoyo de arriba.",
      how: "<b>La Pelota al Hoyo:</b> la barra de abajo golpea la pelota; con cada respuesta correcta entra por el hoyo del medio. Si fallas, rebota y no entra. Mete 14 goles de 20 (70 %) antes de fallar 7 veces.",
      man: { ok: [], bad: [] },
      you: ["¡Adentro!", "¡Al hoyo!", "¡Perfecto!", "¡Gloria a Dios!"],
      miss: ["¡Uy, rebotó!", "¡No entró!", "¡Casi!"],
      create(svg, k) {
        const goal = NEED, maxMiss = MAXERR;
        let goals = 0, miss = 0, busy = false, px = 400, ph = 0;
        svg.innerHTML = sky("#0f2a24", "#16453a") +
          `<rect x="40" y="16" width="720" height="70" rx="14" fill="#1f6b4f" stroke="#d9b45a" stroke-width="3"/>` +
          `<ellipse cx="400" cy="52" rx="34" ry="14" fill="#06120e" stroke="#d9b45a" stroke-width="3"/>` +
          label(400, 32, "HOYO", "middle", 10, "#f3d98e") +
          `<g id="score">${label(400, 112, "", "middle", 15, "#f3d98e")}</g>` +
          `<rect x="0" y="236" width="800" height="14" fill="#0b1f1a"/>` +
          `<g id="ball"><circle r="11" fill="#fff"/><path d="M-6 -3 l6 -5 l6 5 l-2 7 h-8z" fill="#1d2433"/></g>` +
          `<g id="pad"><rect x="-62" y="-7" width="124" height="14" rx="7" fill="#d9b45a"/><rect x="-62" y="-7" width="124" height="5" rx="3" fill="#f3d98e"/></g>` +
          `<g id="pop"></g>`;
        const ball = q(svg, "#ball"), pad = q(svg, "#pad"), score = q(svg, "#score text"), pop = q(svg, "#pop");
        const PY = 224;
        const paint = () => { score.textContent = `⚽ ${goals} / ${goal}   ·   ✖ ${miss} / ${maxMiss}`; };
        paint();
        const rest = () => { tr(pad, px, PY); tr(ball, px, PY - 18); };
        async function shot(ok) {
          busy = true;
          const x0 = px;
          await tween(220, (t) => { px = lerp(x0, 400, t); rest(); }, easeOut);
          await tween(90, (t) => tr(pad, px, PY - 8 * Math.sin(t * Math.PI)));
          fx.bounce();
          const tx = ok ? 400 : 400 + (Math.random() < .5 ? -1 : 1) * 46, ty = 50;
          await tween(520, (t) => tr(ball, lerp(px, tx, t), lerp(PY - 18, ty, easeOut(t)), 0, 1 - t * .25), null);
          if (ok) {
            await tween(220, (t) => tr(ball, 400, 52 + t * 4, 0, .75 * (1 - t)));
            fx.plop(); goals++;
            pop.innerHTML = label(400, 110, "+1", "middle", 22, "#7ef0b4");
            tween(700, (t) => { pop.setAttribute("opacity", 1 - t); tr(pop, 0, -t * 20); });
          } else {
            fx.bounce(); miss++;
            const dir = tx < 400 ? -1 : 1;
            await tween(650, (t) => tr(ball, tx + dir * 160 * t, ty + 10 + (PY - 18 - ty - 10) * easeIn(t)), null);
          }
          paint();
          await sleep(150);
          tr(ball, px, PY - 18, 0, 0);
          await tween(200, (t) => tr(ball, px, PY - 18, 0, t));
          busy = false;
        }
        return {
          tick() {},
          frame() { if (busy) return; ph += 0.016; px = 400 + Math.sin(ph * 1.6) * 200; rest(); },
          correct() { return shot(true); },
          wrong() { return shot(false); },
          status() { return goals >= goal ? "win" : miss >= maxMiss ? "lose" : null; },
          final() { return goals >= goal ? "win" : "lose"; },
          hud() { return { good: goals / goal, goodLbl: `Goles ${goals} de ${goal}`, bad: miss / maxMiss, badLbl: `Fallos ${miss} de ${maxMiss}` }; },
          winTxt: "¡Metiste todas las pelotas en el hoyo!",
          loseTxt: "La pelota rebotó demasiadas veces.",
        };
      },
    },
    {
      id: "muro", ico: "🧱", name: "El Muro",
      desc: "Como Nehemías, levanta el muro piedra por piedra. Si fallas, la piedra se cae y se rompe.",
      how: "<b>El Muro:</b> cada respuesta correcta coloca una piedra; si fallas, la piedra se cae y se rompe. Coloca 14 piedras de 20 (70 %) para terminar el muro (Nehemías 2–6).",
      you: ["¡Una piedra más!", "¡Levantemos el muro!", "¡Firme!", "¡Amén!"],
      miss: ["¡Se cayó una piedra!", "¡Cuidado!", "¡Ay, se derrumbó!"],
      man: { ok: [], bad: [] },
      create(svg, k) {
        const goal = NEED, maxErr = MAXERR, COLS = 7, BW = 62, BH = 26, X0 = 400 - COLS * BW / 2 + 40;
        let stones = 0, errs = 0;
        svg.innerHTML = sky("#2a2238", "#5a4560") + groundSvg("#6b5a43", "#85704f") +
          `<g id="ghost"></g><g id="wall"></g>` +
          `<g id="builder" transform="translate(160 ${GROUND})">${figure({ ...PLAYER, face: 1, arms: [[22, -70], [16, -66]] })}<rect x="10" y="-86" width="22" height="13" rx="2" fill="#b08a5a"/></g>` +
          label(400, 30, "", "middle", 14, "#f3d98e");
        const wall = q(svg, "#wall"), ghost = q(svg, "#ghost"), info = svg.lastElementChild;
        const spot = (i) => { const row = Math.floor(i / COLS), col = i % COLS, off = row % 2 ? BW / 2 : 0; return [X0 + col * BW + off - (row % 2 ? 0 : 0), GROUND - (row + 1) * BH]; };
        let g = "";
        for (let i = 0; i < goal; i++) { const [x, y] = spot(i); g += `<rect x="${x + 1}" y="${y + 1}" width="${BW - 2}" height="${BH - 2}" rx="3" fill="none" stroke="rgba(255,255,255,.18)" stroke-dasharray="4 4"/>`; }
        ghost.innerHTML = g;
        const paint = () => { info.textContent = `🧱 ${stones} / ${goal}   ·   ✖ ${errs}`; };
        paint();
        return {
          tick() {}, frame() {},
          async correct() {
            const [x, y] = spot(stones); stones++; paint();
            const b = document.createElementNS("http://www.w3.org/2000/svg", "g");
            const shade = ["#b9a27e", "#c8b08a", "#a8916e"][stones % 3];
            b.innerHTML = `<rect x="1" y="1" width="${BW - 2}" height="${BH - 2}" rx="3" fill="${shade}" stroke="#7d6a4c" stroke-width="2"/><line x1="8" y1="8" x2="22" y2="8" stroke="rgba(0,0,0,.15)" stroke-width="2"/>`;
            wall.appendChild(b);
            await tween(380, (t) => tr(b, x, lerp(-40, y, t)), easeIn);
            fx.thud();
          },
          async wrong() {
            errs++; paint(); fx.crumble();
            const b = document.createElementNS("http://www.w3.org/2000/svg", "g");
            b.innerHTML = `<rect x="1" y="1" width="${BW - 2}" height="${BH - 2}" rx="3" fill="#9c8a6c" stroke="#6d5d42" stroke-width="2"/><path d="M${BW * .3} 2 l8 10 l-6 6 l9 8" stroke="#3a2f20" stroke-width="2" fill="none"/>`;
            wall.appendChild(b);
            const dir = Math.random() < .5 ? -1 : 1, x = 300 + Math.random() * 200;
            await tween(650, (t) => { tr(b, x + dir * 80 * t, lerp(-40, GROUND - BH + 4, easeIn(t)), dir * 120 * t); });
            await tween(300, (t) => b.setAttribute("opacity", 1 - t));
            b.remove();
          },
          status() { return stones >= goal ? "win" : errs >= maxErr ? "lose" : null; },
          final() { return stones >= goal ? "win" : "lose"; },
          hud() { return { good: stones / goal, goodLbl: `Piedras ${stones} de ${goal}`, bad: errs / maxErr, badLbl: `Errores ${errs} de ${maxErr}` }; },
          winTxt: "¡Terminaste el muro! «…terminó el muro… en cincuenta y dos días» (Nehemías 6:15).",
          loseTxt: "El muro se derrumbó con tantos errores.",
        };
      },
    },
    {
      id: "carrera", ico: "🏃", name: "La Carrera",
      desc: "Corre contra un rival que avanza con el tiempo. Llega primero a la meta.",
      how: "<b>La Carrera:</b> tu rival avanza mientras piensas; cada respuesta correcta te hace correr. Si llegas primero a la meta, ganas (Hebreos 12:1).",
      man: { ok: ["¡Qué rápido!", "¡Espérame!"], bad: ["¡Te pasé!", "¡Me voy!", "¡Adiós!"] },
      you: ["¡Corre!", "¡A la meta!", "¡Vamos!"],
      create(svg, k) {
        const drift = 0.8 + 0.2 * k, step = 5 + k;
        let me = 0, riv = 0, vMe = 0, vRiv = 0, run = 0, runR = 0;
        const X = (p) => 150 + p * 5;
        let lanes = "";
        for (let i = 0; i < 16; i++) lanes += `<rect x="${650 + (i % 2) * 8}" y="${78 + Math.floor(i / 2) * 18}" width="8" height="9" fill="#fff"/><rect x="${650 + ((i + 1) % 2) * 8}" y="${78 + Math.floor(i / 2) * 18 + 9}" width="8" height="9" fill="#fff"/>`;
        svg.innerHTML = sky("#17305a", "#2f5f8c") +
          `<rect y="70" width="800" height="180" fill="#b8563f"/>` +
          `<line x1="0" y1="145" x2="800" y2="145" stroke="#fff" stroke-width="3"/><line x1="0" y1="72" x2="800" y2="72" stroke="#fff" stroke-width="3"/><line x1="0" y1="222" x2="800" y2="222" stroke="#fff" stroke-width="3"/>` +
          `<rect x="650" y="72" width="16" height="150" fill="#111"/>${lanes}` +
          `<line x1="150" y1="72" x2="150" y2="222" stroke="rgba(255,255,255,.5)" stroke-width="2"/>` +
          label(658, 64, "META", "middle", 11, "#fff") + label(130, 112, "RIVAL", "end", 10, "#ffd0c5") + label(130, 188, "TÚ", "end", 10, "#cfe3ff") +
          `<g id="riv">${figure({ skin: "#8a5a3a", shirt: "#d34b4b", pants: "#222", hair: "#111", face: 1, arms: [[14, -52], [-14, -54]], legs: [[-14, 0], [14, 0]] })}</g>` +
          `<g id="me">${figure({ ...PLAYER, face: 1, arms: [[14, -52], [-14, -54]], legs: [[-14, 0], [14, 0]] })}</g>`;
        const gMe = q(svg, "#me"), gRiv = q(svg, "#riv");
        return {
          tick(dt) { riv = Math.min(100, riv + drift * dt); },
          frame(dt) {
            const pm = vMe, pr = vRiv;
            vMe += (me - vMe) * Math.min(1, dt * 4); vRiv += (riv - vRiv) * Math.min(1, dt * 4);
            run += Math.abs(vMe - pm) * .9 + dt * .5; runR += Math.abs(vRiv - pr) * .9 + dt * .5;
            tr(gRiv, X(vRiv), 140 - Math.abs(Math.sin(runR * 3)) * 5, 6, .7);
            tr(gMe, X(vMe), 216 - Math.abs(Math.sin(run * 3)) * 5, 6, .8);
          },
          correct(tf, streak) { me = Math.min(100, me + 11 + 5 * tf + Math.min(streak - 1, 4) * 1.5); fx.whoosh(); },
          wrong(timeout) { riv = Math.min(100, riv + step + (timeout ? 2 : 0)); },
          status() { return me >= 100 ? "win" : riv >= 100 ? "lose" : null; },
          final() { return me > riv ? "win" : "lose"; },
          hud() { return { good: me / 100, goodLbl: `Tú ${Math.round(me)}%`, bad: riv / 100, badLbl: `Rival ${Math.round(riv)}%` }; },
          winTxt: "¡Llegaste primero a la meta! «…corramos con paciencia la carrera que tenemos por delante» (Hebreos 12:1).",
          loseTxt: "Tu rival llegó primero a la meta.",
        };
      },
    },
    {
      id: "flecha", ico: "🎯", name: "Flecha al Blanco",
      desc: "20 flechas. Si respondes bien, la flecha da en el blanco. Acierta 14 para ganar.",
      how: "<b>Flecha al Blanco:</b> tienes 20 flechas. Si respondes bien la flecha da en el blanco (más rápido = más cerca del centro: 10, 8 o 6 puntos). Si fallas, la flecha se pierde. Da 14 veces en el blanco (70 %) para ganar.",
      man: { ok: [], bad: [] },
      you: ["¡Al centro!", "¡En el blanco!", "¡Buen tiro!"],
      miss: ["¡Fuera!", "¡Se fue la flecha!", "¡Uy!"],
      create(svg, k) {
        const shots = NQ, need = NEED, TX = 610, TY = 118;
        let used = 0, pts = 0, hits = 0;
        svg.innerHTML = sky("#24324f", "#4b6a7a") + groundSvg("#3f6b3a", "#5a8c4f") +
          `<rect x="${TX - 8}" y="${TY + 60}" width="16" height="${GROUND - TY - 60}" fill="#6b4a2a"/>` +
          [[70, "#f4f4f4"], [56, "#222"], [42, "#3d7dff"], [28, "#ef3b3b"], [14, "#f3d98e"]].map(([r, c]) => `<circle cx="${TX}" cy="${TY}" r="${r}" fill="${c}" stroke="rgba(0,0,0,.25)"/>`).join("") +
          `<g id="arrows"></g>` +
          `<g id="archer" transform="translate(170 ${GROUND})">${figure({ ...PLAYER, face: 1, arms: [[40, -64], [6, -64]] })}<path d="M44 -100 q22 36 0 72" stroke="#7a4a1f" stroke-width="4" fill="none"/><line x1="44" y1="-100" x2="44" y2="-28" stroke="#ddd" stroke-width="1"/></g>` +
          label(400, 30, "", "middle", 15, "#f3d98e");
        const arrows = q(svg, "#arrows"), info = svg.lastElementChild;
        const paint = () => { info.textContent = `🎯 ${hits} / ${need} en el blanco   ·   ${pts} puntos   ·   🏹 ${shots - used}`; };
        paint();
        async function shoot(score) {
          used++;
          const a = document.createElementNS("http://www.w3.org/2000/svg", "g");
          a.innerHTML = `<line x1="-46" y1="0" x2="0" y2="0" stroke="#e8d3a8" stroke-width="3"/><path d="M0 0 l-9 -4 v8z" fill="#bbb"/><path d="M-46 0 l-7 -5 m7 5 l-7 5" stroke="#ef5a5a" stroke-width="3"/>`;
          arrows.appendChild(a);
          let tx, ty;
          if (score) { const r = score === 10 ? Math.random() * 10 : score === 8 ? 16 + Math.random() * 10 : 30 + Math.random() * 10, an = Math.random() * Math.PI * 2; tx = TX + Math.cos(an) * r; ty = TY + Math.sin(an) * r; }
          else { tx = TX + (Math.random() < .5 ? -1 : 1) * (95 + Math.random() * 40); ty = TY + 40 + Math.random() * 50; }
          fx.whoosh();
          const x0 = 218, y0 = GROUND - 64;
          await tween(480, (t) => { const x = lerp(x0, tx, t), y = lerp(y0, ty, t) - Math.sin(t * Math.PI) * 40; const dy = (ty - y0) - Math.cos(t * Math.PI) * 40 * Math.PI; tr(a, x, y, Math.atan2(dy, tx - x0) * 57.3 * .5); });
          tr(a, tx, ty, 0); fx.thud();
          pts += score; if (score) hits++;
          paint();
        }
        return {
          tick() {}, frame() {},
          correct(tf) { return shoot(tf > .55 ? 10 : tf > .3 ? 8 : 6); },
          wrong() { return shoot(0); },
          status() { if (hits >= need) return "win"; if (used - hits >= MAXERR) return "lose"; return null; },
          final() { return hits >= need ? "win" : "lose"; },
          hud() { return { good: hits / need, goodLbl: `En el blanco ${hits} de ${need}`, bad: (used - hits) / MAXERR, badLbl: `Fallos ${used - hits} de ${MAXERR}` }; },
          winTxt: "¡Diste en el blanco 14 veces!",
          loseTxt: "Se perdieron demasiadas flechas.",
        };
      },
    },
    {
      id: "honda", ico: "🪨", name: "La Honda",
      desc: "Como David, detén al gigante con tu honda antes de que llegue a ti.",
      how: "<b>La Honda:</b> el gigante camina hacia ti. Cada respuesta correcta le lanza una piedra y lo hace retroceder. Dale los golpes que pide el nivel antes de que te alcance (1 Samuel 17).",
      man: { ok: ["¡Ay, mi cabeza!", "¡Uf!", "¡Grrr!"], bad: ["¡Ahí voy!", "¡Ja, fallaste!", "¡No me detienes!"] },
      you: ["¡En el nombre del SEÑOR!", "¡Toma!", "¡Piedra!"],
      create(svg, k) {
        const drift = 0.8 + 0.2 * k, stepIn = 7 + k, hits0 = 5 + k;
        let d = 100, vis = 100, hits = 0, knock = 0, down = 0;
        const X = (dd) => 240 + dd * 4.1;
        svg.innerHTML = sky("#3b2a1f", "#a0703f") + groundSvg("#8a6a3a", "#a5834f") +
          `<g id="giant">${figure({ big: true, skin: "#9a6a45", shirt: "#4a4a52", pants: "#2c2a26", beard: "#1f140c", face: -1, arms: [[-30, -60], [26, -58]], legs: [[16, 0], [-16, 0]] })}<rect x="-26" y="-118" width="52" height="12" rx="4" fill="#8d8d96"/></g>` +
          `<g id="david" transform="translate(160 ${GROUND})">${figure({ ...PLAYER, shirt: "#8a6a3a", face: 1, arms: [[18, -96], [16, -50]] })}</g>` +
          `<g id="stone"></g>` + label(400, 30, "", "middle", 15, "#fff3d6");
        const giant = q(svg, "#giant"), stone = q(svg, "#stone"), info = svg.lastElementChild;
        const paint = () => { info.textContent = `🪨 Golpes ${hits} / ${hits0}`; };
        paint();
        async function sling() {
          fx.whoosh();
          stone.innerHTML = `<circle r="6" fill="#9a9aa2"/>`;
          const x0 = 178, y0 = GROUND - 96, tx = X(vis), ty = GROUND - 128;
          await tween(420, (t) => tr(stone, lerp(x0, tx, t), lerp(y0, ty, t) - Math.sin(t * Math.PI) * 50));
          stone.innerHTML = ""; fx.thud(); knock = 1;
        }
        return {
          tick(dt) { if (!down) d = Math.max(0, d - drift * dt); },
          frame(dt) {
            vis += (d - vis) * Math.min(1, dt * 4); knock = Math.max(0, knock - dt * 2.5);
            const t = performance.now() / 1000;
            if (down) { down = Math.min(1, down + dt * 1.5); tr(giant, X(vis), GROUND, down * 85); return; }
            tr(giant, X(vis), GROUND - Math.abs(Math.sin(t * 3)) * 3, knock * 12);
          },
          async correct(tf) { await sling(); hits++; d = Math.min(100, d + 12 + 4 * tf); paint(); if (hits >= hits0) { down = .01; fx.crumble(); } },
          wrong(timeout) { d = Math.max(0, d - stepIn - (timeout ? 2 : 0)); fx.thud(); },
          status() { return hits >= hits0 ? "win" : d <= 0 ? "lose" : null; },
          final() { return hits >= hits0 ? "win" : "lose"; },
          hud() { return { good: hits / hits0, goodLbl: `Golpes ${hits} de ${hits0}`, bad: 1 - d / 100, badLbl: `El gigante se acerca ${Math.round(100 - d)}%` }; },
          winTxt: "¡Derribaste al gigante! «…la batalla es del SEÑOR…» (1 Samuel 17:47).",
          loseTxt: "El gigante te alcanzó.",
        };
      },
    },
    {
      id: "globo", ico: "🎈", name: "La Aguja y el Globo",
      desc: "Cada respuesta correcta le da un pinchazo al globo. Si fallas, la aguja no llega.",
      how: "<b>La Aguja y el Globo:</b> con cada respuesta correcta la aguja le da al globo; si fallas, la aguja no llega. Con 14 aciertos de 20 (70 %) el globo explota y ganas.",
      man: { ok: [], bad: [] },
      you: ["¡Pínchalo!", "¡Dale!", "¡Ya casi!", "¡Amén!"],
      miss: ["¡No llegó!", "¡Uy, se quedó corta!", "¡Casi!"],
      create(svg) {
        let hits = 0, errs = 0, wob = 0, popped = 0;
        const BX = 520, BY = 105;
        svg.innerHTML = sky("#2a1f4a", "#5b3f7a") + groundSvg("#3b2f55", "#54457a") +
          `<line id="string" x1="${BX}" y1="${BY + 70}" x2="${BX + 6}" y2="${GROUND}" stroke="#ddd" stroke-width="1.5"/>` +
          `<g id="balloon"><ellipse rx="56" ry="66" fill="#ef3b5d"/><ellipse cx="-20" cy="-26" rx="12" ry="20" fill="rgba(255,255,255,.35)"/><path d="M-7 64 l7 10 l7 -10z" fill="#c22a4a"/></g>` +
          `<g id="boom"></g>` +
          `<g id="needle"><rect x="-150" y="-6" width="30" height="12" rx="4" fill="#d9b45a"/><line x1="-120" y1="0" x2="0" y2="0" stroke="#d6dbe3" stroke-width="5" stroke-linecap="round"/><path d="M0 -2.5 L10 0 L0 2.5z" fill="#d6dbe3"/></g>` +
          label(400, 30, "", "middle", 15, "#fff");
        const balloon = q(svg, "#balloon"), needle = q(svg, "#needle"), boom = q(svg, "#boom"), info = svg.lastElementChild;
        const scale = () => 1 + hits * .018;
        const R = () => 56 * scale();
        const restX = () => BX - R() - 70;
        const paint = () => { info.textContent = `🎈 Pinchazos ${hits} / ${NEED}   ·   ✖ ${errs}`; };
        paint();
        let nx = restX();
        async function thrust(ok) {
          const target = ok ? BX - R() + 4 : BX - R() - 30;
          fx.whoosh();
          await tween(180, (t) => { nx = lerp(restX(), target, t); }, easeIn);
          if (ok) { hits++; wob = 1; fx.bounce(); } else fx.thud();
          paint();
          if (ok && hits >= NEED) {
            popped = 1; fx.crumble(); fx.plop();
            balloon.setAttribute("opacity", 0); q(svg, "#string").setAttribute("opacity", 0);
            boom.innerHTML = Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2; return `<path d="M${(BX + Math.cos(a) * 30).toFixed(0)} ${(BY + Math.sin(a) * 30).toFixed(0)} l${(Math.cos(a) * 26).toFixed(0)} ${(Math.sin(a) * 26).toFixed(0)}" stroke="${i % 2 ? "#ffd34d" : "#ef3b5d"}" stroke-width="6" stroke-linecap="round"/>`; }).join("") + label(BX, BY + 8, "¡PUM!", "middle", 34, "#fff");
            await tween(500, (t) => { boom.setAttribute("opacity", 1 - t * .3); });
          }
          await tween(260, (t) => { nx = lerp(target, restX(), t); }, easeOut);
        }
        return {
          tick() {},
          frame(dt) {
            wob = Math.max(0, wob - dt * 2.2);
            const t = performance.now() / 1000, sc = scale();
            if (!popped) tr(balloon, BX + Math.sin(t * 22) * wob * 6, BY + Math.sin(t * 1.5) * 3, Math.sin(t * 18) * wob * 5, sc);
            tr(needle, nx, BY + Math.sin(t * 1.5) * 3);
          },
          correct() { return thrust(true); },
          wrong() { errs++; return thrust(false); },
          status() { return hits >= NEED ? "win" : errs >= MAXERR ? "lose" : null; },
          final() { return hits >= NEED ? "win" : "lose"; },
          hud() { return { good: hits / NEED, goodLbl: `Pinchazos ${hits} de ${NEED}`, bad: errs / MAXERR, badLbl: `Fallos ${errs} de ${MAXERR}` }; },
          winTxt: "¡El globo explotó! ¡PUM! Lograste el 70 %.",
          loseTxt: "La aguja falló demasiadas veces y el globo quedó entero.",
        };
      },
    },
    {
      id: "tanque", ico: "🪣", name: "El Tanque de Agua",
      desc: "Ayuda al niño a llenar el tanque. Cada respuesta correcta echa un cubo de agua.",
      how: "<b>El Tanque de Agua:</b> el niño echa un cubo de agua con cada respuesta correcta; si fallas, el agua se derrama y el tanque no se llena. Con 14 de 20 (70 %) el tanque queda lleno.",
      man: { ok: [], bad: [] },
      you: ["¡Más agua!", "¡Se llena!", "¡Bien!", "¡Amén!"],
      miss: ["¡Se derramó!", "¡Ay, el agua!", "¡Uy!"],
      create(svg) {
        let fill = 0, errs = 0, lvl = 0, wave = 0;
        const TX = 470, TW = 170, TT = 50, TH = 150; // tanque
        svg.innerHTML = sky("#14324a", "#2f6a8c") + groundSvg("#4a6b3a", "#5f8a4a") +
          `<rect x="${TX - 6}" y="${TT + TH}" width="${TW + 12}" height="${GROUND - TT - TH}" fill="#5b5f69"/>` +
          `<defs><clipPath id="tk"><rect x="${TX}" y="${TT}" width="${TW}" height="${TH}" rx="10"/></clipPath></defs>` +
          `<rect x="${TX}" y="${TT}" width="${TW}" height="${TH}" rx="10" fill="rgba(255,255,255,.08)" stroke="#cfd8e8" stroke-width="4"/>` +
          `<g clip-path="url(#tk)"><path id="water" fill="#3d9dff" opacity=".85"/></g>` +
          Array.from({ length: 4 }, (_, i) => `<line x1="${TX + TW}" y1="${TT + TH * (i + 1) / 5}" x2="${TX + TW + 10}" y2="${TT + TH * (i + 1) / 5}" stroke="#cfd8e8" stroke-width="2"/>`).join("") +
          `<rect x="${TX - 70}" y="${TT + 40}" width="70" height="10" fill="#6b4a2a"/><rect x="${TX - 70}" y="${TT + 50}" width="10" height="${GROUND - TT - 50}" fill="#6b4a2a"/>` +
          `<g id="kid">${figure({ ...PLAYER, shirt: "#ffb020", face: 1, arms: [[22, -66], [18, -62]] })}<g id="bucket" transform="translate(26 -72)"><path d="M-10 -6 h20 l-3 18 h-14z" fill="#9aa4b4" stroke="#5c6575" stroke-width="2"/></g></g>` +
          `<g id="drops"></g><path id="puddle" fill="#3d9dff" opacity="0"/>` + label(400, 30, "", "middle", 15, "#fff");
        const water = q(svg, "#water"), kid = q(svg, "#kid"), drops = q(svg, "#drops"), puddle = q(svg, "#puddle"), info = svg.lastElementChild;
        const paint = () => { info.textContent = `💧 Cubos ${fill} / ${NEED}   ·   ✖ ${errs}`; };
        paint();
        let kx = 300, ky = GROUND, tilt = 0;
        async function pour(ok) {
          // el niño sube por la escalera y vacía el cubo
          await tween(380, (t) => { kx = lerp(300, TX - 40, t); ky = lerp(GROUND, TT + 40, t); }, easeOut);
          await tween(200, (t) => (tilt = t * (ok ? 70 : -60)));
          drops.innerHTML = Array.from({ length: 8 }, (_, i) => `<circle r="${3 + (i % 3)}" fill="#6fb8ff"/>`).join("");
          const ds = [...drops.children];
          if (ok) {
            fx.plop();
            await tween(420, (t) => ds.forEach((d, i) => tr(d, TX - 2 + i * 6 + t * 30, TT + 20 + t * (TH - lvl * TH) * (1 - i * .05))));
            fill++; wave = 1;
          } else {
            fx.crumble();
            await tween(520, (t) => ds.forEach((d, i) => tr(d, TX - 50 - i * 5 - t * 40, TT + 30 + t * (GROUND - TT - 30))));
            puddle.setAttribute("d", `M${TX - 140} ${GROUND + 6} q60 -8 120 0 q-60 10 -120 0z`);
            tween(900, (t) => puddle.setAttribute("opacity", (.7 * (1 - t)).toFixed(2)));
          }
          drops.innerHTML = ""; paint();
          await tween(200, (t) => (tilt = (1 - t) * (ok ? 70 : -60)));
          await tween(380, (t) => { kx = lerp(TX - 40, 300, t); ky = lerp(TT + 40, GROUND, t); }, easeOut);
        }
        return {
          tick() {},
          frame(dt) {
            lvl += (fill / NEED - lvl) * Math.min(1, dt * 3); wave = Math.max(0, wave - dt);
            const t = performance.now() / 1000, y = TT + TH - lvl * TH, a = 3 + wave * 6;
            let d = `M${TX} ${y}`;
            for (let x = 0; x <= TW; x += 10) d += ` L${TX + x} ${(y + Math.sin(x / 18 + t * 3) * a * (lvl > 0 ? 1 : 0)).toFixed(1)}`;
            water.setAttribute("d", d + ` L${TX + TW} ${TT + TH + 5} L${TX} ${TT + TH + 5}z`);
            tr(kid, kx, ky);
            q(svg, "#bucket").setAttribute("transform", `translate(26 -72) rotate(${tilt.toFixed(0)})`);
          },
          correct() { return pour(true); },
          wrong() { errs++; return pour(false); },
          status() { return fill >= NEED ? "win" : errs >= MAXERR ? "lose" : null; },
          final() { return fill >= NEED ? "win" : "lose"; },
          hud() { return { good: fill / NEED, goodLbl: `Tanque ${Math.round(fill / NEED * 100)}% lleno`, bad: errs / MAXERR, badLbl: `Cubos derramados ${errs} de ${MAXERR}` }; },
          winTxt: "¡El tanque está lleno! Lograste el 70 %.",
          loseTxt: "Se derramó demasiada agua y el tanque no se llenó.",
        };
      },
    },
  ];

  const ORDEN = ["soga", "pelota", "globo", "tanque", "muro", "carrera", "flecha", "honda"];
  MODES.sort((a, b) => ORDEN.indexOf(a.id) - ORDEN.indexOf(b.id));

  /* ---------------- estado ---------------- */
  const state = { mode: null, level: null, k: 0, queue: [], index: 0, current: null, locked: true, timeLeft: TIME_PER_Q,
    streak: 0, best: 0, correct: 0, answered: 0, M: null, over: null, raf: 0, last: 0, finished: false, busy: false };

  const wonKey = (m, l) => "dbrd2_won_" + m + "_" + l;
  const won = (m, l) => store.get(wonKey(m, l)) === "1";
  const unlocked = (m, i) => i === 0 || won(m, LEVELS[i - 1].id);

  /* ---------------- navegación ---------------- */
  function render() {
    const h = location.hash.replace("#", "");
    let name = SCREENS.find((s) => ROUTE[s] === h) || "welcome";
    if (name === "play" && !state.M) name = state.mode ? "levels" : "welcome";
    if (name === "levels" && !state.mode) name = "modes";
    if (name === "result" && !state.finished) name = "welcome";
    if (name !== "play") stopLoop();
    SCREENS.forEach((s) => $("screen-" + s).classList.toggle("active", s === name));
    document.body.dataset.screen = name;
    if (ROUTE[name] !== h) history.replaceState(null, "", "#" + ROUTE[name]);
    if (window.Sound) Sound.setTrack(name === "play" ? "game" : "menu");
    if (name === "modes") drawModes();
    if (name === "levels") drawLevels();
    scrollTo(0, 0);
  }
  function go(name) { const t = "#" + ROUTE[name]; if (location.hash === t) render(); else location.hash = t; }
  window.addEventListener("hashchange", render);
  document.querySelectorAll("[data-go]").forEach((b) => (b.onclick = () => { click(); go(b.dataset.go); }));

  // El sonido de cada toque lo pone el detector global de abajo (como en la parte 1: suena al tocar o al presionar cualquier tecla)
  const click = () => { if (window.Sound) Sound.start(); };
  document.addEventListener("pointerdown", () => window.Sound && Sound.start(), { once: true });
  document.addEventListener("click", (e) => {
    if (!window.Sound) return;
    Sound.start();
    const t = e.target && e.target.closest ? e.target.closest(".opt, #btnStart, #btnSfx, #btnMusic") : null;
    if (t) return; // las respuestas ya suenan (correcto / incorrecto) y Jugar tiene su fanfarria
    Sound.key();
  }, true);

  /* ---------------- portal ---------------- */
  $("btnStart").onclick = () => { if (window.Sound) { Sound.start(); Sound.triumph(); } go("modes"); };
  $("btnHow").onclick = () => { click(); $("howBox").hidden = false; };
  $("btnHowClose").onclick = () => { click(); $("howBox").hidden = true; };
  $("howBox").addEventListener("click", (e) => { if (e.target.id === "howBox") $("howBox").hidden = true; });
  $("btnHome").onclick = () => { click(); stopLoop(); state.M = null; go("welcome"); };
  $("btnExit").onclick = () => { click(); location.href = "../index.html"; };

  function refreshSound() {
    if (!window.Sound) return;
    $("btnMusic").setAttribute("aria-pressed", String(Sound.musicOn)); $("btnMusic").title = "Música: " + (Sound.musicOn ? "Sí" : "No");
    $("btnSfx").setAttribute("aria-pressed", String(Sound.sfxOn)); $("btnSfx").title = "Sonidos: " + (Sound.sfxOn ? "Sí" : "No");
    $("btnSfx").textContent = Sound.sfxOn ? "🔊" : "🔇";
  }
  $("btnMusic").onclick = () => { Sound.start(); Sound.toggleMusic(); refreshSound(); };
  $("btnSfx").onclick = () => { Sound.start(); Sound.toggleSfx(); refreshSound(); Sound.click(); };
  refreshSound();

  /* ---------------- modos y niveles ---------------- */
  function drawModes() {
    const box = $("modeList"); box.innerHTML = "";
    MODES.forEach((m) => {
      const n = LEVELS.filter((l) => won(m.id, l.id)).length;
      const b = document.createElement("button");
      b.className = "mode"; b.type = "button";
      b.title = m.desc;
      b.innerHTML = `<span class="ico">${m.ico}</span><b>${m.name}</b><span class="prog">${n ? "✓ " + n + " de 5" : "Nuevo"}</span>`;
      b.onclick = () => { click(); if (window.Sound) Sound.welcome(); state.mode = m; go("levels"); };
      box.appendChild(b);
    });
  }
  function drawLevels() {
    const m = state.mode;
    $("levelsMode").textContent = m.ico + " " + m.name;
    $("levelsHint").textContent = m.desc;
    const box = $("levelList"); box.innerHTML = "";
    LEVELS.forEach((l, i) => {
      const open = unlocked(m.id, i), w = won(m.id, l.id);
      const b = document.createElement("button");
      b.className = "level"; b.type = "button"; b.disabled = !open;
      b.innerHTML = `<span class="em">${l.emoji}</span><span class="txt"><b>${l.name}</b></span><span class="st ${open ? "" : "lock"}">${w ? "✓ Ganado" : open ? "Jugar ▶" : "🔒"}</span>`;
      b.onclick = () => { click(); startGame(i); };
      box.appendChild(b);
    });
  }

  /* ---------------- partida ---------------- */
  function startGame(i) {
    const l = LEVELS[i];
    state.level = l; state.k = i;
    state.M = state.mode.create($("arena"), i);
    state.queue = shuffle(QUESTIONS[l.id]).slice(0, NQ);
    Object.assign(state, { index: 0, streak: 0, best: 0, correct: 0, answered: 0, over: null, finished: false, busy: false });
    $("playLevel").textContent = state.mode.ico + " " + state.mode.name + " · " + l.name;
    $("bubbleMan").hidden = $("bubbleYou").hidden = true;
    go("play");
    startLoop();
    showQuestion();
  }

  function showQuestion() {
    const qq = state.queue[state.index];
    const correctText = qq.a[0];
    state.current = { q: qq, options: shuffle(qq.a), correctText };
    state.locked = false; state.timeLeft = TIME_PER_Q;
    $("playProgress").textContent = `${state.index + 1} / ${state.queue.length}`;
    $("questionText").textContent = qq.q;
    const box = $("options"); box.innerHTML = "";
    state.current.options.forEach((t, i) => {
      const b = document.createElement("button");
      b.className = "opt"; b.type = "button";
      b.innerHTML = `<span class="l">${LETTERS[i]}</span><span></span>`;
      b.lastChild.textContent = t;
      b.onclick = () => answer(i);
      box.appendChild(b);
    });
    $("feedback").hidden = true;
    paintStreak(); paintHud(); paintTimer();
  }

  function paintTimer() {
    const t = Math.max(0, state.timeLeft);
    $("timerNum").textContent = Math.ceil(t);
    $("timerRing").style.strokeDashoffset = String(100 - (t / TIME_PER_Q) * 100);
    document.querySelector(".ring-timer").classList.toggle("low", t <= 5);
  }
  function paintHud() {
    const h = state.M.hud();
    $("hbGood").style.width = clamp(h.good, 0, 1) * 100 + "%"; $("hbGoodLbl").textContent = h.goodLbl;
    $("hbBad").style.width = clamp(h.bad, 0, 1) * 100 + "%"; $("hbBadLbl").textContent = h.badLbl;
  }
  function paintStreak() { const s = $("playStreak"); s.hidden = state.streak < 2; s.textContent = "🔥 Racha " + state.streak; }

  let bubbleT = 0;
  function say(who, text) {
    if (!text) return;
    const el = $(who === "man" ? "bubbleMan" : "bubbleYou");
    el.textContent = text; el.hidden = false;
    clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), 1800);
  }

  async function answer(i) {
    if (state.locked || state.busy) return;
    state.locked = true; state.busy = true;
    const cur = state.current, chosen = i == null ? null : cur.options[i];
    const ok = chosen === cur.correctText, timeout = i == null;
    const tf = clamp(state.timeLeft / TIME_PER_Q, 0, 1);
    state.answered++;
    [...$("options").children].forEach((b, j) => {
      b.disabled = true;
      if (cur.options[j] === cur.correctText) b.classList.add("ok");
      else if (j === i) b.classList.add("bad");
    });
    const m = state.mode;
    if (ok) {
      state.correct++; state.streak++; state.best = Math.max(state.best, state.streak);
      if (window.Sound) Sound.correct();
      say("you", pick(m.you));
      if (m.man.ok.length && Math.random() < .5) setTimeout(() => say("man", pick(m.man.ok)), 500);
      $("feedbackText").textContent = state.streak >= 3 ? `¡Correcto! 🔥 Racha de ${state.streak}` : "¡Correcto!";
    } else {
      state.streak = 0;
      if (window.Sound) Sound.wrong();
      if (m.man.bad.length) say("man", pick(m.man.bad)); else if (m.miss) say("you", pick(m.miss));
      $("feedbackText").textContent = (timeout ? "⏰ ¡Se acabó el tiempo! " : "Incorrecto. ") + "La respuesta es: " + cur.correctText;
    }
    $("feedbackRef").textContent = "Referencia: " + cur.q.r + " (LBLA)";
    paintStreak();
    await (ok ? state.M.correct(tf, state.streak) : state.M.wrong(timeout));
    paintHud();
    state.busy = false;
    const st = state.M.status();
    if (st) state.over = st;
    else if (state.index + 1 >= state.queue.length) state.over = state.M.final();
    $("btnNext").textContent = state.over ? "Ver resultado" : "Siguiente";
    $("feedback").hidden = false;
    $("btnNext").focus({ preventScroll: true });
  }

  function lostDuringQuestion() {
    // El rival ganó mientras se pensaba la respuesta (se acabó la soga, la carrera o el gigante llegó)
    state.locked = true; state.over = "lose"; state.answered++; state.streak = 0;
    const cur = state.current;
    [...$("options").children].forEach((b, j) => { b.disabled = true; if (cur.options[j] === cur.correctText) b.classList.add("ok"); });
    if (window.Sound) Sound.wrong();
    if (state.mode.man.bad.length) say("man", pick(state.mode.man.bad));
    $("feedbackText").textContent = "¡Se acabó! La respuesta era: " + cur.correctText;
    $("feedbackRef").textContent = "Referencia: " + cur.q.r + " (LBLA)";
    $("btnNext").textContent = "Ver resultado";
    $("feedback").hidden = false;
    paintHud(); paintStreak();
  }

  function advance() {
    if (state.busy || !state.locked) return;
    if (state.over) { finish(state.over); return; }
    state.index++;
    showQuestion();
  }
  $("btnNext").onclick = () => { click(); advance(); };
  $("btnQuit").onclick = () => { click(); stopLoop(); state.M = null; go("levels"); };

  /* bucle de animación: el tiempo y el rival solo corren mientras la pregunta está abierta */
  function loop(now) {
    const dt = Math.min(.05, (now - state.last) / 1000); state.last = now;
    if (state.M) {
      if (!state.locked && !state.over) {
        const before = Math.ceil(state.timeLeft);
        state.timeLeft -= dt;
        state.M.tick(dt);
        if (Math.ceil(state.timeLeft) !== before && state.timeLeft <= 5 && state.timeLeft > 0 && window.Sound) Sound.tick();
        paintTimer(); paintHud();
        if (state.M.status() === "lose") lostDuringQuestion();
        else if (state.timeLeft <= 0) answer(null);
      }
      state.M.frame(dt);
    }
    state.raf = requestAnimationFrame(loop);
  }
  function startLoop() { stopLoop(); state.last = performance.now(); state.raf = requestAnimationFrame(loop); }
  function stopLoop() { cancelAnimationFrame(state.raf); state.raf = 0; }
  document.addEventListener("visibilitychange", () => { if (document.hidden) state.last = performance.now() + 1e9; else state.last = performance.now(); });

  /* ---------------- resultados ---------------- */
  function finish(res) {
    stopLoop();
    const m = state.mode, l = state.level, M = state.M;
    const win = res === "win";
    const pct = state.answered ? Math.round((state.correct / state.answered) * 100) : 0;
    let next = null;
    if (win) {
      store.set(wonKey(m.id, l.id), "1");
      if (state.k + 1 < LEVELS.length) next = state.k + 1;
      if (window.Sound) Sound.fanfare();
      confetti();
    }
    state.finished = true; state.M = null;
    $("resultIcon").textContent = win ? "🏆" : "💪";
    $("resultTitle").textContent = win ? "¡Ganaste!" : "¡Sigue intentándolo!";
    const nextTxt = win ? (next != null ? `🔓 Se abrió el nivel <b>${LEVELS[next].name}</b> en ${m.name}.` : `👑 ¡Completaste todos los niveles de ${m.name}!`) : "";
    $("resultBody").innerHTML =
      (win ? felicidades(l.id, pct) : "") +
      `<p class="big">${win ? M.winTxt : M.loseTxt}</p>` +
      `<p>${m.ico} ${m.name} · ${l.emoji} ${l.name}</p>` +
      `<p>Respuestas correctas: <b>${state.correct} de ${state.answered}</b> (${pct}%) · Mejor racha: <b>${state.best}</b></p>` +
      (nextTxt ? `<p>${nextTxt}</p>` : "") +
      `<p class="rv">${win ? "«Todo lo puedo en Cristo que me fortalece.» — Filipenses 4:13" : "«¡Sé fuerte y valiente!» — Josué 1:9"}</p>`;
    $("btnNextLevel").hidden = next == null;
    state.nextLevel = next;
    go("result");
  }
  // Mensaje grande de felicitación según el nivel ganado
  function felicidades(levelId, pct) {
    const T = { basico: ["Aprendiz de la Palabra", "🌱"], intermedio: ["Discípulo de la Palabra", "📗"], avanzado: ["Guerrero de la Fe", "🔥"], experto: ["Experto Bíblico", "👑"], master: ["MÁSTER", "💎"] };
    const [t, e] = T[levelId] || ["Campeón", "🏆"];
    return `<div class="felicidades"><span class="f1">¡FELICIDADES!</span><span class="f2">Eres un ${t} ${e}</span>${pct >= 100 ? '<span class="f3">⭐ ¡Puntuación perfecta! ⭐</span>' : pct >= 90 ? '<span class="f3">¡Excelente puntuación!</span>' : ""}</div>`;
  }
  $("btnNextLevel").onclick = () => { if (state.nextLevel != null) { click(); startGame(state.nextLevel); } };
  $("btnAgain").onclick = () => { click(); startGame(state.k); };

  /* confeti */
  function confetti() {
    const cv = $("confetti"), c = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ["#d9b45a", "#f3d98e", "#ffffff", "#36c98a", "#4f8cff", "#ef5a5a"];
    let parts = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35, vx: (Math.random() - .5) * 12, vy: -Math.random() * 12 - 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3, w: 6 + Math.random() * 6, h: 4 + Math.random() * 4, c: pick(cols), life: 140 }));
    (function f() {
      c.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => { p.vy += .25; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--; c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life / 40); c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); });
      parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 20);
      if (parts.length) requestAnimationFrame(f); else c.clearRect(0, 0, cv.width, cv.height);
    })();
  }

  /* ---------------- teclado ---------------- */
  document.addEventListener("keydown", (e) => {
    if (window.Sound) { Sound.start(); Sound.key(); }
    if (!$("screen-play").classList.contains("active")) return;
    const k = e.key.toLowerCase();
    const map = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 };
    if (!state.locked && k in map) { e.preventDefault(); answer(map[k]); }
    else if (state.locked && (e.key === "Enter" || e.key === " ") && !$("feedback").hidden) { e.preventDefault(); advance(); }
  });

  render();
})();
