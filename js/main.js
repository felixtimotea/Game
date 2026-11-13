/*
 * Crate Shift: screens, input and saved progress.
 *
 * Three screens (title menu, level select, play) share one page. Progress is
 * kept in localStorage: a level counts as unlocked when it is the first one or
 * the level before it has been completed.
 */
(function () {
  'use strict';

  const LEVELS = window.CRATE_LEVELS || [];
  const Game = window.CrateGame;
  const Render = window.CrateRender;
  const Solver = window.CrateSolver;
  const STORAGE_KEY = 'crate-shift-progress-v1';
  const STYLE_KEY = 'crate-shift-style-v1';
  const SWIPE_DISTANCE = 24;
  const HOLD_DELAY = 320;
  const HOLD_REPEAT = 110;
  const COMPLETE_DELAY = 380;
  const HINT_MAX_STATES = 300000;

  const ICONS = {
    lock: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7h1zm2 0h4V5a2 2 0 0 0-4 0v2z"/></svg>',
    tick: '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M3 8.5l3.2 3.2L13 5"/></svg>'
  };

  const KEY_DIRS = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right'
  };

  // Each style changes the board art, the page colours and the wording.
  const STYLES = {
    warehouse: {
      label: 'Warehouse',
      themeColor: '#0e1420',
      text: {
        title: 'Crate Shift',
        tagline: 'Push every crate onto a marker.',
        helpIntro: 'Drive the robot around the warehouse and push every crate onto a glowing marker. A crate turns green when it is in place.',
        helpPush: 'You can push one crate at a time, and only push: never pull.',
        helpStuck: 'A crate stuck in a corner stays there, so plan ahead. Restart if you get stuck.'
      }
    },
    pizza: {
      label: 'Pizza',
      themeColor: '#2a160d',
      text: {
        title: 'Pepperoni Push',
        tagline: 'Push every pepperoni onto a golden spot.',
        helpIntro: 'Walk the chef around the pizza and push every slice of pepperoni onto a golden spot. A pepperoni crisps up when it is in place.',
        helpPush: 'You can push one pepperoni at a time, and only push: never pull.',
        helpStuck: 'A pepperoni stuck against the crust in a corner stays there, so plan ahead. Restart if you get stuck.'
      }
    }
  };
  const STYLE_ORDER = Object.keys(STYLES);

  const $ = (id) => document.getElementById(id);
  const screens = { title: $('screen-title'), levels: $('screen-levels'), play: $('screen-play') };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = Render.createRenderer($('board'), { reducedMotion });
  let styleName = loadStyle();

  let currentScreen = 'title';
  let openOverlay = null;
  let levelIndex = 0;
  let game = null;
  let solved = false;
  let solveToken = 0;
  let frameId = 0;
  // Steps still to play from the last solve, while the player keeps following them.
  let hintPlan = '';
  let hintTaps = 0; // hint taps on the current level; kept across restarts

  // ---------- Saved progress ----------

  function loadProgress() {
    const loaded = { completed: {} };
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (data && data.completed && typeof data.completed === 'object') {
        Object.keys(data.completed).forEach((key) => {
          const index = Number(key);
          const entry = data.completed[key];
          if (Number.isInteger(index) && index >= 0 && entry &&
              Number.isFinite(entry.moves) && Number.isFinite(entry.pushes)) {
            loaded.completed[index] = { moves: entry.moves, pushes: entry.pushes };
          }
        });
      }
    } catch (err) {
      // Storage is blocked or holds something unreadable: start fresh.
    }
    return loaded;
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch (err) {
      // The game still works without saving; progress lasts until the page closes.
    }
  }

  const progress = loadProgress();
  const isComplete = (index) => !!progress.completed[index];
  const isUnlocked = (index) => index === 0 || isComplete(index - 1);

  function firstUnfinished() {
    for (let i = 0; i < LEVELS.length; i++) {
      if (!isComplete(i)) return i;
    }
    return -1;
  }

  // ---------- Style ----------

  function loadStyle() {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved && STYLES[saved]) return saved;
    } catch (err) {
      // Storage is blocked: use the default style.
    }
    return STYLE_ORDER[0];
  }

  function applyStyle(name) {
    styleName = STYLES[name] ? name : STYLE_ORDER[0];
    const style = STYLES[styleName];
    document.documentElement.dataset.theme = styleName;
    document.querySelectorAll('[data-text]').forEach((el) => {
      const text = style.text[el.dataset.text];
      if (text) el.textContent = text;
    });
    document.title = style.text.title;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = style.themeColor;
    $('btn-style').textContent = `Style: ${style.label}`;
    renderer.setTheme(styleName);
    Render.drawLogo($('logo'), styleName);
  }

  function nextStyle() {
    const next = STYLE_ORDER[(STYLE_ORDER.indexOf(styleName) + 1) % STYLE_ORDER.length];
    applyStyle(next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch (err) {
      // Not saved; the choice lasts until the page closes.
    }
    $('announcer').textContent = `Style changed to ${STYLES[next].label}.`;
  }

  // ---------- Screens ----------

  function showScreen(name) {
    currentScreen = name;
    Object.keys(screens).forEach((key) => { screens[key].hidden = key !== name; });
    if (name === 'play') {
      if (!frameId) frameId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(frameId);
      frameId = 0;
      stopHold();
    }
  }

  function frame(now) {
    renderer.draw(now);
    frameId = requestAnimationFrame(frame);
  }

  function showTitle(takeFocus) {
    closeOverlay();
    const anyComplete = LEVELS.some((level, i) => isComplete(i));
    $('btn-play').textContent = anyComplete && firstUnfinished() !== -1 ? 'Continue' : 'Play';
    $('btn-play').disabled = LEVELS.length === 0;
    showScreen('title');
    if (takeFocus) $('btn-play').focus();
  }

  function showLevels() {
    closeOverlay();
    solveToken++;
    buildLevelGrid();
    showScreen('levels');
    const next = firstUnfinished();
    const tiles = $('level-grid').children;
    const target = tiles[next === -1 ? 0 : next] || $('btn-levels-back');
    target.focus();
  }

  function buildLevelGrid() {
    const grid = $('level-grid');
    grid.textContent = '';
    let done = 0;

    LEVELS.forEach((level, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'level-tile';

      const number = document.createElement('span');
      number.className = 'level-num';
      number.textContent = String(index + 1);

      const name = document.createElement('span');
      name.className = 'level-name';
      name.textContent = level.name || '';

      const status = document.createElement('span');
      status.className = 'level-status';

      if (!isUnlocked(index)) {
        tile.disabled = true;
        tile.classList.add('is-locked');
        status.innerHTML = ICONS.lock;
        status.append('Locked');
        tile.setAttribute('aria-label', `Level ${index + 1}, locked`);
      } else if (isComplete(index)) {
        done++;
        const best = progress.completed[index].moves;
        tile.classList.add('is-complete');
        status.innerHTML = ICONS.tick;
        status.append(`Best ${best}`);
        tile.setAttribute('aria-label', `Level ${index + 1}, ${level.name || ''}, completed, best ${best} moves`);
      } else {
        status.textContent = 'Play';
        tile.setAttribute('aria-label', `Level ${index + 1}, ${level.name || ''}, not completed`);
      }

      tile.append(number, name, status);
      tile.addEventListener('click', () => startLevel(index));
      grid.appendChild(tile);
    });

    $('levels-count').textContent = `${done} / ${LEVELS.length} complete`;
  }

  // ---------- Overlays ----------

  function showOverlay(overlay, focusTarget) {
    openOverlay = overlay;
    overlay.hidden = false;
    Object.keys(screens).forEach((key) => { screens[key].inert = true; });
    focusTarget.focus();
  }

  function closeOverlay() {
    if (!openOverlay) return;
    openOverlay.hidden = true;
    openOverlay = null;
    Object.keys(screens).forEach((key) => { screens[key].inert = false; });
  }

  // ---------- Play ----------

  function startLevel(index, keepHintTaps) {
    if (index < 0 || index >= LEVELS.length || !isUnlocked(index)) return;
    closeOverlay();
    if (!keepHintTaps || index !== levelIndex) hintTaps = 0;
    levelIndex = index;
    game = Game.createGame(LEVELS[index].rows);
    solved = false;
    solveToken++;
    hintPlan = '';
    clearHint();

    $('hud-level').textContent = `Level ${index + 1}`;
    $('hud-name').textContent = LEVELS[index].name || '';
    updateHud();
    showScreen('play');
    renderer.setGame(game);
    $('stage').focus({ preventScroll: true });
  }

  function updateHud() {
    $('hud-moves').textContent = String(game.moves);
    $('hud-pushes').textContent = String(game.pushes);
    $('hud-hints').textContent = String(hintTaps);
    $('btn-hint').disabled = solved;
  }

  function canPlay() {
    return currentScreen === 'play' && !openOverlay && !solved && !!game;
  }

  function move(dir) {
    if (!canPlay()) return;
    if (!Game.tryMove(game, dir).moved) return;
    // Following the hint keeps the rest of the plan; any other step throws it away.
    hintPlan = hintPlan && Solver.letterToDir(hintPlan[0]) === dir ? hintPlan.slice(1) : '';
    clearHint();
    if (Game.isSolved(game)) levelSolved();
    updateHud();
  }

  // ---------- Hints ----------

  function clearHint() {
    renderer.setHint(null);
    $('play-note').hidden = true;
    document.querySelectorAll('.dpad-btn.is-hint').forEach((button) => button.classList.remove('is-hint'));
  }

  function showNote(text) {
    $('play-note').textContent = text;
    $('play-note').hidden = false;
    $('announcer').textContent = text;
  }

  /** Points at the next step of a shortest-push solution from the current position. */
  function hint() {
    if (!canPlay()) return;
    clearHint();

    if (!hintPlan) {
      const result = Solver.solveState(game, HINT_MAX_STATES);
      if (!result.solvable) {
        showNote(result.reason === 'limit'
          ? 'This position is too complex for a hint.'
          : 'No way to finish from here. Restart to try again.');
        return;
      }
      hintPlan = result.solution;
    }

    const dir = Solver.letterToDir(hintPlan[0]);
    const pushes = hintPlan[0] !== hintPlan[0].toLowerCase();
    hintTaps++;
    updateHud();
    renderer.setHint(dir);
    const button = document.querySelector(`.dpad-btn[data-dir="${dir}"]`);
    if (button) button.classList.add('is-hint');
    $('announcer').textContent = `Hint: ${pushes ? 'push' : 'move'} ${dir}.`;
  }

  function restart() {
    if (currentScreen !== 'play') return;
    startLevel(levelIndex, true);
  }

  function levelSolved() {
    solved = true;
    stopHold();

    const previous = progress.completed[levelIndex];
    const improved = !!previous && game.moves < previous.moves;
    if (!previous || improved) {
      progress.completed[levelIndex] = { moves: game.moves, pushes: game.pushes };
      saveProgress();
    }

    // Let the last crate finish sliding before the result card covers the board.
    const token = ++solveToken;
    setTimeout(() => {
      if (token === solveToken && currentScreen === 'play') showComplete(!previous, improved);
    }, reducedMotion ? 0 : COMPLETE_DELAY);
  }

  function showComplete(firstTime, improved) {
    const isLast = levelIndex === LEVELS.length - 1;
    const best = progress.completed[levelIndex];

    let note = '';
    if (improved) note = 'New best score!';
    else if (isLast) note = 'You have finished every level.';
    else if (firstTime) note = `Level ${levelIndex + 2} is now unlocked.`;

    $('complete-heading').textContent = isLast ? 'All levels complete!' : 'Level complete!';
    $('complete-note').textContent = note;
    $('complete-moves').textContent = String(game.moves);
    $('complete-pushes').textContent = String(game.pushes);
    $('complete-hints').textContent = String(hintTaps);
    $('complete-best').textContent = String(best.moves);

    $('btn-next').hidden = isLast;
    $('btn-complete-levels').classList.toggle('btn-primary', isLast);
    $('announcer').textContent =
      `Level ${levelIndex + 1} complete in ${game.moves} moves and ${game.pushes} pushes. ${note}`;
    showOverlay($('overlay-complete'), isLast ? $('btn-complete-levels') : $('btn-next'));
  }

  // ---------- Input: buttons ----------

  $('btn-play').addEventListener('click', () => {
    const next = firstUnfinished();
    if (next === -1) showLevels();
    else startLevel(next);
  });
  $('btn-levels').addEventListener('click', showLevels);
  $('btn-style').addEventListener('click', nextStyle);
  $('btn-levels-back').addEventListener('click', () => showTitle(true));
  $('btn-hint').addEventListener('click', hint);
  $('btn-restart').addEventListener('click', restart);
  $('btn-exit').addEventListener('click', showLevels);
  $('btn-next').addEventListener('click', () => startLevel(levelIndex + 1));
  $('btn-again').addEventListener('click', () => startLevel(levelIndex));
  $('btn-complete-levels').addEventListener('click', showLevels);

  let helpOpener = null;
  $('btn-help').addEventListener('click', () => {
    helpOpener = document.activeElement;
    showOverlay($('overlay-help'), $('btn-help-close'));
  });
  function closeHelp() {
    closeOverlay();
    if (helpOpener && helpOpener.focus) helpOpener.focus();
    helpOpener = null;
  }
  $('btn-help-close').addEventListener('click', closeHelp);

  // ---------- Input: keyboard ----------

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

    if (openOverlay) {
      if (key === 'Escape') {
        if (openOverlay === $('overlay-help')) closeHelp();
        else showLevels();
      }
      return;
    }

    if (currentScreen === 'levels') {
      if (key === 'Escape') showTitle(true);
      return;
    }
    if (currentScreen !== 'play') return;

    const dir = KEY_DIRS[key];
    if (dir) {
      event.preventDefault();
      move(dir);
    } else if (key === 'h') {
      if (!event.repeat) hint();
    } else if (key === 'r') {
      if (!event.repeat) restart();
    } else if (key === 'Escape') {
      showLevels();
    }
  });

  // ---------- Input: swipe on the board ----------

  const stage = $('stage');
  let swipe = null;
  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return;
    swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', (event) => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_DISTANCE) return;
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
    else move(dy > 0 ? 'down' : 'up');
  });
  stage.addEventListener('pointercancel', () => { swipe = null; });

  // ---------- Input: on-screen direction pad (hold to keep moving) ----------

  let holdTimer = 0;
  let heldButton = null;

  function stopHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
    if (heldButton) heldButton.classList.remove('is-held');
    heldButton = null;
  }

  document.querySelectorAll('.dpad-btn').forEach((button) => {
    const dir = button.dataset.dir;

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      stopHold();
      heldButton = button;
      button.classList.add('is-held');
      move(dir);
      const repeat = () => {
        move(dir);
        holdTimer = setTimeout(repeat, HOLD_REPEAT);
      };
      holdTimer = setTimeout(repeat, HOLD_DELAY);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {
      button.addEventListener(type, stopHold);
    });
    // Keyboard activation (Enter or Space) arrives as a click with no pointer.
    button.addEventListener('click', (event) => {
      if (event.detail === 0) move(dir);
    });
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });

  window.addEventListener('blur', stopHold);

  // ---------- Layout ----------

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => renderer.resize()).observe(stage);
  } else {
    window.addEventListener('resize', () => renderer.resize());
  }

  // ---------- Start ----------

  applyStyle(styleName);
  showTitle(false);
})();
