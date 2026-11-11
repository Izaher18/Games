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
  const SLIDE_MS = 110;
  const SWIPE_DISTANCE = 24;
  const UNDO_LIMIT = 50;
  const AUTO_MS = 150;
  const ARROWS = {
    up: { symbol: "↑", dx: 0, dy: -1 },
    down: { symbol: "↓", dx: 0, dy: 1 },
    left: { symbol: "←", dx: -1, dy: 0 },
    right: { symbol: "→", dx: 1, dy: 0 },
  };

  const boardEl = document.getElementById("board");
  const helpEl = document.getElementById("help");
  const cellsEl = document.getElementById("cells");
  const tilesEl = document.getElementById("tiles");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const restartButton = document.getElementById("restart");
  const undoButton = document.getElementById("undo");
  const hintButton = document.getElementById("hint");
  const hintArrow = document.getElementById("hint-arrow");
  const autoButton = document.getElementById("auto");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const keepGoingButton = document.getElementById("keep-going");
  const tryAgainButton = document.getElementById("try-again");

  let game;
  let history = [];
  let best = Number(localStorage.getItem("2048.best")) || 0;
  let bestAtStart = best;
  let celebrating = false;
  let hinted = null;
  let autoTimer = null;
  // Games the computer helped play don't count toward the best score.
  let assisted = false;
  // Tiles keep their element across moves so CSS can animate them sliding.
  const elements = new Map();
  let settling = null;
  let mergedIds = new Set();

  for (let i = 0; i < Game2048.SIZE * Game2048.SIZE; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    cellsEl.append(cell);
  }

  function newGame() {
    stopAuto();
    clearHint();
    settle();
    game = Game2048.create();
    history = [];
    bestAtStart = best;
    celebrating = false;
    assisted = false;
    elements.forEach((el) => el.remove());
    elements.clear();
    syncTiles();
    render();
  }

  function play(direction) {
    if (celebrating) return;
    const result = Game2048.move(game, direction);
    if (!result) return;
    clearHint();
    settle();
    history.push(game);
    if (history.length > UNDO_LIMIT) history.shift();
    game = result.state;
    if (!assisted && game.score > best) {
      best = game.score;
      localStorage.setItem("2048.best", best);
    }
    celebrating = result.justWon;
    if (result.gained) bump(result.gained);

    // Slide every old tile (including the pairs that are about to merge) to where
    // it ends up, then swap in the merged and new tiles once the slide is done.
    result.moves.forEach(({ id, x, y }) => place(elements.get(id), x, y));
    mergedIds = new Set(result.merges.map(({ tile }) => tile.id));
    settling = setTimeout(settle, SLIDE_MS);
    render();
  }

  function bump(points) {
    const el = document.createElement("span");
    el.className = "bump";
    el.textContent = `+${points}`;
    el.addEventListener("animationend", () => el.remove());
    scoreEl.parentElement.append(el);
  }

  function settle() {
    if (settling === null) return;
    clearTimeout(settling);
    settling = null;
    syncTiles();
  }

  function syncTiles() {
    const ids = new Set(game.tiles.map((tile) => tile.id));
    elements.forEach((el, id) => {
      if (ids.has(id)) return;
      el.remove();
      elements.delete(id);
    });
    game.tiles.forEach((tile) => {
      if (elements.has(tile.id)) {
        place(elements.get(tile.id), tile.x, tile.y);
        return;
      }
      const el = tileElement(tile);
      el.classList.add(mergedIds.has(tile.id) ? "is-merged" : "is-new");
      elements.set(tile.id, el);
      tilesEl.append(el);
    });
    mergedIds = new Set();
  }

  function place(el, x, y) {
    el.style.setProperty("--x", x);
    el.style.setProperty("--y", y);
  }

  function hint() {
    if (celebrating || game.over) return;
    hinted = Game2048AI.bestMove(game);
    if (!hinted) return;
    const arrow = ARROWS[hinted];
    hintArrow.firstElementChild.textContent = arrow.symbol;
    hintArrow.style.setProperty("--dx", arrow.dx);
    hintArrow.style.setProperty("--dy", arrow.dy);
    hintArrow.classList.remove("is-showing");
    void hintArrow.offsetWidth;
    hintArrow.classList.add("is-showing");
    render();
  }

  function clearHint() {
    hinted = null;
    hintArrow.classList.remove("is-showing");
  }

  function toggleAuto() {
    if (autoTimer !== null) {
      stopAuto();
      render();
      return;
    }
    if (celebrating || game.over) return;
    assisted = true;
    autoStep();
  }

  function autoStep() {
    const direction = Game2048AI.bestMove(game);
    if (direction) play(direction);
    autoTimer = direction && !celebrating && !game.over ? setTimeout(autoStep, AUTO_MS) : null;
    render();
  }

  function stopAuto() {
    clearTimeout(autoTimer);
    autoTimer = null;
  }

  function playByHand(direction) {
    stopAuto();
    play(direction);
    render();
  }

  function undo() {
    stopAuto();
    if (!history.length) return;
    clearHint();
    settle();
    game = history.pop();
    celebrating = false;
    syncTiles();
    render();
  }

  function keepGoing() {
    celebrating = false;
    render();
  }

  function render() {
    scoreEl.textContent = game.score;
    bestEl.textContent = best;
    undoButton.disabled = !history.length;
    hintButton.disabled = celebrating || game.over || autoTimer !== null;
    autoButton.disabled = celebrating || game.over;
    autoButton.setAttribute("aria-pressed", autoTimer !== null);
    autoButton.textContent = autoTimer !== null ? "Stop" : "Autoplay";

    if (celebrating) {
      statusEl.textContent = assisted ? "The computer reached 2048!" : "You reached 2048!";
    } else if (game.over) {
      if (assisted) statusEl.textContent = `Game over, scored ${game.score} with the computer's help`;
      else statusEl.textContent = game.score > bestAtStart ? `New best: ${game.score}!` : `Game over, you scored ${game.score}`;
    } else if (autoTimer !== null) {
      statusEl.textContent = "The computer is playing";
    } else if (hinted) {
      statusEl.textContent = `Try sliding ${hinted}`;
    } else if (game.won) {
      statusEl.textContent = "Keep going, how high can you get?";
    } else {
      statusEl.textContent = "Join the tiles to reach 2048";
    }

    const showOverlay = celebrating || game.over;
    const wasHidden = overlay.hidden;
    overlay.hidden = !showOverlay;
    overlay.classList.toggle("is-won", celebrating);
    if (!celebrating) overlayTitle.textContent = "No moves left";
    else overlayTitle.textContent = assisted ? "The computer made 2048!" : "You made 2048!";
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
    place(el, tile.x, tile.y);
    return el;
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code === "KeyU" || event.code === "Backspace") {
      event.preventDefault();
      undo();
      return;
    }
    if (event.code === "KeyH") {
      event.preventDefault();
      hint();
      return;
    }
    if (event.code === "KeyP") {
      event.preventDefault();
      toggleAuto();
      return;
    }
    const direction = KEYS[event.code];
    if (!direction) return;
    event.preventDefault();
    playByHand(direction);
  });

  // Pointer events cover both finger swipes and mouse drags.
  let swipeStart = null;
  boardEl.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    swipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  });

  document.addEventListener("pointerup", (event) => {
    if (!swipeStart || event.pointerId !== swipeStart.id) return;
    const dx = event.clientX - swipeStart.x;
    const dy = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
    if (Math.abs(dx) > Math.abs(dy)) playByHand(dx > 0 ? "right" : "left");
    else playByHand(dy > 0 ? "down" : "up");
  });

  document.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  if (window.matchMedia("(pointer: coarse)").matches) helpEl.textContent = "Swipe on the board to slide the tiles";

  restartButton.addEventListener("click", newGame);
  undoButton.addEventListener("click", undo);
  hintButton.addEventListener("click", hint);
  autoButton.addEventListener("click", toggleAuto);
  tryAgainButton.addEventListener("click", newGame);
  keepGoingButton.addEventListener("click", keepGoing);

  newGame();
})();
