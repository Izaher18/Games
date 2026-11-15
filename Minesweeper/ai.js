/**
 * Minesweeper hint solver.
 *
 * It only looks at numbers that are already showing. Flags are ignored, so a
 * wrong flag cannot talk it into calling a mine safe. When nothing is certain
 * it points at the hidden cell that looks least likely to be a mine.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./game.js"));
  } else {
    root.MinesweeperAI = factory(root.Minesweeper);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Minesweeper) {
  "use strict";

  function hint(state) {
    if (!state || state.status === "won" || state.status === "lost") return null;
    if (!state.placed) return { index: Math.floor(state.mine.length / 2), certain: true };

    const size = state.mine.length;
    const knownMine = new Array(size).fill(false);
    const knownSafe = new Array(size).fill(false);
    let progress = true;

    while (progress) {
      progress = false;
      for (let i = 0; i < size; i += 1) {
        if (!state.revealed[i] || state.adjacent[i] < 0) continue;
        const split = splitNeighbors(state, i, knownMine, knownSafe);
        if (split.need === 0) progress = mark(split.unknown, knownSafe) || progress;
        else if (split.need === split.unknown.length) progress = mark(split.unknown, knownMine) || progress;
      }
    }

    for (let i = 0; i < size; i += 1) {
      if (knownSafe[i] && !state.revealed[i] && !state.flagged[i]) return { index: i, certain: true };
    }

    const risk = new Array(size).fill(0);
    const frontier = new Array(size).fill(false);
    for (let i = 0; i < size; i += 1) {
      if (!state.revealed[i] || state.adjacent[i] < 0) continue;
      const split = splitNeighbors(state, i, knownMine, knownSafe);
      if (!split.unknown.length || split.need < 0) continue;
      const chance = split.need / split.unknown.length;
      split.unknown.forEach((cell) => {
        if (state.flagged[cell] || knownMine[cell]) return;
        frontier[cell] = true;
        if (chance > risk[cell]) risk[cell] = chance;
      });
    }

    let best = -1;
    let bestRisk = Infinity;
    for (let i = 0; i < size; i += 1) {
      if (!frontier[i]) continue;
      if (risk[i] < bestRisk) {
        bestRisk = risk[i];
        best = i;
      }
    }
    if (best !== -1) return { index: best, certain: false };

    for (let i = 0; i < size; i += 1) {
      if (!state.revealed[i] && !state.flagged[i] && !knownMine[i]) return { index: i, certain: false };
    }
    return null;
  }

  function splitNeighbors(state, cell, knownMine, knownSafe) {
    const around = Minesweeper.neighbors(state, cell);
    const unknown = [];
    let mines = 0;
    for (let i = 0; i < around.length; i += 1) {
      const next = around[i];
      if (state.revealed[next] || knownSafe[next]) continue;
      if (knownMine[next]) mines += 1;
      else unknown.push(next);
    }
    return { unknown, need: state.adjacent[cell] - mines };
  }

  function mark(cells, flags) {
    let changed = false;
    for (let i = 0; i < cells.length; i += 1) {
      if (flags[cells[i]]) continue;
      flags[cells[i]] = true;
      changed = true;
    }
    return changed;
  }

  return { hint };
});
