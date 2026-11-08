(() => {
  const cellsEl = document.getElementById("cells");
  const tilesEl = document.getElementById("tiles");
  const statusEl = document.getElementById("status");
  const restartButton = document.getElementById("restart");

  let game;

  for (let i = 0; i < Game2048.SIZE * Game2048.SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cellsEl.append(cell);
  }

  function newGame() {
    game = Game2048.create();
    render();
  }

  function render() {
    tilesEl.replaceChildren(...game.tiles.map(tileElement));
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

  restartButton.addEventListener("click", newGame);

  newGame();
})();
