# Minesweeper

Classic Minesweeper in plain HTML, CSS and JavaScript. Open `index.html` in a browser to play.

- Click or tap a cell to clear it. The first click is always safe, and it opens an empty patch.
- Right-click a hidden cell to plant a flag, then a question mark, then clear the mark. On a phone, long-press, or turn on **Flag** and tap.
- The mine counter shows how many flags you still have left to place. It can go below zero.
- Click a number once the flags around it match, and the other neighbors clear. A flag on the wrong cell sets off that mine.
- Easy is 9×9 with 10 mines, Medium is 16×16 with 40, and Hard is 30×16 with 99. The choice is remembered in this browser. A wide board scrolls sideways.
- The clock starts on the first clear and stops when you win or hit a mine. Your best time for each difficulty is saved. A game you used a hint on does not count.
- Undo (or U / Backspace) takes back clears, flags, and hints, up to the last 50, and puts a best time back if that win was undone.
- Hint (or H) outlines a cell the solver can prove is safe. If it can't, it points at the cell that looks least likely to be a mine.
- Arrow keys move the cursor. Enter or Space clears it (or flags it, while Flag is on). F flags the cursor cell.
- The face smiles, goes round-mouthed while you press, frowns on a blast, and shuts its eyes when you win. Click it, or **New game**, to start over. A blast shakes the board.

`game.js` holds the rules (mine placement, revealing, flags, chords, wins and losses) and works in the browser or Node. `ai.js` is the hint solver and `main.js` handles drawing and input.

The solver only reads numbers that are already showing. It ignores your flags, so a mistaken flag can't convince it that a mine is safe. It repeats a simple pass: a number whose hidden neighbors are all mines marks them, and a number that already has enough mines marks the rest of its neighbors safe.
