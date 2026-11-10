(() => {
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

  const cellsEl = document.getElementById("cells");
  const tilesEl = document.getElementById("tiles");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const restartButton = document.getElementById("restart");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const keepGoingButton = document.getElementById("keep-going");
  const tryAgainButton = document.getElementById("try-again");

  let game;
  let best = Number(localStorage.getItem("2048.best")) || 0;
  let bestAtStart = best;
  let celebrating = false;

  for (let i = 0; i < Game2048.SIZE * Game2048.SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cellsEl.append(cell);
  }

  function newGame() {
    game = Game2048.create();
    bestAtStart = best;
    celebrating = false;
    render();
  }

  function play(direction) {
    if (celebrating) return;
    const result = Game2048.move(game, direction);
    if (!result) return;
    game = result.state;
    if (game.score > best) {
      best = game.score;
      localStorage.setItem("2048.best", best);
    }
    celebrating = result.justWon;
    render();
  }

  function keepGoing() {
    celebrating = false;
    render();
  }

  function render() {
    tilesEl.replaceChildren(...game.tiles.map(tileElement));
    scoreEl.textContent = game.score;
    bestEl.textContent = best;

    if (celebrating) {
      statusEl.textContent = "You reached 2048!";
    } else if (game.over) {
      statusEl.textContent = game.score > bestAtStart ? `New best: ${game.score}!` : `Game over, you scored ${game.score}`;
    } else if (game.won) {
      statusEl.textContent = "Keep going, how high can you get?";
    } else {
      statusEl.textContent = "Join the tiles to reach 2048";
    }

    const showOverlay = celebrating || game.over;
    const wasHidden = overlay.hidden;
    overlay.hidden = !showOverlay;
    overlay.classList.toggle("is-won", celebrating);
    overlayTitle.textContent = celebrating ? "You made 2048!" : "No moves left";
    keepGoingButton.hidden = !celebrating;
    if (showOverlay && wasHidden) (celebrating ? keepGoingButton : tryAgainButton).focus();
  }

  function tileElement(tile) {
    const el = document.createElement("div");
    el.className = "tile";
    el.textContent = tile.value;
    el.dataset.value = tile.value;
    el.dataset.digits = String(tile.value).length;
    el.classList.toggle("is-super", tile.value > Game2048.WIN);
    el.style.setProperty("--x", tile.x);
    el.style.setProperty("--y", tile.y);
    return el;
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const direction = KEYS[event.code];
    if (!direction) return;
    event.preventDefault();
    play(direction);
  });

  restartButton.addEventListener("click", newGame);
  tryAgainButton.addEventListener("click", newGame);
  keepGoingButton.addEventListener("click", keepGoing);

  newGame();
})();
