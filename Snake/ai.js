const SnakeAI = (() => {
  const key = (state, cell) => cell.y * state.size + cell.x;

  function neighbors(state, cell) {
    const result = [];
    Object.entries(Snake.DIRECTIONS).forEach(([direction, delta]) => {
      let x = cell.x + delta.x;
      let y = cell.y + delta.y;
      if (state.wrap) {
        x = (x + state.size) % state.size;
        y = (y + state.size) % state.size;
      } else if (x < 0 || y < 0 || x >= state.size || y >= state.size) {
        return;
      }
      result.push({ direction, cell: { x, y } });
    });
    return result;
  }

  // The tail is left open because it moves out of the way on the next step.
  function obstacles(state, body) {
    return new Set([...state.walls, ...body.slice(0, -1)].map((cell) => key(state, cell)));
  }

  function path(state, from, to, blocked) {
    const goal = key(state, to);
    const seen = new Map([[key(state, from), null]]);
    const queue = [from];
    while (queue.length) {
      const cell = queue.shift();
      if (key(state, cell) === goal) {
        const steps = [];
        for (let k = goal; seen.get(k); k = key(state, seen.get(k).from)) steps.unshift(seen.get(k));
        return steps;
      }
      neighbors(state, cell).forEach((next) => {
        const k = key(state, next.cell);
        if (seen.has(k) || (blocked.has(k) && k !== goal)) return;
        seen.set(k, { direction: next.direction, cell: next.cell, from: cell });
        queue.push(next.cell);
      });
    }
    return null;
  }

  function follow(body, steps, food) {
    let result = body;
    steps.forEach(({ cell }) => {
      const eating = cell.x === food.x && cell.y === food.y;
      result = [cell, ...(eating ? result : result.slice(0, -1))];
    });
    return result;
  }

  function canReachTail(state, body) {
    if (body.length < 2) return true;
    const blocked = obstacles(state, body);
    blocked.delete(key(state, body[0]));
    return path(state, body[0], body[body.length - 1], blocked) !== null;
  }

  function openSpace(state, start, blocked) {
    const seen = new Set([key(state, start)]);
    const queue = [start];
    while (queue.length) {
      neighbors(state, queue.shift()).forEach(({ cell }) => {
        const k = key(state, cell);
        if (seen.has(k) || blocked.has(k)) return;
        seen.add(k);
        queue.push(cell);
      });
    }
    return seen.size;
  }

  // Moves since each game's last apple, so a snake that keeps stalling eventually takes a risk.
  const hunger = new WeakMap();

  function nextMove(state) {
    const body = state.body;
    const blocked = obstacles(state, body);
    const last = hunger.get(state);
    const moves = last && last.score === state.score ? last.moves + 1 : 0;
    hunger.set(state, { score: state.score, moves });
    const starving = moves > state.size * state.size;

    // Take the shortest route to the apple, but only if the snake could still
    // reach its own tail afterwards; that keeps it from sealing itself in.
    if (state.food) {
      const steps = path(state, body[0], state.food, blocked);
      if (steps) {
        const after = follow(body, steps, state.food);
        const filled = after.length + state.walls.length === state.size * state.size;
        if (starving || filled || canReachTail(state, after)) return steps[0].direction;
      }
    }

    // Otherwise stall by following the tail, taking the longest way round.
    const options = neighbors(state, body[0]).filter(({ cell }) => !blocked.has(key(state, cell)));
    let best = null;
    let bestLength = -1;
    options.forEach(({ direction, cell }) => {
      const eating = state.food && cell.x === state.food.x && cell.y === state.food.y;
      const after = [cell, ...(eating ? body : body.slice(0, -1))];
      if (!canReachTail(state, after)) return;
      const toTail = path(state, cell, after[after.length - 1], obstacles(state, after));
      const length = toTail ? toTail.length : 0;
      if (length > bestLength) {
        best = direction;
        bestLength = length;
      }
    });
    if (best) return best;

    // Nothing is safe, so head for the most open space and hope it frees up.
    let roomiest = state.direction;
    let mostRoom = -1;
    options.forEach(({ direction, cell }) => {
      const room = openSpace(state, cell, blocked);
      if (room > mostRoom) {
        roomiest = direction;
        mostRoom = room;
      }
    });
    return roomiest;
  }

  return { nextMove };
})();
