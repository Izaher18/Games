(() => {
  const COLORS = {
    I: "#22d3ee",
    O: "#facc15",
    T: "#c084fc",
    S: "#4ade80",
    Z: "#f87171",
    J: "#60a5fa",
    L: "#fb923c",
  };
  const FLASH_LIFE = 0.28;
  const RESTART_DELAY_MS = 400;

  const field = document.getElementById("field");
  const holdCanvas = document.getElementById("hold");
  const nextCanvas = document.getElementById("next");
  const fieldCtx = field.getContext("2d");
  const holdCtx = holdCanvas.getContext("2d");
  const nextCtx = nextCanvas.getContext("2d");
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const linesEl = document.getElementById("lines");
  const bestEl = document.getElementById("best");
  const levelEl = document.getElementById("level");
  const helpEl = document.getElementById("help");
  const pauseButton = document.getElementById("pause");
  const autopilotButton = document.getElementById("autopilot");
  const soundButton = document.getElementById("sound");
  const shareButton = document.getElementById("share");
  const restartButton = document.getElementById("restart");
  const speedButtons = [...document.querySelectorAll("[data-speed]")];

  let speed = readStorage("tetris.speed");
  if (!Tetris.SPEEDS[speed]) speed = "normal";
  let game;
  let lastTime = null;
  let paused = false;
  let autopilot = false;
  let assisted = false;
  let soundOn = readStorage("tetris.sound") !== "off";
  let audio = null;
  let best = 0;
  let bestAtStart = 0;
  let overAt = 0;
  let flashUntil = 0;
  let shareReset = 0;
  let shownStatus = null;
  let aiCooldown = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Private browsing can reject storage.
    }
  }

  function loadBest() {
    return Number(readStorage(`tetris.best.${speed}`)) || 0;
  }

  function newGame() {
    game = Tetris.create({ speed });
    paused = false;
    assisted = false;
    lastTime = null;
    overAt = 0;
    flashUntil = 0;
    aiCooldown = 0;
    best = loadBest();
    bestAtStart = best;
    stageEl.classList.remove("is-shaking");
    syncSpeedButtons();
    renderChrome();
  }

  function syncSpeedButtons() {
    speedButtons.forEach((button) => {
      const selected = button.dataset.speed === speed;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function ensurePlaying() {
    if (game.status === "ready") Tetris.start(game);
  }

  function beep(freq, duration, type = "square") {
    if (!soundOn) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audio = audio || new AudioContextClass();
    if (audio.state === "suspended") audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function noteClear(cleared) {
    if (!cleared) return;
    const base = 440 + cleared * 80;
    beep(base, 0.08, "triangle");
    if (cleared >= 4) {
      beep(660, 0.1, "triangle");
      beep(880, 0.14, "triangle");
    }
  }

  function noteOver() {
    overAt = performance.now();
    flashUntil = performance.now() + FLASH_LIFE * 1000;
    if (!reduceMotion) {
      stageEl.classList.remove("is-shaking");
      void stageEl.offsetWidth;
      stageEl.classList.add("is-shaking");
    }
    beep(180, 0.18, "sawtooth");
    beep(90, 0.28, "square");
  }

  function trackBest() {
    if (assisted) return;
    if (game.score > best) {
      best = game.score;
      writeStorage(`tetris.best.${speed}`, String(best));
    }
  }

  function applyInput(action, fromAI = false) {
    if (paused && action !== "pause") {
      paused = false;
      lastTime = null;
    }
    if (game.status === "over") {
      if (performance.now() - overAt > RESTART_DELAY_MS && (action === "hard" || action === "soft" || action === "rotate")) {
        newGame();
        if (fromAI) assisted = true;
        ensurePlaying();
        beep(520, 0.06, "triangle");
      }
      return;
    }

    if (fromAI) assisted = true;
    ensurePlaying();
    let ok = false;
    let result = null;
    if (action === "left") ok = Tetris.tryMove(game, -1, 0);
    else if (action === "right") ok = Tetris.tryMove(game, 1, 0);
    else if (action === "rotate") ok = Tetris.rotate(game, 1);
    else if (action === "soft") ok = Tetris.softDrop(game);
    else if (action === "hard") result = Tetris.hardDrop(game);
    else if (action === "hold") ok = Tetris.hold(game);

    if (result) {
      noteClear(result.cleared);
      trackBest();
      beep(360, 0.05, "square");
      if (game.status === "over") noteOver();
    } else if (ok) {
      if (action === "soft") beep(260, 0.03, "triangle");
      else if (action === "rotate") beep(480, 0.04, "triangle");
      else if (action === "hold") beep(400, 0.05, "sine");
      else beep(300, 0.03, "square");
      trackBest();
    }
    renderChrome();
  }

  function togglePause() {
    if (game.status === "over") return;
    paused = !paused;
    lastTime = null;
    renderChrome();
  }

  function toggleAutopilot() {
    autopilot = !autopilot;
    if (autopilot && game.status === "ready") {
      assisted = true;
      ensurePlaying();
    }
    renderChrome();
  }

  function frame(now) {
    const elapsed = lastTime === null ? 0 : Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (!paused && game.status === "playing") {
      if (autopilot) {
        aiCooldown -= elapsed;
        if (aiCooldown <= 0) {
          const move = TetrisAI.chooseMove(game);
          if (move) applyInput(move, true);
          aiCooldown = move === "hard" ? 0.18 : 0.05;
        }
      }
      const events = Tetris.step(game, elapsed);
      if (events.locked) {
        noteClear(events.cleared);
        trackBest();
        if (!events.cleared) beep(340, 0.04, "square");
      }
      if (events.over) noteOver();
    }

    draw();
    renderChrome();
    requestAnimationFrame(frame);
  }

  function resizeCanvas(canvas, cssWidth, cssHeight) {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(cssWidth * ratio);
    const height = Math.round(cssHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return { width: canvas.width, height: canvas.height, cell: canvas.width / Tetris.WIDTH };
  }

  function draw() {
    const fieldBox = field.getBoundingClientRect();
    const { cell } = resizeCanvas(field, fieldBox.width, fieldBox.height);
    fieldCtx.setTransform(1, 0, 0, 1, 0, 0);
    fieldCtx.clearRect(0, 0, field.width, field.height);
    fieldCtx.fillStyle = "#1c1917";
    fieldCtx.fillRect(0, 0, field.width, field.height);

    for (let y = 0; y < Tetris.HEIGHT; y += 1) {
      for (let x = 0; x < Tetris.WIDTH; x += 1) {
        drawCell(fieldCtx, x, y, cell, game.grid[y][x], 1);
      }
    }

    if (game.active) {
      const gy = Tetris.ghostY(game);
      if (gy !== null && gy !== game.active.y) {
        Tetris.cellsOf({ ...game.active, y: gy }).forEach(({ x, y }) => {
          drawCell(fieldCtx, x, y, cell, game.active.type, 0.22);
        });
      }
      Tetris.cellsOf(game.active).forEach(({ x, y }) => {
        drawCell(fieldCtx, x, y, cell, game.active.type, 1);
      });
    }

    if (paused) drawPause(cell);
    if (game.status === "ready" && !paused) drawReady(cell);
    if (game.status === "over") drawOver(cell);
    if (performance.now() < flashUntil) {
      const left = (flashUntil - performance.now()) / 1000 / FLASH_LIFE;
      fieldCtx.fillStyle = `rgba(255, 255, 255, ${0.45 * left})`;
      fieldCtx.fillRect(0, 0, field.width, field.height);
    }

    drawMini(holdCtx, holdCanvas, game.hold ? [game.hold] : [], 1);
    drawMini(nextCtx, nextCanvas, game.next, Tetris.NEXT_COUNT);
  }

  function drawCell(ctx, x, y, cell, type, alpha) {
    if (y < 0 || y >= Tetris.HEIGHT || x < 0 || x >= Tetris.WIDTH) return;
    if (!type) {
      ctx.fillStyle = (x + y) % 2 ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)";
      ctx.fillRect(x * cell, y * cell, cell, cell);
      return;
    }
    const pad = Math.max(1, cell * 0.06);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[type];
    ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, cell - pad * 2);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x * cell + pad, y * cell + pad, cell - pad * 2, Math.max(2, cell * 0.18));
    ctx.globalAlpha = 1;
  }

  function drawMini(ctx, canvas, types, slots) {
    const box = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(box.width * ratio);
    const height = Math.round(box.height * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#1c1917";
    ctx.fillRect(0, 0, width, height);
    const slotH = height / slots;
    const cell = Math.min(width, slotH) / 5;
    types.forEach((type, index) => {
      const shape = Tetris.SHAPES[type][0];
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      shape.forEach(([x, y]) => {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      });
      const pieceW = (maxX - minX + 1) * cell;
      const pieceH = (maxY - minY + 1) * cell;
      const ox = (width - pieceW) / 2 - minX * cell;
      const oy = index * slotH + (slotH - pieceH) / 2 - minY * cell;
      shape.forEach(([x, y]) => {
        ctx.fillStyle = COLORS[type];
        ctx.fillRect(ox + x * cell + 1, oy + y * cell + 1, cell - 2, cell - 2);
      });
    });
  }

  function drawCentered(ctx, lines, top) {
    ctx.save();
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#1c1917";
    ctx.lineJoin = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    lines.forEach((line, i) => {
      ctx.lineWidth = i === 0 ? 6 : 4;
      ctx.font = `${i === 0 ? 800 : 700} ${i === 0 ? 34 : 16}px 'Avenir Next', 'Segoe UI', sans-serif`;
      const y = top + i * 32;
      ctx.strokeText(line, field.width / 2, y);
      ctx.fillText(line, field.width / 2, y);
    });
    ctx.restore();
  }

  function drawReady() {
    drawCentered(fieldCtx, ["Ready", "Press any move"], field.height * 0.42);
  }

  function drawPause() {
    fieldCtx.fillStyle = "rgba(28, 25, 23, 0.45)";
    fieldCtx.fillRect(0, 0, field.width, field.height);
    drawCentered(fieldCtx, ["Paused", "P / Esc or Resume"], field.height * 0.42);
  }

  function drawOver() {
    fieldCtx.fillStyle = "rgba(28, 25, 23, 0.4)";
    fieldCtx.fillRect(0, 0, field.width, field.height);
    const lines = ["Game over", `Score ${game.score}`];
    if (!assisted && game.score > bestAtStart) lines.push("New best");
    lines.push("Drop to play again");
    drawCentered(fieldCtx, lines, field.height * 0.36);
  }

  function renderChrome() {
    scoreEl.textContent = game.score;
    linesEl.textContent = game.lines;
    bestEl.textContent = best;
    levelEl.textContent = game.level;
    pauseButton.disabled = game.status === "over";
    pauseButton.textContent = paused ? "Resume" : "Pause";
    autopilotButton.setAttribute("aria-pressed", String(autopilot));
    autopilotButton.textContent = autopilot ? "Take over" : "Watch AI";
    soundButton.setAttribute("aria-pressed", String(soundOn));
    soundButton.textContent = soundOn ? "Sound on" : "Sound off";
    shareButton.disabled = game.status !== "over";
    if (performance.now() >= shareReset) shareButton.textContent = "Copy score";

    let text;
    if (paused) text = "Paused";
    else if (game.status === "ready") text = "Move to start";
    else if (game.status === "playing") text = autopilot ? "The computer is stacking" : `Level ${game.level}`;
    else if (assisted) text = `Game over, scored ${game.score} with the AI's help`;
    else if (game.score > bestAtStart) text = `New best: ${game.score}!`;
    else text = `Game over, you scored ${game.score}`;
    if (text !== shownStatus) {
      shownStatus = text;
      statusEl.textContent = text;
    }
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (event.code === "KeyP" || event.code === "Escape") {
      event.preventDefault();
      togglePause();
      return;
    }
    if (event.code === "KeyI") {
      event.preventDefault();
      toggleAutopilot();
      return;
    }
    const map = {
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      ArrowDown: "soft",
      KeyS: "soft",
      ArrowUp: "rotate",
      KeyW: "rotate",
      KeyX: "rotate",
      Space: "hard",
      KeyC: "hold",
      ShiftLeft: "hold",
      ShiftRight: "hold",
    };
    const action = map[event.code];
    if (!action) return;
    if (event.code === "Space" && event.target instanceof Element && event.target.closest("button")) return;
    event.preventDefault();
    if (autopilot) autopilot = false;
    applyInput(action, false);
  });

  field.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (autopilot) autopilot = false;
    applyInput("rotate", false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.status === "playing" && !paused) {
      paused = true;
      lastTime = null;
      renderChrome();
    }
  });

  pauseButton.addEventListener("click", () => {
    togglePause();
    pauseButton.blur();
  });
  autopilotButton.addEventListener("click", () => {
    toggleAutopilot();
    autopilotButton.blur();
  });
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    writeStorage("tetris.sound", soundOn ? "on" : "off");
    renderChrome();
    soundButton.blur();
  });
  restartButton.addEventListener("click", () => {
    autopilot = false;
    newGame();
    restartButton.blur();
  });
  shareButton.addEventListener("click", async () => {
    const speedLabel = speed[0].toUpperCase() + speed.slice(1);
    const parts = ["Tetris", String(game.score), `${game.lines} lines`, speedLabel];
    if (assisted) parts.push("with AI");
    try {
      await navigator.clipboard.writeText(parts.join(" · "));
      shareButton.textContent = "Copied!";
      shareReset = performance.now() + 1600;
    } catch (error) {
      shareButton.textContent = "Copy failed";
      shareReset = performance.now() + 1600;
    }
    shareButton.blur();
  });

  speedButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.speed === speed) return;
      speed = button.dataset.speed;
      writeStorage("tetris.speed", speed);
      autopilot = false;
      newGame();
    });
  });

  const pads = {
    "pad-left": "left",
    "pad-right": "right",
    "pad-rotate": "rotate",
    "pad-soft": "soft",
    "pad-hard": "hard",
    "pad-hold": "hold",
  };
  Object.entries(pads).forEach(([id, action]) => {
    document.getElementById(id).addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (autopilot) autopilot = false;
      applyInput(action, false);
    });
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    helpEl.textContent = "Use the pad under the board · Pause and Watch AI are below";
  }

  newGame();
  requestAnimationFrame(frame);
})();
