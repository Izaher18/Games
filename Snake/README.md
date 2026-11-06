# Snake

Classic Snake in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- Arrow keys or WASD to steer, Space or P to pause, Enter to play again, I to toggle the AI.
- On phones, swipe on the board or use the on-screen arrows; tap the board to pause.
- Pick Slow, Normal or Fast. The snake speeds up a little with every apple.
- Pick a mode: Classic ends the game at the walls, Wrap sends the snake out the opposite side, and Maze adds blocks to steer around (one of two layouts, picked at random).
- Best scores are saved per speed and mode in the browser.
- Press Watch AI (or I) to let the computer play; press any arrow to take over. Games the AI touched don't count toward best scores.
- The snake glides smoothly between cells (turned off if your system asks for reduced motion).
- Eating an apple sets off a burst of sparks and a floating +1.
- Crashing shakes the board and flashes it red.

`game.js` holds the rules (movement, turning, food, collisions, maze layouts), `ai.js` picks the autopilot's moves and `main.js` handles drawing, input and sound.

The autopilot takes the shortest path to the apple only when it could still reach its own tail afterwards; otherwise it follows its tail the long way round until a safe path opens up.
