/*
 * Crate Shift: solver.
 *
 * Finds a way to finish a level from any position. The game uses it for hints
 * and tools/verify-levels.js uses it to check that every level can be solved.
 * Pure logic with no DOM access.
 */
(function (root) {
  'use strict';

  const Game = root.CrateGame || (typeof require !== 'undefined' ? require('./game.js') : null);

  const DEFAULT_MAX_STATES = 2000000;
  const LETTERS = ['u', 'd', 'l', 'r'];
  const DIR_NAMES = ['up', 'down', 'left', 'right'];

  /**
   * Finds a solution with the fewest pushes.
   *
   * Search states are (crate positions, area the player can walk to). Walking
   * costs nothing in the search, so each step of the search is one push.
   *
   * `level` is a parsed level or a game in progress: anything with width,
   * height, walls, targets, floor, crates and player. It must come from a level
   * that passes Game.validateLevel: the index maths relies on the floor being
   * enclosed by walls.
   *
   * Returns { solvable: true, solution, pushes, moves, states }, where solution
   * is one letter per step (u d l r, uppercase for a push), or
   * { solvable: false, reason: 'exhausted' | 'limit', states }.
   */
  function solveState(level, maxStates) {
    const limit = maxStates || DEFAULT_MAX_STATES;
    const width = level.width;
    const size = width * level.height;
    const walls = level.walls;
    const targets = level.targets;
    const step = [-width, width, -1, 1];

    // A cell is "live" if a lone crate there could still be pushed to a target.
    // Found by pulling a crate backwards from every target.
    const live = new Uint8Array(size);
    const pullQueue = [];
    for (let i = 0; i < size; i++) {
      if (targets[i]) {
        live[i] = 1;
        pullQueue.push(i);
      }
    }
    while (pullQueue.length) {
      const cell = pullQueue.pop();
      for (let d = 0; d < 4; d++) {
        const from = cell - step[d];
        if (walls[from] || !level.floor[from] || live[from]) continue;
        const standing = from - step[d];
        if (walls[standing]) continue;
        live[from] = 1;
        pullQueue.push(from);
      }
    }

    const occupied = new Uint8Array(size);
    const seen = new Int32Array(size);
    const walkQueue = new Int32Array(size);
    let stamp = 0;

    /** Flood-fills where the player can walk; returns the lowest reachable cell index. */
    function walk(from) {
      stamp++;
      let head = 0;
      let tail = 0;
      let lowest = from;
      walkQueue[tail++] = from;
      seen[from] = stamp;
      while (head < tail) {
        const cell = walkQueue[head++];
        if (cell < lowest) lowest = cell;
        for (let d = 0; d < 4; d++) {
          const next = cell + step[d];
          if (walls[next] || occupied[next] || seen[next] === stamp) continue;
          seen[next] = stamp;
          walkQueue[tail++] = next;
        }
      }
      return lowest;
    }

    const startCrates = level.crates.map((c) => c.y * width + c.x).sort((a, b) => a - b);
    const startPlayer = level.player.y * width + level.player.x;

    const stateCrates = [];
    const statePlayer = [];
    const stateParent = [];
    const statePush = [];
    const known = new Map();

    function setOccupied(crates, value) {
      for (let i = 0; i < crates.length; i++) occupied[crates[i]] = value;
    }

    function addState(crates, player, parent, push) {
      setOccupied(crates, 1);
      const key = crates.join(',') + '|' + walk(player);
      setOccupied(crates, 0);
      if (known.has(key)) return -1;
      const id = stateCrates.length;
      known.set(key, id);
      stateCrates.push(crates);
      statePlayer.push(player);
      stateParent.push(parent);
      statePush.push(push);
      return id;
    }

    const isGoal = (crates) => crates.every((c) => targets[c]);

    addState(startCrates, startPlayer, -1, -1);
    let goal = isGoal(startCrates) ? 0 : -1;

    for (let id = 0; goal === -1 && id < stateCrates.length; id++) {
      if (stateCrates.length > limit) {
        return { solvable: false, reason: 'limit', states: stateCrates.length };
      }
      const crates = stateCrates[id];
      setOccupied(crates, 1);
      walk(statePlayer[id]);
      const reachStamp = stamp;
      // Collect the legal pushes first: addState reuses the walk buffers.
      const pushes = [];
      for (let c = 0; c < crates.length; c++) {
        for (let d = 0; d < 4; d++) {
          const standing = crates[c] - step[d];
          const dest = crates[c] + step[d];
          if (seen[standing] !== reachStamp) continue;
          if (walls[dest] || occupied[dest] || !live[dest]) continue;
          pushes.push(c * 4 + d);
        }
      }
      setOccupied(crates, 0);

      for (let p = 0; p < pushes.length; p++) {
        const c = pushes[p] >> 2;
        const d = pushes[p] & 3;
        const from = crates[c];
        const next = crates.slice();
        next[c] = from + step[d];
        next.sort((a, b) => a - b);
        const added = addState(next, from, id, from * 4 + d);
        if (added !== -1 && isGoal(next)) {
          goal = added;
          break;
        }
      }
    }

    if (goal === -1) return { solvable: false, reason: 'exhausted', states: stateCrates.length };

    // Walk the push list back out, then fill in the steps between pushes.
    const pushList = [];
    for (let id = goal; stateParent[id] !== -1; id = stateParent[id]) pushList.push(statePush[id]);
    pushList.reverse();

    const crates = startCrates.slice();
    let player = startPlayer;
    let solution = '';
    for (const push of pushList) {
      const from = push >> 2;
      const d = push & 3;
      setOccupied(crates, 1);
      solution += pathBetween(player, from - step[d]);
      setOccupied(crates, 0);
      solution += LETTERS[d].toUpperCase();
      crates[crates.indexOf(from)] = from + step[d];
      player = from;
    }

    /** Shortest walk between two cells as lowercase letters; crates must be marked occupied. */
    function pathBetween(start, end) {
      if (start === end) return '';
      const cameFrom = new Int32Array(size).fill(-1);
      const cameDir = new Int8Array(size);
      const queue = [start];
      cameFrom[start] = start;
      for (let head = 0; head < queue.length; head++) {
        const cell = queue[head];
        if (cell === end) break;
        for (let d = 0; d < 4; d++) {
          const next = cell + step[d];
          if (walls[next] || occupied[next] || cameFrom[next] !== -1) continue;
          cameFrom[next] = cell;
          cameDir[next] = d;
          queue.push(next);
        }
      }
      let path = '';
      for (let cell = end; cell !== start; cell = cameFrom[cell]) path = LETTERS[cameDir[cell]] + path;
      return path;
    }

    return {
      solvable: true,
      pushes: pushList.length,
      moves: solution.length,
      solution,
      states: stateCrates.length
    };
  }

  /** Solves a level given as rows of text. */
  function solve(rows, maxStates) {
    return solveState(Game.parseLevel(rows), maxStates);
  }

  /** The direction name ('up', 'down', 'left', 'right') for one solution letter. */
  function letterToDir(letter) {
    return DIR_NAMES[LETTERS.indexOf(letter.toLowerCase())];
  }

  const api = { solve, solveState, letterToDir, LETTERS, DIR_NAMES };

  root.CrateSolver = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
