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
    },
    {
      name: 'Loading Bay',
      rows: [
        ' #######',
        '##@##..#',
        '# $$ $.#',
        '#   $  #',
        '####  .#',
        '   #####'
      ]
    },
    {
      name: 'Back Alley',
      rows: [
        '   #####',
        '####...#',
        '# @##$ #',
        '# $    #',
        '## ##  #',
        '##   #$#',
        ' ###   #',
        '   #####'
      ]
    },
    {
      name: 'Tight Squeeze',
      rows: [
        '  ####  ',
        '  #@ #  ',
        '### $#  ',
        '# $$.## ',
        '# $.. # ',
        '# $.. # ',
        '#   ### ',
        '#####   '
      ]
    },
    {
      name: 'Spiral',
      rows: [
        ' ####   ',
        ' #  #   ',
        '##  ### ',
        '# $.  # ',
        '# .$  # ',
        '#@ .$ # ',
        '###  ## ',
        '  ####  '
      ]
    }
  ];

  root.CRATE_LEVELS = LEVELS;
  if (typeof module !== 'undefined' && module.exports) module.exports = LEVELS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
