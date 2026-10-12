(function () {
  "use strict";

  const { ROWS, COLS, Player, createGame } = ConnectFour;
  const DROP_MS = 360;

  const game = createGame();
  const boardEl = document.querySelector("#board");
  const stageEl = document.querySelector("#stage");
  const statusEl = document.querySelector("#status");
  const playerOneEl = document.querySelector("#player-one");
  const playerTwoEl = document.querySelector("#player-two");
  const restartEl = document.querySelector("#restart");

  const columns = [];
  let locked = false;
  let dropToken = 0;

  function sideName(player) {
    return player === Player.One ? "Red" : "Yellow";
  }

  function sideClass(player) {
    return player === Player.One ? "red" : "yellow";
  }

  function statusMessage() {
    if (game.winner) return sideName(game.winner) + " connects four.";
    if (game.isDraw) return "Draw. The board is full.";
    return sideName(game.current) + " to move.";
  }

  function build() {
    boardEl.replaceChildren();
    for (let col = 0; col < COLS; col += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "column";
      button.addEventListener("click", () => onColumn(col));

      const ghost = document.createElement("span");
      ghost.className = "ghost";
      ghost.setAttribute("aria-hidden", "true");
      button.append(ghost);

      for (let row = 0; row < ROWS; row += 1) {
        const slot = document.createElement("span");
        slot.className = "slot";
        button.append(slot);
      }

      columns.push(button);
      boardEl.append(button);
    }
  }

  function render(lastMove) {
    const board = game.board;
    const wins = new Set(game.winningCells.map(([row, col]) => row + ":" + col));
    const sample = columns[0].querySelector(".slot");
    const slotSize = sample.getBoundingClientRect().height;
    const gap = parseFloat(getComputedStyle(columns[0]).rowGap) || 0;

    stageEl.classList.toggle("is-over", game.isOver);
    stageEl.dataset.turn = sideClass(game.current);
    statusEl.textContent = statusMessage();

    const redActive =
      game.winner === Player.One || (!game.isOver && game.current === Player.One);
    const yellowActive =
      game.winner === Player.Two || (!game.isOver && game.current === Player.Two);
    playerOneEl.classList.toggle("is-active", redActive);
    playerTwoEl.classList.toggle("is-active", yellowActive);

    for (let col = 0; col < COLS; col += 1) {
      const button = columns[col];
      const columnFull = board[0][col] !== Player.None;
      button.disabled = game.isOver || columnFull;
      button.classList.toggle("is-full", columnFull);
      button.setAttribute(
        "aria-label",
        columnFull
          ? "Column " + (col + 1) + " is full"
          : game.isOver
            ? "Column " + (col + 1)
            : "Drop " + sideName(game.current) + " in column " + (col + 1)
      );

      const ghost = button.querySelector(".ghost");
      ghost.classList.toggle("red", game.current === Player.One);
      ghost.classList.toggle("yellow", game.current === Player.Two);

      const slots = button.querySelectorAll(".slot");
      for (let row = 0; row < ROWS; row += 1) {
        const slot = slots[row];
        const occupant = board[row][col];
        slot.classList.toggle("is-win", wins.has(row + ":" + col));
        slot.replaceChildren();
        if (occupant === Player.None) continue;

        const disc = document.createElement("span");
        disc.className = "disc " + sideClass(occupant);
        if (lastMove && lastMove.row === row && lastMove.col === col) {
          const fall = (row + 1) * (slotSize + gap);
          disc.style.setProperty("--fall", fall + "px");
          disc.classList.add("is-falling");
        }
        slot.append(disc);
      }
    }
  }

  function onColumn(col) {
    if (locked) return;
    const result = game.drop(col);
    if (!result.ok) return;
    locked = true;
    const token = ++dropToken;
    render(result);
    window.setTimeout(() => {
      if (token === dropToken) locked = false;
    }, DROP_MS);
  }

  restartEl.addEventListener("click", () => {
    dropToken += 1;
    locked = false;
    game.reset();
    render(null);
  });

  build();
  render(null);
})();
