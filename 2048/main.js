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

  let game;
  let best = Number(localStorage.getItem("2048.best")) || 0;

  for (let i = 0; i < Game2048.SIZE * Game2048.SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cellsEl.append(cell);
  }

  function newGame() {
    game = Game2048.create();
    render();
  }

  function play(direction) {
    const result = Game2048.move(game, direction);
    if (!result) return;
    game = result.state;
    if (game.score > best) {
      best = game.score;
      localStorage.setItem("2048.best", best);
    }
    render();
  }

  function render() {
    tilesEl.replaceChildren(...game.tiles.map(tileElement));
    scoreEl.textContent = game.score;
    bestEl.textContent = best;
    statusEl.textContent = "Join the tiles to reach 2048";
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

  newGame();
})();
