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

  const boardEl = document.getElementById("board");
  const helpEl = document.getElementById("help");
  const cellsEl = document.getElementById("cells");
  const tilesEl = document.getElementById("tiles");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const restartButton = document.getElementById("restart");
  const undoButton = document.getElementById("undo");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlay-title");
  const keepGoingButton = document.getElementById("keep-going");
  const tryAgainButton = document.getElementById("try-again");

  let game;
  let history = [];
  let best = Number(localStorage.getItem("2048.best")) || 0;
  let bestAtStart = best;
  let celebrating = false;
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
    settle();
    game = Game2048.create();
    history = [];
    bestAtStart = best;
    celebrating = false;
    elements.forEach((el) => el.remove());
    elements.clear();
    syncTiles();
    render();
  }

  function play(direction) {
    if (celebrating) return;
    const result = Game2048.move(game, direction);
    if (!result) return;
    settle();
    history.push(game);
    if (history.length > UNDO_LIMIT) history.shift();
    game = result.state;
    if (game.score > best) {
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

  function undo() {
    if (!history.length) return;
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
    const direction = KEYS[event.code];
    if (!direction) return;
    event.preventDefault();
    play(direction);
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
    if (Math.abs(dx) > Math.abs(dy)) play(dx > 0 ? "right" : "left");
    else play(dy > 0 ? "down" : "up");
  });

  document.addEventListener("pointercancel", () => {
    swipeStart = null;
  });

  if (window.matchMedia("(pointer: coarse)").matches) helpEl.textContent = "Swipe on the board to slide the tiles";

  restartButton.addEventListener("click", newGame);
  undoButton.addEventListener("click", undo);
  tryAgainButton.addEventListener("click", newGame);
  keepGoingButton.addEventListener("click", keepGoing);

  newGame();
})();
