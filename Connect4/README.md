# Connect Four

A Connect Four game that runs in the browser. Play Yellow against the computer, or pass the device for a local two-player game.

## Play

Open `index.html` in a browser. No install or build step.

You play Red. Click a column to drop a disc. It falls to the lowest open slot. Against the computer, Yellow plays the other turns. The first side to line up four discs horizontally, vertically, or diagonally wins. If the board fills with no line of four, the game is a draw.

**Computer** and **Two players** switch who controls Yellow. **You** and **Computer** (or **Red** and **Yellow**) choose who moves first. Either switch starts a new game. Against the computer, **Easy**, **Medium**, and **Hard** change how far ahead Yellow looks. Easy also misses some chances. Difficulty and who moves first are remembered in this browser.

Wins and draws stay on the name plates until you choose **Clear scores**. Two-player games keep a separate tally. **Undo** takes back the last disc you played. Against the computer it also takes back Yellow's reply, including a finished game. **Play again** clears the board and starts over with whoever was chosen to move first.

**Hint** briefly highlights the column the computer would choose for whoever is moving, using the Hard search. A ring marks the most recently dropped disc.

You can also move between columns with the keyboard and drop a disc with Enter or Space. Keys **1** through **7** drop in that column. **U** or Backspace undoes. **H** shows a hint.

**Sound on** plays a short note for each drop, and a small flourish when the game ends. The switch is remembered in this browser.

## Project layout

| File | Role |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Board, discs, and layout |
| `board.js` | Rules: drops, wins, draws |
| `ai.js` | Computer opponent |
| `main.js` | Board UI and turn flow |

`board.js` exposes `ConnectFour` in the browser and as a Node export. `ai.js` uses those same rules to choose Yellow's move.
