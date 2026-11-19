/**
 * Flappy autopilot.
 *
 * Aims a little below the center of the next gap and flaps only while falling,
 * so it doesn't pin itself to the ceiling. With no pipe ahead it holds mid-air.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./game.js"));
  } else {
    root.FlappyAI = factory(root.Flappy);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (Flappy) {
  "use strict";

  function shouldFlap(state) {
    if (!state || state.status !== "playing") return false;
    const bird = state.bird;
    const next = state.pipes.find((pipe) => pipe.x + Flappy.PIPE_WIDTH > bird.x - bird.radius);
    const target = next ? next.gapY + state.gap * 0.22 : state.floor / 2;
    return bird.y > target && bird.vy > 0;
  }

  return { shouldFlap };
});
