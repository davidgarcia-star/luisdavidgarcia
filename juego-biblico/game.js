/* Desafío Bíblico RD – Lógica del juego */
(() => {
  const $ = (id) => document.getElementById(id);
  const TIME_PER_Q = 20; // segundos por pregunta
  const LETTERS = ["A", "B", "C", "D"];

  // Cada pantalla tiene su propia dirección (#hash) para que el botón "atrás" funcione.
  const ROUTE = { welcome: "inicio", menu: "menu", teams: "equipos", levels: "niveles", play: "juego", result: "resultados" };
  const SCREENS = Object.keys(ROUTE);

  // Equipos: color fijo por equipo y nombres sugeridos
  const TEAM_COLORS = [
    { hex: "#e5484d", name: "Rojo" },
    { hex: "#3e8bff", name: "Azul" },
    { hex: "#2fbf71", name: "Verde" },
    { hex: "#a970ff", name: "Morado" },
  ];
  const PRESET_NAMES = ["Leones de Judá", "Águilas de Fuego", "Guerreros de Fe", "Hijos de la Luz"];
  const CUSTOM = "custom";
  const PASS_PCT = 70;   // porcentaje mínimo para aprobar un nivel

  const state = {
    mode: "solo",          // "solo" | "teams"
    soloCount: 20,         // 20 (pocas) o 50 (muchas)
    teamCount: 2,
    teamCfg: PRESET_NAMES.map((_, i) => ({ choice: String(i), custom: "" })),
    teamNames: [],
    rounds: 5,
    level: null,
    queue: [],
    index: 0,
    scores: [],
    correctCount: 0,
    turn: 0,
    locked: false,
    timer: null,
    timeLeft: TIME_PER_Q,
    total: 0,
    active: false,         // hay una partida en curso
    finished: false,       // hay resultados para mostrar
    current: null,
  };

  /* ---------- efectos visuales ---------- */
  (function particles() {
    const box = $("particles");
    if (!box) return;
    for (let i = 0; i < 28; i++) {
      const p = document.createElement("span");
      p.className = "particle";
      const size = 4 + Math.random() * 10;
      p.style.cssText = "left:" + Math.random() * 100 + "%;width:" + size + "px;height:" + size + "px;animation-duration:" + (9 + Math.random() * 12) + "s;animation-delay:" + (-Math.random() * 18) + "s";
      box.appendChild(p);
    }
  })();

  const confetti = (() => {
    const cv = $("confetti");
    const c = cv.getContext("2d");
    let parts = [], raf = null;
    const colors = ["#f4c542", "#ffffff", "#2fbf71", "#5a78ff", "#e5484d", "#ffd96b"];
    function size() { cv.width = innerWidth; cv.height = innerHeight; }
    addEventListener("resize", size); size();
    function frame() {
      c.clearRect(0, 0, cv.width, cv.height);
      parts.forEach((p) => {
        p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.color;
        c.globalAlpha = Math.max(0, Math.min(1, p.life / 40));
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
      });
      parts = parts.filter((p) => p.life > 0 && p.y < cv.height + 20);
      if (parts.length) raf = requestAnimationFrame(frame);
      else { raf = null; c.clearRect(0, 0, cv.width, cv.height); }
    }
    return function burst(n, x, y) {
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 7;
        parts.push({ x: x ?? cv.width / 2, y: y ?? cv.height / 3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4,
          w: 6 + Math.random() * 6, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4,
          color: colors[(Math.random() * colors.length) | 0], life: 90 + Math.random() * 60 });
      }
      if (!raf) raf = requestAnimationFrame(frame);
    };
  })();

  /* ---------- utilidades ---------- */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const bestKey = (levelId, n) => "dbrd_best_" + levelId + "_" + n;
  function best(levelId, n) {
    try { return parseInt(localStorage.getItem(bestKey(levelId, n)) || "0", 10); } catch (e) { return 0; }
  }
  function saveBest(levelId, n, v) {
    try { if (v > best(levelId, n)) localStorage.setItem(bestKey(levelId, n), String(v)); } catch (e) { /* sin almacenamiento */ }
  }
  // Niveles aprobados (modo individual). Se guarda en el navegador y también en memoria.
  const passedMem = {};
  function isPassed(levelId) {
    if (passedMem[levelId]) return true;
    try { return localStorage.getItem("dbrd_passed_" + levelId) === "1"; } catch (e) { return false; }
  }
  function setPassed(levelId) {
    passedMem[levelId] = true;
    try { localStorage.setItem("dbrd_passed_" + levelId, "1"); } catch (e) { /* sin almacenamiento */ }
  }
  const teamColor = (i) => TEAM_COLORS[i % TEAM_COLORS.length].hex;

  /* ---------- navegación con historial (botón atrás) ---------- */
  function paint(name) {
    SCREENS.forEach((s) => $("screen-" + s).classList.toggle("active", s === name));
    window.scrollTo({ top: 0 });
  }

  // Decide qué pantalla mostrar según la dirección actual; si no hay datos, vuelve al menú.
  function render() {
    const h = location.hash.replace("#", "");
    let name = SCREENS.find((s) => ROUTE[s] === h) || "welcome";
    if (name === "play" && !state.active) name = "menu";
    if (name === "result" && !state.finished) name = "menu";
    if (name === "levels" && state.mode === "teams" && !state.teamNames.length) name = "teams";
    if (name !== "play") { clearInterval(state.timer); }
    if (name === "levels") buildLevels();
    if (name === "teams") renderTeamRows();
    if (name !== "play" && state.active && name !== "result") state.active = false;
    // Corrige la dirección si fue redirigida
    if (ROUTE[name] !== h && !(name === "welcome" && h === "")) {
      history.replaceState(null, "", "#" + ROUTE[name]);
    }
    Sound.setTrack(name === "play" ? "game" : "menu");   // otra música al iniciar el juego
    paint(name);
  }

  function go(name) {
    const target = "#" + ROUTE[name];
    if (location.hash === target) render();
    else location.hash = target;      // dispara "hashchange" → render()
  }
  window.addEventListener("hashchange", render);

  /* ---------- sonido ---------- */
  document.addEventListener("keydown", () => { Sound.start(); Sound.key(); });
  document.addEventListener("pointerdown", () => Sound.start(), { once: true });

  function refreshSoundButtons() {
    const m = Sound.musicOn, s = Sound.sfxOn;
    $("btnMusic").textContent = "🎵 Música: " + (m ? "Sí" : "No");
    $("btnSfx").textContent = "🔊 Sonidos: " + (s ? "Sí" : "No");
    $("btnMusic").classList.toggle("off", !m);
    $("btnSfx").classList.toggle("off", !s);
    $("btnMusic").setAttribute("aria-pressed", String(m));
    $("btnSfx").setAttribute("aria-pressed", String(s));
    $("btnMusicMenu").textContent = "🎵 Música instrumental: " + (m ? "Sí" : "No");
    $("btnSfxMenu").textContent = "🔊 Sonidos del juego: " + (s ? "Sí" : "No");
  }
  const toggleMusic = () => { Sound.start(); Sound.toggleMusic(); refreshSoundButtons(); };
  const toggleSfx = () => { Sound.start(); Sound.toggleSfx(); refreshSoundButtons(); Sound.click(); };
  $("btnMusic").onclick = toggleMusic;
  $("btnMusicMenu").onclick = toggleMusic;
  $("btnSfx").onclick = toggleSfx;
  $("btnSfxMenu").onclick = toggleSfx;

  /* ---------- botones de navegación ---------- */
  $("btnStart").onclick = () => { Sound.start(); Sound.click(); go("menu"); };
  $("btnSolo").onclick = () => { Sound.click(); state.mode = "solo"; go("levels"); };
  $("btnTeams").onclick = () => { Sound.click(); state.mode = "teams"; go("teams"); };
  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => {
      Sound.click();
      const target = Object.keys(ROUTE).find((k) => "screen-" + k === b.dataset.back) || "menu";
      go(target);
    };
  });

  /* ---------- equipos ---------- */
  function renderTeamRows() {
    document.querySelectorAll("#teamCount .seg").forEach((b) =>
      b.classList.toggle("selected", Number(b.dataset.n) === state.teamCount)
    );
    const box = $("teamNames");
    box.innerHTML = "";
    for (let i = 0; i < state.teamCount; i++) {
      const cfg = state.teamCfg[i];
      const row = document.createElement("div");
      row.className = "team-row";
      row.style.setProperty("--tc", teamColor(i));
      row.style.animationDelay = i * 0.06 + "s";

      const dot = document.createElement("span");
      dot.className = "team-dot";
      const fields = document.createElement("div");
      fields.className = "team-fields";

      const label = document.createElement("div");
      label.className = "team-label";
      label.innerHTML = "<b>Equipo " + (i + 1) + "</b> · Color " + TEAM_COLORS[i].name;

      const sel = document.createElement("select");
      sel.setAttribute("aria-label", "Nombre del equipo " + (i + 1));
      PRESET_NAMES.forEach((n, k) => {
        const o = document.createElement("option");
        o.value = String(k); o.textContent = n;
        sel.appendChild(o);
      });
      const oc = document.createElement("option");
      oc.value = CUSTOM; oc.textContent = "✏️ Asignar nombre de preferencia";
      sel.appendChild(oc);
      sel.value = cfg.choice;

      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 20;
      input.placeholder = "Escribe el nombre que prefieras";
      input.setAttribute("aria-label", "Nombre de preferencia del equipo " + (i + 1));
      input.value = cfg.custom;
      input.hidden = cfg.choice !== CUSTOM;

      sel.onchange = () => {
        Sound.click();
        cfg.choice = sel.value;
        input.hidden = sel.value !== CUSTOM;
        if (!input.hidden) input.focus();
      };
      input.oninput = () => { cfg.custom = input.value; };

      fields.append(label, sel, input);
      row.append(dot, fields);
      box.appendChild(row);
    }
  }

  $("teamCount").addEventListener("click", (e) => {
    const b = e.target.closest(".seg");
    if (!b) return;
    Sound.click();
    state.teamCount = Number(b.dataset.n);
    renderTeamRows();
  });

  function resolveTeamNames() {
    const used = new Map();
    const names = [];
    for (let i = 0; i < state.teamCount; i++) {
      const cfg = state.teamCfg[i];
      let name = cfg.choice === CUSTOM ? cfg.custom.trim() : PRESET_NAMES[Number(cfg.choice)];
      if (!name) name = PRESET_NAMES[i];
      const key = name.toLowerCase();
      const n = (used.get(key) || 0) + 1;
      used.set(key, n);
      names.push(n > 1 ? name + " " + n : name);
    }
    return names;
  }

  $("btnTeamsNext").onclick = () => {
    Sound.click();
    state.teamNames = resolveTeamNames();
    state.rounds = Number($("rounds").value);
    go("levels");
  };

  /* ---------- niveles ---------- */
  function buildLevels() {
    const solo = state.mode === "solo";
    $("levelsTitle").textContent = solo ? "Modo individual" : "Modo por equipos · " + state.teamCount + " equipos";
    $("soloLength").hidden = !solo;
    document.querySelectorAll("#lengthSeg .seg").forEach((b) =>
      b.classList.toggle("selected", Number(b.dataset.n) === state.soloCount)
    );
    $("levelsSub").textContent = solo
      ? "Elige un nivel"
      : "Elige un nivel · " + state.rounds + " rondas por equipo";

    const list = $("levelList");
    list.innerHTML = "";
    LEVELS.forEach((lv, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn";
      const total = QUESTIONS[lv.id].length;
      const n = solo ? Math.min(state.soloCount, total) : Math.min(state.rounds * state.teamCount, total);
      const bst = solo ? best(lv.id, n) : 0;
      // Solo en modo individual: un nivel se desbloquea al aprobar el anterior
      const locked = solo && idx > 0 && !isPassed(LEVELS[idx - 1].id);
      const passed = solo && isPassed(lv.id);
      const desc = locked
        ? "Bloqueado · aprueba " + LEVELS[idx - 1].name + " con " + PASS_PCT + "% o más"
        : lv.desc + " · " + n + " preguntas";
      b.innerHTML =
        '<span class="level-emoji">' + (locked ? "🔒" : lv.emoji) + "</span>" +
        '<span><span class="level-name">' + lv.name + '</span><span class="level-desc">' + desc + "</span></span>" +
        (!locked && passed ? '<span class="level-best ok">✅ Aprobado</span>' : "") +
        (!locked && !passed && solo && bst ? '<span class="level-best">Récord: ' + bst + "/" + n + "</span>" : "");
      if (locked) {
        b.classList.add("locked");
        b.disabled = true;
        b.setAttribute("aria-disabled", "true");
      } else {
        b.onclick = () => { Sound.click(); startGame(lv); };
      }
      list.appendChild(b);
    });
  }

  $("lengthSeg").addEventListener("click", (e) => {
    const b = e.target.closest(".seg");
    if (!b) return;
    Sound.click();
    state.soloCount = Number(b.dataset.n);
    buildLevels();
  });

  $("btnLevelsBack").onclick = () => { Sound.click(); go(state.mode === "solo" ? "menu" : "teams"); };

  /* ---------- partida ---------- */
  function startGame(lv) {
    state.level = lv;
    const pool = shuffle(QUESTIONS[lv.id]);
    if (state.mode === "solo") {
      state.queue = pool.slice(0, state.soloCount);       // 20 (pocas) o 50 (muchas)
      state.scores = [0];
    } else {
      state.queue = pool.slice(0, state.rounds * state.teamCount);
      state.scores = state.teamNames.map(() => 0);
    }
    state.total = state.queue.length;
    state.index = 0;
    state.correctCount = 0;
    state.turn = 0;
    state.active = true;
    state.finished = false;
    $("playLevel").textContent = lv.emoji + " " + lv.name;
    go("play");
    renderScoreboard();
    nextQuestion();
  }

  function applyTeamTheme() {
    const card = document.querySelector("#screen-play .card");
    if (state.mode === "teams") {
      card.classList.add("team-turn");
      card.style.setProperty("--tc", teamColor(state.turn));
    } else {
      card.classList.remove("team-turn");
      card.style.removeProperty("--tc");
    }
  }

  function renderScoreboard() {
    const sb = $("scoreboard");
    sb.innerHTML = "";
    if (state.mode === "solo") {
      sb.innerHTML = '<div class="score-chip active">Aciertos<b>' + state.correctCount + "</b></div>";
      return;
    }
    state.teamNames.forEach((name, i) => {
      const d = document.createElement("div");
      d.className = "score-chip" + (i === state.turn ? " active" : "");
      d.style.setProperty("--tc", teamColor(i));
      const t = document.createElement("span");
      t.textContent = name;
      const b = document.createElement("b");
      b.textContent = state.scores[i];
      d.append(t, b);
      sb.appendChild(d);
    });
  }

  function nextQuestion() {
    if (state.index >= state.total) return finish();
    state.locked = false;
    const item = state.queue[state.index];
    const correct = item.a[0];
    state.current = { correct, opts: shuffle(item.a), ref: item.r };

    $("playProgress").textContent = "Pregunta " + (state.index + 1) + " de " + state.total;
    const turn = $("turnInfo");
    turn.textContent = "";
    if (state.mode === "teams") {
      turn.style.setProperty("--tc", teamColor(state.turn));
      const dot = document.createElement("span");
      dot.className = "dot";
      turn.append(dot, "Turno de: " + state.teamNames[state.turn]);
    }
    $("questionText").textContent = item.q;
    $("feedback").hidden = true;
    applyTeamTheme();
    renderScoreboard();

    const box = $("options");
    box.innerHTML = "";
    state.current.opts.forEach((text, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "opt";
      const k = document.createElement("span");
      k.className = "key";
      k.textContent = LETTERS[i];
      const s = document.createElement("span");
      s.textContent = text;
      b.append(k, s);
      b.onclick = () => answer(i);
      box.appendChild(b);
    });
    startTimer();
  }

  function startTimer() {
    clearInterval(state.timer);
    state.timeLeft = TIME_PER_Q;
    updateTimerBar();
    state.timer = setInterval(() => {
      state.timeLeft -= 0.25;
      updateTimerBar();
      if (state.timeLeft <= 5 && Math.abs(state.timeLeft - Math.round(state.timeLeft)) < 0.01) Sound.tick();
      if (state.timeLeft <= 0) {
        clearInterval(state.timer);
        answer(-1); // se acabó el tiempo
      }
    }, 250);
  }
  function updateTimerBar() {
    const bar = $("timerBar");
    const pct = Math.max(0, (state.timeLeft / TIME_PER_Q) * 100);
    bar.style.width = pct + "%";
    bar.classList.toggle("warn", pct <= 50 && pct > 25);
    bar.classList.toggle("danger", pct <= 25);
  }

  function answer(i) {
    if (state.locked || !state.active) return;
    state.locked = true;
    clearInterval(state.timer);
    const { correct, opts, ref } = state.current;
    const buttons = Array.from($("options").children);
    buttons.forEach((b, idx) => {
      b.disabled = true;
      if (opts[idx] === correct) b.classList.add("correct");
      else if (idx === i) b.classList.add("wrong");
    });
    const ok = i >= 0 && opts[i] === correct;
    if (ok) {
      state.correctCount++;
      state.scores[state.mode === "solo" ? 0 : state.turn] += 1;
      Sound.correct();
      const r = buttons[opts.indexOf(correct)].getBoundingClientRect();
      confetti(28, r.left + r.width / 2, r.top);
    } else {
      Sound.wrong();
    }
    $("feedbackText").textContent = ok
      ? "✅ ¡Correcto!"
      : (i === -1 ? "⏰ Se acabó el tiempo. " : "❌ Incorrecto. ") + "Respuesta: " + correct;
    $("feedbackRef").textContent = "📖 " + ref + " · LBLA";
    $("feedback").hidden = false;
    $("btnNext").textContent = state.index + 1 >= state.total ? "Ver resultados →" : "Siguiente →";
    $("btnNext").focus({ preventScroll: true });
    renderScoreboard();
  }

  function advance() {
    if (!state.locked) return;
    state.index++;
    if (state.mode === "teams") state.turn = (state.turn + 1) % state.teamCount;
    nextQuestion();
  }
  $("btnNext").onclick = () => { Sound.click(); advance(); };

  $("btnQuit").onclick = () => {
    Sound.click();
    clearInterval(state.timer);
    state.active = false;
    go("menu");
  };

  // Atajos de teclado en la pantalla de juego
  document.addEventListener("keydown", (e) => {
    if (!$("screen-play").classList.contains("active")) return;
    if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "SELECT")) return;
    const k = e.key.toLowerCase();
    if (!state.locked) {
      const map = { "1": 0, "2": 1, "3": 2, "4": 3, a: 0, b: 1, c: 2, d: 3 };
      if (k in map) answer(map[k]);
    } else if (k === "enter") {
      e.preventDefault();
      advance();
    }
  });

  /* ---------- resultados ---------- */
  function finish() {
    clearInterval(state.timer);
    state.active = false;
    state.finished = true;
    Sound.fanfare();
    confetti(180);
    setTimeout(() => confetti(120), 500);
    const body = $("resultBody");
    body.innerHTML = "";
    if (state.mode === "solo") {
      const n = state.total;
      const pct = Math.round((state.correctCount / n) * 100);
      saveBest(state.level.id, n, state.correctCount);
      const passed = pct >= PASS_PCT;
      if (passed) setPassed(state.level.id);
      const li = LEVELS.findIndex((l) => l.id === state.level.id);
      const nextLv = LEVELS[li + 1] || null;
      state.nextLevel = passed ? nextLv : null;
      $("resultTitle").textContent = "¡Nivel " + state.level.name + " completado!";
      const big = document.createElement("div");
      big.className = "big-score";
      big.textContent = state.correctCount + " / " + n;
      const l1 = document.createElement("p");
      l1.className = "result-line";
      l1.textContent = pct + "% de aciertos";
      const l2 = document.createElement("p");
      l2.className = "result-line";
      l2.textContent =
        pct >= 90 ? "🏆 ¡Excelente! Conoces muy bien la Palabra." :
        pct >= 70 ? "🌟 ¡Muy bien! Sigue creciendo en la Palabra." :
        pct >= 50 ? "📖 Buen intento. ¡Sigue estudiando la Biblia!" :
                    "🙏 ¡Ánimo! Lee, estudia y vuelve a intentarlo.";
      const verdict = document.createElement("div");
      verdict.className = "verdict " + (passed ? "pass" : "retry");
      verdict.textContent = passed
        ? (nextLv
            ? "✅ ¡Aprobaste! Puedes pasar al siguiente nivel: " + nextLv.name + "."
            : "🎉 ¡Aprobaste el último nivel! Completaste todos los niveles.")
        : "📚 Debes seguir practicando. Necesitas " + PASS_PCT + "% o más para pasar al siguiente nivel.";
      body.append(big, l1, l2, verdict);
      $("btnNextLevel").hidden = !state.nextLevel;
      if (state.nextLevel) $("btnNextLevel").textContent = "Siguiente nivel: " + state.nextLevel.name + " →";
      $("btnAgain").textContent = passed ? "🔁 Repetir nivel" : "🔁 Practicar de nuevo";
    } else {
      $("resultTitle").textContent = "¡Resultados por equipos!";
      $("btnNextLevel").hidden = true;
      $("btnAgain").textContent = "🔁 Jugar de nuevo";
      const order = state.teamNames
        .map((name, i) => ({ name, pts: state.scores[i], color: teamColor(i) }))
        .sort((a, b) => b.pts - a.pts);
      const topPts = order[0].pts;
      const winners = order.filter((o) => o.pts === topPts);
      const l = document.createElement("p");
      l.className = "result-line";
      l.textContent = winners.length > 1
        ? "🤝 ¡Empate entre: " + winners.map((w) => w.name).join(", ") + "!"
        : "🏆 ¡Ganador: " + winners[0].name + "!";
      body.appendChild(l);
      const rank = document.createElement("div");
      rank.className = "rank";
      order.forEach((o, idx) => {
        const r = document.createElement("div");
        r.className = "rank-item" + (o.pts === topPts ? " first" : "");
        r.style.setProperty("--tc", o.color);
        const a = document.createElement("span");
        a.textContent = (idx + 1) + ". " + o.name;
        const b = document.createElement("strong");
        b.textContent = o.pts + (o.pts === 1 ? " punto" : " puntos");
        r.append(a, b);
        rank.appendChild(r);
      });
      body.appendChild(rank);
    }
    go("result");
  }

  $("btnNextLevel").onclick = () => { if (state.nextLevel) { Sound.click(); startGame(state.nextLevel); } };
  $("btnAgain").onclick = () => { Sound.click(); startGame(state.level); };
  $("btnToMenu").onclick = () => { Sound.click(); go("menu"); };

  /* ---------- inicio ---------- */
  refreshSoundButtons();
  render();
})();
