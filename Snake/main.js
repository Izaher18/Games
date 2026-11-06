(() => {
  const SIZE = 18;
  const SPEEDS = { slow: 150, normal: 110, fast: 75 };
  const MODES = ["classic", "wrap"];
  const SPEEDUP_PER_APPLE = 1.5;
  const FASTEST_RATIO = 0.6;
  const SWIPE_DISTANCE = 24;
  const SPARKS = 12;
  const KEYS = {
    ArrowUp: "up",
    KeyW: "up",
    ArrowDown: "down",
    KeyS: "down",
    ArrowLeft: "left",
    KeyA: "left",
    ArrowRight: "right",
    KeyD: "right",
  };
  const COLORS = {
    light: "#aad751",
    dark: "#a2d149",
    head: "#2f6fe6",
    tail: "#7fa8f5",
    eye: "#fff",
    pupil: "#0b1b3a",
    apple: "#e23b3b",
    leaf: "#3d7a24",
    crashed: "#a81f1f",
  };

  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const statusEl = document.getElementById("status");
  const pauseButton = document.getElementById("pause");
  const soundButton = document.getElementById("sound");
  const restartButton = document.getElementById("restart");
  const speedButtons = document.querySelectorAll("[data-speed]");
  const modeButtons = document.querySelectorAll("[data-mode]");
  const touchScreen = window.matchMedia("(pointer: coarse)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let speed = SPEEDS[localStorage.getItem("snake.speed")] ? localStorage.getItem("snake.speed") : "normal";
  let mode = MODES.includes(localStorage.getItem("snake.mode")) ? localStorage.getItem("snake.mode") : "classic";
  let soundOn = localStorage.getItem("snake.sound") !== "off";
  const bests = loadBests();
  let game;
  let phase;
  let timer = null;
  let newBest = false;
  let audio = null;
  // The board is drawn partway between the previous tick's body and the current one.
  let prevBody = null;
  let eaten = null;
  let tickStart = 0;
  let tickLength = 1;
  let pausedProgress = 1;
  let pausedAt = 0;
  let frame = null;
  const effects = [];

  function loadBests() {
    try {
      return JSON.parse(localStorage.getItem("snake.best")) || {};
    } catch {
      return {};
    }
  }

  function reset() {
    stopTimer();
    game = Snake.create(SIZE, { wrap: mode === "wrap" });
    prevBody = game.body;
    eaten = null;
    effects.length = 0;
    stage.classList.remove("is-shaking");
    phase = "ready";
    newBest = false;
    update();
    draw();
  }

  function play() {
    if (phase === "paused") {
      const pausedFor = performance.now() - pausedAt;
      effects.forEach((effect) => {
        effect.start += pausedFor;
      });
      tickStart = performance.now() - pausedProgress * tickLength;
      startTimer(tickLength * (1 - pausedProgress));
    } else {
      beginTick();
      startTimer(tickLength);
    }
    phase = "playing";
    update();
    animate();
  }

  function interval() {
    const base = SPEEDS[speed];
    return Math.max(base * FASTEST_RATIO, base - game.score * SPEEDUP_PER_APPLE);
  }

  function beginTick() {
    tickLength = interval();
    tickStart = performance.now();
  }

  function startTimer(delay) {
    stopTimer();
    timer = setTimeout(tick, delay);
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = null;
  }

  function progress() {
    if (reducedMotion.matches) return 1;
    if (phase === "paused") return pausedProgress;
    return Math.min(1, (performance.now() - tickStart) / tickLength);
  }

  function animate() {
    if (frame === null) frame = requestAnimationFrame(render);
  }

  function render() {
    frame = null;
    draw();
    if (phase === "playing" || (phase !== "paused" && (progress() < 1 || effects.length))) animate();
  }

  function tick() {
    prevBody = game.body;
    const food = game.food;
    const result = Snake.step(game);
    eaten = result === "eat" ? food : null;
    beginTick();
    if (result === "eat") {
      beep(660, 0.07);
      burst(food, tickStart + (reducedMotion.matches ? 0 : tickLength));
    }
    if (result === "crash" || result === "win") finish(result);
    else startTimer(tickLength);
    update();
    animate();
  }

  function finish(result) {
    phase = "over";
    stopTimer();
    if (game.score > (bests[bestKey()] || 0)) {
      bests[bestKey()] = game.score;
      localStorage.setItem("snake.best", JSON.stringify(bests));
      newBest = true;
    }
    if (result === "win") {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => beep(freq, 0.12), i * 110));
    } else {
      beep(140, 0.3, "sawtooth");
      crashEffects();
    }
  }

  function steer(direction) {
    if (phase === "over" || phase === "paused") return;
    Snake.turn(game, direction);
    if (phase === "ready") play();
  }

  function togglePause() {
    if (phase === "playing") {
      pausedProgress = progress();
      pausedAt = performance.now();
      phase = "paused";
      stopTimer();
      update();
      draw();
    } else if (phase === "paused" || phase === "ready") {
      play();
    }
  }

  function setSpeed(next) {
    speed = next;
    localStorage.setItem("snake.speed", speed);
    reset();
  }

  function setMode(next) {
    mode = next;
    localStorage.setItem("snake.mode", mode);
    reset();
  }

  // Classic keeps the plain speed key so best scores saved before modes existed still count.
  function bestKey() {
    return mode === "classic" ? speed : `${mode}.${speed}`;
  }

  function update() {
    scoreEl.textContent = game.score;
    bestEl.textContent = bests[bestKey()] || 0;

    if (phase === "ready") {
      statusEl.textContent = touchScreen ? "Swipe or tap an arrow to start" : "Press an arrow key to start";
    } else if (phase === "playing") {
      statusEl.textContent = `Length ${game.body.length}`;
    } else if (phase === "paused") {
      statusEl.textContent = touchScreen ? "Paused, tap to resume" : "Paused, press space to resume";
    } else if (game.won) {
      statusEl.textContent = "You filled the whole board!";
    } else if (newBest) {
      statusEl.textContent = `New best: ${game.score}!`;
    } else {
      statusEl.textContent = `Game over, you scored ${game.score}`;
    }

    stage.classList.toggle("is-paused", phase === "paused");
    stage.classList.toggle("is-over", phase === "over");
    pauseButton.textContent = phase === "paused" ? "Resume" : "Pause";
    pauseButton.disabled = phase === "over";
    restartButton.textContent = phase === "over" ? "Play again" : "Restart";
    soundButton.textContent = soundOn ? "Sound on" : "Sound off";
    soundButton.setAttribute("aria-pressed", String(soundOn));
    speedButtons.forEach((button) => {
      const selected = button.dataset.speed === speed;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    modeButtons.forEach((button) => {
      const selected = button.dataset.mode === mode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const size = Math.round(canvas.clientWidth * ratio);
    if (canvas.width !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    draw();
  }

  function mix(from, to, amount) {
    const a = parseInt(from.slice(1), 16);
    const b = parseInt(to.slice(1), 16);
    const channel = (shift) => {
      const x = (a >> shift) & 255;
      const y = (b >> shift) & 255;
      return Math.round(x + (y - x) * amount);
    };
    return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
  }

  function draw() {
    if (!game || !canvas.width) return;
    const cell = canvas.width / SIZE;

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? COLORS.dark : COLORS.light;
        ctx.fillRect(x * cell, y * cell, cell + 1, cell + 1);
      }
    }

    const t = progress();
    if (eaten && t < 1) drawApple(eaten, cell);
    if (game.food) drawApple(game.food, cell, eaten ? t : 1);
    drawSnake(cell, t);
    drawEffects(cell);
  }

  // Effects are timestamped so an apple's burst can wait for the head to reach it.
  function burst(at, start) {
    sparks(at.x + 0.5, at.y + 0.5, [COLORS.apple, COLORS.apple, COLORS.leaf], start);
    effects.push({ kind: "label", x: at.x + 0.5, y: at.y + 0.5, text: "+1", start, life: 750 });
  }

  function crashEffects() {
    const now = performance.now();
    const head = game.body[0];
    const { x: dx, y: dy } = Snake.DIRECTIONS[game.direction];
    sparks(head.x + 0.5 + dx * 0.45, head.y + 0.5 + dy * 0.45, [COLORS.head, COLORS.tail, COLORS.eye], now);
    effects.push({ kind: "flash", start: now, life: 420 });
    if (reducedMotion.matches) return;
    stage.classList.remove("is-shaking");
    void stage.offsetWidth;
    stage.classList.add("is-shaking");
  }

  function sparks(x, y, colors, start) {
    if (reducedMotion.matches) return;
    for (let i = 0; i < SPARKS; i += 1) {
      const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.5;
      const reach = 0.7 + Math.random() * 0.6;
      effects.push({
        kind: "spark",
        x,
        y,
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * reach,
        color: colors[i % colors.length],
        start,
        life: 450,
      });
    }
  }

  function drawEffects(cell) {
    const now = phase === "paused" ? pausedAt : performance.now();
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      const age = (now - effect.start) / effect.life;
      if (age >= 1) {
        effects.splice(i, 1);
        continue;
      }
      if (age < 0) continue;
      const eased = 1 - (1 - age) ** 2;

      ctx.save();
      if (effect.kind === "flash") {
        ctx.fillStyle = `rgba(226, 59, 59, ${0.4 * (1 - age)})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (effect.kind === "spark") {
        ctx.globalAlpha = 1 - age;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(
          (effect.x + effect.dx * eased) * cell,
          (effect.y + effect.dy * eased) * cell,
          cell * 0.13 * (1 - age * 0.6),
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else {
        const rise = reducedMotion.matches ? 0 : 0.8 * eased;
        ctx.globalAlpha = 1 - age ** 3;
        ctx.font = `800 ${cell * 0.8}px "Avenir Next", "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = cell * 0.16;
        ctx.lineJoin = "round";
        ctx.strokeStyle = COLORS.leaf;
        ctx.fillStyle = "#fff";
        const px = effect.x * cell;
        const py = (effect.y - 0.6 - rise) * cell;
        ctx.strokeText(effect.text, px, py);
        ctx.fillText(effect.text, px, py);
      }
      ctx.restore();
    }
  }

  function drawApple(food, cell, scale = 1) {
    if (scale <= 0) return;
    ctx.save();
    ctx.translate((food.x + 0.5) * cell, (food.y + 0.55) * cell);
    ctx.scale(scale, scale);
    ctx.fillStyle = COLORS.apple;
    ctx.beginPath();
    ctx.arc(0, 0, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(-cell * 0.12, -cell * 0.12, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.leaf;
    ctx.beginPath();
    ctx.ellipse(cell * 0.1, -cell * 0.38, cell * 0.12, cell * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function lerp(from, to, t) {
    return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
  }

  function drawSnake(cell, t) {
    const body = game.body;
    const prev = prevBody || body;
    const last = body.length - 1;
    const crashed = phase === "over" && !game.won;

    // On a wrapping board each cell is moved next to the one before it, so the snake
    // is one unbroken path that can hang off an edge; copies shifted by a board's
    // width then draw the part that comes back in on the far side.
    const cells = [body[0]];
    for (let i = 1; i <= last; i += 1) cells.push(beside(body[i], cells[i - 1]));

    // The head slides into its new cell while the tail slides out of its old one;
    // the cells in between stay put, so corners are drawn exactly where they are.
    // A growing snake has no previous tail cell, so its tail holds still.
    const points = [
      lerp(beside(prev[0], cells[0]), cells[0], t),
      ...cells.slice(1),
      lerp(beside(prev[last] || body[last], cells[last]), cells[last], t),
    ];

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    [-SIZE, 0, SIZE].forEach((ox) => {
      [-SIZE, 0, SIZE].forEach((oy) => {
        if (Math.max(...xs) + ox < -1 || Math.min(...xs) + ox > SIZE) return;
        if (Math.max(...ys) + oy < -1 || Math.min(...ys) + oy > SIZE) return;
        ctx.save();
        ctx.translate(ox * cell, oy * cell);
        drawBody(points, cell);
        drawEyes(points[0], cell, crashed);
        ctx.restore();
      });
    });
  }

  function beside(cell, anchor) {
    return {
      x: cell.x + Math.round((anchor.x - cell.x) / SIZE) * SIZE,
      y: cell.y + Math.round((anchor.y - cell.y) / SIZE) * SIZE,
    };
  }

  function drawBody(points, cell) {
    ctx.lineCap = "round";
    ctx.lineWidth = cell * 0.76;
    for (let i = points.length - 2; i >= 0; i -= 1) {
      ctx.strokeStyle = mix(COLORS.head, COLORS.tail, i / (points.length - 2));
      ctx.beginPath();
      ctx.moveTo((points[i].x + 0.5) * cell, (points[i].y + 0.5) * cell);
      ctx.lineTo((points[i + 1].x + 0.5) * cell, (points[i + 1].y + 0.5) * cell);
      ctx.stroke();
    }
  }

  function drawEyes(head, cell, crashed) {
    const { x: dx, y: dy } = Snake.DIRECTIONS[game.direction];
    const cx = (head.x + 0.5) * cell + dx * cell * 0.12;
    const cy = (head.y + 0.5) * cell + dy * cell * 0.12;
    const spread = cell * 0.2;

    [-1, 1].forEach((side) => {
      const ex = cx + -dy * spread * side;
      const ey = cy + dx * spread * side;
      ctx.fillStyle = COLORS.eye;
      ctx.beginPath();
      ctx.arc(ex, ey, cell * 0.13, 0, Math.PI * 2);
      ctx.fill();

      if (crashed) {
        ctx.strokeStyle = COLORS.crashed;
        ctx.lineWidth = Math.max(1.5, cell * 0.05);
        const r = cell * 0.07;
        ctx.beginPath();
        ctx.moveTo(ex - r, ey - r);
        ctx.lineTo(ex + r, ey + r);
        ctx.moveTo(ex + r, ey - r);
        ctx.lineTo(ex - r, ey + r);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.pupil;
        ctx.beginPath();
        ctx.arc(ex + dx * cell * 0.04, ey + dy * cell * 0.04, cell * 0.065, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  function beep(freq, duration, type = "square") {
    if (!soundOn) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audio = audio || new AudioContextClass();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = KEYS[event.code];
    if (direction) {
      event.preventDefault();
      steer(direction);
    } else if (event.code === "Space" || event.code === "KeyP") {
      if (event.code === "Space" && event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      if (phase === "over") reset();
      else togglePause();
    } else if (event.code === "Enter" && phase === "over") {
      event.preventDefault();
      reset();
    }
  });

  let touchStart = null;
  canvas.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  canvas.addEventListener("touchend", (event) => {
    if (!touchStart) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) {
      if (phase === "over") reset();
      else togglePause();
    } else if (Math.abs(dx) > Math.abs(dy)) {
      steer(dx > 0 ? "right" : "left");
    } else {
      steer(dy > 0 ? "down" : "up");
    }
  });

  document.querySelectorAll("[data-direction]").forEach((button) => {
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      steer(button.dataset.direction);
    });
  });

  speedButtons.forEach((button) => {
    button.addEventListener("click", () => setSpeed(button.dataset.speed));
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.mode));
  });

  pauseButton.addEventListener("click", togglePause);
  restartButton.addEventListener("click", reset);
  soundButton.addEventListener("click", () => {
    soundOn = !soundOn;
    localStorage.setItem("snake.sound", soundOn ? "on" : "off");
    update();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && phase === "playing") togglePause();
  });

  new ResizeObserver(resize).observe(canvas);
  reset();
  resize();
})();
