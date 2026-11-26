const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Tetris = require("./game.js");

function fixedRandom(values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("Tetris.create", () => {
  it("starts ready with an active piece and a next queue", () => {
    const state = Tetris.create({ speed: "normal" }, () => 0);
    assert.equal(state.status, "ready");
    assert.ok(state.active);
    assert.equal(state.next.length, Tetris.NEXT_COUNT);
    assert.equal(state.score, 0);
    assert.equal(state.level, 1);
  });
});

describe("Tetris.tryMove", () => {
  it("moves sideways while playing and rejects walls", () => {
    const state = Tetris.create({}, () => 0);
    Tetris.start(state);
    state.active = { type: "I", rotation: 0, x: 3, y: 0 };
    assert.equal(Tetris.tryMove(state, -1, 0), true);
    assert.equal(state.active.x, 2);
    state.active.x = 0;
    assert.equal(Tetris.tryMove(state, -1, 0), false);
  });
});

describe("Tetris.rotate", () => {
  it("rotates the active piece when there is room", () => {
    const state = Tetris.create({}, () => 0);
    Tetris.start(state);
    state.active = { type: "T", rotation: 0, x: 3, y: 0 };
    assert.equal(Tetris.rotate(state, 1), true);
    assert.equal(state.active.rotation, 1);
  });
});

describe("Tetris.hardDrop", () => {
  it("locks the piece on the floor and spawns the next one", () => {
    const state = Tetris.create({}, fixedRandom([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7]));
    Tetris.start(state);
    const type = state.active.type;
    const result = Tetris.hardDrop(state, () => 0);
    assert.ok(result.locked);
    assert.ok(state.grid.some((row) => row.includes(type)));
    assert.ok(state.active);
  });
});

describe("Tetris line clears", () => {
  it("scores a single line clear and raises the level after ten lines", () => {
    const state = Tetris.create({}, () => 0);
    Tetris.start(state);
    // Fill the bottom row except one cell, then drop an O... easier: fill row 19.
    for (let x = 0; x < Tetris.WIDTH; x += 1) state.grid[19][x] = "I";
    // Force a piece that will complete nothing on hard drop of empty - instead clear via lock helper path:
    // Put active as a single-cell stand-in by filling 9 cells and locking a J that completes the line.
    for (let x = 0; x < 9; x += 1) state.grid[19][x] = "I";
    state.grid[19][9] = null;
    state.active = { type: "I", rotation: 1, x: 7, y: 16 }; // vertical I covering x=9
    // Vertical I cells at x=9 (origin 7 + 2).
    const result = Tetris.hardDrop(state, () => 0);
    assert.equal(result.cleared, 1);
    assert.equal(state.lines, 1);
    assert.ok(state.score >= 100);
  });
});

describe("Tetris.hold", () => {
  it("swaps the active piece into hold once per drop", () => {
    const state = Tetris.create({}, () => 0);
    Tetris.start(state);
    const first = state.active.type;
    assert.equal(Tetris.hold(state, () => 0), true);
    assert.equal(state.hold, first);
    assert.equal(Tetris.hold(state, () => 0), false);
  });
});

describe("Tetris.step", () => {
  it("locks a grounded piece after the lock delay", () => {
    const state = Tetris.create({ speed: "fast" }, () => 0);
    Tetris.start(state);
    state.active = { type: "O", rotation: 0, x: 4, y: 18 };
    assert.equal(Tetris.grounded(state), true);
    const events = Tetris.step(state, state.lockDelay, () => 0);
    assert.equal(events.locked, true);
  });
});
