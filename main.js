(function () {
  "use strict";

  const { ROWS, COLS, Player, createGame } = ConnectFour;
  const DROP_MS = 360;
  const THINK_MS = 280;

  const game = createGame();
  const boardEl = document.querySelector("#board");
  const stageEl = document.querySelector("#stage");
  const statusEl = document.querySelector("#status");
  const kickerEl = document.querySelector("#kicker");
  const playerOneEl = document.querySelector("#player-one");
  const playerTwoEl = document.querySelector("#player-two");
  const playerOneNameEl = document.querySelector("#player-one-name");
  const playerTwoNameEl = document.querySelector("#player-two-name");
  const restartEl = document.querySelector("#restart");
  const modeComputerEl = document.querySelector("#mode-computer");
  const modePeopleEl = document.querySelector("#mode-people");

  const columns = [];
  let locked = false;
  let thinking = false;
  let versusComputer = true;
  let dropToken = 0;

  function sideName(player) {
    if (versusComputer) return player === Player.One ? "You" : "Computer";
    return player === Player.One ? "Red" : "Yellow";
  }

  function sideClass(player) {
    return player === Player.One ? "red" : "yellow";
  }

  function statusMessage() {
    if (game.winner) {
      if (versusComputer) {
        return game.winner === Player.One ? "You win." : "Computer wins.";
      }
      return sideName(game.winner) + " connects four.";
    }
    if (game.isDraw) return "Draw. The board is full.";
    if (versusComputer && game.current === Player.Two) return "Computer is choosing a column.";
    if (versusComputer) return "Your turn.";
    return sideName(game.current) + " to move.";
  }

  function syncChrome() {
    kickerEl.textContent = versusComputer ? "Versus computer" : "Two players";
    playerOneNameEl.textContent = versusComputer ? "You" : "Red";
    playerTwoNameEl.textContent = versusComputer ? "Computer" : "Yellow";
    modeComputerEl.classList.toggle("is-selected", versusComputer);
    modePeopleEl.classList.toggle("is-selected", !versusComputer);
    modeComputerEl.setAttribute("aria-pressed", String(versusComputer));
    modePeopleEl.setAttribute("aria-pressed", String(!versusComputer));
    playerTwoEl.classList.toggle("is-thinking", thinking);
    boardEl.setAttribute("aria-busy", thinking ? "true" : "false");
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
    const humanCanPlay =
      !game.isOver && !locked && !thinking && (!versusComputer || game.current === Player.One);

    stageEl.classList.toggle("is-over", game.isOver);
    stageEl.classList.toggle("is-thinking", thinking);
    stageEl.dataset.turn = sideClass(game.current);
    syncChrome();
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
      const computerTurn = versusComputer && game.current === Player.Two;
      button.disabled = !humanCanPlay || columnFull;
      button.classList.toggle("is-full", columnFull);
      button.setAttribute(
        "aria-label",
        columnFull
          ? "Column " + (col + 1) + " is full"
          : game.isOver || computerTurn
            ? "Column " + (col + 1)
            : "Drop a " + sideClass(game.current) + " disc in column " + (col + 1)
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

  function releaseColumns() {
    const board = game.board;
    const humanCanPlay =
      !game.isOver && !locked && !thinking && (!versusComputer || game.current === Player.One);

    for (let col = 0; col < COLS; col += 1) {
      const columnFull = board[0][col] !== Player.None;
      columns[col].disabled = !humanCanPlay || columnFull;
    }
  }

  function onColumn(col) {
    if (locked || thinking || game.isOver) return;
    if (versusComputer && game.current !== Player.One) return;

    const result = game.drop(col);
    if (!result.ok) return;

    locked = true;
    const token = ++dropToken;
    render(result);
    window.setTimeout(() => {
      if (token !== dropToken) return;
      if (versusComputer && !game.isOver && game.current === Player.Two) {
        beginComputerTurn(token);
        return;
      }
      locked = false;
      releaseColumns();
    }, DROP_MS);
  }

  function beginComputerTurn(token) {
    thinking = true;
    render(null);
    window.setTimeout(() => {
      if (token !== dropToken) return;

      let col = -1;
      try {
        col = ConnectFourAI.chooseColumn(game.board, Player.Two);
      } catch (error) {
        thinking = false;
        locked = false;
        render(null);
        throw error;
      }

      thinking = false;
      const result = game.drop(col);
      if (!result.ok) {
        locked = false;
        render(null);
        return;
      }

      render(result);
      window.setTimeout(() => {
        if (token !== dropToken) return;
        locked = false;
        releaseColumns();
      }, DROP_MS);
    }, THINK_MS);
  }

  function selectMode(nextVersusComputer) {
    if (nextVersusComputer === versusComputer) return;
    versusComputer = nextVersusComputer;
    dropToken += 1;
    locked = false;
    thinking = false;
    game.reset();
    render(null);
  }

  restartEl.addEventListener("click", () => {
    dropToken += 1;
    locked = false;
    thinking = false;
    game.reset();
    render(null);
  });

  modeComputerEl.addEventListener("click", () => selectMode(true));
  modePeopleEl.addEventListener("click", () => selectMode(false));

  build();
  render(null);
})();
