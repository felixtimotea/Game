# Crate Shift

A box-pushing puzzle game for the browser. Drive the robot around the warehouse
and push every crate onto a glowing marker.

- Title menu, level select, and in-order unlocking: finishing a level opens the next.
- Hints that show the next move, restart, move and push counters, and a saved best score per level.
- Works with a keyboard, and on phones with swipes or the on-screen pad.
- Two styles, switched from the title menu with **Style**: the original warehouse, and a
  pizza where a chef pushes pepperoni onto golden spots. The choice is saved.
- No dependencies and no build step. All artwork is drawn in code.

## Play

Open `index.html` in a browser. Nothing needs installing.

To host it, publish the repository with GitHub Pages (Settings → Pages → deploy
from the branch root).

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrow keys or W A S D | Swipe on the board, or the on-screen pad |
| Hint | H | Hint button |
| Restart | R | Restart button |
| Level select | Esc | Levels button |

Progress is stored in the browser's `localStorage`, so it stays on the device
it was played on.

## Add a level

Levels live in `js/levels.js` and are played in the order they appear. Append an
entry:

```js
{
  name: 'Second Shift',
  rows: [
    '#######',
    '#@ $ .#',
    '#######'
  ]
}
```

| Character | Meaning |
|---|---|
| `#` | Wall |
| `@` | Player |
| `$` | Crate |
| `.` | Target |
| `*` | Crate already on a target |
| `+` | Player standing on a target |
| space | Floor |

A level needs exactly one player, as many crates as targets, and walls all the
way around the floor. Then check it:

```sh
node tools/verify-levels.js              # validates and solves every level
node tools/verify-levels.js --solution   # also prints a solution for each
```

The checker reports the fewest pushes needed, which is a handy guide when
ordering levels from easy to hard. It exits with an error if a level is
malformed or cannot be solved. The menu, unlocking and saved progress pick up
new levels automatically.

## Project layout

| File | Purpose |
|---|---|
| `index.html` | The page: title menu, level select and play screens |
| `css/style.css` | Styling and responsive layout |
| `js/levels.js` | The level list |
| `js/game.js` | Game rules: parsing, moving, pushing, win check |
| `js/solver.js` | Solver behind hints and the level checker |
| `js/render.js` | Canvas drawing, slide animation and the warehouse art |
| `js/theme-pizza.js` | The pizza style's art |
| `js/main.js` | Screens, input and saved progress |
| `tools/verify-levels.js` | Level validator (Node, no dependencies) |
