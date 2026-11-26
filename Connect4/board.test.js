const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const ConnectFour = require("./board.js");

const { Player, createGame, applyMove, emptyBoard, rowForDrop } = ConnectFour;

describe("ConnectFour.createGame", () => {
  it("starts with an empty board and Red to move", () => {
    const game = createGame();
    assert.equal(game.current, Player.One);
    assert.equal(game.isOver, false);
    assert.equal(game.board[5].every((cell) => cell === Player.None), true);
  });
});

describe("ConnectFour.applyMove", () => {
  it("drops into the lowest open row", () => {
    const board = emptyBoard();
    const result = applyMove(board, 3, Player.One);
    assert.ok(result);
    assert.equal(result.row, 5);
    assert.equal(result.col, 3);
    assert.equal(result.board[5][3], Player.One);
    assert.equal(result.current, Player.Two);
  });

  it("rejects a full column", () => {
    let board = emptyBoard();
    for (let i = 0; i < ConnectFour.ROWS; i += 1) {
      const player = i % 2 === 0 ? Player.One : Player.Two;
      board = applyMove(board, 0, player).board;
    }
    assert.equal(rowForDrop(board, 0), -1);
    assert.equal(applyMove(board, 0, Player.One), null);
  });

  it("detects a horizontal win", () => {
    let board = emptyBoard();
    for (let col = 0; col < 3; col += 1) {
      board = applyMove(board, col, Player.One).board;
      board = applyMove(board, col, Player.Two).board;
    }
    const result = applyMove(board, 3, Player.One);
    assert.equal(result.winner, Player.One);
    assert.ok(result.winningCells.length >= 4);
  });

  it("detects a vertical win", () => {
    let board = emptyBoard();
    for (let i = 0; i < 3; i += 1) {
      board = applyMove(board, 0, Player.One).board;
      board = applyMove(board, 1, Player.Two).board;
    }
    const result = applyMove(board, 0, Player.One);
    assert.equal(result.winner, Player.One);
  });
});

describe("ConnectFour.createGame.drop", () => {
  it("mutates through drop and ends on four in a row", () => {
    const game = createGame();
    [0, 1, 0, 1, 0, 1, 0].forEach((col) => {
      const result = game.drop(col);
      assert.equal(result.ok, true);
    });
    assert.equal(game.winner, Player.One);
    assert.equal(game.isOver, true);
    assert.equal(game.drop(2).ok, false);
  });
});
