(() => {
  const STEP = 1 / 120;
  // Long pauses (a background tab, a debugger) would otherwise replay seconds of physics at once.
  const MAX_FRAME = 0.25;
  // Taps that land right after a crash shouldn't start the next game by accident.
  const RESTART_DELAY_MS = 450;
  // The bird noses up to UP_TILT after a flap and dives to DOWN_TILT (radians) as it falls.
  const UP_TILT = -0.45;
  const DOWN_TILT = 1.35;
  const TILT_EASE = 12;
  // Background layers slide at a fraction of the pipe speed so they look farther away.
  const CLOUD_DEPTH = 0.12;
  const FAR_HILL_DEPTH = 0.25;
  const NEAR_HILL_DEPTH = 0.5;
  // Clouds repeat every CLOUD_TILE pixels; each entry is a puff cluster's left edge, height, and size.
  const CLOUD_TILE = 640;
  const CLOUDS = [
    { x: 30, y: 90, size: 1 },
    { x: 250, y: 150, size: 0.7 },
    { x: 420, y: 70, size: 1.2 },
    { x: 560, y: 190, size: 0.8 },
  ];
  const STRIPE = 24;
  const MEDAL_COLORS = {
    bronze: { rim: "#92400e", face: "#d6925a", shine: "#f3c9a1" },
    silver: { rim: "#57534e", face: "#d6d3d1", shine: "#fafaf9" },
    gold: { rim: "#a16207", face: "#facc15", shine: "#fef08a" },
  };
  const PANEL_SLIDE = 0.35;
  const FEATHER_LIFE = 0.9;
  const POP_LIFE = 0.7;
  const FLASH_LIFE = 0.28;

  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const helpEl = document.getElementById("help");
  const restartButton = document.getElementById("restart");
  const pauseButton = document.getElementById("pause");
  const autopilotButton = document.getElementById("autopilot");
  const soundButton = document.getElementById("sound");
  const levelButtons = [...document.querySelectorAll(".mode")];

  let level = readStorage("flappy.level");
  if (!Flappy.LEVELS[level]) level = "normal";
  let game;
  let lastTime = null;
  let carry = 0;
  let overAt = 0;
  let shownStatus = null;
  let best = 0;
  let bestAtStart = 0;
  let tilt = 0;
  let wingPhase = 0;
  // How far the scenery has slid. It keeps going between games and stops when the bird crashes.
  let scroll = 0;
  let clock = 0;
  let paused = false;
  let autopilot = false;
  // Games the computer helped with don't count toward the best score.
  let assisted = false;
  let soundOn = readStorage("flappy.sound") !== "off";
  let audio = null;
  let feathers = [];
  let pops = [];
  let flashUntil = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function newGame() {
    game = Flappy.create({ level });
    carry = 0;
    overAt = 0;
    best = loadBest();
    bestAtStart = best;
    tilt = 0;
    wingPhase = 0;
    paused = false;
    assisted = false;
    feathers = [];
    pops = [];
    flashUntil = 0;
    stageEl.classList.remove("is-shaking");
    syncLevelButtons();
  }

  function loadBest() {
    return Number(readStorage(`flappy.best.${level}`)) || 0;
  }

  function syncLevelButtons() {
    levelButtons.forEach((button) => {
      const selected = button.dataset.level === level;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  }

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
      // Private browsing can reject storage. The game still plays.
    }
  }

  function scored(points) {
    if (!assisted && game.score > best) {
      best = game.score;
      writeStorage(`flappy.best.${level}`, String(best));
    }
    for (let i = 0; i < points; i += 1) {
      pops.push({
        x: game.bird.x,
        y: game.bird.y - 24,
        age: 0,
        life: POP_LIFE,
      });
    }
    beep(660, 0.08, "square");
    beep(880, 0.1, "square");
  }

  function crashed() {
    overAt = clock;
    spawnFeathers();
    flashUntil = clock + FLASH_LIFE * 1000;
    if (!reduceMotion) {
      stageEl.classList.remove("is-shaking");
      void stageEl.offsetWidth;
      stageEl.classList.add("is-shaking");
    }
    beep(180, 0.18, "sawtooth");
    beep(90, 0.28, "square");
  }

  function spawnFeathers() {
    const { x, y } = game.bird;
    for (let i = 0; i < 14; i += 1) {
      const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
      const speed = 80 + Math.random() * 160;
      feathers.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        spin: (Math.random() - 0.5) * 10,
        rot: Math.random() * Math.PI,
        age: 0,
        life: FEATHER_LIFE * (0.7 + Math.random() * 0.5),
      });
    }
  }

  function flap(fromAI = false) {
    if (paused) {
      paused = false;
      lastTime = null;
    }
    if (game.status === "over") {
      if (game.landed && performance.now() - overAt > RESTART_DELAY_MS) {
        newGame();
        if (fromAI) assisted = true;
        if (Flappy.flap(game)) beep(520, 0.06, "triangle");
      }
      return;
    }
    if (fromAI) assisted = true;
    if (Flappy.flap(game)) beep(520, 0.06, "triangle");
  }

  function togglePause() {
    if (game.status === "over") return;
    paused = !paused;
    lastTime = null;
    renderStatus();
  }

  function toggleAutopilot() {
    autopilot = !autopilot;
    if (autopilot && game.status === "ready") flap(true);
    renderStatus();
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

  function frame(now) {
    const elapsed = lastTime === null ? 0 : Math.min(MAX_FRAME, (now - lastTime) / 1000);
    lastTime = now;
    clock = now;

    if (!paused) {
      carry += elapsed;
      while (carry >= STEP) {
        if (autopilot && FlappyAI.shouldFlap(game)) flap(true);
        const events = Flappy.step(game, STEP);
        if (events.scored) scored(events.scored);
        if (events.crashed) crashed();
        carry -= STEP;
      }
      if (game.status !== "over") scroll += game.speed * elapsed;
      animateBird(elapsed);
      updateEffects(elapsed);
    }

    draw();
    renderStatus();
    requestAnimationFrame(frame);
  }

  function animateBird(elapsed) {
    const { vy } = game.bird;
    let target = 0;
    if (game.status !== "ready") target = vy < 0 ? UP_TILT : (vy / Flappy.MAX_FALL) * DOWN_TILT;
    tilt += (target - tilt) * Math.min(1, elapsed * TILT_EASE);

    // Wings beat fast on the way up, lazily while gliding, and stop once the bird has landed.
    if (game.landed) return;
    const speed = game.status === "ready" ? 9 : vy < 0 ? 24 : 11;
    wingPhase = (wingPhase + elapsed * speed) % (Math.PI * 2);
  }

  function updateEffects(elapsed) {
    feathers = feathers.filter((f) => {
      f.age += elapsed;
      f.x += f.vx * elapsed;
      f.y += f.vy * elapsed;
      f.vy += 420 * elapsed;
      f.rot += f.spin * elapsed;
      return f.age < f.life;
    });
    pops = pops.filter((p) => {
      p.age += elapsed;
      p.y -= 40 * elapsed;
      return p.age < p.life;
    });
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function draw() {
    resize();
    ctx.setTransform(canvas.width / Flappy.WIDTH, 0, 0, canvas.height / Flappy.HEIGHT, 0, 0);
    drawSky();
    drawClouds();
    drawHills(FAR_HILL_DEPTH, game.floor - 70, 36, "#a7d8a0");
    drawHills(NEAR_HILL_DEPTH, game.floor - 28, 26, "#7cc576");
    game.pipes.forEach(drawPipe);
    drawGround();
    drawBird();
    drawFeathers();
    drawPops();
    if (game.status === "over" && game.landed) drawPanel();
    else if (game.status !== "ready") drawScore();
    if (paused) drawPause();
    drawFlash();
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawMedal(cx, cy, name) {
    const { rim, face, shine } = MEDAL_COLORS[name];
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = shine;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 21, Math.PI * 1.05, Math.PI * 1.65);
    ctx.stroke();
    ctx.fillStyle = rim;
    ctx.font = "800 26px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", 0, 2);
    ctx.restore();
  }

  function drawPanel() {
    const age = Math.min(1, (clock - overAt) / 1000 / PANEL_SLIDE);
    const eased = 1 - (1 - age) * (1 - age);
    const width = 280;
    const height = 220;
    const x = (game.width - width) / 2;
    const y = 110 - (1 - eased) * 40;
    const earned = Flappy.medal(game.score);
    const newBest = !assisted && game.score > bestAtStart;

    ctx.save();
    ctx.globalAlpha = eased;
    ctx.fillStyle = "#fffbeb";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 4;
    roundedRect(x, y, width, height, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#1c1917";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 30px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText("Game over", game.width / 2, y + 44);

    ctx.font = "700 14px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillStyle = "#78716c";
    ctx.textAlign = "left";
    ctx.fillText("MEDAL", x + 28, y + 86);
    ctx.textAlign = "right";
    ctx.fillText("SCORE", x + width - 28, y + 86);
    ctx.fillText("BEST", x + width - 28, y + 146);

    ctx.fillStyle = "#1c1917";
    ctx.font = "800 34px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.fillText(String(game.score), x + width - 28, y + 118);
    ctx.fillText(String(Math.max(best, assisted ? bestAtStart : game.score)), x + width - 28, y + 178);

    if (earned) {
      drawMedal(x + 70, y + 138, earned);
    } else {
      ctx.strokeStyle = "#d6d3d1";
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(x + 70, y + 138, 31, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (newBest) {
      ctx.fillStyle = "#e11d48";
      roundedRect(x + width - 118, y + 132, 44, 20, 6);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "800 12px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("NEW", x + width - 96, y + 142);
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = eased;
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.font = "800 20px 'Avenir Next', 'Segoe UI', sans-serif";
    const hint = "Flap to play again";
    ctx.strokeText(hint, game.width / 2, y + height + 40);
    ctx.fillText(hint, game.width / 2, y + height + 40);
    ctx.restore();
  }

  function drawScore() {
    ctx.save();
    ctx.font = "800 56px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.lineJoin = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1c1917";
    ctx.fillStyle = "#fff";
    ctx.strokeText(String(game.score), game.width / 2, 36);
    ctx.fillText(String(game.score), game.width / 2, 36);
    ctx.restore();
  }

  function drawPause() {
    ctx.fillStyle = "rgba(28, 25, 23, 0.35)";
    ctx.fillRect(0, 0, game.width, game.height);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 6;
    ctx.lineJoin = "round";
    ctx.font = "800 42px 'Avenir Next', 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeText("Paused", game.width / 2, game.floor / 2);
    ctx.fillText("Paused", game.width / 2, game.floor / 2);
  }

  function drawFlash() {
    if (clock >= flashUntil) return;
    const left = (flashUntil - clock) / 1000 / FLASH_LIFE;
    ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * left})`;
    ctx.fillRect(0, 0, game.width, game.height);
  }

  function drawFeathers() {
    feathers.forEach((f) => {
      const alpha = 1 - f.age / f.life;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fef3c7";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  function drawPops() {
    pops.forEach((p) => {
      const alpha = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 4;
      ctx.font = "800 22px 'Avenir Next', 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeText("+1", p.x, p.y);
      ctx.fillText("+1", p.x, p.y);
      ctx.restore();
    });
  }

  function drawSky() {
    const sky = ctx.createLinearGradient(0, 0, 0, game.floor);
    sky.addColorStop(0, "#7dd3fc");
    sky.addColorStop(1, "#e0f2fe");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, game.width, game.floor);
  }

  function drawClouds() {
    const offset = (scroll * CLOUD_DEPTH) % CLOUD_TILE;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    for (let tile = -offset; tile < game.width; tile += CLOUD_TILE) {
      CLOUDS.forEach(({ x, y, size }) => {
        const left = tile + x;
        if (left > game.width || left + 110 * size < 0) return;
        ctx.beginPath();
        ctx.arc(left + 26 * size, y, 22 * size, 0, Math.PI * 2);
        ctx.arc(left + 56 * size, y - 14 * size, 28 * size, 0, Math.PI * 2);
        ctx.arc(left + 86 * size, y, 22 * size, 0, Math.PI * 2);
        ctx.rect(left + 26 * size, y, 60 * size, 22 * size);
        ctx.fill();
      });
    }
  }

  // Two sine waves of different lengths make a hill line that doesn't visibly repeat.
  function drawHills(depth, base, height, color) {
    const offset = scroll * depth;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, game.floor);
    for (let x = 0; x <= game.width; x += 8) {
      const at = x + offset;
      const rise = Math.sin(at * 0.011) * 0.6 + Math.sin(at * 0.027 + 1.3) * 0.4;
      ctx.lineTo(x, base - (rise + 1) * height * 0.5);
    }
    ctx.lineTo(game.width, game.floor);
    ctx.closePath();
    ctx.fill();
  }

  function drawPipe(pipe) {
    const top = pipe.gapY - game.gap / 2;
    const bottom = pipe.gapY + game.gap / 2;
    const lip = 22;
    const overhang = Flappy.PIPE_OVERHANG;
    const body = ctx.createLinearGradient(pipe.x, 0, pipe.x + Flappy.PIPE_WIDTH, 0);
    body.addColorStop(0, "#4ade80");
    body.addColorStop(0.45, "#86efac");
    body.addColorStop(1, "#16a34a");
    ctx.fillStyle = body;
    ctx.strokeStyle = "#14532d";
    ctx.lineWidth = 2;

    ctx.fillRect(pipe.x, 0, Flappy.PIPE_WIDTH, top - lip);
    ctx.strokeRect(pipe.x, -2, Flappy.PIPE_WIDTH, top - lip + 2);
    ctx.fillRect(pipe.x - overhang, top - lip, Flappy.PIPE_WIDTH + overhang * 2, lip);
    ctx.strokeRect(pipe.x - overhang, top - lip, Flappy.PIPE_WIDTH + overhang * 2, lip);

    ctx.fillRect(pipe.x - overhang, bottom, Flappy.PIPE_WIDTH + overhang * 2, lip);
    ctx.strokeRect(pipe.x - overhang, bottom, Flappy.PIPE_WIDTH + overhang * 2, lip);
    ctx.fillRect(pipe.x, bottom + lip, Flappy.PIPE_WIDTH, game.floor - bottom - lip);
    ctx.strokeRect(pipe.x, bottom + lip, Flappy.PIPE_WIDTH, game.floor - bottom - lip + 2);
  }

  function drawGround() {
    const grass = 14;
    ctx.fillStyle = "#ded895";
    ctx.fillRect(0, game.floor, game.width, game.height - game.floor);
    ctx.fillStyle = "#73bf2e";
    ctx.fillRect(0, game.floor, game.width, grass);

    ctx.fillStyle = "#9be15d";
    const offset = scroll % STRIPE;
    for (let x = -offset - STRIPE; x < game.width + STRIPE; x += STRIPE) {
      ctx.beginPath();
      ctx.moveTo(x, game.floor + grass);
      ctx.lineTo(x + STRIPE / 2, game.floor + grass);
      ctx.lineTo(x + STRIPE / 2 + grass, game.floor);
      ctx.lineTo(x + grass, game.floor);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = "#4d7c0f";
    ctx.fillRect(0, game.floor + grass, game.width, 3);
    ctx.fillStyle = "#c9c27d";
    for (let x = -(scroll % 40); x < game.width; x += 40) {
      ctx.fillRect(x + 6, game.floor + 34, 14, 3);
      ctx.fillRect(x + 26, game.floor + 58, 10, 3);
    }
  }

  function drawBird() {
    const { x, y } = game.bird;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = "#facc15";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const beat = Math.sin(wingPhase);
    ctx.save();
    ctx.translate(-6, 2);
    ctx.rotate(-0.3 - beat * 0.55);
    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.ellipse(-3, beat * 2, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.arc(9, -5, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(25, 3);
    ctx.lineTo(13, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  function renderStatus() {
    if (scoreEl.textContent !== String(game.score)) scoreEl.textContent = game.score;
    if (bestEl.textContent !== String(best)) bestEl.textContent = best;
    pauseButton.disabled = game.status === "over";
    pauseButton.textContent = paused ? "Resume" : "Pause";
    autopilotButton.setAttribute("aria-pressed", String(autopilot));
    autopilotButton.textContent = autopilot ? "Take over" : "Watch AI";
    soundButton.setAttribute("aria-pressed", String(soundOn));
    soundButton.textContent = soundOn ? "Sound on" : "Sound off";

    let text;
    if (paused) text = "Paused";
    else if (game.status === "ready") text = "Flap to start";
    else if (game.status === "playing") text = autopilot ? "The computer is flying" : "Fly through the gaps";
    else if (assisted) text = `Game over, scored ${game.score} with the AI's help`;
    else if (game.score > bestAtStart) text = `New best: ${game.score}!`;
    else text = `Game over, you scored ${game.score}`;
    if (text === shownStatus) return;
    shownStatus = text;
    statusEl.textContent = text;
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
    if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
    if (event.code === "Space" && event.target instanceof Element && event.target.closest("button")) return;
    event.preventDefault();
    if (autopilot) autopilot = false;
    flap(false);
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (autopilot) autopilot = false;
    flap(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && game.status === "playing" && !paused) {
      paused = true;
      lastTime = null;
      renderStatus();
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
    writeStorage("flappy.sound", soundOn ? "on" : "off");
    renderStatus();
    soundButton.blur();
  });

  restartButton.addEventListener("click", () => {
    newGame();
    restartButton.blur();
  });

  levelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.level === level) return;
      level = button.dataset.level;
      writeStorage("flappy.level", level);
      autopilot = false;
      newGame();
    });
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    helpEl.textContent = "Tap the field to flap · Pause and Watch AI are below the board";
  }

  newGame();
  requestAnimationFrame(frame);
})();
