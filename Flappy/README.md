# Flappy

A Flappy Bird–style flyer in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- Space, Up, W, a click, or a tap flaps the bird. The first flap starts the run. After a crash, flap again once the bird has landed to play again.
- Fly through the gaps in the green pipes. Each pipe you clear adds a point. The big number on the field is your score; Best is saved per difficulty in this browser.
- Easy, Normal, and Hard change the gap size and how fast the pipes move. The choice is remembered. Within a run, speed also ticks up every few pipes.
- Bronze is 10 points, silver 20, and gold 30. The game-over panel shows your medal, score, and best. Copy score pastes a short summary to the clipboard.
- Pause (or P / Esc) freezes the run. Switching away from the tab pauses automatically.
- Watch AI (or I) lets the computer fly — an AI tag sits above the bird. Press any flap control to take over. Games the AI touched don't count toward your best.
- Sound on plays short tones for flaps, scores, and crashes. The switch is remembered.
- A crash flashes the field, shakes it, and scatters feathers. Clearing a pipe floats a +1. Successful flaps flash the field lightly.
- Prefers-reduced-motion turns off shake, flap flash, ready bob, and wing beat.

`game.js` holds the rules (flapping, pipes, collisions, medals, difficulty, speed ramp) and works in the browser or Node. `ai.js` is the autopilot and `main.js` handles drawing, input, sound, and effects.

Run the rules tests with:

```bash
node --test game.test.js
```

The autopilot aims a little below the center of the next gap and flaps only while falling, so it doesn't pin itself to the ceiling.
