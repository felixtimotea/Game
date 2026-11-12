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
const Solver = require('../js/solver.js');

const { solve, LETTERS, DIR_NAMES } = Solver;

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
