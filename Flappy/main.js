(() => {
  const STEP = 1 / 120;
  // Long pauses (a background tab, a debugger) would otherwise replay seconds of physics at once.
  const MAX_FRAME = 0.25;
  // Taps that land right after a crash shouldn't start the next game by accident.
  const RESTART_DELAY_MS = 450;

  const canvas = document.getElementById("field");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const helpEl = document.getElementById("help");
  const restartButton = document.getElementById("restart");

  let game;
  let lastTime = null;
  let carry = 0;
  let overAt = 0;
  let shownStatus = null;

  function newGame() {
    game = Flappy.create();
    carry = 0;
    overAt = 0;
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
      if (events.crashed) overAt = now;
      carry -= STEP;
    }
    draw();
    renderStatus();
    requestAnimationFrame(frame);
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

    ctx.fillStyle = "#facc15";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#fef3c7";
    ctx.beginPath();
    ctx.ellipse(-7, 3, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

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
    let text;
    if (game.status === "ready") text = "Flap to start";
    else if (game.status === "playing") text = "Fly through the gaps";
    else text = "Game over";
    if (text === shownStatus) return;
    shownStatus = text;
    statusEl.textContent = text;
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    if (event.code !== "Space" && event.code !== "ArrowUp" && event.code !== "KeyW") return;
    if (event.code === "Space" && event.target.closest("button")) return;
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
