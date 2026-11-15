(() => {
  const boardEl = document.getElementById("board");
  const stageEl = document.getElementById("stage");
  const faceEl = document.getElementById("face");
  const statusEl = document.getElementById("status");
  const minesEl = document.getElementById("mines");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const restartButton = document.getElementById("restart");
  const undoButton = document.getElementById("undo");
  const hintButton = document.getElementById("hint");
  const flagModeButton = document.getElementById("flag-mode");
  const helpEl = document.getElementById("help");
  const levelButtons = [...document.querySelectorAll(".mode")];

  let level = readStorage("minesweeper.level");
  if (!Minesweeper.LEVELS[level]) level = "easy";
  let game = Minesweeper.create(level);
  let fresh = new Set();
  let best = null;
  let newBest = false;
  let assisted = false;
  let hinted = null;
  let cursor = 0;
  let flagMode = false;
  let suppressClick = false;
  let press = null;
  let heldAt = 0;
  const LONG_PRESS_MS = 450;
  // Seconds already on the clock, plus the moment the current run started.
  let baseSeconds = 0;
  let resumedAt = null;
  let clockId = null;
  const UNDO_LIMIT = 50;
  let history = [];

  function newGame() {
    game = Minesweeper.create(level);
    fresh = new Set();
    history = [];
    best = loadBest();
    newBest = false;
    assisted = false;
    hinted = null;
    flagMode = false;
    cursor = Math.floor(game.height / 2) * game.width + Math.floor(game.width / 2);
    setClock(0, false);
    stageEl.classList.remove("is-shaking");
    levelButtons.forEach((button) => {
      const selected = button.dataset.level === level;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    build();
    render();
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
      // Private browsing can reject storage. The game still plays.
    }
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
    const result = game.revealed[index] ? Minesweeper.chord(game, index) : Minesweeper.reveal(game, index);
    if (!result) return;
    remember();
    hinted = null;
    apply(result.state, result.opened);
  }

  function remember() {
    history.push({
      state: game,
      seconds: elapsedSeconds(),
      running: resumedAt !== null,
      best,
      newBest,
      assisted,
      hinted,
    });
    if (history.length > UNDO_LIMIT) history.shift();
  }

  function undo() {
    const snap = history.pop();
    if (!snap) return;
    game = snap.state;
    fresh = new Set();
    newBest = snap.newBest;
    assisted = snap.assisted;
    hinted = snap.hinted;
    if (best !== snap.best) {
      best = snap.best;
      const key = `minesweeper.best.${level}`;
      if (best === null) {
        try {
          localStorage.removeItem(key);
        } catch (error) {
          // The in-memory best is already restored.
        }
      } else {
        writeStorage(key, String(best));
      }
    }
    setClock(snap.seconds, snap.running);
    stageEl.classList.remove("is-shaking");
    render();
  }

  function apply(next, opened) {
    const starting = game.status === "ready" && next.status !== "ready";
    const blewUp = next.status === "lost" && game.status !== "lost";
    game = next;
    fresh = new Set(opened || []);
    if (game.status === "won" || game.status === "lost") {
      setClock(starting ? 0 : Math.floor(elapsedSeconds()), false);
      if (game.status === "won") saveBest();
    } else if (starting) {
      setClock(0, true);
    }
    if (blewUp) {
      stageEl.classList.remove("is-shaking");
      void stageEl.offsetWidth;
      stageEl.classList.add("is-shaking");
    }
    render();
  }

  function paintFace(down) {
    if (down) faceEl.dataset.mood = "down";
    else if (game.status === "lost") faceEl.dataset.mood = "lost";
    else if (game.status === "won") faceEl.dataset.mood = "won";
    else if (game.status === "playing") faceEl.dataset.mood = "play";
    else faceEl.dataset.mood = "ready";
  }

  function elapsedSeconds() {
    if (resumedAt === null) return baseSeconds;
    return baseSeconds + (Date.now() - resumedAt) / 1000;
  }

  function setClock(seconds, running) {
    baseSeconds = seconds;
    resumedAt = running ? Date.now() : null;
    if (running && clockId === null) clockId = setInterval(paintClock, 200);
    if (!running && clockId !== null) {
      clearInterval(clockId);
      clockId = null;
    }
    paintClock();
  }

  function paintClock() {
    timeEl.textContent = formatTime(elapsedSeconds());
  }

  function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(whole / 60);
    const remain = whole % 60;
    return `${minutes}:${String(remain).padStart(2, "0")}`;
  }

  function loadBest() {
    const raw = readStorage(`minesweeper.best.${level}`);
    const stored = Number(raw);
    if (raw === null || !Number.isFinite(stored) || stored < 0) return null;
    return stored;
  }

  function saveBest() {
    if (assisted) {
      newBest = false;
      return;
    }
    const seconds = Math.floor(elapsedSeconds());
    if (best !== null && seconds >= best) {
      newBest = false;
      return;
    }
    writeStorage(`minesweeper.best.${level}`, String(seconds));
    best = seconds;
    newBest = true;
  }

  function mark(index) {
    const next = Minesweeper.cycleMark(game, index);
    if (!next) return;
    remember();
    hinted = null;
    game = next;
    fresh = new Set();
    render();
  }

  function render() {
    const lost = game.status === "lost";
    const finished = lost || game.status === "won";
    undoButton.disabled = history.length === 0;
    hintButton.disabled = game.status === "won" || game.status === "lost";
    flagModeButton.setAttribute("aria-pressed", String(flagMode));
    minesEl.textContent = String(game.mines - Minesweeper.flagCount(game));
    bestEl.textContent = best === null ? "—" : formatTime(best);
    paintClock();
    const buttons = boardEl.children;
    for (let i = 0; i < game.mine.length; i += 1) {
      paint(buttons[i], i, finished);
      if (i === cursor) buttons[i].classList.add("is-cursor");
      if (!hinted || hinted.index !== i) continue;
      buttons[i].classList.add("is-hint");
      buttons[i].setAttribute("aria-label", `${buttons[i].getAttribute("aria-label")}, hint`);
    }
    fresh = new Set();

    if (game.status === "won") {
      const time = formatTime(elapsedSeconds());
      if (assisted) statusEl.textContent = `Cleared in ${time}, with a hint`;
      else statusEl.textContent = newBest ? `New best: ${time}` : `Cleared in ${time}`;
    } else if (lost) statusEl.textContent = "Boom";
    else if (hinted) {
      statusEl.textContent = hinted.certain ? "This cell is safe" : "No sure cell. This one looks safest";
    } else if (flagMode) statusEl.textContent = "Next click plants a flag";
    else if (game.status === "playing") statusEl.textContent = "Keep going";
    else statusEl.textContent = "Clear every cell except the mines";
    paintFace(false);
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

  function pick(index) {
    cursor = index;
    if (flagMode) mark(index);
    else reveal(index);
  }

  boardEl.addEventListener("click", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    pick(Number(cell.dataset.index));
  });

  boardEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const cell = event.target.closest(".cell");
    if (!cell) return;
    const index = Number(cell.dataset.index);
    paintFace(true);
    press = {
      index,
      x: event.clientX,
      y: event.clientY,
      timer: setTimeout(() => {
        // A phone may also fire contextmenu for the same hold. One mark is enough.
        suppressClick = true;
        markHeld(index);
      }, LONG_PRESS_MS),
    };
  });

  boardEl.addEventListener("pointermove", (event) => {
    if (!press) return;
    const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (moved < 10) return;
    clearTimeout(press.timer);
    press = null;
  });

  function endPress() {
    paintFace(false);
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
  }

  document.addEventListener("pointerup", endPress);
  document.addEventListener("pointercancel", endPress);

  function markHeld(index) {
    const now = Date.now();
    if (now - heldAt < 700) return;
    heldAt = now;
    mark(index);
  }

  boardEl.addEventListener("contextmenu", (event) => {
    const cell = event.target.closest(".cell");
    if (!cell) return;
    event.preventDefault();
    if (event.pointerType === "touch") suppressClick = true;
    markHeld(Number(cell.dataset.index));
  });

  function showHint() {
    if (game.status === "won" || game.status === "lost") return;
    const result = MinesweeperAI.hint(game);
    if (!result) return;
    remember();
    assisted = true;
    hinted = result;
    render();
  }

  function moveCursor(dx, dy) {
    const x = Math.max(0, Math.min(game.width - 1, (cursor % game.width) + dx));
    const y = Math.max(0, Math.min(game.height - 1, Math.floor(cursor / game.width) + dy));
    cursor = y * game.width + x;
    render();
    boardEl.children[cursor].scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const typing = event.target.closest("button") && !event.target.closest("#board");
    if (event.code === "KeyH") {
      event.preventDefault();
      showHint();
      return;
    }
    if (event.code === "KeyU" || event.code === "Backspace") {
      event.preventDefault();
      undo();
      return;
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      mark(cursor);
      return;
    }
    if (event.code === "ArrowUp") moveCursor(0, -1);
    else if (event.code === "ArrowDown") moveCursor(0, 1);
    else if (event.code === "ArrowLeft") moveCursor(-1, 0);
    else if (event.code === "ArrowRight") moveCursor(1, 0);
    else if (!typing && (event.code === "Enter" || event.code === "Space")) pick(cursor);
    else return;
    event.preventDefault();
  });

  if (window.matchMedia("(pointer: coarse)").matches) {
    helpEl.textContent = "Tap to clear. Long-press, or turn on Flag, to mark a cell. Tap a number once its flags match.";
  }

  undoButton.addEventListener("click", undo);
  hintButton.addEventListener("click", showHint);
  flagModeButton.addEventListener("click", () => {
    flagMode = !flagMode;
    render();
  });
  faceEl.addEventListener("click", newGame);
  restartButton.addEventListener("click", newGame);
  levelButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.level === level) return;
      level = button.dataset.level;
      writeStorage("minesweeper.level", level);
      newGame();
    });
  });
  newGame();
})();
