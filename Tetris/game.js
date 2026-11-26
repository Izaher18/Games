/**
 * Tetris rules.
 *
 * The well is WIDTH×HEIGHT cells. Pieces spawn near the top, fall on a gravity
 * tick, and lock when they can't drop. `step` advances gravity; input helpers
 * mutate the state in place so the page can animate around the same object.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Tetris = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 10;
  const HEIGHT = 20;
  const NEXT_COUNT = 3;
  const LINE_SCORES = [0, 100, 300, 500, 800];
  const SPEEDS = {
    slow: { gravity: 1.0, lock: 0.55 },
    normal: { gravity: 0.8, lock: 0.5 },
    fast: { gravity: 0.55, lock: 0.4 },
  };

  // Each rotation is a list of cell offsets from the piece origin.
  const SHAPES = {
    I: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    T: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  };

  const TYPES = Object.keys(SHAPES);
  const KICKS = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [0, -1],
    [-2, 0],
    [2, 0],
    [-1, -1],
    [1, -1],
    [0, -2],
  ];

  function emptyGrid() {
    return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
  }

  function createBag(size = 7, random = Math.random) {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = bag[i];
      bag[i] = bag[j];
      bag[j] = swap;
    }
    return bag.slice(0, size);
  }

  function spawnPiece(type) {
    return {
      type,
      rotation: 0,
      x: 3,
      y: type === "I" ? -1 : 0,
    };
  }

  function cellsOf(piece) {
    return SHAPES[piece.type][piece.rotation].map(([ox, oy]) => ({
      x: piece.x + ox,
      y: piece.y + oy,
    }));
  }

  function fits(state, piece) {
    return cellsOf(piece).every(({ x, y }) => {
      if (x < 0 || x >= WIDTH || y >= HEIGHT) return false;
      if (y < 0) return true;
      return state.grid[y][x] === null;
    });
  }

  function create(settings = {}, random = Math.random) {
    const speed = SPEEDS[settings.speed] ? settings.speed : "normal";
    const state = {
      width: WIDTH,
      height: HEIGHT,
      speed,
      baseGravity: SPEEDS[speed].gravity,
      lockDelay: SPEEDS[speed].lock,
      grid: emptyGrid(),
      bag: [],
      next: [],
      active: null,
      hold: null,
      holdUsed: false,
      score: 0,
      lines: 0,
      level: 1,
      status: "ready",
      gravityAcc: 0,
      lockAcc: 0,
      grounded: false,
    };
    refillNext(state, random);
    state.active = spawnPiece(takeNext(state, random));
    if (!fits(state, state.active)) state.status = "over";
    return state;
  }

  function refillNext(state, random) {
    while (state.next.length < NEXT_COUNT) {
      if (!state.bag.length) state.bag = createBag(7, random);
      state.next.push(state.bag.shift());
    }
  }

  function takeNext(state, random) {
    refillNext(state, random);
    const type = state.next.shift();
    refillNext(state, random);
    return type;
  }

  function start(state) {
    if (state.status !== "ready") return false;
    state.status = "playing";
    return true;
  }

  function gravityInterval(state) {
    const levelFactor = Math.max(0.12, 1 - (state.level - 1) * 0.08);
    return state.baseGravity * levelFactor;
  }

  function clearLines(state) {
    const kept = state.grid.filter((row) => row.some((cell) => cell === null));
    const cleared = HEIGHT - kept.length;
    while (kept.length < HEIGHT) kept.unshift(Array(WIDTH).fill(null));
    state.grid = kept;
    if (!cleared) return 0;
    state.lines += cleared;
    state.level = Math.floor(state.lines / 10) + 1;
    state.score += LINE_SCORES[cleared] * state.level;
    return cleared;
  }

  function lockPiece(state, random = Math.random) {
    cellsOf(state.active).forEach(({ x, y }) => {
      if (y >= 0 && y < HEIGHT && x >= 0 && x < WIDTH) state.grid[y][x] = state.active.type;
    });
    const cleared = clearLines(state);
    state.holdUsed = false;
    state.active = spawnPiece(takeNext(state, random));
    state.gravityAcc = 0;
    state.lockAcc = 0;
    state.grounded = false;
    if (!fits(state, state.active)) {
      state.status = "over";
      state.active = null;
    }
    return { locked: true, cleared };
  }

  function tryMove(state, dx, dy) {
    if (state.status !== "playing" || !state.active) return false;
    const next = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
    if (!fits(state, next)) return false;
    state.active = next;
    if (dy !== 0) {
      state.lockAcc = 0;
      state.grounded = false;
    } else if (grounded(state)) {
      state.lockAcc = 0;
    }
    return true;
  }

  function grounded(state) {
    if (!state.active) return false;
    return !fits(state, { ...state.active, y: state.active.y + 1 });
  }

  function rotate(state, dir = 1) {
    if (state.status !== "playing" || !state.active) return false;
    const rotation = (state.active.rotation + dir + 4) % 4;
    for (let i = 0; i < KICKS.length; i += 1) {
      const [kx, ky] = KICKS[i];
      const next = {
        ...state.active,
        rotation,
        x: state.active.x + kx,
        y: state.active.y + ky,
      };
      if (fits(state, next)) {
        state.active = next;
        state.lockAcc = 0;
        return true;
      }
    }
    return false;
  }

  function softDrop(state) {
    if (!tryMove(state, 0, 1)) return false;
    state.score += 1;
    return true;
  }

  function hardDrop(state, random = Math.random) {
    if (state.status !== "playing" || !state.active) return null;
    let distance = 0;
    while (tryMove(state, 0, 1)) distance += 1;
    state.score += distance * 2;
    return lockPiece(state, random);
  }

  function hold(state, random = Math.random) {
    if (state.status !== "playing" || !state.active || state.holdUsed) return false;
    const current = state.active.type;
    if (state.hold) {
      state.active = spawnPiece(state.hold);
    } else {
      state.active = spawnPiece(takeNext(state, random));
    }
    state.hold = current;
    state.holdUsed = true;
    state.gravityAcc = 0;
    state.lockAcc = 0;
    state.grounded = false;
    if (!fits(state, state.active)) {
      state.status = "over";
      state.active = null;
    }
    return true;
  }

  function ghostY(state) {
    if (!state.active) return null;
    let piece = { ...state.active };
    while (fits(state, { ...piece, y: piece.y + 1 })) piece.y += 1;
    return piece.y;
  }

  /**
   * Advances gravity by `dt` seconds. Returns what happened: soft drops from
   * gravity, line clears, and whether a piece locked or the run ended.
   */
  function step(state, dt, random = Math.random) {
    const events = { cleared: 0, locked: false, over: false };
    if (state.status !== "playing" || !state.active) return events;

    state.gravityAcc += dt;
    const interval = gravityInterval(state);
    while (state.gravityAcc >= interval) {
      state.gravityAcc -= interval;
      if (!tryMove(state, 0, 1)) break;
    }

    if (grounded(state)) {
      state.grounded = true;
      state.lockAcc += dt;
      if (state.lockAcc >= state.lockDelay) {
        const result = lockPiece(state, random);
        events.locked = true;
        events.cleared = result.cleared;
        if (state.status === "over") events.over = true;
      }
    } else {
      state.grounded = false;
      state.lockAcc = 0;
    }
    return events;
  }

  return {
    WIDTH,
    HEIGHT,
    NEXT_COUNT,
    SPEEDS,
    SHAPES,
    TYPES,
    LINE_SCORES,
    create,
    start,
    cellsOf,
    fits,
    tryMove,
    rotate,
    softDrop,
    hardDrop,
    hold,
    ghostY,
    grounded,
    step,
    gravityInterval,
  };
});
