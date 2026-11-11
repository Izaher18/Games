/**
 * 2048 computer player: expectimax search over the moves it can make and the
 * tiles the game might add after each one.
 *
 * The search works on a flat array of 16 exponents (0 for empty, 1 for a 2,
 * 2 for a 4, ...) because it looks at thousands of boards per move. Its slide
 * follows the same rules as game.js.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./game.js"));
  } else {
    root.Game2048AI = factory(root.Game2048);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Game2048) {
  "use strict";

  const SIZE = 4;
  const FOUR_CHANCE = 0.1;
  // Branches less likely than this are scored as they stand instead of searched.
  const MIN_PROBABILITY = 0.001;
  const DEAD = -1e12;

  // Each line lists its cells from the wall the tiles slide toward.
  const LINES = { up: [], down: [], left: [], right: [] };
  for (let i = 0; i < SIZE; i += 1) {
    const row = [0, 1, 2, 3].map((x) => i * SIZE + x);
    const column = [0, 1, 2, 3].map((y) => y * SIZE + i);
    LINES.left.push(row);
    LINES.right.push([...row].reverse());
    LINES.up.push(column);
    LINES.down.push([...column].reverse());
  }

  // Rewards keeping tiles in a snake that runs from the top-left corner, so big
  // tiles stay together where they can keep merging.
  const WEIGHTS = [
    15, 14, 13, 12,
    8, 9, 10, 11,
    7, 6, 5, 4,
    0, 1, 2, 3,
  ].map((power) => 2 ** power);
  const EMPTY_BONUS = 2 ** 21;

  function toGrid(state) {
    const grid = new Array(SIZE * SIZE).fill(0);
    state.tiles.forEach((tile) => {
      grid[tile.y * SIZE + tile.x] = Math.min(Math.log2(tile.value), MAX_EXPONENT);
    });
    return grid;
  }

  // A line of four exponents packs into 16 bits (4 bits each, wall side first), so
  // the result of sliding every possible line is worked out once, up front.
  const MAX_EXPONENT = 15;
  const SLID = new Uint16Array(1 << 16);
  for (let key = 0; key < SLID.length; key += 1) {
    const values = [12, 8, 4, 0].map((shift) => (key >> shift) & 15).filter(Boolean);
    const merged = [];
    for (let k = 0; k < values.length; k += 1) {
      if (values[k] === values[k + 1]) {
        merged.push(Math.min(values[k] + 1, MAX_EXPONENT));
        k += 1;
      } else {
        merged.push(values[k]);
      }
    }
    SLID[key] = [0, 1, 2, 3].reduce((packed, k) => (packed << 4) | (merged[k] || 0), 0);
  }

  function slideGrid(grid, direction) {
    let next = null;
    LINES[direction].forEach(([a, b, c, d]) => {
      const key = (grid[a] << 12) | (grid[b] << 8) | (grid[c] << 4) | grid[d];
      const slid = SLID[key];
      if (slid === key) return;
      if (!next) next = grid.slice();
      next[a] = slid >> 12;
      next[b] = (slid >> 8) & 15;
      next[c] = (slid >> 4) & 15;
      next[d] = slid & 15;
    });
    return next;
  }

  function evaluate(grid) {
    let score = 0;
    for (let i = 0; i < grid.length; i += 1) {
      score += grid[i] ? (2 ** grid[i]) * WEIGHTS[i] : EMPTY_BONUS;
    }
    return score;
  }

  function bestValue(grid, depth, probability) {
    let best = DEAD;
    Game2048.DIRECTIONS.forEach((direction) => {
      const next = slideGrid(grid, direction);
      if (next) best = Math.max(best, chanceValue(next, depth - 1, probability));
    });
    return best;
  }

  function chanceValue(grid, depth, probability) {
    if (depth <= 0 || probability < MIN_PROBABILITY) return evaluate(grid);
    const empty = [];
    grid.forEach((value, i) => {
      if (!value) empty.push(i);
    });
    let total = 0;
    empty.forEach((cell) => {
      [[1, 1 - FOUR_CHANCE], [2, FOUR_CHANCE]].forEach(([value, chance]) => {
        grid[cell] = value;
        total += chance * bestValue(grid, depth, (probability * chance) / empty.length);
        grid[cell] = 0;
      });
    });
    return total / empty.length;
  }

  // Search deeper when the board is crowded, where one bad move ends the game.
  function depthFor(grid) {
    const empty = grid.filter((value) => !value).length;
    return empty >= 4 ? 2 : 3;
  }

  /** Returns the best direction for `state`, or null when no move is left. */
  function bestMove(state) {
    const grid = toGrid(state);
    const depth = depthFor(grid);
    let best = null;
    let bestScore = -Infinity;
    Game2048.DIRECTIONS.forEach((direction) => {
      const next = slideGrid(grid, direction);
      if (!next) return;
      const score = chanceValue(next, depth, 1);
      if (score > bestScore) {
        best = direction;
        bestScore = score;
      }
    });
    return best;
  }

  return { bestMove, slideGrid, toGrid };
});
