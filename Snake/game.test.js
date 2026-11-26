const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Snake = require("./game.js");

describe("Snake.create", () => {
  it("starts a three-segment snake heading right", () => {
    const state = Snake.create(10);
    assert.equal(state.size, 10);
    assert.equal(state.body.length, 3);
    assert.equal(state.direction, "right");
    assert.equal(state.over, false);
    assert.ok(state.food);
  });
});

describe("Snake.turn", () => {
  it("queues a perpendicular turn and rejects a reverse", () => {
    const state = Snake.create(10);
    assert.equal(Snake.turn(state, "up"), true);
    assert.deepEqual(state.queue, ["up"]);
    assert.equal(Snake.turn(state, "down"), false);
  });
});

describe("Snake.step", () => {
  it("moves the head forward and leaves the length unchanged", () => {
    const state = Snake.create(10);
    state.food = { x: 0, y: 0 };
    const before = state.body.length;
    assert.equal(Snake.step(state), "move");
    assert.equal(state.body.length, before);
    assert.equal(state.body[0].x, 6);
    assert.equal(state.body[0].y, 5);
  });

  it("grows and scores when the head reaches the food", () => {
    const state = Snake.create(10);
    state.food = { x: 6, y: 5 };
    assert.equal(Snake.step(state), "eat");
    assert.equal(state.score, 1);
    assert.equal(state.body.length, 4);
  });

  it("crashes into a wall in classic mode", () => {
    const state = Snake.create(5);
    state.food = { x: 2, y: 2 };
    state.body = [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];
    state.direction = "right";
    assert.equal(Snake.step(state), "crash");
    assert.equal(state.over, true);
  });

  it("wraps through the far edge when wrap is on", () => {
    const state = Snake.create(5, { wrap: true });
    state.food = { x: 2, y: 2 };
    state.body = [{ x: 4, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 2 }];
    state.direction = "right";
    assert.equal(Snake.step(state), "move");
    assert.deepEqual(state.body[0], { x: 0, y: 2 });
    assert.equal(state.over, false);
  });

  it("crashes into a maze wall", () => {
    const state = Snake.create(10, { walls: [{ x: 6, y: 5 }] });
    state.food = { x: 0, y: 0 };
    assert.equal(Snake.step(state), "crash");
    assert.equal(state.over, true);
  });
});

describe("Snake.mazes", () => {
  it("keeps the middle row clear for the opening run", () => {
    const mid = Math.floor(18 / 2);
    Snake.mazes(18).forEach((layout) => {
      assert.equal(layout.some((cell) => cell.y === mid), false);
    });
  });
});
