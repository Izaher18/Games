# Tetris

A Tetris-style stacker in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- ← → or A/D move · ↑ / W / X rotate · ↓ / S soft drop · Space hard drop · C or Shift hold
- Clear lines to score. A single is 100×level, double 300, triple 500, tetris 800. Soft drops add 1 per cell, hard drops 2.
- Level rises every 10 lines and the stack falls faster. Slow, Normal, and Fast set the starting gravity; the choice and your best score are remembered per speed.
- Hold stores one piece until you swap it back. Next shows the upcoming three. A ghost piece marks the landing.
- Pause (or P / Esc) freezes the run. Switching away from the tab pauses automatically.
- Watch AI (or I) lets the computer stack. Press any move to take over. Games the AI touched don't count toward your best.
- Sound on plays short tones for moves, clears, and game over. Copy score pastes a short summary when a run ends.

`game.js` holds the rules (7-bag pieces, rotation kicks, hold, gravity, locks, scoring) and works in the browser or Node. `ai.js` is the autopilot and `main.js` handles drawing, input, and sound.

Run the rules tests with:

```bash
node --test game.test.js
```

The autopilot tries every rotation and column, scores landings by line clears, holes, height, and bumpiness, then rotates, shifts, and hard-drops into the best spot.
