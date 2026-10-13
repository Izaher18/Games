# Connect Four

A Connect Four game that runs in the browser. Play Yellow against the computer, or pass the device for a local two-player game.

## Play

Open `index.html` in a browser. No install or build step.

You play Red. Click a column to drop a disc. The disc falls to the lowest open slot, then the computer plays Yellow. The first side to line up four discs horizontally, vertically, or diagonally wins. If the board fills with no line of four, the game is a draw.

**Computer** and **Two players** switch who controls Yellow. Switching starts a new game. **Play again** clears the board and starts over with Red.

You can also move between columns with the keyboard and drop a disc with Enter or Space.

## Project layout

| File | Role |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Board, discs, and layout |
| `board.js` | Rules: drops, wins, draws |
| `ai.js` | Computer opponent |
| `main.js` | Board UI and turn flow |

`board.js` exposes `ConnectFour` in the browser and as a Node export. `ai.js` uses those same rules to choose Yellow's move.
