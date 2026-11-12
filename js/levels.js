/*
 * Crate Shift: level list.
 *
 * Levels are played in the order they appear here; finishing one unlocks the
 * next. To add a level, append an entry and run `node tools/verify-levels.js`.
 *
 * Notation, one string per row:
 *   #  wall            @  player           $  crate
 *   .  target          +  player on target *  crate on target
 *   (space) floor
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'First Shift',
      rows: [
        '#######',
        '#.    #',
        '#.$ $ ##',
        '#. $   #',
        '#.  $@ #',
        '###  ###',
        '  ####'
      ]
    },
    {
      name: 'Crossroads',
      rows: [
        '   ###',
        '   #.#',
        '#### #',
        '#. $$###',
        '### @$.#',
        '  #$####',
        '  #.#',
        '  ###'
      ]
    }
  ];

  root.CRATE_LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
