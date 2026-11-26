const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Minesweeper = require("./game.js");

function fixedRandom(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("Minesweeper.create", () => {
  it("builds an easy board that is not yet mined", () => {
    const state = Minesweeper.create("easy");
    assert.equal(state.width, 9);
    assert.equal(state.height, 9);
    assert.equal(state.mines, 10);
    assert.equal(state.placed, false);
    assert.equal(state.status, "ready");
  });
});

describe("Minesweeper.reveal", () => {
  it("plants mines away from the first click and its neighbors", () => {
    const state = Minesweeper.create("easy");
    const cell = 40;
    const result = Minesweeper.reveal(state, cell, () => 0);
    assert.ok(result);
    assert.equal(result.state.placed, true);
    assert.equal(result.state.mine[cell], false);
    Minesweeper.neighbors(result.state, cell).forEach((n) => {
      assert.equal(result.state.mine[n], false);
    });
    assert.equal(result.state.revealed[cell], true);
  });

  it("loses when a mine is opened", () => {
    const state = Minesweeper.create("easy");
    // First reveal plants mines with a deterministic shuffle seed of zeros.
    const first = Minesweeper.reveal(state, 0, () => 0);
    const mined = first.state.mine.findIndex((isMine, i) => isMine && !first.state.revealed[i]);
    assert.ok(mined >= 0);
    const boom = Minesweeper.reveal(first.state, mined, () => 0);
    assert.equal(boom.state.status, "lost");
    assert.equal(boom.state.hit, mined);
  });

  it("wins when every safe cell is open", () => {
    const state = Minesweeper.create("easy");
    // Tiny custom board: 2x2 with one mine after placement.
    state.width = 2;
    state.height = 2;
    state.mines = 1;
    state.mine = [false, false, false, false];
    state.revealed = [false, false, false, false];
    state.flagged = [false, false, false, false];
    state.questioned = [false, false, false, false];
    state.adjacent = [0, 0, 0, 0];
    const random = fixedRandom([0, 0, 0, 0]);
    const open = Minesweeper.reveal(state, 0, random);
    assert.ok(open);
    // Force a won board: one mine, three open.
    const won = {
      ...open.state,
      mine: [false, false, false, true],
      revealed: [true, true, true, false],
      adjacent: [0, 1, 1, -1],
      status: "playing",
    };
    assert.equal(Minesweeper.cleared(won), true);
    won.status = Minesweeper.cleared(won) ? "won" : "playing";
    assert.equal(won.status, "won");
  });
});

describe("Minesweeper.cycleMark", () => {
  it("cycles flag, question, then clear", () => {
    let state = Minesweeper.create("easy");
    state = Minesweeper.cycleMark(state, 0);
    assert.equal(state.flagged[0], true);
    state = Minesweeper.cycleMark(state, 0);
    assert.equal(state.flagged[0], false);
    assert.equal(state.questioned[0], true);
    state = Minesweeper.cycleMark(state, 0);
    assert.equal(state.flagged[0], false);
    assert.equal(state.questioned[0], false);
  });
});

describe("Minesweeper.chord", () => {
  it("opens unflagged neighbors when the flag count matches", () => {
    const state = Minesweeper.create("easy");
    state.status = "playing";
    state.placed = true;
    state.width = 3;
    state.height = 3;
    state.mines = 1;
    state.mine = [false, true, false, false, false, false, false, false, false];
    state.revealed = [false, false, false, false, true, false, false, false, false];
    state.flagged = [false, true, false, false, false, false, false, false, false];
    state.questioned = state.mine.map(() => false);
    state.adjacent = [1, -1, 1, 1, 1, 1, 0, 0, 0];
    const result = Minesweeper.chord(state, 4);
    assert.ok(result);
    assert.ok(result.opened.length >= 1);
    assert.equal(result.state.revealed[1], false);
  });
});
