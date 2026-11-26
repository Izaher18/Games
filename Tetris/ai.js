/**
 * Tetris autopilot.
 *
 * Tries every rotation and column for the active piece, hard-drops in a copy of
 * the well, and picks the landing that clears the most lines while keeping the
 * stack low, flat, and hole-free.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./game.js"));
  } else {
    root.TetrisAI = factory(root.Tetris);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Tetris) {
  "use strict";

  function cloneState(state) {
    return {
      ...state,
      grid: state.grid.map((row) => row.slice()),
      bag: state.bag.slice(),
      next: state.next.slice(),
      active: state.active ? { ...state.active } : null,
    };
  }

  function columnHeights(grid) {
    const heights = Array(Tetris.WIDTH).fill(0);
    for (let x = 0; x < Tetris.WIDTH; x += 1) {
      for (let y = 0; y < Tetris.HEIGHT; y += 1) {
        if (grid[y][x] !== null) {
          heights[x] = Tetris.HEIGHT - y;
          break;
        }
      }
    }
    return heights;
  }

  function evaluate(grid, cleared) {
    const heights = columnHeights(grid);
    let aggregate = 0;
    let bump = 0;
    let holes = 0;
    for (let x = 0; x < heights.length; x += 1) {
      aggregate += heights[x];
      if (x > 0) bump += Math.abs(heights[x] - heights[x - 1]);
      let blockSeen = false;
      for (let y = 0; y < Tetris.HEIGHT; y += 1) {
        if (grid[y][x] !== null) blockSeen = true;
        else if (blockSeen) holes += 1;
      }
    }
    return cleared * 760 - aggregate * 18 - holes * 140 - bump * 12;
  }

  function bestPlan(state) {
    if (!state || state.status !== "playing" || !state.active) return null;
    let best = null;
    for (let rotation = 0; rotation < 4; rotation += 1) {
      for (let x = -2; x < Tetris.WIDTH; x += 1) {
        const trial = cloneState(state);
        trial.active.rotation = rotation;
        trial.active.x = x;
        trial.active.y = state.active.type === "I" ? -1 : 0;
        if (!Tetris.fits(trial, trial.active)) continue;
        while (Tetris.fits(trial, { ...trial.active, y: trial.active.y + 1 })) {
          trial.active.y += 1;
        }
        const beforeLines = trial.lines;
        // Lock without spawning the next piece — only score this landing.
        Tetris.cellsOf(trial.active).forEach(({ x: cx, y: cy }) => {
          if (cy >= 0 && cy < Tetris.HEIGHT && cx >= 0 && cx < Tetris.WIDTH) {
            trial.grid[cy][cx] = trial.active.type;
          }
        });
        const kept = trial.grid.filter((row) => row.some((cell) => cell === null));
        const cleared = Tetris.HEIGHT - kept.length;
        while (kept.length < Tetris.HEIGHT) kept.unshift(Array(Tetris.WIDTH).fill(null));
        trial.grid = kept;
        const score = evaluate(trial.grid, cleared);
        if (!best || score > best.score) {
          best = {
            score,
            rotation,
            x,
            cleared,
            linesBefore: beforeLines,
          };
        }
      }
    }
    return best;
  }

  /**
   * Returns one input to apply this frame: "left", "right", "rotate",
   * "soft", "hard", or null when waiting.
   */
  function chooseMove(state) {
    const plan = bestPlan(state);
    if (!plan || !state.active) return null;
    if (state.active.rotation !== plan.rotation) return "rotate";
    if (state.active.x < plan.x) return "right";
    if (state.active.x > plan.x) return "left";
    return "hard";
  }

  return { bestPlan, chooseMove, evaluate };
});
