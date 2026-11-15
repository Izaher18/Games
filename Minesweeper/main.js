(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const restartButton = document.getElementById("restart");

  let game = Minesweeper.create("easy");
  let fresh = new Set();

  function newGame() {
    game = Minesweeper.create("easy");
    fresh = new Set();
    build();
    render();
  }

  function build() {
    boardEl.style.setProperty("--cols", String(game.width));
    boardEl.replaceChildren();
    for (let i = 0; i < game.mine.length; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "cell";
      button.dataset.index = String(i);
      button.tabIndex = -1;
      button.setAttribute("role", "gridcell");
      button.setAttribute("aria-rowindex", String(Math.floor(i / game.width) + 1));
      button.setAttribute("aria-colindex", String((i % game.width) + 1));
      boardEl.append(button);
    }
  }

  function reveal(index) {
    const result = Minesweeper.reveal(game, index);
    if (!result) return;
    game = result.state;
    fresh = new Set(result.opened);
    render();
  }

  function render() {
    const lost = game.status === "lost";
    const buttons = boardEl.children;
    for (let i = 0; i < game.mine.length; i += 1) paint(buttons[i], i, lost);
    fresh = new Set();

    if (game.status === "won") statusEl.textContent = "You cleared the board";
    else if (lost) statusEl.textContent = "Boom";
    else if (game.status === "playing") statusEl.textContent = "Keep going";
    else statusEl.textContent = "Clear every cell except the mines";
  }

  function paint(button, i, lost) {
    const open = game.revealed[i] || (lost && game.mine[i]);
    button.className = "cell";
    button.replaceChildren();
    delete button.dataset.n;

    if (!open) {
      button.setAttribute("aria-label", "Hidden");
      return;
    }

    button.classList.add("is-open");
    if (fresh.has(i)) button.classList.add("is-fresh");

    if (game.mine[i]) {
      button.classList.add("is-mine");
      if (i === game.hit) button.classList.add("is-hit");
      button.append(mineIcon());
      button.setAttribute("aria-label", i === game.hit ? "Exploded mine" : "Mine");
      return;
    }

    const number = game.adjacent[i];
    if (number > 0) {
      button.dataset.n = String(number);
      button.textContent = String(number);
      button.setAttribute("aria-label", String(number));
    } else {
      button.setAttribute("aria-label", "Empty");
    }
  }

  function mineIcon() {
    const mine = document.createElement("span");
    const cross = document.createElement("span");
    const ball = document.createElement("span");
    mine.className = "mine";
    cross.className = "mine-cross";
    ball.className = "mine-ball";
    mine.setAttribute("aria-hidden", "true");
    mine.append(cross, ball);
    return mine;
  }

  boardEl.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    reveal(Number(cell.dataset.index));
  });

  restartButton.addEventListener("click", newGame);
  newGame();
})();
