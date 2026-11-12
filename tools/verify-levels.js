#!/usr/bin/env node
/*
 * Checks every level in js/levels.js.
 *
 *   node tools/verify-levels.js              validate and solve each level
 *   node tools/verify-levels.js --solution   also print a solution for each
 *
 * A level passes when it is well formed (one player, as many crates as targets,
 * floor enclosed by walls) and a breadth-first search finds a way to finish it.
 * Exits with status 1 if any level fails, so it can gate a commit.
 */
'use strict';

const Game = require('../js/game.js');

const DEFAULT_MAX_STATES = 2000000;
const LETTERS = ['u', 'd', 'l', 'r'];
const DIR_NAMES = ['up', 'down', 'left', 'right'];

/**
 * Finds a solution with the fewest pushes.
 *
 * Search states are (crate positions, area the player can walk to). Walking
 * costs nothing in the search, so each step of the search is one push.
 *
 * The level must already have passed Game.validateLevel: the index maths
 * relies on the floor being enclosed by walls.
 */
function solve(rows, maxStates) {
  const limit = maxStates || DEFAULT_MAX_STATES;
  const level = Game.parseLevel(rows);
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

/** Plays a solution string through the real game rules and reports whether it finishes the level. */
function replay(rows, solution) {
  const game = Game.createGame(rows);
  for (const letter of solution) {
    const dir = DIR_NAMES[LETTERS.indexOf(letter.toLowerCase())];
    if (!Game.tryMove(game, dir).moved) return false;
  }
  return Game.isSolved(game);
}

/** Validates and solves one level. */
function checkLevel(level, maxStates) {
  if (!level || !Array.isArray(level.rows)) {
    return { ok: false, problems: ['Level entry needs a "rows" array.'] };
  }
  const problems = Game.validateLevel(level.rows);
  if (problems.length) return { ok: false, problems };

  const result = solve(level.rows, maxStates);
  if (!result.solvable) {
    const why = result.reason === 'limit'
      ? `Too large to verify (stopped after ${result.states} positions).`
      : `No solution exists (searched ${result.states} positions).`;
    return { ok: false, problems: [why] };
  }
  if (!replay(level.rows, result.solution)) {
    return { ok: false, problems: ['Solver found a solution the game rules reject.'] };
  }

  const parsed = Game.parseLevel(level.rows);
  return {
    ok: true,
    size: `${parsed.width}x${parsed.height}`,
    crates: parsed.crates.length,
    pushes: result.pushes,
    moves: result.moves,
    states: result.states,
    solution: result.solution
  };
}

function main() {
  const levels = require('../js/levels.js');
  const showSolution = process.argv.includes('--solution');
  let failures = 0;

  if (!Array.isArray(levels) || levels.length === 0) {
    console.error('js/levels.js does not export any levels.');
    process.exit(1);
  }

  levels.forEach((level, index) => {
    const label = `Level ${index + 1}${level && level.name ? ` "${level.name}"` : ''}`;
    const result = checkLevel(level);
    if (!result.ok) {
      failures++;
      console.log(`FAIL  ${label}`);
      result.problems.forEach((problem) => console.log(`        ${problem}`));
      return;
    }
    console.log(
      `ok    ${label}: ${result.size}, ${result.crates} crates, ` +
      `fewest pushes ${result.pushes} (${result.moves} moves), ${result.states} positions searched`
    );
    if (showSolution) console.log(`        ${result.solution}`);
  });

  console.log('');
  if (failures) {
    console.log(`${failures} of ${levels.length} levels failed.`);
    process.exit(1);
  }
  console.log(levels.length === 1
    ? 'The level is valid and solvable.'
    : `All ${levels.length} levels are valid and solvable.`);
}

module.exports = { solve, replay, checkLevel };

if (require.main === module) main();
