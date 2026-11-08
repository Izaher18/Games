/**
 * 2048 rules, shared by the page and the computer player.
 *
 * Moves never change the state passed in; they return a new one, which keeps
 * undo and the computer's look-ahead simple.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Game2048 = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SIZE = 4;
  const WIN = 2048;
  const FOUR_CHANCE = 0.1;
  const VECTORS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };
  const DIRECTIONS = Object.keys(VECTORS);

  function create(random = Math.random) {
    let state = { size: SIZE, tiles: [], score: 0, nextId: 1, won: false, over: false };
    state = spawn(state, random).state;
    state = spawn(state, random).state;
    return state;
  }

  function emptyCells(state) {
    const taken = new Set(state.tiles.map((tile) => tile.y * state.size + tile.x));
    const cells = [];
    for (let y = 0; y < state.size; y += 1) {
      for (let x = 0; x < state.size; x += 1) {
        if (!taken.has(y * state.size + x)) cells.push({ x, y });
      }
    }
    return cells;
  }

  function spawn(state, random = Math.random) {
    const cells = emptyCells(state);
    if (!cells.length) return { state, tile: null };
    const cell = cells[Math.floor(random() * cells.length)];
    const tile = { id: state.nextId, value: random() < FOUR_CHANCE ? 4 : 2, x: cell.x, y: cell.y };
    return { state: { ...state, tiles: [...state.tiles, tile], nextId: state.nextId + 1 }, tile };
  }

  // Tiles nearest the wall they slide toward go first, so each one lands
  // against tiles that have already settled.
  function order(size, step) {
    const indexes = Array.from({ length: size }, (_, i) => i);
    return step === 1 ? indexes.reverse() : indexes;
  }

  /**
   * Slides every tile toward `direction` without adding a new tile.
   * Returns null when nothing would move.
   */
  function slide(state, direction) {
    const vector = VECTORS[direction];
    const size = state.size;
    const grid = new Array(size * size).fill(null);
    state.tiles.forEach((tile) => {
      grid[tile.y * size + tile.x] = tile;
    });

    const inside = (x, y) => x >= 0 && y >= 0 && x < size && y < size;
    const mergedInto = new Set();
    const moves = [];
    const merges = [];
    let nextId = state.nextId;
    let gained = 0;
    let moved = false;

    order(size, vector.y).forEach((y) => {
      order(size, vector.x).forEach((x) => {
        const tile = grid[y * size + x];
        if (!tile) return;

        let tx = x;
        let ty = y;
        while (inside(tx + vector.x, ty + vector.y) && !grid[(ty + vector.y) * size + tx + vector.x]) {
          tx += vector.x;
          ty += vector.y;
        }

        const nx = tx + vector.x;
        const ny = ty + vector.y;
        const neighbor = inside(nx, ny) ? grid[ny * size + nx] : null;
        grid[y * size + x] = null;

        if (neighbor && neighbor.value === tile.value && !mergedInto.has(ny * size + nx)) {
          const merged = { id: nextId, value: tile.value * 2, x: nx, y: ny };
          nextId += 1;
          grid[ny * size + nx] = merged;
          mergedInto.add(ny * size + nx);
          gained += merged.value;
          merges.push({ tile: merged, from: [neighbor.id, tile.id] });
          moves.push({ id: tile.id, x: nx, y: ny });
          moved = true;
        } else {
          grid[ty * size + tx] = tx === x && ty === y ? tile : { ...tile, x: tx, y: ty };
          moves.push({ id: tile.id, x: tx, y: ty });
          if (tx !== x || ty !== y) moved = true;
        }
      });
    });

    if (!moved) return null;
    const tiles = grid.filter(Boolean);
    return {
      state: {
        ...state,
        tiles,
        nextId,
        score: state.score + gained,
        won: state.won || tiles.some((tile) => tile.value >= WIN),
      },
      moves,
      merges,
      gained,
    };
  }

  function move(state, direction, random = Math.random) {
    if (state.over) return null;
    const result = slide(state, direction);
    if (!result) return null;
    const spawned = spawn(result.state, random);
    const next = { ...spawned.state };
    next.over = !canMove(next);
    return { ...result, state: next, spawned: spawned.tile, justWon: next.won && !state.won };
  }

  function canMove(state) {
    if (state.tiles.length < state.size * state.size) return true;
    const values = new Map(state.tiles.map((tile) => [tile.y * state.size + tile.x, tile.value]));
    return state.tiles.some((tile) =>
      (tile.x + 1 < state.size && values.get(tile.y * state.size + tile.x + 1) === tile.value) ||
      (tile.y + 1 < state.size && values.get((tile.y + 1) * state.size + tile.x) === tile.value),
    );
  }

  return { SIZE, WIN, DIRECTIONS, create, slide, move, spawn, canMove, emptyCells };
});
