# 2048

The sliding tile puzzle in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- Arrow keys or WASD slide every tile on the board; on a phone, swipe (or drag with a mouse). Two tiles with the same number merge into one worth their sum, and a new 2 or 4 appears after each move.
- Undo (or U / Backspace) takes back moves, up to the last 50, even after the game ends.
- Hint (or H) flashes an arrow for the move the computer player would make.
- Autoplay (or P) lets the computer play until you press it again or make a move yourself. Games it helped with don't count toward your best score.
- Reach the 2048 tile to win, then keep going for a higher score. The game ends when no move is left.
- Your best score is saved in the browser.

`game.js` holds the rules (sliding, merging, new tiles, game over) and works in the browser or Node. `ai.js` is the computer player and `main.js` handles drawing and input.

The computer player uses expectimax: it tries each move, averages over every 2 or 4 the game could add next (weighted by how likely each is), and looks two or three moves ahead. Boards score higher when big tiles line up in a snake from one corner and when more cells are empty. In testing it reaches 2048 in most games at a few milliseconds per move.
