const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const Flappy = require("./game.js");

function playUntil(state, predicate, random = () => 0.5, limit = 20000) {
  for (let n = 0; n < limit; n += 1) {
    const events = Flappy.step(state, 1 / 120, random);
    if (predicate(state, events)) return events;
  }
  throw new Error("playUntil exceeded step limit");
}

describe("Flappy.create", () => {
  it("starts ready at mid-air on normal settings", () => {
    const state = Flappy.create();
    assert.equal(state.status, "ready");
    assert.equal(state.score, 0);
    assert.equal(state.speed, Flappy.LEVELS.normal.speed);
    assert.equal(state.baseSpeed, state.speed);
    assert.equal(state.bird.radius, Flappy.BIRD_RADIUS);
  });

  it("applies hard level gap and speed", () => {
    const state = Flappy.create({ level: "hard" });
    assert.equal(state.gap, Flappy.LEVELS.hard.gap);
    assert.equal(state.speed, Flappy.LEVELS.hard.speed);
  });
});

describe("Flappy.flap", () => {
  it("starts a ready game and launches the bird up", () => {
    const state = Flappy.create();
    assert.equal(Flappy.flap(state), true);
    assert.equal(state.status, "playing");
    assert.ok(state.bird.vy < 0);
  });

  it("does nothing after the run is over", () => {
    const state = Flappy.create();
    state.status = "over";
    const vy = state.bird.vy;
    assert.equal(Flappy.flap(state), false);
    assert.equal(state.bird.vy, vy);
  });
});

describe("Flappy.step", () => {
  it("scores each pipe only once when the bird clears its center", () => {
    const state = Flappy.create({ level: "easy" });
    state.status = "playing";
    state.untilPipe = 9999;
    state.bird.vy = 0;
    const gapY = state.bird.y;
    // Center already behind the bird so the next step awards the point.
    state.pipes.push({
      x: state.bird.x - Flappy.PIPE_WIDTH / 2 - 1,
      gapY,
      scored: false,
    });
    const first = Flappy.step(state, 1 / 120, () => 0.5);
    assert.equal(first.scored, 1);
    assert.equal(state.score, 1);
    assert.equal(state.pipes[0].scored, true);
    const second = Flappy.step(state, 1 / 120, () => 0.5);
    assert.equal(second.scored, 0);
    assert.equal(state.score, 1);
  });

  it("crashes and lands when the bird hits the ground", () => {
    const state = Flappy.create();
    Flappy.flap(state);
    // No more flaps — gravity wins.
    const events = playUntil(state, (s) => s.landed);
    assert.equal(state.status, "over");
    assert.equal(events.crashed, true);
    assert.equal(events.landed, true);
    assert.ok(state.bird.y + state.bird.radius <= state.floor + 0.001);
  });

  it("crashes when the bird overlaps a pipe body", () => {
    const state = Flappy.create({ level: "hard" });
    state.status = "playing";
    state.untilPipe = 9999;
    state.bird.vy = 0;
    // Gap well above the bird so the lower pipe occupies the bird's y.
    state.pipes.push({
      x: state.bird.x - Flappy.PIPE_WIDTH / 2,
      gapY: state.bird.y - state.gap,
      scored: false,
    });
    const events = Flappy.step(state, 1 / 120, () => 0.5);
    assert.equal(events.crashed, true);
    assert.equal(state.status, "over");
    assert.equal(state.landed, false);
  });

  it("ramps speed after every few pipes cleared", () => {
    const state = Flappy.create({ level: "easy" });
    state.status = "playing";
    state.score = Flappy.RAMP_EVERY - 1;
    state.pipes.push({
      x: state.bird.x - Flappy.PIPE_WIDTH / 2 - 1,
      gapY: state.bird.y,
      scored: false,
    });
    const before = state.speed;
    Flappy.step(state, 1 / 120, () => 0.5);
    assert.equal(state.score, Flappy.RAMP_EVERY);
    assert.equal(state.speed, before + Flappy.RAMP_AMOUNT);
    assert.equal(state.speed, Flappy.speedForScore(state.baseSpeed, state.score));
  });
});

describe("Flappy.medal", () => {
  it("returns null below bronze and the best tier earned above", () => {
    assert.equal(Flappy.medal(0), null);
    assert.equal(Flappy.medal(9), null);
    assert.equal(Flappy.medal(10), "bronze");
    assert.equal(Flappy.medal(20), "silver");
    assert.equal(Flappy.medal(29), "silver");
    assert.equal(Flappy.medal(30), "gold");
  });
});

describe("Flappy.hitsPipe", () => {
  it("counts the lip overhang as solid", () => {
    const state = Flappy.create();
    state.status = "playing";
    const gapY = state.floor / 2;
    const pipe = { x: state.bird.x - Flappy.PIPE_WIDTH / 2, gapY, scored: false };
    // Sit beside the body but inside the wider lip.
    state.bird.y = gapY - state.gap / 2 - 11;
    state.bird.x = pipe.x - Flappy.PIPE_OVERHANG / 2;
    assert.equal(Flappy.hitsPipe(state, pipe), true);
  });
});
