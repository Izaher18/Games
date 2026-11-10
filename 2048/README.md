# 2048

The sliding tile puzzle in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- Arrow keys or WASD slide every tile on the board. Two tiles with the same number merge into one worth their sum, and a new 2 or 4 appears after each move.
- Reach the 2048 tile to win, then keep going for a higher score. The game ends when no move is left.
- Your best score is saved in the browser.

`game.js` holds the rules (sliding, merging, new tiles, game over) and works in the browser or Node. `main.js` handles drawing and input.
