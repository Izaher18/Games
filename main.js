(function () {
  "use strict";

  const { ROWS, COLS, Player, createGame } = ConnectFour;
  const DROP_MS = 360;
  const THINK_MS = 280;
  const HINT_MS = 1800;
  const DIFFICULTY_KEY = "connect4-difficulty";
  const SCORE_KEY = "connect4-scores";
  const SOUND_KEY = "connect4-sound";
  const STARTER_KEY = "connect4-starter";
  const DIFFICULTY = {
    easy: { maxDepth: 2, softDepth: 2, budgetMs: 40, blunder: 0.55 },
    medium: { maxDepth: 5, softDepth: 4, budgetMs: 80, blunder: 0 },
    hard: { maxDepth: 8, softDepth: 5, budgetMs: 180, blunder: 0 },
  };

  const game = createGame();
  const boardEl = document.querySelector("#board");
  const stageEl = document.querySelector("#stage");
  const statusEl = document.querySelector("#status");
  const kickerEl = document.querySelector("#kicker");
  const playerOneEl = document.querySelector("#player-one");
  const playerTwoEl = document.querySelector("#player-two");
  const playerOneNameEl = document.querySelector("#player-one-name");
  const playerTwoNameEl = document.querySelector("#player-two-name");
  const playerOneScoreEl = document.querySelector("#player-one-score");
  const playerTwoScoreEl = document.querySelector("#player-two-score");
  const drawsEl = document.querySelector("#draws");
  const clearScoresEl = document.querySelector("#clear-scores");
  const undoEl = document.querySelector("#undo");
  const hintEl = document.querySelector("#hint");
  const soundEl = document.querySelector("#sound");
  const restartEl = document.querySelector("#restart");
  const modeComputerEl = document.querySelector("#mode-computer");
  const modePeopleEl = document.querySelector("#mode-people");
  const startFirstEl = document.querySelector("#start-first");
  const startSecondEl = document.querySelector("#start-second");
  const difficultyEl = document.querySelector("#difficulties");
  const difficultyButtons = {
    easy: document.querySelector("#difficulty-easy"),
    medium: document.querySelector("#difficulty-medium"),
    hard: document.querySelector("#difficulty-hard"),
  };

  const columns = [];
  const moves = [];
  let locked = false;
  let thinking = false;
  let versusComputer = true;
  let difficulty = "medium";
  let dropToken = 0;
  let scores = loadScores();
  let recordedField = null;
  let soundOn = readStorage(SOUND_KEY) !== "off";
  let humanStarts = readStorage(STARTER_KEY) !== "second";
  let audioCtx = null;
  let hintCol = -1;
  let hintTimer = 0;

  const savedDifficulty = readStorage(DIFFICULTY_KEY);
  if (savedDifficulty && DIFFICULTY[savedDifficulty]) difficulty = savedDifficulty;

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
    difficultyEl.hidden = !versusComputer;
    const firstLabel = versusComputer ? "You" : "Red";
    const secondLabel = versusComputer ? "Computer" : "Yellow";
    startFirstEl.textContent = firstLabel;
    startSecondEl.textContent = secondLabel;
    startFirstEl.setAttribute(
      "aria-label",
      (firstLabel === "You" ? "You move" : firstLabel + " moves") + " first"
    );
    startSecondEl.setAttribute("aria-label", secondLabel + " moves first");
    startFirstEl.classList.toggle("is-selected", humanStarts);
    startSecondEl.classList.toggle("is-selected", !humanStarts);
    startFirstEl.setAttribute("aria-pressed", String(humanStarts));
    startSecondEl.setAttribute("aria-pressed", String(!humanStarts));
    for (const name of Object.keys(difficultyButtons)) {
      const selected = name === difficulty;
      difficultyButtons[name].classList.toggle("is-selected", selected);
      difficultyButtons[name].setAttribute("aria-pressed", String(selected));
    }
    renderScore();
    undoEl.disabled = undoCount() === 0;
    hintEl.disabled = !humanCanPlay();
    soundEl.textContent = soundOn ? "Sound on" : "Sound off";
    soundEl.setAttribute("aria-pressed", String(soundOn));
  }

  function emptyScores() {
    return {
      computer: { one: 0, two: 0, draws: 0 },
      people: { one: 0, two: 0, draws: 0 },
    };
  }

  function loadScores() {
    try {
      const saved = JSON.parse(readStorage(SCORE_KEY) || "");
      if (!saved || !saved.computer || !saved.people) return emptyScores();
      for (const mode of ["computer", "people"]) {
        for (const field of ["one", "two", "draws"]) {
          const value = saved[mode][field];
          if (!Number.isInteger(value) || value < 0) return emptyScores();
        }
      }
      return saved;
    } catch (error) {
      return emptyScores();
    }
  }

  function renderScore() {
    const bucket = scores[versusComputer ? "computer" : "people"];
    playerOneScoreEl.textContent = String(bucket.one);
    playerTwoScoreEl.textContent = String(bucket.two);
    drawsEl.textContent = "Draws " + bucket.draws;
  }

  function saveScores() {
    writeStorage(SCORE_KEY, JSON.stringify(scores));
  }

  function maybeRecord() {
    if (recordedField || !game.isOver) return;
    const mode = versusComputer ? "computer" : "people";
    const field = game.isDraw ? "draws" : game.winner === Player.One ? "one" : "two";
    scores[mode][field] += 1;
    recordedField = mode + ":" + field;
    saveScores();
  }

  function unrecordResult() {
    if (!recordedField) return;
    const parts = recordedField.split(":");
    scores[parts[0]][parts[1]] = Math.max(0, scores[parts[0]][parts[1]] - 1);
    recordedField = null;
    saveScores();
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
      // Private browsing can reject storage. The match still plays.
    }
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

  function humanCanPlay() {
    return !game.isOver && !locked && !thinking && (!versusComputer || game.current === Player.One);
  }

  function lastPlayed(board) {
    if (moves.length === 0) return null;
    const col = moves[moves.length - 1];
    for (let row = 0; row < ROWS; row += 1) {
      if (board[row][col] !== Player.None) return { row, col };
    }
    return null;
  }

  function clearHint() {
    window.clearTimeout(hintTimer);
    if (hintCol >= 0) columns[hintCol].classList.remove("is-hint");
    hintCol = -1;
  }

  function showHint() {
    if (!humanCanPlay()) return;
    clearHint();
    const col = ConnectFourAI.chooseColumn(game.board, game.current, DIFFICULTY.hard);
    if (col < 0) return;
    hintCol = col;
    columns[col].classList.add("is-hint");
    hintTimer = window.setTimeout(clearHint, HINT_MS);
  }

  function render(lastMove) {
    const board = game.board;
    const wins = new Set(game.winningCells.map(([row, col]) => row + ":" + col));
    const latest = lastPlayed(board);
    const sample = columns[0].querySelector(".slot");
    const slotSize = sample.getBoundingClientRect().height;
    const gap = parseFloat(getComputedStyle(columns[0]).rowGap) || 0;
    const canPlay = humanCanPlay();

    clearHint();
    stageEl.classList.toggle("is-over", game.isOver);
    stageEl.classList.toggle("is-thinking", thinking);
    stageEl.dataset.turn = sideClass(game.current);
    maybeRecord();
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
      button.disabled = !canPlay || columnFull;
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
        slot.classList.toggle(
          "is-last",
          latest !== null && latest.row === row && latest.col === col
        );
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
    const canPlay = humanCanPlay();

    for (let col = 0; col < COLS; col += 1) {
      const columnFull = board[0][col] !== Player.None;
      columns[col].disabled = !canPlay || columnFull;
    }
    hintEl.disabled = !canPlay;
  }

  function onColumn(col) {
    if (locked || thinking || game.isOver) return;
    if (versusComputer && game.current !== Player.One) return;

    const result = game.drop(col);
    if (!result.ok) return;

    moves.push(col);
    playFor(result.player);
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
    locked = true;
    thinking = true;
    render(null);
    window.setTimeout(() => {
      if (token !== dropToken) return;

      let col = -1;
      try {
        col = ConnectFourAI.chooseColumn(game.board, Player.Two, DIFFICULTY[difficulty]);
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

      moves.push(col);
      playFor(result.player);
      render(result);
      window.setTimeout(() => {
        if (token !== dropToken) return;
        locked = false;
        releaseColumns();
      }, DROP_MS);
    }, THINK_MS);
  }

  function openingPlayer() {
    return humanStarts ? Player.One : Player.Two;
  }

  function playerForMove(index) {
    if (index % 2 === 0) return openingPlayer();
    return openingPlayer() === Player.One ? Player.Two : Player.One;
  }

  function undoCount() {
    if (moves.length === 0) return 0;
    if (!versusComputer) return 1;
    for (let index = moves.length - 1; index >= 0; index -= 1) {
      if (playerForMove(index) === Player.One) return moves.length - index;
    }
    return 0;
  }

  function startGame() {
    dropToken += 1;
    locked = false;
    thinking = false;
    recordedField = null;
    moves.length = 0;
    game.reset(openingPlayer());
    if (versusComputer && game.current === Player.Two) {
      beginComputerTurn(dropToken);
      return;
    }
    render(null);
  }

  function selectMode(nextVersusComputer) {
    if (nextVersusComputer === versusComputer) return;
    versusComputer = nextVersusComputer;
    startGame();
  }

  function selectStarter(nextHumanStarts) {
    if (nextHumanStarts === humanStarts) return;
    humanStarts = nextHumanStarts;
    writeStorage(STARTER_KEY, humanStarts ? "first" : "second");
    startGame();
  }

  function undo() {
    const count = undoCount();
    if (count === 0) return;
    dropToken += 1;
    locked = false;
    thinking = false;
    unrecordResult();
    moves.splice(moves.length - count, count);
    game.reset(openingPlayer());
    for (const col of moves) game.drop(col);
    render(null);
  }

  restartEl.addEventListener("click", startGame);

  undoEl.addEventListener("click", undo);

  hintEl.addEventListener("click", showHint);

  soundEl.addEventListener("click", () => {
    soundOn = !soundOn;
    writeStorage(SOUND_KEY, soundOn ? "on" : "off");
    if (soundOn) ensureAudio();
    syncChrome();
  });

  function ensureAudio() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    if (!audioCtx) audioCtx = new Context();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(ctx, freq, when, duration, peak) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(when);
    osc.stop(when + duration + 0.02);
  }

  function playFor(player) {
    if (!soundOn) return;
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    if (game.winner) {
      [523, 659, 784].forEach((freq, index) => tone(ctx, freq, now + index * 0.07, 0.18, 0.035));
      return;
    }
    if (game.isDraw) {
      tone(ctx, 330, now, 0.12, 0.03);
      tone(ctx, 262, now + 0.08, 0.16, 0.03);
      return;
    }
    const freq = player === Player.One ? 520 : 370;
    tone(ctx, freq, now, 0.1, 0.04);
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "u" || event.key === "U" || event.key === "Backspace") {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key === "h" || event.key === "H") {
      event.preventDefault();
      showHint();
      return;
    }
    const col = "1234567".indexOf(event.key);
    if (col === -1) return;
    event.preventDefault();
    onColumn(col);
  });

  clearScoresEl.addEventListener("click", () => {
    scores = emptyScores();
    saveScores();
    renderScore();
  });

  modeComputerEl.addEventListener("click", () => selectMode(true));
  modePeopleEl.addEventListener("click", () => selectMode(false));
  startFirstEl.addEventListener("click", () => selectStarter(true));
  startSecondEl.addEventListener("click", () => selectStarter(false));

  for (const name of Object.keys(difficultyButtons)) {
    difficultyButtons[name].addEventListener("click", () => {
      if (difficulty === name) return;
      difficulty = name;
      writeStorage(DIFFICULTY_KEY, name);
      syncChrome();
    });
  }

  build();
  startGame();
})();
