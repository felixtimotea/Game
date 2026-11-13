/*
 * Crate Shift: the pizza style.
 *
 * The board becomes a pizza: tomato sauce and melted mozzarella underfoot,
 * crust for walls, a little chef for the player and slices of pepperoni to
 * push onto the golden spots. Drawn on the same 16x16 grid per tile as the
 * warehouse art, through the painters the renderer shares.
 */
(function (root) {
  'use strict';

  const Render = root.CrateRender;
  if (!Render) return;
  const { px, disc } = Render;

  const C = {
    sauce: '#c23a22',
    sauceDark: '#a12a17',
    sauceLight: '#d9512f',
    herb: '#4f5e26',
    cheese: '#fbe9bd',
    cheeseShade: '#f0cd83',
    crust: '#d99a55',
    crustLight: '#f1c587',
    crustDark: '#ab6a33',
    char: '#4a2a17',
    pep: '#b3261a',
    pepRim: '#7a150e',
    pepFat: '#e46a4f',
    pepCrisp: '#4c100a',
    pepCup: '#9a1d13',
    grease: '#e8833f',
    greaseShine: '#ffd39a',
    basil: '#3f9b3a',
    basilLight: '#7ccf5e',
    spot: '#ffe08a',
    coat: '#f8f5ee',
    coatShade: '#d7d1c4',
    skin: '#f2c49b',
    skinShade: '#d9a27a',
    hair: '#5a3220',
    ink: '#2a1a12',
    scarf: '#d93a2b',
    trousers: '#2e2c38',
    shadow: 'rgba(40, 10, 0, 0.32)'
  };

  /** A small hash so neighbouring tiles pick different cheese and crust patterns. */
  function pick(x, y, count) {
    const h = (x * 73856093) ^ (y * 19349663);
    return Math.abs(h) % count;
  }

  // Melted mozzarella blobs: [cx, cy, radius] in 16ths of a tile.
  const CHEESE = [
    [[4.5, 4.5, 2.8], [11.5, 11, 3]],
    [[11, 4, 2.6], [4.5, 11.5, 2.9]],
    [[8, 8, 3.3], [14, 2, 1.6]],
    [[3, 12.5, 2.2], [12, 5, 2.8], [8.5, 14, 1.4]],
    [[5.5, 7, 2.4], [12.5, 12.5, 2]]
  ];

  // Specks of sauce texture and oregano: [x, y].
  const SPECKS = [[2, 8], [9, 2], [13, 8], [6, 14], [10, 12], [3, 2]];

  function floor(ctx, ox, oy, tile, gx, gy) {
    const u = tile / 16;
    px(ctx, ox, oy, u, 0, 0, 16, 16, C.sauce);
    const variant = pick(gx, gy, CHEESE.length);
    SPECKS.forEach((s, i) => {
      const color = (i + variant) % 3 === 0 ? C.herb : (i % 2 ? C.sauceDark : C.sauceLight);
      px(ctx, ox, oy, u, s[0], s[1], 1, 1, color);
    });
    CHEESE[variant].forEach((b) => {
      disc(ctx, ox, oy, u, b[0], b[1] + 0.6, b[2], C.cheeseShade);
      disc(ctx, ox, oy, u, b[0], b[1], b[2], C.cheese);
    });
  }

  // Crust bubbles and charred "leopard" spots, two layouts so walls do not tile visibly.
  const CRUST = [
    { bubbles: [[5, 6, 2.6], [11.5, 10, 2.8]], char: [[3, 11, 2, 1], [12, 3, 1, 1], [8, 13, 1, 1], [10, 5, 1, 1]] },
    { bubbles: [[10.5, 5.5, 2.7], [5, 11, 2.5]], char: [[4, 3, 2, 1], [12, 12, 1, 1], [8, 8, 1, 1], [2, 7, 1, 1]] }
  ];

  function wall(ctx, ox, oy, tile, gx, gy) {
    const u = tile / 16;
    const look = CRUST[pick(gx || 0, gy || 0, CRUST.length)];
    px(ctx, ox, oy, u, 0, 0, 16, 16, C.crust);
    px(ctx, ox, oy, u, 0, 0, 16, 2, C.crustLight);
    px(ctx, ox, oy, u, 0, 14, 16, 2, C.crustDark);
    look.bubbles.forEach((b) => {
      disc(ctx, ox, oy, u, b[0], b[1] + 0.8, b[2], C.crustDark);
      disc(ctx, ox, oy, u, b[0], b[1], b[2], C.crustLight);
      px(ctx, ox, oy, u, Math.round(b[0] - 1), Math.round(b[1] - 1), 1, 1, '#fbe0b0');
    });
    look.char.forEach((c) => px(ctx, ox, oy, u, c[0], c[1], c[2], c[3], C.char));
  }

  /** A golden ring where a pepperoni belongs. `glow` runs 0..1 and drives the pulse. */
  function target(ctx, ox, oy, tile, glow) {
    const u = tile / 16;
    const cx = ox + tile / 2;
    const cy = oy + tile / 2;
    const halo = ctx.createRadialGradient(cx, cy, tile * 0.05, cx, cy, tile * 0.5);
    halo.addColorStop(0, `rgba(255, 224, 138, ${0.22 + 0.18 * glow})`);
    halo.addColorStop(1, 'rgba(255, 224, 138, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(ox, oy, tile, tile);

    const c = C.spot;
    // A dashed ring: four arcs with gaps on the diagonals.
    px(ctx, ox, oy, u, 6, 2, 4, 1, c);
    px(ctx, ox, oy, u, 6, 13, 4, 1, c);
    px(ctx, ox, oy, u, 2, 6, 1, 4, c);
    px(ctx, ox, oy, u, 13, 6, 1, 4, c);
    px(ctx, ox, oy, u, 4, 3, 1, 1, c);
    px(ctx, ox, oy, u, 11, 3, 1, 1, c);
    px(ctx, ox, oy, u, 3, 4, 1, 1, c);
    px(ctx, ox, oy, u, 12, 4, 1, 1, c);
    px(ctx, ox, oy, u, 3, 11, 1, 1, c);
    px(ctx, ox, oy, u, 12, 11, 1, 1, c);
    px(ctx, ox, oy, u, 4, 12, 1, 1, c);
    px(ctx, ox, oy, u, 11, 12, 1, 1, c);
    // A basil leaf in the middle.
    px(ctx, ox, oy, u, 7, 6, 2, 1, C.basilLight);
    px(ctx, ox, oy, u, 6, 7, 4, 2, C.basil);
    px(ctx, ox, oy, u, 7, 9, 2, 1, C.basil);
    px(ctx, ox, oy, u, 7, 7, 1, 1, C.basilLight);
  }

  /** A pepperoni slice. Once on its spot it crisps up into a cup with a pool of grease and a basil leaf. */
  function crate(ctx, ox, oy, tile, onTarget) {
    const u = tile / 16;
    disc(ctx, ox, oy, u, 8.6, 9.4, 6.6, C.shadow);

    if (onTarget) {
      disc(ctx, ox, oy, u, 8, 8, 6.6, C.pepCrisp);
      disc(ctx, ox, oy, u, 8, 8, 5.5, C.pepRim);
      disc(ctx, ox, oy, u, 8, 8.4, 4.4, C.pepCup);
      disc(ctx, ox, oy, u, 8, 8.6, 2.6, C.grease);
      px(ctx, ox, oy, u, 6, 7, 2, 1, C.greaseShine);
      px(ctx, ox, oy, u, 5, 4, 1, 1, C.pepFat);
      px(ctx, ox, oy, u, 11, 11, 1, 1, C.pepFat);
      // Basil leaf tucked on the top right.
      px(ctx, ox, oy, u, 11, 2, 3, 1, C.basilLight);
      px(ctx, ox, oy, u, 10, 3, 4, 2, C.basil);
      px(ctx, ox, oy, u, 10, 5, 2, 1, C.basil);
      px(ctx, ox, oy, u, 11, 3, 1, 1, C.basilLight);
      return;
    }

    disc(ctx, ox, oy, u, 8, 8, 6.6, C.pepRim);
    disc(ctx, ox, oy, u, 8, 8, 5.6, C.pep);
    // Fat speckles and a highlight on the top left.
    [[5, 6], [10, 5], [9, 9], [6, 10], [11, 10], [7, 4]].forEach((p) => {
      px(ctx, ox, oy, u, p[0], p[1], 1, 1, C.pepFat);
    });
    px(ctx, ox, oy, u, 4, 5, 1, 2, C.pepFat);
    px(ctx, ox, oy, u, 5, 3, 2, 1, C.pepFat);
  }

  /** A little chef in a tall white hat. */
  function chef(ctx, ox, oy, tile, facing) {
    const u = tile / 16;
    px(ctx, ox, oy, u, 3, 14.5, 10, 1.5, C.shadow);

    // Legs.
    px(ctx, ox, oy, u, 5, 13, 2, 2, C.trousers);
    px(ctx, ox, oy, u, 9, 13, 2, 2, C.trousers);

    // Coat, arms and hands.
    px(ctx, ox, oy, u, 4, 8, 8, 5, C.coat);
    px(ctx, ox, oy, u, 4, 12, 8, 1, C.coatShade);
    px(ctx, ox, oy, u, 11, 8, 1, 5, C.coatShade);
    px(ctx, ox, oy, u, 2, 9, 2, 3, C.coatShade);
    px(ctx, ox, oy, u, 12, 9, 2, 3, C.coatShade);
    px(ctx, ox, oy, u, 2, 12, 2, 1, C.skin);
    px(ctx, ox, oy, u, 12, 12, 2, 1, C.skin);

    // Hat: a puffy top over a band.
    px(ctx, ox, oy, u, 4, 0, 8, 1, C.coat);
    px(ctx, ox, oy, u, 3, 1, 10, 2, C.coat);
    px(ctx, ox, oy, u, 6, 1, 1, 1, C.coatShade);
    px(ctx, ox, oy, u, 9, 1, 1, 1, C.coatShade);
    px(ctx, ox, oy, u, 4, 3, 8, 1, C.coatShade);

    if (facing === 'up') {
      // Seen from behind: hair and the knot of the neckerchief.
      px(ctx, ox, oy, u, 5, 4, 6, 4, C.hair);
      px(ctx, ox, oy, u, 6, 7, 4, 1, C.skinShade);
      px(ctx, ox, oy, u, 7, 8, 2, 2, C.scarf);
      return;
    }

    // Face.
    px(ctx, ox, oy, u, 5, 4, 6, 4, C.skin);
    px(ctx, ox, oy, u, 5, 7, 6, 1, C.skinShade);
    const side = facing === 'left' || facing === 'right';
    const eyes = facing === 'left' ? [5, 8] : facing === 'right' ? [7, 10] : [6, 9];
    px(ctx, ox, oy, u, eyes[0], 5, 1, 1, C.ink);
    px(ctx, ox, oy, u, eyes[1], 5, 1, 1, C.ink);
    // Moustache.
    const tache = facing === 'left' ? 5 : facing === 'right' ? 8 : 6;
    px(ctx, ox, oy, u, tache, 6, side ? 3 : 4, 1, C.hair);

    // Neckerchief and coat buttons.
    px(ctx, ox, oy, u, 6, 8, 4, 1, C.scarf);
    px(ctx, ox, oy, u, 7, 9, 2, 1, C.scarf);
    px(ctx, ox, oy, u, 7, 10, 1, 1, C.coatShade);
    px(ctx, ox, oy, u, 7, 12, 1, 1, C.coatShade);
  }

  Render.addTheme('pizza', {
    floor,
    wall,
    target,
    crate,
    player: chef,
    hint: { stroke: C.ink, fill: C.spot }
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
