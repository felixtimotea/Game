/*
 * Crate Shift: canvas drawing.
 *
 * All artwork is drawn in code on a 16x16 grid per tile, so there are no image
 * files to load. The renderer keeps its own animated positions and slides them
 * towards the positions held by the game state.
 */
(function (root) {
  'use strict';

  const COLORS = {
    floorA: '#222b3c',
    floorB: '#263145',
    floorSpeck: '#1a2231',
    wall: '#2f8f8a',
    wallLight: '#56c2b6',
    wallDark: '#1f6663',
    wallPanel: '#287a76',
    crate: '#d99a3d',
    crateLight: '#f3c069',
    crateDark: '#a66a1f',
    crateFrame: '#6e420f',
    crateOn: '#4fbf73',
    crateOnLight: '#8be6a4',
    crateOnDark: '#2f8a4d',
    crateOnFrame: '#1c5730',
    target: '#7dffb0',
    robotBody: '#dde5f2',
    robotShade: '#9aa8bf',
    robotDark: '#3b465c',
    visor: '#161d2b',
    eye: '#6fe3ff',
    accent: '#ff8a4c',
    shadow: 'rgba(0, 0, 0, 0.28)'
  };

  const MAX_TILE = 72;
  const SLIDE_SPEED = 13; // tiles per second

  /** Fills a rectangle given in 16ths of a tile, snapped to whole pixels so tiles never show seams. */
  function px(ctx, ox, oy, unit, x, y, w, h, color) {
    const x0 = Math.round(ox + x * unit);
    const y0 = Math.round(oy + y * unit);
    const x1 = Math.round(ox + (x + w) * unit);
    const y1 = Math.round(oy + (y + h) * unit);
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  }

  function drawFloor(ctx, ox, oy, tile, alternate) {
    const u = tile / 16;
    px(ctx, ox, oy, u, 0, 0, 16, 16, alternate ? COLORS.floorB : COLORS.floorA);
    px(ctx, ox, oy, u, 3, 4, 1, 1, COLORS.floorSpeck);
    px(ctx, ox, oy, u, 12, 11, 1, 1, COLORS.floorSpeck);
  }

  function drawWall(ctx, ox, oy, tile) {
    const u = tile / 16;
    px(ctx, ox, oy, u, 0, 0, 16, 16, COLORS.wall);
    px(ctx, ox, oy, u, 0, 0, 16, 2, COLORS.wallLight);
    px(ctx, ox, oy, u, 0, 0, 2, 16, COLORS.wallLight);
    px(ctx, ox, oy, u, 0, 14, 16, 2, COLORS.wallDark);
    px(ctx, ox, oy, u, 14, 0, 2, 16, COLORS.wallDark);
    px(ctx, ox, oy, u, 4, 4, 8, 8, COLORS.wallDark);
    px(ctx, ox, oy, u, 5, 5, 7, 7, COLORS.wallLight);
    px(ctx, ox, oy, u, 5, 5, 6, 6, COLORS.wallPanel);
  }

  /** A ring marker on the floor. `glow` runs 0..1 and drives the soft pulse. */
  function drawTarget(ctx, ox, oy, tile, glow) {
    const u = tile / 16;
    const cx = ox + tile / 2;
    const cy = oy + tile / 2;
    const halo = ctx.createRadialGradient(cx, cy, tile * 0.05, cx, cy, tile * 0.5);
    halo.addColorStop(0, `rgba(125, 255, 176, ${0.16 + 0.14 * glow})`);
    halo.addColorStop(1, 'rgba(125, 255, 176, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(ox, oy, tile, tile);

    const c = COLORS.target;
    px(ctx, ox, oy, u, 5, 3, 6, 1, c);
    px(ctx, ox, oy, u, 5, 12, 6, 1, c);
    px(ctx, ox, oy, u, 3, 5, 1, 6, c);
    px(ctx, ox, oy, u, 12, 5, 1, 6, c);
    px(ctx, ox, oy, u, 4, 4, 1, 1, c);
    px(ctx, ox, oy, u, 11, 4, 1, 1, c);
    px(ctx, ox, oy, u, 4, 11, 1, 1, c);
    px(ctx, ox, oy, u, 11, 11, 1, 1, c);
    px(ctx, ox, oy, u, 7, 7, 2, 2, c);
  }

  function drawCrate(ctx, ox, oy, tile, onTarget) {
    const u = tile / 16;
    const body = onTarget ? COLORS.crateOn : COLORS.crate;
    const light = onTarget ? COLORS.crateOnLight : COLORS.crateLight;
    const dark = onTarget ? COLORS.crateOnDark : COLORS.crateDark;
    const frame = onTarget ? COLORS.crateOnFrame : COLORS.crateFrame;

    px(ctx, ox, oy, u, 2, 14, 13, 1.5, COLORS.shadow);
    px(ctx, ox, oy, u, 1, 1, 14, 14, frame);
    px(ctx, ox, oy, u, 2, 2, 12, 12, body);
    px(ctx, ox, oy, u, 2, 2, 12, 1, light);
    px(ctx, ox, oy, u, 2, 2, 1, 12, light);
    px(ctx, ox, oy, u, 2, 13, 12, 1, dark);
    px(ctx, ox, oy, u, 13, 2, 1, 12, dark);

    if (onTarget) {
      // Tick mark.
      const tick = [[4, 8], [5, 9], [6, 10], [7, 9], [8, 8], [9, 7], [10, 6], [11, 5]];
      tick.forEach((p) => px(ctx, ox, oy, u, p[0], p[1], 1, 2, frame));
    } else {
      // Three planks with a nail in each corner.
      px(ctx, ox, oy, u, 3, 6, 10, 1, dark);
      px(ctx, ox, oy, u, 3, 9, 10, 1, dark);
      px(ctx, ox, oy, u, 4, 4, 1, 1, frame);
      px(ctx, ox, oy, u, 11, 4, 1, 1, frame);
      px(ctx, ox, oy, u, 4, 11, 1, 1, frame);
      px(ctx, ox, oy, u, 11, 11, 1, 1, frame);
    }
  }

  function drawRobot(ctx, ox, oy, tile, facing) {
    const u = tile / 16;
    px(ctx, ox, oy, u, 3, 14.5, 10, 1.5, COLORS.shadow);

    // Treads.
    px(ctx, ox, oy, u, 3, 12, 10, 3, COLORS.robotDark);
    px(ctx, ox, oy, u, 4, 13, 1, 1, COLORS.robotShade);
    px(ctx, ox, oy, u, 7, 13, 2, 1, COLORS.robotShade);
    px(ctx, ox, oy, u, 11, 13, 1, 1, COLORS.robotShade);

    // Arms and body.
    px(ctx, ox, oy, u, 2, 8, 2, 4, COLORS.robotShade);
    px(ctx, ox, oy, u, 12, 8, 2, 4, COLORS.robotShade);
    px(ctx, ox, oy, u, 4, 7, 8, 6, COLORS.robotBody);
    px(ctx, ox, oy, u, 4, 12, 8, 1, COLORS.robotShade);

    // Antenna and head.
    px(ctx, ox, oy, u, 7, 1, 2, 1, COLORS.robotDark);
    px(ctx, ox, oy, u, 7, 0, 2, 1, COLORS.accent);
    px(ctx, ox, oy, u, 3, 2, 10, 5, COLORS.robotBody);
    px(ctx, ox, oy, u, 3, 6, 10, 1, COLORS.robotShade);

    if (facing === 'up') {
      // Seen from behind: a vented back panel instead of a face.
      px(ctx, ox, oy, u, 5, 3, 6, 2, COLORS.robotShade);
      px(ctx, ox, oy, u, 6, 9, 4, 1, COLORS.robotShade);
      px(ctx, ox, oy, u, 6, 11, 4, 1, COLORS.robotShade);
      return;
    }

    px(ctx, ox, oy, u, 4, 3, 8, 3, COLORS.visor);
    const eyes = facing === 'left' ? [4, 7] : facing === 'right' ? [7, 10] : [5, 9];
    px(ctx, ox, oy, u, eyes[0], 4, 2, 1, COLORS.eye);
    px(ctx, ox, oy, u, eyes[1], 4, 2, 1, COLORS.eye);
    px(ctx, ox, oy, u, 7, 9, 2, 2, COLORS.accent);
  }

  /** Sizes a canvas for sharp drawing on high-density screens; returns a context scaled to CSS pixels. */
  function prepare(canvas, cssWidth, cssHeight) {
    const dpr = Math.max(1, root.devicePixelRatio || 1);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    return ctx;
  }

  function createRenderer(canvas, options) {
    const reducedMotion = !!(options && options.reducedMotion);
    let ctx = canvas.getContext('2d');
    let game = null;
    let viewWidth = 0;
    let viewHeight = 0;
    let tile = 32;
    let originX = 0;
    let originY = 0;
    let lastTime = 0;
    let playerPos = { x: 0, y: 0 };
    let cratePos = [];

    /** Jumps the animated positions straight to the game state (new level, restart). */
    function snap() {
      if (!game) return;
      playerPos = { x: game.player.x, y: game.player.y };
      cratePos = game.crates.map((c) => ({ x: c.x, y: c.y }));
    }

    function setGame(next) {
      game = next;
      snap();
      resize();
    }

    /** Fits the board to the canvas's parent element. */
    function resize() {
      const host = canvas.parentElement;
      if (!host) return;
      viewWidth = host.clientWidth;
      viewHeight = host.clientHeight;
      if (viewWidth <= 0 || viewHeight <= 0) return;
      ctx = prepare(canvas, viewWidth, viewHeight);
      if (!game) return;

      let size = Math.floor(Math.min(viewWidth / game.width, viewHeight / game.height));
      size = Math.min(MAX_TILE, size);
      if (size >= 16) size -= size % 4;
      tile = Math.max(4, size);
      originX = Math.floor((viewWidth - tile * game.width) / 2);
      originY = Math.floor((viewHeight - tile * game.height) / 2);
    }

    function approach(pos, target, dt) {
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance === 0) return;
      // Speed up when lagging more than a tile behind, so fast input never piles up.
      const stepSize = SLIDE_SPEED * Math.max(1, distance) * dt;
      if (reducedMotion || distance <= stepSize) {
        pos.x = target.x;
        pos.y = target.y;
        return;
      }
      pos.x += (dx / distance) * stepSize;
      pos.y += (dy / distance) * stepSize;
    }

    function draw(now) {
      const dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
      lastTime = now;
      if (!game || viewWidth <= 0 || viewHeight <= 0) return;

      approach(playerPos, game.player, dt);
      for (let i = 0; i < game.crates.length; i++) approach(cratePos[i], game.crates[i], dt);

      ctx.clearRect(0, 0, viewWidth, viewHeight);
      const glow = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(now / 450);

      for (let y = 0; y < game.height; y++) {
        for (let x = 0; x < game.width; x++) {
          const i = y * game.width + x;
          const ox = originX + x * tile;
          const oy = originY + y * tile;
          if (game.walls[i]) {
            drawWall(ctx, ox, oy, tile);
          } else if (game.floor[i]) {
            drawFloor(ctx, ox, oy, tile, (x + y) % 2 === 1);
            if (game.targets[i]) drawTarget(ctx, ox, oy, tile, glow);
          }
        }
      }

      for (let i = 0; i < cratePos.length; i++) {
        const p = cratePos[i];
        const cell = Math.round(p.y) * game.width + Math.round(p.x);
        drawCrate(ctx, originX + p.x * tile, originY + p.y * tile, tile, game.targets[cell]);
      }
      drawRobot(ctx, originX + playerPos.x * tile, originY + playerPos.y * tile, tile, game.facing);
    }

    return { setGame, snap, resize, draw };
  }

  /** Draws the title-screen picture: the robot, a crate and a target in a row. */
  function drawLogo(canvas) {
    const tile = 56;
    const ctx = prepare(canvas, tile * 3, tile);
    canvas.style.width = tile * 3 + 'px';
    canvas.style.height = tile + 'px';
    for (let x = 0; x < 3; x++) drawFloor(ctx, x * tile, 0, tile, x % 2 === 1);
    drawRobot(ctx, 0, 0, tile, 'right');
    drawCrate(ctx, tile, 0, tile, false);
    drawTarget(ctx, tile * 2, 0, tile, 0.6);
  }

  root.CrateRender = { createRenderer, drawLogo };
})(typeof globalThis !== 'undefined' ? globalThis : this);
