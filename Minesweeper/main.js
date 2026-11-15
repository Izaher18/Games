(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const minesEl = document.getElementById("mines");
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

  function mark(index) {
    const next = Minesweeper.cycleMark(game, index);
    if (!next) return;
    game = next;
    fresh = new Set();
    render();
  }

  function render() {
    const lost = game.status === "lost";
    const finished = lost || game.status === "won";
    minesEl.textContent = String(game.mines - Minesweeper.flagCount(game));
    const buttons = boardEl.children;
    for (let i = 0; i < game.mine.length; i += 1) paint(buttons[i], i, finished);
    fresh = new Set();

    if (game.status === "won") statusEl.textContent = "You cleared the board";
    else if (lost) statusEl.textContent = "Boom";
    else if (game.status === "playing") statusEl.textContent = "Keep going";
    else statusEl.textContent = "Clear every cell except the mines";
  }

  function paint(button, i, finished) {
    const coveredMine = finished && game.mine[i] && !game.flagged[i];
    const open = game.revealed[i] || coveredMine;
    button.className = "cell";
    button.replaceChildren();
    delete button.dataset.n;

    if (!open && game.flagged[i]) {
      button.append(flagIcon());
      const wrong = finished && !game.mine[i];
      if (wrong) button.classList.add("is-wrong");
      button.setAttribute("aria-label", wrong ? "Wrong flag" : "Flag");
      return;
    }

    if (!open && game.questioned[i]) {
      button.textContent = "?";
      button.classList.add("is-question");
      button.setAttribute("aria-label", "Question mark");
      return;
    }

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

  function flagIcon() {
    const flag = document.createElement("span");
    flag.className = "flag";
    flag.setAttribute("aria-hidden", "true");
    return flag;
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

  boardEl.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    event.preventDefault();
    mark(Number(cell.dataset.index));
  });

  restartButton.addEventListener("click", newGame);
  newGame();
})();
