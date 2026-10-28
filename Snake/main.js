(() => {
  const SIZE = 18;
  const SPEEDS = { slow: 150, normal: 110, fast: 75 };
  const SPEEDUP_PER_APPLE = 1.5;
  const FASTEST_RATIO = 0.6;
  const SWIPE_DISTANCE = 24;
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
  const touchScreen = window.matchMedia("(pointer: coarse)").matches;

  let speed = SPEEDS[localStorage.getItem("snake.speed")] ? localStorage.getItem("snake.speed") : "normal";
  let soundOn = localStorage.getItem("snake.sound") !== "off";
  const bests = loadBests();
  let game;
  let phase;
  let timer = null;
  let newBest = false;
  let audio = null;

  function loadBests() {
    try {
      return JSON.parse(localStorage.getItem("snake.best")) || {};
    } catch {
      return {};
    }
  }

  function reset() {
    stopTimer();
    game = Snake.create(SIZE);
    phase = "ready";
    newBest = false;
    update();
    draw();
  }

  function play() {
    phase = "playing";
    schedule();
    update();
    draw();
  }

  function interval() {
    const base = SPEEDS[speed];
    return Math.max(base * FASTEST_RATIO, base - game.score * SPEEDUP_PER_APPLE);
  }

  function schedule() {
    stopTimer();
    timer = setTimeout(tick, interval());
  }

  function stopTimer() {
    clearTimeout(timer);
    timer = null;
  }

  function tick() {
    const result = Snake.step(game);
    if (result === "eat") beep(660, 0.07);
    if (result === "crash" || result === "win") finish(result);
    else schedule();
    update();
    draw();
  }

  function finish(result) {
    phase = "over";
    stopTimer();
    if (game.score > (bests[speed] || 0)) {
      bests[speed] = game.score;
      localStorage.setItem("snake.best", JSON.stringify(bests));
      newBest = true;
    }
    if (result === "win") {
      [523, 659, 784, 1047].forEach((freq, i) => setTimeout(() => beep(freq, 0.12), i * 110));
    } else {
      beep(140, 0.3, "sawtooth");
    }
  }

  function steer(direction) {
    if (phase === "over" || phase === "paused") return;
    Snake.turn(game, direction);
    if (phase === "ready") play();
  }

  function togglePause() {
    if (phase === "playing") {
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

  function update() {
    scoreEl.textContent = game.score;
    bestEl.textContent = bests[speed] || 0;

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

    if (game.food) drawApple(game.food, cell);
    drawSnake(cell);
  }

  function drawApple(food, cell) {
    const cx = (food.x + 0.5) * cell;
    const cy = (food.y + 0.55) * cell;
    ctx.fillStyle = COLORS.apple;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.beginPath();
    ctx.arc(cx - cell * 0.12, cy - cell * 0.12, cell * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.leaf;
    ctx.beginPath();
    ctx.ellipse(cx + cell * 0.1, cy - cell * 0.38, cell * 0.12, cell * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSnake(cell) {
    const body = game.body;
    const inset = cell * 0.12;
    const width = cell - inset * 2;
    const crashed = phase === "over" && !game.won;

    for (let i = body.length - 1; i >= 0; i -= 1) {
      const part = body[i];
      const color = mix(COLORS.head, COLORS.tail, body.length > 1 ? i / (body.length - 1) : 0);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(part.x * cell + inset, part.y * cell + inset, width, width, cell * 0.28);
      ctx.fill();

      const ahead = body[i - 1];
      if (ahead) {
        const left = Math.min(part.x, ahead.x) * cell;
        const top = Math.min(part.y, ahead.y) * cell;
        if (part.y === ahead.y) ctx.fillRect(left + cell / 2, top + inset, cell, width);
        else ctx.fillRect(left + inset, top + cell / 2, width, cell);
      }
    }

    drawEyes(body[0], cell, crashed);
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
