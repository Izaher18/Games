(() => {
  const boardEl = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const minesEl = document.getElementById("mines");
  const timeEl = document.getElementById("time");
  const bestEl = document.getElementById("best");
  const restartButton = document.getElementById("restart");
  const undoButton = document.getElementById("undo");
  const levelButtons = [...document.querySelectorAll(".mode")];

  let level = readStorage("minesweeper.level");
  if (!Minesweeper.LEVELS[level]) level = "easy";
  let game = Minesweeper.create(level);
  let fresh = new Set();
  let best = null;
  let newBest = false;
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
    setClock(0, false);
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
    const result = Minesweeper.reveal(game, index);
    if (!result) return;
    remember();
    apply(result.state, result.opened);
  }

  function remember() {
    history.push({
      state: game,
      seconds: elapsedSeconds(),
      running: resumedAt !== null,
      best,
      newBest,
    });
    if (history.length > UNDO_LIMIT) history.shift();
  }

  function undo() {
    const snap = history.pop();
    if (!snap) return;
    game = snap.state;
    fresh = new Set();
    newBest = snap.newBest;
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
    render();
  }

  function apply(next, opened) {
    const starting = game.status === "ready" && next.status !== "ready";
    game = next;
    fresh = new Set(opened || []);
    if (game.status === "won" || game.status === "lost") {
      setClock(starting ? 0 : Math.floor(elapsedSeconds()), false);
      if (game.status === "won") saveBest();
    } else if (starting) {
      setClock(0, true);
    }
    render();
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
    game = next;
    fresh = new Set();
    render();
  }

  function render() {
    const lost = game.status === "lost";
    const finished = lost || game.status === "won";
    undoButton.disabled = history.length === 0;
    minesEl.textContent = String(game.mines - Minesweeper.flagCount(game));
    bestEl.textContent = best === null ? "—" : formatTime(best);
    paintClock();
    const buttons = boardEl.children;
    for (let i = 0; i < game.mine.length; i += 1) paint(buttons[i], i, finished);
    fresh = new Set();

    if (game.status === "won") {
      const time = formatTime(elapsedSeconds());
      statusEl.textContent = newBest ? `New best: ${time}` : `Cleared in ${time}`;
    }
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

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.code !== "KeyU" && event.code !== "Backspace") return;
    event.preventDefault();
    undo();
  });

  undoButton.addEventListener("click", undo);
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
