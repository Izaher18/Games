const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Game2048 = require("./game.js");

function fixedRandom(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

function board(values) {
  const tiles = [];
  let nextId = 1;
  values.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      tiles.push({ id: nextId, value, x, y });
      nextId += 1;
    });
  });
  return { size: 4, tiles, score: 0, nextId, won: false, over: false };
}

describe("Game2048.create", () => {
  it("starts with two tiles on an empty board", () => {
    const state = Game2048.create(fixedRandom([0, 0.5, 0, 0.5]));
    assert.equal(state.tiles.length, 2);
    assert.equal(state.score, 0);
    assert.equal(state.over, false);
  });
});

describe("Game2048.move", () => {
  it("merges matching tiles and adds their value to the score", () => {
    const state = board([
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = Game2048.move(state, "left", () => 0.99);
    assert.ok(result);
    assert.equal(result.gained, 4);
    assert.equal(result.state.score, 4);
    assert.equal(result.merges.length, 1);
    assert.equal(result.merges[0].tile.value, 4);
  });

  it("returns null when the slide would change nothing", () => {
    const state = board([
      [2, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    assert.equal(Game2048.move(state, "left", () => 0.5), null);
  });

  it("marks a win the first time a 2048 tile appears", () => {
    const state = board([
      [1024, 1024, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
    const result = Game2048.move(state, "left", () => 0.99);
    assert.equal(result.justWon, true);
    assert.equal(result.state.won, true);
  });

  it("marks the board over when the spawn leaves no moves", () => {
    const packed = board([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [8, 16, 8, 16],
      [16, 8, 0, 4],
    ]);
    const result = Game2048.move(packed, "left", () => 0.99);
    assert.ok(result);
    assert.equal(Game2048.canMove(result.state), false);
    assert.equal(result.state.over, true);
  });
});

describe("Game2048.canMove", () => {
  it("is true while any neighbor pair matches", () => {
    const state = board([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 4],
    ]);
    assert.equal(Game2048.canMove(state), true);
  });

  it("is false on a full board with no matching neighbors", () => {
    const state = board([
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [8, 16, 8, 16],
      [16, 8, 4, 2],
    ]);
    assert.equal(Game2048.canMove(state), false);
  });
});
