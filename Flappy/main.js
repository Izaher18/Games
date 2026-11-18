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

  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const helpEl = document.getElementById("help");
  const restartButton = document.getElementById("restart");

  let game;
  let lastTime = null;
  let carry = 0;
  let overAt = 0;
  let shownStatus = null;
  let best = Number(readStorage("flappy.best")) || 0;
  let bestAtStart = best;
  let tilt = 0;
  let wingPhase = 0;
  // How far the scenery has slid. It keeps going between games and stops when the bird crashes.
  let scroll = 0;

  function newGame() {
    game = Flappy.create();
    carry = 0;
    overAt = 0;
    bestAtStart = best;
    tilt = 0;
    wingPhase = 0;
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

  function scored() {
    if (game.score <= best) return;
    best = game.score;
    writeStorage("flappy.best", String(best));
  }

  function flap() {
    if (game.status === "over") {
      if (game.landed && performance.now() - overAt > RESTART_DELAY_MS) {
        newGame();
        Flappy.flap(game);
      }
      return;
    }
    Flappy.flap(game);
  }

  function frame(now) {
    const elapsed = lastTime === null ? 0 : Math.min(MAX_FRAME, (now - lastTime) / 1000);
    lastTime = now;
    carry += elapsed;
    while (carry >= STEP) {
      const events = Flappy.step(game, STEP);
      if (events.scored) scored();
      if (events.crashed) overAt = now;
      carry -= STEP;
    }
    if (game.status !== "over") scroll += game.speed * elapsed;
    animateBird(elapsed);
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
    if (game.status !== "ready") drawScore();
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
    const overhang = 4;
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

    let text;
    if (game.status === "ready") text = "Flap to start";
    else if (game.status === "playing") text = "Fly through the gaps";
    else if (game.score > bestAtStart) text = `New best: ${game.score}!`;
    else text = `Game over, you scored ${game.score}`;
    if (text === shownStatus) return;
    shownStatus = text;
    statusEl.textContent = text;
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
    if (event.code === "Space" && event.target instanceof Element && event.target.closest("button")) return;
    event.preventDefault();
    flap();
  });

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    flap();
  });

  restartButton.addEventListener("click", () => {
    newGame();
    restartButton.blur();
  });

  if (window.matchMedia("(pointer: coarse)").matches) helpEl.textContent = "Tap the field to flap";

  newGame();
  requestAnimationFrame(frame);
})();
