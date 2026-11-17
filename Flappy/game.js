/**
 * Flappy rules.
 *
 * Distances are in world pixels on a fixed 400×600 field and times are in
 * seconds. `step` changes the state in place; the page calls it many times a
 * second with a small fixed `dt` so the physics behave the same on every screen.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.Flappy = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const WIDTH = 400;
  const HEIGHT = 600;
  const GROUND = 90;
  const BIRD_X = 120;
  const BIRD_RADIUS = 13;
  const GRAVITY = 1600;
  const FLAP_SPEED = 480;
  const MAX_FALL = 720;
  const PIPE_WIDTH = 68;
  const PIPE_SPACING = 220;
  // Closest a gap may come to the ceiling or the ground.
  const EDGE = 70;
  // Furthest one gap may sit above or below the last, so every climb can be made.
  const MAX_SHIFT = 170;
  const DEFAULTS = { gap: 150, speed: 150 };

  function create(settings = {}) {
    const options = { ...DEFAULTS, ...settings };
    const floor = HEIGHT - GROUND;
    return {
      width: WIDTH,
      height: HEIGHT,
      floor,
      gap: options.gap,
      speed: options.speed,
      bird: { x: BIRD_X, y: floor / 2, vy: 0, radius: BIRD_RADIUS },
      pipes: [],
      untilPipe: 0,
      lastGapY: null,
      score: 0,
      status: "ready",
      landed: false,
      time: 0,
      distance: 0,
    };
  }

  function flap(state) {
    if (state.status === "over") return false;
    if (state.status === "ready") state.status = "playing";
    state.bird.vy = -FLAP_SPEED;
    return true;
  }

  function newPipe(state, random) {
    let min = EDGE + state.gap / 2;
    let max = state.floor - EDGE - state.gap / 2;
    if (state.lastGapY !== null) {
      min = Math.max(min, state.lastGapY - MAX_SHIFT);
      max = Math.min(max, state.lastGapY + MAX_SHIFT);
    }
    const gapY = min + random() * (max - min);
    state.lastGapY = gapY;
    return { x: state.width, gapY, scored: false };
  }

  function hitsRect(bird, left, top, right, bottom) {
    const nearX = Math.max(left, Math.min(bird.x, right));
    const nearY = Math.max(top, Math.min(bird.y, bottom));
    const dx = bird.x - nearX;
    const dy = bird.y - nearY;
    return dx * dx + dy * dy < bird.radius * bird.radius;
  }

  function hitsPipe(state, pipe) {
    const left = pipe.x;
    const right = pipe.x + PIPE_WIDTH;
    const top = pipe.gapY - state.gap / 2;
    const bottom = pipe.gapY + state.gap / 2;
    // The top pipe reaches past the ceiling so the bird can't slip over it.
    return hitsRect(state.bird, left, -HEIGHT, right, top) || hitsRect(state.bird, left, bottom, right, state.floor);
  }

  /**
   * Advances the game by `dt` seconds. Returns what happened during the step:
   * how many pipes were passed, and whether the bird crashed or hit the ground.
   */
  function step(state, dt, random = Math.random) {
    const events = { scored: 0, crashed: false, landed: false };
    const bird = state.bird;
    state.time += dt;

    if (state.status === "ready") {
      bird.y = state.floor / 2 + Math.sin(state.time * 5) * 7;
      return events;
    }

    if (state.status === "playing") {
      const move = state.speed * dt;
      state.distance += move;
      state.untilPipe -= move;
      if (state.untilPipe <= 0) {
        state.pipes.push(newPipe(state, random));
        state.untilPipe += PIPE_SPACING;
      }
      state.pipes.forEach((pipe) => {
        pipe.x -= move;
      });
      while (state.pipes.length && state.pipes[0].x + PIPE_WIDTH < 0) state.pipes.shift();
    }

    // After a crash the bird keeps falling until it lands.
    if (!state.landed) {
      bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt);
      bird.y += bird.vy * dt;
      if (bird.y - bird.radius < 0) {
        bird.y = bird.radius;
        bird.vy = Math.max(0, bird.vy);
      }
      if (bird.y + bird.radius >= state.floor) {
        bird.y = state.floor - bird.radius;
        bird.vy = 0;
        state.landed = true;
        events.landed = true;
        if (state.status === "playing") {
          state.status = "over";
          events.crashed = true;
        }
      }
    }

    if (state.status !== "playing") return events;

    for (let i = 0; i < state.pipes.length; i += 1) {
      const pipe = state.pipes[i];
      if (hitsPipe(state, pipe)) {
        state.status = "over";
        events.crashed = true;
        return events;
      }
      if (!pipe.scored && pipe.x + PIPE_WIDTH / 2 < bird.x) {
        pipe.scored = true;
        state.score += 1;
        events.scored += 1;
      }
    }
    return events;
  }

  return {
    WIDTH,
    HEIGHT,
    GROUND,
    PIPE_WIDTH,
    PIPE_SPACING,
    GRAVITY,
    FLAP_SPEED,
    MAX_FALL,
    create,
    flap,
    step,
    hitsPipe,
  };
});
