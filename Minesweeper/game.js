/**
 * Minesweeper rules, shared by the page and the hint solver.
 *
 * Every move returns a new state and leaves the one passed in untouched,
 * which keeps undo simple. Mines are planted on the first reveal, and that
 * cell plus every cell touching it is kept clear so the first click always
 * opens an empty patch.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Minesweeper = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LEVELS = {
    easy: { width: 9, height: 9, mines: 10 },
    medium: { width: 16, height: 16, mines: 40 },
    hard: { width: 30, height: 16, mines: 99 },
  };

  function create(level) {
    const spec = LEVELS[level] || LEVELS.easy;
    const size = spec.width * spec.height;
    return {
      level: LEVELS[level] ? level : "easy",
      width: spec.width,
      height: spec.height,
      mines: spec.mines,
      mine: new Array(size).fill(false),
      revealed: new Array(size).fill(false),
      flagged: new Array(size).fill(false),
      questioned: new Array(size).fill(false),
      adjacent: new Array(size).fill(0),
      placed: false,
      status: "ready",
      hit: null,
    };
  }

  function clone(state) {
    return {
      ...state,
      mine: state.mine.slice(),
      revealed: state.revealed.slice(),
      flagged: state.flagged.slice(),
      questioned: state.questioned.slice(),
      adjacent: state.adjacent.slice(),
    };
  }

  function inRange(state, cell) {
    return Number.isInteger(cell) && cell >= 0 && cell < state.mine.length;
  }

  function neighbors(state, cell) {
    const x = cell % state.width;
    const y = Math.floor(cell / state.width);
    const cells = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.width || ny >= state.height) continue;
        cells.push(ny * state.width + nx);
      }
    }
    return cells;
  }

  // Fisher-Yates so every safe cell is equally likely to hold a mine.
  function shuffle(items, random) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const swap = items[i];
      items[i] = items[j];
      items[j] = swap;
    }
    return items;
  }

  function placeMines(state, safeCell, random) {
    const next = clone(state);
    const banned = new Set([safeCell, ...neighbors(state, safeCell)]);
    const spots = [];
    for (let i = 0; i < next.mine.length; i += 1) {
      if (!banned.has(i)) spots.push(i);
    }
    shuffle(spots, random);
    const count = Math.min(next.mines, spots.length);
    for (let i = 0; i < count; i += 1) next.mine[spots[i]] = true;
    next.mines = count;

    for (let i = 0; i < next.mine.length; i += 1) {
      const around = neighbors(next, i);
      let touching = 0;
      for (let n = 0; n < around.length; n += 1) {
        if (next.mine[around[n]]) touching += 1;
      }
      // Mines stay at -1 so a flood can never treat one as an empty cell.
      next.adjacent[i] = next.mine[i] ? -1 : touching;
    }

    next.placed = true;
    next.status = "playing";
    return next;
  }

  function cleared(state) {
    if (!state.placed) return false;
    for (let i = 0; i < state.mine.length; i += 1) {
      if (!state.mine[i] && !state.revealed[i]) return false;
    }
    return true;
  }

  /**
   * Opens `cell`. A zero opens its neighbors too, and those zeros keep going.
   * Returns null when the click changes nothing.
   */
  function reveal(state, cell, random = Math.random) {
    if (state.status === "won" || state.status === "lost") return null;
    if (!inRange(state, cell)) return null;
    if (state.flagged[cell]) return null;

    let next = state.placed ? state : placeMines(state, cell, random);
    if (next.revealed[cell] || next.flagged[cell]) return null;
    if (next === state) next = clone(state);

    const opened = [];
    const stack = [cell];
    while (stack.length) {
      const current = stack.pop();
      if (next.revealed[current] || next.flagged[current]) continue;
      next.revealed[current] = true;
      next.questioned[current] = false;
      opened.push(current);
      if (next.mine[current]) {
        next.status = "lost";
        next.hit = current;
        return { state: next, opened };
      }
      if (next.adjacent[current] === 0) {
        neighbors(next, current).forEach((n) => {
          if (!next.revealed[n] && !next.flagged[n]) stack.push(n);
        });
      }
    }

    next.status = cleared(next) ? "won" : "playing";
    return { state: next, opened };
  }

  /**
   * Hidden cells cycle through flag, question mark, then unmarked.
   * A flag blocks reveal. A question mark is only a note to yourself.
   */
  function cycleMark(state, cell) {
    if (state.status === "won" || state.status === "lost") return null;
    if (!inRange(state, cell) || state.revealed[cell]) return null;
    const next = clone(state);
    if (next.flagged[cell]) {
      next.flagged[cell] = false;
      next.questioned[cell] = true;
    } else if (next.questioned[cell]) {
      next.questioned[cell] = false;
    } else {
      next.flagged[cell] = true;
    }
    return next;
  }

  /**
   * Opens every unflagged neighbor of a number whose flags already match it.
   * A flag on the wrong cell sets off that mine.
   */
  function chord(state, cell) {
    if (state.status !== "playing" || !inRange(state, cell)) return null;
    if (!state.revealed[cell] || state.adjacent[cell] < 1) return null;
    const around = neighbors(state, cell);
    let flags = 0;
    for (let i = 0; i < around.length; i += 1) {
      if (state.flagged[around[i]]) flags += 1;
    }
    if (flags !== state.adjacent[cell]) return null;

    let next = state;
    const opened = [];
    for (let i = 0; i < around.length; i += 1) {
      const neighbor = around[i];
      if (next.revealed[neighbor] || next.flagged[neighbor]) continue;
      const result = reveal(next, neighbor);
      if (!result) continue;
      next = result.state;
      for (let n = 0; n < result.opened.length; n += 1) opened.push(result.opened[n]);
      if (next.status === "lost" || next.status === "won") break;
    }
    if (next === state) return null;
    return { state: next, opened };
  }

  function flagCount(state) {
    let count = 0;
    for (let i = 0; i < state.flagged.length; i += 1) {
      if (state.flagged[i]) count += 1;
    }
    return count;
  }

  return { LEVELS, create, neighbors, reveal, cycleMark, chord, flagCount, cleared };
});
