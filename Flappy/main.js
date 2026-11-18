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
    animateBird(elapsed);
    draw();
    renderStatus();
    requestAnimationFrame(frame);
  }

  function animateBird(elapsed) {
    const { vy } = game.bird;
    let target = 0;
    if (game.status !== "ready") {
      const fall = vy < 0 ? vy / Flappy.FLAP_SPEED : vy / Flappy.MAX_FALL;
      target = fall < 0 ? -fall * UP_TILT : fall * DOWN_TILT;
    }
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
    ctx.fillStyle = "#ded895";
    ctx.fillRect(0, game.floor, game.width, game.height - game.floor);
    ctx.fillStyle = "#73bf2e";
    ctx.fillRect(0, game.floor, game.width, 14);
    ctx.fillStyle = "#4d7c0f";
    ctx.fillRect(0, game.floor + 14, game.width, 3);
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
