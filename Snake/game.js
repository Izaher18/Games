const Snake = (() => {
  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const MAX_QUEUED_TURNS = 2;

  function create(size, options = {}) {
    const mid = Math.floor(size / 2);
    const state = {
      size,
      wrap: Boolean(options.wrap),
      walls: options.walls || [],
      body: [
        { x: mid, y: mid },
        { x: mid - 1, y: mid },
        { x: mid - 2, y: mid },
      ],
      direction: "right",
      queue: [],
      food: null,
      score: 0,
      over: false,
      won: false,
    };
    state.food = placeFood(state);
    return state;
  }

  function isOpposite(a, b) {
    const da = DIRECTIONS[a];
    const db = DIRECTIONS[b];
    return da.x + db.x === 0 && da.y + db.y === 0;
  }

  // Turns are queued so two quick key presses between ticks both register,
  // without letting the snake reverse into itself.
  function turn(state, direction) {
    if (!DIRECTIONS[direction] || state.over) return false;
    const last = state.queue.length ? state.queue[state.queue.length - 1] : state.direction;
    if (state.queue.length >= MAX_QUEUED_TURNS) return false;
    if (direction === last || isOpposite(direction, last)) return false;
    state.queue.push(direction);
    return true;
  }

  function placeFood(state) {
    const taken = new Set([...state.body, ...state.walls].map((cell) => cell.y * state.size + cell.x));
    const free = [];
    for (let y = 0; y < state.size; y += 1) {
      for (let x = 0; x < state.size; x += 1) {
        if (!taken.has(y * state.size + x)) free.push({ x, y });
      }
    }
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function step(state) {
    if (state.over) return "over";
    if (state.queue.length) state.direction = state.queue.shift();

    const delta = DIRECTIONS[state.direction];
    const head = state.body[0];
    const next = { x: head.x + delta.x, y: head.y + delta.y };
    if (state.wrap) {
      next.x = (next.x + state.size) % state.size;
      next.y = (next.y + state.size) % state.size;
    }
    const eating = state.food && next.x === state.food.x && next.y === state.food.y;
    // The tail moves out of the way this tick unless the snake is growing.
    const rest = eating ? state.body : state.body.slice(0, -1);

    const outside = next.x < 0 || next.y < 0 || next.x >= state.size || next.y >= state.size;
    const hits = (cell) => cell.x === next.x && cell.y === next.y;
    if (outside || rest.some(hits) || state.walls.some(hits)) {
      state.over = true;
      return "crash";
    }

    state.body = [next, ...rest];
    if (!eating) return "move";

    state.score += 1;
    state.food = placeFood(state);
    if (!state.food) {
      state.over = true;
      state.won = true;
      return "win";
    }
    return "eat";
  }

  // Every layout leaves the middle row clear, since the snake starts there heading right.
  function mazes(size) {
    const near = 3;
    const far = size - 4;
    const arm = 4;

    const corners = [];
    [[near, 1], [far, -1]].forEach(([cx, sx]) => {
      [[near, 1], [far, -1]].forEach(([cy, sy]) => {
        corners.push({ x: cx, y: cy });
        for (let i = 1; i < arm; i += 1) {
          corners.push({ x: cx + sx * i, y: cy }, { x: cx, y: cy + sy * i });
        }
      });
    });

    const bars = [];
    for (let x = near + 1; x <= far - 1; x += 1) {
      bars.push({ x, y: near + 1 }, { x, y: far - 1 });
    }

    return [corners, bars];
  }

  return { DIRECTIONS, create, turn, step, mazes };
})();
