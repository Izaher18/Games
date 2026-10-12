# Connect Four

A two-player Connect Four game that runs in the browser. Red and Yellow take turns on one device. An opponent that plays Yellow is planned next.

## Play

Open `index.html` in a browser. No install or build step.

Click a column to drop a disc. The disc falls to the lowest open slot. Red starts, then players alternate. The first player to line up four discs horizontally, vertically, or diagonally wins. If the board fills with no line of four, the game is a draw.

**Play again** clears the board and starts a new game with Red.

You can also move between columns with the keyboard and drop a disc with Enter or Space.

## Project layout

| File | Role |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Board, discs, and layout |
| `board.js` | Rules: drops, wins, draws |
| `main.js` | Board UI and turn flow |

`board.js` exposes `ConnectFour` in the browser and as a Node export, so the same rules can drive a computer player later.
