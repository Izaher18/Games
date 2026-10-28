/**
 * Computer opponent.
 * Looks ahead through legal drops, takes a win, and blocks a threat.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./board.js"));
  } else {
    root.ConnectFourAI = factory(root.ConnectFour);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (ConnectFour) {
  "use strict";

  const { ROWS, COLS, Player, rowForDrop, applyMove } = ConnectFour;

  const COLUMN_ORDER = [3, 2, 4, 1, 5, 0, 6];
  const COLUMN_WEIGHT = [1, 2, 3, 4, 3, 2, 1];
  const WIN_SCORE = 1000000;
  const LOSS_SCORE = -1000000;
  const DEFAULT_MAX_DEPTH = 7;
  const DEFAULT_SOFT_DEPTH = 4;
  const DEFAULT_BUDGET_MS = 90;

  const WINDOWS = [];

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      WINDOWS.push([
        [row, col],
        [row, col + 1],
        [row, col + 2],
        [row, col + 3],
      ]);
    }
  }

  for (let col = 0; col < COLS; col += 1) {
    for (let row = 0; row <= ROWS - 4; row += 1) {
      WINDOWS.push([
        [row, col],
        [row + 1, col],
        [row + 2, col],
        [row + 3, col],
      ]);
    }
  }

  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 0; col <= COLS - 4; col += 1) {
      WINDOWS.push([
        [row, col],
        [row + 1, col + 1],
        [row + 2, col + 2],
        [row + 3, col + 3],
      ]);
    }
  }

  for (let row = 0; row <= ROWS - 4; row += 1) {
    for (let col = 3; col < COLS; col += 1) {
      WINDOWS.push([
        [row, col],
        [row + 1, col - 1],
        [row + 2, col - 2],
        [row + 3, col - 3],
      ]);
    }
  }

  function otherPlayer(player) {
    return player === Player.One ? Player.Two : Player.One;
  }

  function legalColumns(grid) {
    const open = [];
    for (const col of COLUMN_ORDER) {
      if (grid[0][col] === Player.None) open.push(col);
    }
    return open;
  }

  function emptyIsPlayable(grid, row, col) {
    return rowForDrop(grid, col) === row;
  }

  function scoreWindow(grid, cells, player, opponent) {
    let mine = 0;
    let opp = 0;
    const empties = [];

    for (const [row, col] of cells) {
      const value = grid[row][col];
      if (value === player) mine += 1;
      else if (value === opponent) opp += 1;
      else empties.push([row, col]);
    }

    if (mine > 0 && opp > 0) return 0;

    const playable = empties.some(([row, col]) => emptyIsPlayable(grid, row, col));
    if (mine === 3 && empties.length === 1) return playable ? 90 : 12;
    if (opp === 3 && empties.length === 1) return playable ? -110 : -12;
    if (mine === 2 && empties.length === 2) return playable ? 12 : 4;
    if (opp === 2 && empties.length === 2) return playable ? -11 : -3;
    if (mine === 1 && empties.length === 3) return 1;
    if (opp === 1 && empties.length === 3) return -1;
    return 0;
  }

  function evaluate(grid, player) {
    const opponent = otherPlayer(player);
    let score = 0;

    for (let col = 0; col < COLS; col += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        if (grid[row][col] === player) score += COLUMN_WEIGHT[col];
        else if (grid[row][col] === opponent) score -= COLUMN_WEIGHT[col];
      }
    }

    for (const cells of WINDOWS) {
      score += scoreWindow(grid, cells, player, opponent);
    }

    return score;
  }

  function minimax(state, depth, alpha, beta, aiPlayer, deadline, watchClock) {
    if (watchClock && Date.now() >= deadline) return null;
    if (state.winner === aiPlayer) return WIN_SCORE + depth;
    if (state.winner) return LOSS_SCORE - depth;
    if (state.isDraw || depth === 0) {
      return state.isDraw ? 0 : evaluate(state.board, aiPlayer);
    }

    const columns = legalColumns(state.board);
    if (columns.length === 0) return 0;

    const maximizing = state.current === aiPlayer;
    let best = maximizing ? -Infinity : Infinity;

    for (const col of columns) {
      const next = applyMove(state.board, col, state.current);
      const score = minimax(next, depth - 1, alpha, beta, aiPlayer, deadline, watchClock);
      if (score === null) return null;

      if (maximizing) {
        best = Math.max(best, score);
        alpha = Math.max(alpha, score);
      } else {
        best = Math.min(best, score);
        beta = Math.min(beta, score);
      }

      if (alpha >= beta) break;
    }

    return best;
  }

  /**
   * Column the computer should play, or -1 when no legal drop remains.
   * options.maxDepth, options.softDepth, and options.budgetMs tune the search.
   */
  function chooseColumn(board, player, options) {
    if (player !== Player.One && player !== Player.Two) return -1;

    const settings = options || {};
    const maxDepth = settings.maxDepth || DEFAULT_MAX_DEPTH;
    const softDepth = settings.softDepth || DEFAULT_SOFT_DEPTH;
    const budgetMs = settings.budgetMs || DEFAULT_BUDGET_MS;
    const columns = legalColumns(board);
    if (columns.length === 0) return -1;

    for (const col of columns) {
      const result = applyMove(board, col, player);
      if (result && result.winner === player) return col;
    }

    const deadline = Date.now() + budgetMs;
    let order = columns.slice();
    let bestCol = order[0];

    for (let depth = 1; depth <= maxDepth; depth += 1) {
      const watchClock = depth > softDepth;
      if (watchClock && Date.now() >= deadline) break;

      const scored = [];
      let stopped = false;

      for (const col of order) {
        if (watchClock && Date.now() >= deadline) {
          stopped = true;
          break;
        }

        const result = applyMove(board, col, player);
        const score = minimax(
          result,
          depth - 1,
          -Infinity,
          Infinity,
          player,
          deadline,
          watchClock
        );
        if (score === null) {
          stopped = true;
          break;
        }
        scored.push({ col, score });
      }

      if (stopped || scored.length !== order.length) break;

      scored.sort((a, b) => b.score - a.score || order.indexOf(a.col) - order.indexOf(b.col));
      order = scored.map((entry) => entry.col);
      bestCol = order[0];

      if (scored[0].score >= WIN_SCORE || scored[0].score <= LOSS_SCORE) break;
    }

    const blunder = settings.blunder || 0;
    if (blunder > 0 && Math.random() < blunder) {
      const opponent = otherPlayer(player);
      const slips = columns.filter((col) => {
        if (col === bestCol) return false;
        const result = applyMove(board, col, player);
        if (!result || result.winner) return false;
        return !opponentCanWin(result.board, opponent);
      });
      if (slips.length > 0) return slips[Math.floor(Math.random() * slips.length)];
    }

    return bestCol;
  }

  function opponentCanWin(grid, opponent) {
    for (let col = 0; col < COLS; col += 1) {
      const result = applyMove(grid, col, opponent);
      if (result && result.winner === opponent) return true;
    }
    return false;
  }

  return {
    chooseColumn,
  };
});
