/**
 * Connect Four rules, shared by the page and the computer opponent.
 *
 * Sitting 1: local two-player game.
 * Sitting 2: computer opponent (ai.js).
 * Sitting 3: difficulty, scores, undo, and sound.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.ConnectFour = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ROWS = 6;
  const COLS = 7;

  const Player = {
    None: 0,
    One: 1,
    Two: 2,
  };

  const DIRECTIONS = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(Player.None));
  }

  function rowForDrop(grid, col) {
    if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
    for (let row = ROWS - 1; row >= 0; row -= 1) {
      if (grid[row][col] === Player.None) return row;
    }
    return -1;
  }

  function connectedCells(grid, row, col) {
    const player = grid[row][col];
    if (player === Player.None) return [];

    const found = [];
    for (const [dr, dc] of DIRECTIONS) {
      const line = [[row, col]];
      for (const step of [-1, 1]) {
        let r = row + dr * step;
        let c = col + dc * step;
        while (
          r >= 0 &&
          r < ROWS &&
          c >= 0 &&
          c < COLS &&
          grid[r][c] === player
        ) {
          line.push([r, c]);
          r += dr * step;
          c += dc * step;
        }
      }
      if (line.length >= 4) found.push(...line);
    }

    const seen = new Set();
    const unique = [];
    for (const [r, c] of found) {
      const key = r + ":" + c;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push([r, c]);
    }
    return unique;
  }

  function otherPlayer(player) {
    return player === Player.One ? Player.Two : Player.One;
  }

  /**
   * Drop a disc without mutating the board passed in.
   * Returns null when the column is illegal or already full.
   */
  function applyMove(grid, col, player) {
    if (player !== Player.One && player !== Player.Two) return null;
    const next = grid.map((row) => row.slice());
    const row = rowForDrop(next, col);
    if (row < 0) return null;

    next[row][col] = player;
    const winningCells = connectedCells(next, row, col);
    const winner = winningCells.length > 0 ? player : null;
    const isDraw = winner === null && next[0].every((cell) => cell !== Player.None);

    return {
      board: next,
      row,
      col,
      player,
      winner,
      isDraw,
      winningCells,
      current: winner || isDraw ? null : otherPlayer(player),
    };
  }

  function createGame() {
    let board = emptyBoard();
    let opening = Player.One;
    let current = Player.One;
    let winner = null;
    let isDraw = false;
    let winningCells = [];

    return {
      get board() {
        return board.map((row) => row.slice());
      },
      get current() {
        return current;
      },
      get winner() {
        return winner;
      },
      get isDraw() {
        return isDraw;
      },
      get isOver() {
        return winner !== null || isDraw;
      },
      get winningCells() {
        return winningCells.map(([row, col]) => [row, col]);
      },
      drop(col) {
        if (winner || isDraw) return { ok: false, reason: "over" };
        const result = applyMove(board, col, current);
        if (!result) {
          if (!Number.isInteger(col) || col < 0 || col >= COLS) {
            return { ok: false, reason: "column" };
          }
          return { ok: false, reason: "full" };
        }
        board = result.board;
        winner = result.winner;
        isDraw = result.isDraw;
        winningCells = result.winningCells;
        if (result.current !== null) current = result.current;
        return { ok: true, row: result.row, col, player: result.player };
      },
      reset(nextOpening) {
        if (nextOpening === Player.One || nextOpening === Player.Two) opening = nextOpening;
        board = emptyBoard();
        current = opening;
        winner = null;
        isDraw = false;
        winningCells = [];
      },
    };
  }

  return {
    ROWS,
    COLS,
    Player,
    emptyBoard,
    rowForDrop,
    applyMove,
    createGame,
  };
});
