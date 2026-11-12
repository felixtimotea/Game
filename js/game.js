/*
 * Crate Shift: game rules.
 *
 * Pure logic with no DOM access. The browser game and tools/verify-levels.js
 * both load this file, so the solver checks levels against the real rules.
 *
 * Level notation, one string per row:
 *   #  wall            @  player           $  crate
 *   .  target          +  player on target *  crate on target
 *   (space) floor
 */
(function (root) {
  'use strict';

  const DIRS = {
    up: { dx: 0, dy: -1 },
    down: { dx: 0, dy: 1 },
    left: { dx: -1, dy: 0 },
    right: { dx: 1, dy: 0 }
  };

  /** Marks every cell the player could ever stand on, and whether walls contain them. */
  function floodFloor(width, height, walls, player) {
    const floor = new Array(width * height).fill(false);
    let enclosed = true;
    if (!player) return { floor, enclosed };

    const stack = [player.y * width + player.x];
    floor[stack[0]] = true;
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) enclosed = false;
      const next = [
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1
      ];
      for (const n of next) {
        if (n !== -1 && !walls[n] && !floor[n]) {
          floor[n] = true;
          stack.push(n);
        }
      }
    }
    return { floor, enclosed };
  }

  function parseLevel(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('A level needs at least one row.');
    }
    const height = rows.length;
    const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const walls = new Array(width * height).fill(false);
    const targets = new Array(width * height).fill(false);
    const crates = [];
    const players = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const ch = x < rows[y].length ? rows[y].charAt(x) : ' ';
        const i = y * width + x;
        switch (ch) {
          case '#': walls[i] = true; break;
          case '@': players.push({ x, y }); break;
          case '+': players.push({ x, y }); targets[i] = true; break;
          case '$': crates.push({ x, y }); break;
          case '*': crates.push({ x, y }); targets[i] = true; break;
          case '.': targets[i] = true; break;
          case ' ': break;
          default:
            throw new Error(`Unknown character "${ch}" at row ${y + 1}, column ${x + 1}.`);
        }
      }
    }

    const player = players.length ? players[0] : null;
    const fill = floodFloor(width, height, walls, player);
    return {
      width,
      height,
      walls,
      targets,
      crates,
      player,
      playerCount: players.length,
      floor: fill.floor,
      enclosed: fill.enclosed
    };
  }

  /** Returns a list of problems with a level; an empty list means it is well formed. */
  function validateLevel(rows) {
    let level;
    try {
      level = parseLevel(rows);
    } catch (err) {
      return [err.message];
    }

    const problems = [];
    if (level.playerCount !== 1) {
      problems.push(`Needs exactly one player, found ${level.playerCount}.`);
    }
    const targetCount = level.targets.filter(Boolean).length;
    if (level.crates.length === 0) problems.push('Needs at least one crate.');
    if (level.crates.length !== targetCount) {
      problems.push(`Has ${level.crates.length} crates but ${targetCount} targets.`);
    }
    if (!level.enclosed) problems.push('The player can walk off the map: walls must enclose the floor.');

    if (level.player) {
      const at = (x, y) => y * level.width + x;
      if (level.crates.some((c) => !level.floor[at(c.x, c.y)])) {
        problems.push('A crate sits where the player can never reach.');
      }
      if (level.targets.some((isTarget, i) => isTarget && !level.floor[i])) {
        problems.push('A target sits where the player can never reach.');
      }
      if (level.crates.length > 0 && level.crates.every((c) => level.targets[at(c.x, c.y)])) {
        problems.push('The level starts already solved.');
      }
    }
    return problems;
  }

  function createGame(rows) {
    const level = parseLevel(rows);
    if (!level.player) throw new Error('The level has no player.');
    return {
      width: level.width,
      height: level.height,
      walls: level.walls,
      targets: level.targets,
      floor: level.floor,
      crates: level.crates.map((c) => ({ x: c.x, y: c.y })),
      player: { x: level.player.x, y: level.player.y },
      facing: 'down',
      moves: 0,
      pushes: 0,
      history: []
    };
  }

  function isWall(game, x, y) {
    if (x < 0 || y < 0 || x >= game.width || y >= game.height) return true;
    return game.walls[y * game.width + x];
  }

  function isTarget(game, x, y) {
    if (x < 0 || y < 0 || x >= game.width || y >= game.height) return false;
    return game.targets[y * game.width + x];
  }

  /** Index of the crate on a cell, or -1. */
  function crateAt(game, x, y) {
    for (let i = 0; i < game.crates.length; i++) {
      if (game.crates[i].x === x && game.crates[i].y === y) return i;
    }
    return -1;
  }

  /**
   * Steps the player one cell. A crate in the way is pushed if the cell behind
   * it is free; two crates in a row, or a crate against a wall, block the move.
   */
  function tryMove(game, dir) {
    const d = DIRS[dir];
    const result = { moved: false, pushed: false };
    if (!d) return result;

    const previousFacing = game.facing;
    game.facing = dir;

    const nx = game.player.x + d.dx;
    const ny = game.player.y + d.dy;
    if (isWall(game, nx, ny)) return result;

    const crate = crateAt(game, nx, ny);
    if (crate !== -1) {
      const bx = nx + d.dx;
      const by = ny + d.dy;
      if (isWall(game, bx, by) || crateAt(game, bx, by) !== -1) return result;
      game.crates[crate].x = bx;
      game.crates[crate].y = by;
      game.pushes++;
      result.pushed = true;
    }

    game.history.push({ dir, crate, facing: previousFacing });
    game.player.x = nx;
    game.player.y = ny;
    game.moves++;
    result.moved = true;
    return result;
  }

  /** Takes back the last step, including any push. Returns false if there is nothing to undo. */
  function undo(game) {
    const last = game.history.pop();
    if (!last) return false;
    const d = DIRS[last.dir];
    if (last.crate !== -1) {
      game.crates[last.crate].x -= d.dx;
      game.crates[last.crate].y -= d.dy;
      game.pushes--;
    }
    game.player.x -= d.dx;
    game.player.y -= d.dy;
    game.moves--;
    game.facing = last.facing;
    return true;
  }

  function isSolved(game) {
    return game.crates.every((c) => game.targets[c.y * game.width + c.x]);
  }

  const api = {
    DIRS,
    parseLevel,
    validateLevel,
    createGame,
    isWall,
    isTarget,
    crateAt,
    tryMove,
    undo,
    isSolved
  };

  root.CrateGame = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
