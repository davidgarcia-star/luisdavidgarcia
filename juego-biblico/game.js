/* Desafío Bíblico RD – Lógica del juego */
(() => {
  const $ = (id) => document.getElementById(id);
  const screens = ["welcome", "menu", "teams", "levels", "play", "result"];
  const TIME_PER_Q = 20; // segundos por pregunta
  const LETTERS = ["A", "B", "C", "D"];

  const state = {
    mode: "solo",        // "solo" | "teams"
    teamCount: 2,
    teamNames: [],
    rounds: 5,
    level: null,
    queue: [],
    index: 0,
    scores: [],          // por equipo (o [puntos] en solo)
    correctCount: 0,
    turn: 0,
    locked: false,
    timer: null,
    timeLeft: TIME_PER_Q,
    total: 0,
  };


  /* ---------- efectos visuales ---------- */
  (function particles() {
    const box = document.getElementById("particles");
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
    const cv = document.getElementById("confetti");
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
  function show(name) {
    screens.forEach((s) => $("screen-" + s).classList.toggle("active", s === name));
    window.scrollTo({ top: 0 });
  }
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function best(levelId) {
    try { return parseInt(localStorage.getItem("dbrd_best_" + levelId) || "0", 10); } catch (e) { return 0; }
  }
  function saveBest(levelId, v) {
    try { if (v > best(levelId)) localStorage.setItem("dbrd_best_" + levelId, String(v)); } catch (e) { /* sin almacenamiento */ }
  }

  /* ---------- sonido: cualquier tecla ---------- */
  document.addEventListener("keydown", (e) => {
    Sound.start();
    Sound.key();
  });
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

  /* ---------- navegación ---------- */
  $("btnStart").onclick = () => { Sound.start(); Sound.click(); show("menu"); };

  $("btnSolo").onclick = () => {
    Sound.click();
    state.mode = "solo";
    openLevels();
  };
  $("btnTeams").onclick = () => {
    Sound.click();
    state.mode = "teams";
    renderTeamNames();
    show("teams");
  };
  document.querySelectorAll("[data-back]").forEach((b) => {
    b.onclick = () => { Sound.click(); show(b.dataset.back); };
  });

  /* ---------- equipos ---------- */
  function renderTeamNames() {
    document.querySelectorAll("#teamCount .seg").forEach((b) =>
      b.classList.toggle("selected", Number(b.dataset.n) === state.teamCount)
    );
    const box = $("teamNames");
    const prev = Array.from(box.querySelectorAll("input")).map((i) => i.value);
    box.innerHTML = "";
    for (let i = 0; i < state.teamCount; i++) {
      const label = document.createElement("label");
      label.className = "field";
      label.textContent = "Nombre del equipo " + (i + 1);
      const input = document.createElement("input");
      input.type = "text";
      input.maxLength = 20;
      input.placeholder = "Equipo " + (i + 1);
      input.value = prev[i] || "";
      label.appendChild(input);
      box.appendChild(label);
    }
  }
  $("teamCount").addEventListener("click", (e) => {
    const b = e.target.closest(".seg");
    if (!b) return;
    Sound.click();
    state.teamCount = Number(b.dataset.n);
    renderTeamNames();
  });
  $("btnTeamsNext").onclick = () => {
    Sound.click();
    const inputs = Array.from($("teamNames").querySelectorAll("input"));
    state.teamNames = inputs.map((inp, i) => inp.value.trim() || "Equipo " + (i + 1));
    state.rounds = Number($("rounds").value);
    openLevels();
  };

  /* ---------- niveles ---------- */
  function openLevels() {
    const solo = state.mode === "solo";
    $("levelsTitle").textContent = solo ? "Modo individual" : "Modo por equipos · " + state.teamCount + " equipos";
    $("levelsSub").textContent = "Elige un nivel · cada nivel tiene " + QUESTIONS.basico.length + " preguntas";
    const list = $("levelList");
    list.innerHTML = "";
    LEVELS.forEach((lv) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "level-btn";
      const n = QUESTIONS[lv.id].length;
      const bst = solo ? best(lv.id) : 0;
      b.innerHTML =
        '<span class="level-emoji">' + lv.emoji + "</span>" +
        '<span><span class="level-name">' + lv.name + '</span><span class="level-desc">' + lv.desc + " · " + n + " preguntas</span></span>" +
        (solo && bst ? '<span class="level-best">Récord: ' + bst + "/" + n + "</span>" : "");
      b.onclick = () => { Sound.click(); startGame(lv); };
      list.appendChild(b);
    });
    show("levels");
  }
  $("btnLevelsBack").onclick = () => { Sound.click(); show(state.mode === "solo" ? "menu" : "teams"); };

  /* ---------- partida ---------- */
  function startGame(lv) {
    state.level = lv;
    const pool = shuffle(QUESTIONS[lv.id]);
    if (state.mode === "solo") {
      state.queue = pool;                         // las 50 preguntas
      state.scores = [0];
    } else {
      state.queue = pool.slice(0, state.rounds * state.teamCount);
      state.scores = state.teamNames.map(() => 0);
    }
    state.total = state.queue.length;
    state.index = 0;
    state.correctCount = 0;
    state.turn = 0;
    show("play");
    $("playLevel").textContent = lv.emoji + " " + lv.name;
    renderScoreboard();
    nextQuestion();
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
      d.innerHTML = "";
      const t = document.createElement("span");
      t.textContent = name;
      const b = document.createElement("b");
      b.textContent = state.scores[i];
      d.appendChild(t);
      d.appendChild(b);
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
    $("turnInfo").textContent = state.mode === "teams" ? "Turno de: " + state.teamNames[state.turn] : "";
    $("questionText").textContent = item.q;
    $("feedback").hidden = true;
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
      b.appendChild(k);
      b.appendChild(s);
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
    if (state.locked) return;
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
      { const r = $("options").children[opts.indexOf(correct)].getBoundingClientRect(); confetti(28, r.left + r.width / 2, r.top); }
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
    show("menu");
  };

  // Atajos de teclado en pantalla de juego
  document.addEventListener("keydown", (e) => {
    if (!$("screen-play").classList.contains("active")) return;
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
    Sound.fanfare();
    confetti(180);
    setTimeout(() => confetti(120), 500);
    const body = $("resultBody");
    body.innerHTML = "";
    if (state.mode === "solo") {
      const n = state.total;
      const pct = Math.round((state.correctCount / n) * 100);
      saveBest(state.level.id, state.correctCount);
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
      body.append(big, l1, l2);
    } else {
      $("resultTitle").textContent = "¡Resultados por equipos!";
      const order = state.teamNames
        .map((name, i) => ({ name, pts: state.scores[i] }))
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
        const a = document.createElement("span");
        a.textContent = (idx + 1) + ". " + o.name;
        const b = document.createElement("strong");
        b.textContent = o.pts + (o.pts === 1 ? " punto" : " puntos");
        r.append(a, b);
        rank.appendChild(r);
      });
      body.appendChild(rank);
    }
    show("result");
  }

  $("btnAgain").onclick = () => { Sound.click(); startGame(state.level); };
  $("btnToMenu").onclick = () => { Sound.click(); show("menu"); };

  refreshSoundButtons();
})();
