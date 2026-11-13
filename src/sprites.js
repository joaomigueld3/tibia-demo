/**
 * CC0 Pixel-Art Sprite Atlas & Compositor:
 * - Loads verified Dungeon Crawl Stone Soup CC0 32x32 pixel sprites from assets/cc0/
 * - Performs offscreen palette remapping (brown Rat, charcoal Cave Rat, oak Chest, brass Helmet, wood Club/Shield)
 * - Generates seamless floor tiles, thin Tibia wall masonry slices, and 64x64 multi-tile trees
 * - Composites equipment-reactive modular paper-doll characters (S/N/E/W + walk frames + hit-flash)
 */

const ASSET_BASE = './assets/cc0/';

const CC0_FILES = [
  'grass0.png',
  'dirt0.png',
  'grey_dirt0.png',
  'rect_gray0.png',
  'marble0.png',
  'marble1.png',
  'mosaic0.png',
  'water0.png',
  'wall_brick_gray0.png',
  'wall_church0.png',
  'wall_lair0.png',
  'wall_stone_dark0.png',
  'stairs_up.png',
  'tree1.png',
  'bush1.png',
  'chest.png',
  'human_m.png',
  'hair_brown.png',
  'body_belt.png',
  'body_leather.png',
  'body_robe_brown.png',
  'head_helm.png',
  'head_hood.png',
  'hand1_club.png',
  'hand1_sword.png',
  'hand2_shield.png',
  'labrat.png',
  'spider.png',
  'gold_coin.png',
  'cheese.png',
  'meat.png',
  'health_potion.png',
  'club.png',
  'short_sword.png',
  'wooden_shield.png',
  'leather_armor.png',
  'brass_helmet.png',
  'leather_boots.png',
  'fire_cloud0.png',
];

function createCanvas(width = 32, height = 32) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function loadImage(filename) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load sprite: ${filename}`));
    img.src = ASSET_BASE + filename;
  });
}

async function loadAllImages(filenames) {
  const entries = await Promise.all(filenames.map(async (name) => [name, await loadImage(name)]));
  return Object.fromEntries(entries);
}

/**
 * Copies source onto a canvas and applies a per-pixel RGBA transform.
 */
function transformSprite(src, width, height, pixelFn) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, width, height);
  if (pixelFn) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const x = (i / 4) % width;
      const y = Math.floor(i / 4 / width);
      pixelFn(data, i, x, y);
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return canvas;
}

function cloneTransformed(src, pixelFn) {
  return transformSprite(src, src.width || 32, src.height || 32, pixelFn);
}

function flipHorizontal(src) {
  const w = src.width || 32;
  const h = src.height || 32;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function flipVertical(src) {
  const w = src.width || 32;
  const h = src.height || 32;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(0, h);
  ctx.scale(1, -1);
  ctx.drawImage(src, 0, 0);
  return c;
}

function shiftSprite(src, dx, dy) {
  const w = src.width || 32;
  const h = src.height || 32;
  const c = createCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, dx, dy);
  return c;
}

function makeFlashMask(src, alpha = 0.72) {
  return cloneTransformed(src, (d, i) => {
    d[i] = 255;
    d[i + 1] = 250;
    d[i + 2] = 240;
    d[i + 3] = Math.round(d[i + 3] * alpha);
  });
}

function buildDirectionsFromRightOrFront(baseCanvas, walkCanvas) {
  const leftBase = flipHorizontal(baseCanvas);
  const leftWalk = flipHorizontal(walkCanvas);
  return {
    frames: {
      S: [baseCanvas, walkCanvas],
      E: [baseCanvas, walkCanvas],
      W: [leftBase, leftWalk],
      N: [baseCanvas, walkCanvas],
    },
    flash: {
      S: [makeFlashMask(baseCanvas), makeFlashMask(walkCanvas)],
      E: [makeFlashMask(baseCanvas), makeFlashMask(walkCanvas)],
      W: [makeFlashMask(leftBase), makeFlashMask(leftWalk)],
      N: [makeFlashMask(baseCanvas), makeFlashMask(walkCanvas)],
    },
  };
}

function buildGrassVariants(grassImg) {
  const base = cloneTransformed(grassImg, (d, i) => {
    d[i] = clampByte(d[i] * 0.94);
    d[i + 1] = clampByte(d[i + 1] * 1.03);
    d[i + 2] = clampByte(d[i + 2] * 0.88);
  });
  return [base, flipHorizontal(base), flipVertical(base)];
}

function buildFlowerOverlays() {
  const mk = (petalA, petalB) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    const spots = [[7, 10], [21, 7], [14, 23], [25, 21]];
    for (const [x, y] of spots) {
      ctx.fillStyle = '#2d571a';
      ctx.fillRect(x, y + 1, 2, 2);
      ctx.fillStyle = petalA;
      ctx.fillRect(x, y, 2, 1);
      ctx.fillRect(x + 1, y - 1, 1, 1);
      ctx.fillStyle = petalB;
      ctx.fillRect(x - 1, y, 1, 1);
    }
    return c;
  };
  return [mk('#f5e45b', '#fff5a6'), mk('#8ec6ff', '#d6ecff')];
}

/**
 * Seamlessly prepares marble floor by toning down DCSS's top-left bright frame bevel
 * and warming it into classic Rookgaard Temple limestone/sandstone marble.
 */
function buildTempleFloor(marbleImg) {
  const cropped = createCanvas(32, 32);
  const cCtx = cropped.getContext('2d');
  cCtx.imageSmoothingEnabled = false;
  // Crop out DCSS's thick outer pink/white edge frame [4..28] so slabs tile softly
  cCtx.drawImage(marbleImg, 4, 4, 24, 24, 0, 0, 32, 32);
  return cloneTransformed(cropped, (d, i, x, y) => {
    const lum = (d[i] * 0.4 + d[i + 1] * 0.35 + d[i + 2] * 0.25) * 0.92 + 12;
    const subtleSeam = x === 31 || y === 31 ? 0.91 : 1.0;
    d[i] = clampByte(lum * 1.04 * subtleSeam);
    d[i + 1] = clampByte(lum * 1.0 * subtleSeam);
    d[i + 2] = clampByte(lum * 0.9 * subtleSeam);
  });
}

/**
 * Lightens DCSS rect_gray stone slabs into crisp Rookgaard cobblestone.
 */
function buildCobblestone(rectImg) {
  return cloneTransformed(rectImg, (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const lifted = 72 + avg * 1.35;
    d[i] = clampByte(lifted * 1.04);
    d[i + 1] = clampByte(lifted * 1.0);
    d[i + 2] = clampByte(lifted * 0.93);
  });
}

/**
 * Builds damp cavern/sewer floor from grey_dirt + optional subtle moss flecks.
 */
function buildSewerFloor(greyDirtImg, mossSeed = 0) {
  const c = cloneTransformed(greyDirtImg, (d, i) => {
    d[i] = clampByte(d[i] * 0.72);
    d[i + 1] = clampByte(d[i + 1] * 0.75);
    d[i + 2] = clampByte(d[i + 2] * 0.8);
  });
  if (mossSeed > 0) {
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(72, 108, 48, 0.35)';
    ctx.fillRect(6 + mossSeed * 4, 8, 3, 2);
    ctx.fillRect(19, 21 - mossSeed * 3, 4, 2);
  }
  return c;
}

/**
 * Seamless wooden floor & heavy plank bridge (zero boxy 32x32 border).
 */
function buildWoodFloor(variant = 0) {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  const plankRows = [0, 8, 16, 24];
  const shades = ['#825831', '#774f2b', '#8b5e36', '#6d4725'];
  for (let r = 0; r < 4; r++) {
    const y = plankRows[r];
    ctx.fillStyle = shades[(r + variant) % shades.length];
    ctx.fillRect(0, y, 32, 7);
    ctx.fillStyle = '#4f3218';
    ctx.fillRect(0, y + 7, 32, 1);
    const seamX = (r * 13 + variant * 9) % 28;
    ctx.fillRect(seamX, y, 1, 7);
    ctx.fillStyle = '#332010';
    ctx.fillRect((seamX + 2) % 31, y + 2, 1, 1);
    ctx.fillRect((seamX + 2) % 31, y + 5, 1, 1);
    ctx.fillStyle = '#9c6c3f';
    for (let x = 2; x < 30; x += 6) {
      if ((x + r + variant) % 5 === 0) ctx.fillRect(x, y + 3, 4, 1);
    }
  }
  return c;
}

function buildBridge() {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#57391e';
  ctx.fillRect(0, 0, 32, 32);
  for (let y = 0; y < 32; y += 6) {
    ctx.fillStyle = y % 12 === 0 ? '#936438' : '#85582f';
    ctx.fillRect(2, y + 1, 28, 4);
    ctx.fillStyle = '#6c4623';
    ctx.fillRect(2, y + 4, 28, 1);
    ctx.fillStyle = '#2d1c0d';
    ctx.fillRect(4, y + 2, 1, 1);
    ctx.fillRect(27, y + 2, 1, 1);
  }
  ctx.fillStyle = '#a67647';
  ctx.fillRect(0, 0, 3, 32);
  ctx.fillRect(29, 0, 3, 32);
  ctx.fillStyle = '#3b2410';
  ctx.fillRect(2, 0, 1, 32);
  ctx.fillRect(29, 0, 1, 32);
  return c;
}

function buildWaterFrame(waterImg, frameIdx) {
  const base = frameIdx === 1 ? flipHorizontal(waterImg) : waterImg;
  const c = cloneTransformed(base, (d, i) => {
    d[i] = clampByte(d[i] * 0.9 + 6);
    d[i + 1] = clampByte(d[i + 1] * 1.05 + 10);
    d[i + 2] = clampByte(d[i + 2] * 1.15 + 16);
  });
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(138, 206, 240, 0.35)';
  const shift = frameIdx * 4;
  ctx.fillRect((4 + shift) % 26, 7, 5, 1);
  ctx.fillRect((17 + shift) % 25, 19, 6, 1);
  ctx.fillRect((9 + shift) % 27, 27, 4, 1);
  return c;
}

function buildGrassPathEdges() {
  const dirs = {};
  const bladeColors = ['#2f5a1d', '#49822c', '#639f3d'];
  for (const dir of ['N', 'E', 'S', 'W']) {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    for (let t = 0; t < 32; t++) {
      const tuftLen = 2 + ((t * 5 + (dir.charCodeAt(0) % 7)) % 4);
      for (let depth = 0; depth < tuftLen; depth++) {
        ctx.fillStyle = bladeColors[(t + depth) % bladeColors.length];
        if (dir === 'N') ctx.fillRect(t, depth, 1, 1);
        else if (dir === 'S') ctx.fillRect(t, 31 - depth, 1, 1);
        else if (dir === 'W') ctx.fillRect(depth, t, 1, 1);
        else if (dir === 'E') ctx.fillRect(31 - depth, t, 1, 1);
      }
    }
    dirs[dir] = c;
  }
  return dirs;
}

function buildShoreEdges(sewer = false) {
  const dirs = {};
  const bankDark = sewer ? '#3a3d42' : '#4a351e';
  const bankMid = sewer ? '#565a62' : '#6f5130';
  const rimCol = sewer ? '#767b85' : '#4a832d';
  const foam = 'rgba(195, 232, 255, 0.45)';

  for (const dir of ['N', 'S', 'E', 'W']) {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    if (dir === 'N') {
      ctx.fillStyle = rimCol;
      ctx.fillRect(0, 0, 32, 2);
      ctx.fillStyle = bankMid;
      ctx.fillRect(0, 2, 32, 3);
      ctx.fillStyle = bankDark;
      ctx.fillRect(0, 5, 32, 1);
      ctx.fillStyle = foam;
      for (let x = 1; x < 31; x += 4) ctx.fillRect(x, 6 + (x % 2), 2, 1);
    } else if (dir === 'S') {
      ctx.fillStyle = foam;
      for (let x = 2; x < 30; x += 5) ctx.fillRect(x, 27, 2, 1);
      ctx.fillStyle = bankMid;
      ctx.fillRect(0, 29, 32, 2);
      ctx.fillStyle = rimCol;
      ctx.fillRect(0, 30, 32, 2);
    } else if (dir === 'W') {
      ctx.fillStyle = rimCol;
      ctx.fillRect(0, 0, 2, 32);
      ctx.fillStyle = bankDark;
      ctx.fillRect(2, 0, 2, 32);
      ctx.fillStyle = foam;
      for (let y = 2; y < 30; y += 5) ctx.fillRect(4, y, 1, 2);
    } else if (dir === 'E') {
      ctx.fillStyle = foam;
      for (let y = 3; y < 30; y += 5) ctx.fillRect(27, y, 1, 2);
      ctx.fillStyle = bankMid;
      ctx.fillRect(28, 0, 2, 32);
      ctx.fillStyle = rimCol;
      ctx.fillRect(30, 0, 2, 32);
    }
    dirs[dir] = c;
  }
  return dirs;
}

function buildShadowOverlays() {
  const mk = (drawFn) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    drawFn(ctx);
    return c;
  };
  return {
    shadowSouth: mk((ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 10);
      grad.addColorStop(0, 'rgba(0,0,0,0.34)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 32, 10);
    }),
    shadowEast: mk((ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 10, 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.28)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 10, 32);
    }),
    shadowCorner: mk((ctx) => {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, 6, 6);
    }),
  };
}

/**
 * Extracts warm Tibia Rookgaard masonry swatches (32x20 South brick faces & cavern rocks)
 * from CC0 brick textures.
 */
function buildWallTextures(imgs) {
  const mkStoneFace = (src, warmShift = 1.0, addMoss = false) => {
    const face = createCanvas(32, 20);
    const ctx = face.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(src, 0, 6, 32, 20, 0, 0, 32, 20);
    const imgData = ctx.getImageData(0, 0, 32, 20);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const py = Math.floor(i / 4 / 32);
      const ao = 1 - (py / 20) * 0.16;
      d[i] = clampByte(d[i] * 1.18 * warmShift * ao);
      d[i + 1] = clampByte(d[i + 1] * 1.14 * ao);
      d[i + 2] = clampByte(d[i + 2] * 1.02 * ao);
    }
    ctx.putImageData(imgData, 0, 0);
    if (addMoss) {
      ctx.fillStyle = 'rgba(66, 110, 42, 0.55)';
      ctx.fillRect(4, 15, 5, 3);
      ctx.fillRect(21, 14, 6, 4);
      ctx.fillRect(12, 16, 3, 2);
    }
    ctx.fillStyle = 'rgba(255,245,220,0.22)';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 19, 32, 1);
    return face;
  };

  const grayFlipped = flipHorizontal(imgs['wall_brick_gray0.png']);
  const southFaces = [
    mkStoneFace(imgs['wall_brick_gray0.png'], 1.04, false),
    mkStoneFace(grayFlipped, 1.02, false),
    mkStoneFace(imgs['wall_brick_gray0.png'], 1.03, true),
  ];

  const capH = createCanvas(32, 10);
  {
    const ctx = capH.getContext('2d');
    ctx.fillStyle = '#9e9584';
    ctx.fillRect(0, 0, 32, 10);
    ctx.fillStyle = '#bdb3a0';
    ctx.fillRect(0, 1, 32, 2);
    ctx.fillStyle = '#6c6558';
    ctx.fillRect(10, 1, 1, 8);
    ctx.fillRect(22, 1, 1, 8);
    ctx.fillStyle = '#25211b';
    ctx.fillRect(0, 0, 32, 1);
    ctx.fillRect(0, 9, 32, 1);
  }

  const capV = createCanvas(10, 32);
  {
    const ctx = capV.getContext('2d');
    ctx.fillStyle = '#978f7e';
    ctx.fillRect(0, 0, 10, 32);
    ctx.fillStyle = '#b7ad9a';
    ctx.fillRect(1, 0, 2, 32);
    ctx.fillStyle = '#6b6457';
    ctx.fillRect(1, 10, 8, 1);
    ctx.fillRect(1, 22, 8, 1);
    ctx.fillStyle = '#25211b';
    ctx.fillRect(0, 0, 1, 32);
    ctx.fillRect(9, 0, 1, 32);
  }

  const mkCavernWall = (src) =>
    cloneTransformed(src, (d, i, x, y) => {
      const distCenter = Math.hypot((x - 15.5) / 16, (y - 15.5) / 16);
      const shade = Math.max(0.28, 1 - distCenter * 0.45);
      d[i] = clampByte(d[i] * 0.56 * shade);
      d[i + 1] = clampByte(d[i + 1] * 0.58 * shade);
      d[i + 2] = clampByte(d[i + 2] * 0.62 * shade);
    });

  return {
    southFaces,
    capH,
    capV,
    sewerRocks: [
      mkCavernWall(imgs['wall_lair0.png']),
      mkCavernWall(flipHorizontal(imgs['wall_lair0.png'])),
      mkCavernWall(imgs['wall_stone_dark0.png']),
    ],
  };
}

/**
 * Builds 3 tall 64x64 oak tree variants from CC0 tree1.png & bush1.png.
 */
function buildTallTrees(imgs) {
  return [0, 1, 2].map((idx) => {
    const c = createCanvas(64, 64);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(38, 56, 15, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Roots & shaded trunk
    ctx.fillStyle = '#3b2412';
    ctx.fillRect(27, 40, 10, 16);
    ctx.fillRect(25, 54, 14, 3);
    ctx.fillStyle = '#5c3a1d';
    ctx.fillRect(29, 40, 5, 15);
    ctx.fillStyle = '#734b28';
    ctx.fillRect(30, 41, 2, 13);
    ctx.fillStyle = '#1d1108';
    ctx.fillRect(26, 40, 1, 16);
    ctx.fillRect(37, 40, 1, 16);

    const tintShift = idx === 1 ? 0.94 : idx === 2 ? 1.06 : 1.0;
    const leafCluster = cloneTransformed(imgs['bush1.png'], (d, i, x, y) => {
      if (y > 22 && d[i] + d[i + 1] + d[i + 2] < 36) {
        d[i + 3] = 0;
        return;
      }
      d[i] = clampByte(d[i] * 0.9 * tintShift);
      d[i + 1] = clampByte(d[i + 1] * 1.04 * tintShift);
      d[i + 2] = clampByte(d[i + 2] * 0.85);
    });
    const treeTop = cloneTransformed(imgs['tree1.png'], (d, i, x, y) => {
      // Remove baked-in dark trunk & opaque black cast shadow in lower-right of tree1.png
      const isBlackShadow = y > 13 && x > 14 && d[i] < 24 && d[i + 1] < 24 && d[i + 2] < 24;
      if (y >= 20 || isBlackShadow) {
        d[i + 3] = 0;
        return;
      }
      d[i] = clampByte(d[i] * 0.92 * tintShift);
      d[i + 1] = clampByte(d[i + 1] * 1.05 * tintShift);
      d[i + 2] = clampByte(d[i + 2] * 0.86);
    });
    const finalTop = idx % 2 === 1 ? flipHorizontal(treeTop) : treeTop;

    ctx.drawImage(leafCluster, 4, 16, 36, 32);
    ctx.drawImage(flipHorizontal(leafCluster), 22, 16, 36, 32);
    ctx.drawImage(finalTop, 8, 2, 48, 44);
    ctx.drawImage(finalTop, 14, 10, 36, 34);
    return c;
  });
}

function buildSign() {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(10, 26, 13, 4);
  ctx.fillStyle = '#4c3018';
  ctx.fillRect(14, 15, 4, 14);
  ctx.fillStyle = '#6c4726';
  ctx.fillRect(15, 15, 2, 13);
  ctx.fillStyle = '#221409';
  ctx.fillRect(6, 5, 20, 13);
  ctx.fillStyle = '#8b5e34';
  ctx.fillRect(7, 6, 18, 11);
  ctx.fillStyle = '#d9c89e';
  ctx.fillRect(9, 8, 14, 7);
  ctx.fillStyle = '#4a3824';
  ctx.fillRect(10, 10, 11, 1);
  ctx.fillRect(10, 12, 8, 1);
  return c;
}

function buildCrate() {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(6, 26, 22, 4);
  ctx.fillStyle = '#201309';
  ctx.fillRect(5, 8, 22, 20);
  ctx.fillStyle = '#9c6c3b';
  ctx.fillRect(6, 9, 20, 6);
  ctx.fillStyle = '#b4804b';
  ctx.fillRect(7, 10, 18, 4);
  ctx.fillStyle = '#754c25';
  ctx.fillRect(6, 15, 20, 12);
  ctx.fillStyle = '#4a2e14';
  ctx.fillRect(8, 17, 16, 8);
  ctx.fillStyle = '#916336';
  ctx.fillRect(6, 15, 20, 2);
  ctx.fillRect(6, 25, 20, 2);
  ctx.fillRect(6, 15, 2, 12);
  ctx.fillRect(24, 15, 2, 12);
  for (let k = 0; k < 10; k++) {
    ctx.fillRect(8 + Math.round(k * 1.4), 17 + Math.round(k * 0.7), 2, 2);
  }
  return c;
}

function buildSewerGrate() {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#4f5156';
  ctx.fillRect(2, 3, 28, 26);
  ctx.fillStyle = '#7b7e86';
  ctx.fillRect(2, 3, 28, 2);
  ctx.fillRect(2, 3, 2, 26);
  ctx.fillStyle = '#090a0d';
  ctx.fillRect(5, 6, 22, 20);
  ctx.fillStyle = '#5c3c1e';
  ctx.fillRect(9, 10, 2, 15);
  ctx.fillRect(19, 10, 2, 15);
  ctx.fillStyle = '#7c522b';
  ctx.fillRect(9, 14, 12, 2);
  ctx.fillRect(9, 20, 12, 2);
  for (let x = 7; x <= 23; x += 4) {
    ctx.fillStyle = '#1e2126';
    ctx.fillRect(x - 1, 5, 3, 22);
    ctx.fillStyle = '#6c737d';
    ctx.fillRect(x, 6, 1, 20);
  }
  ctx.fillStyle = '#6c737d';
  ctx.fillRect(5, 11, 22, 1);
  return c;
}

function buildLadder(stairsUpImg) {
  const stone = cloneTransformed(stairsUpImg, (d, i) => {
    const lum = (d[i] * 0.48 + d[i + 1] * 0.3 + d[i + 2] * 0.22) * 0.68;
    d[i] = clampByte(lum + 14);
    d[i + 1] = clampByte(lum + 13);
    d[i + 2] = clampByte(lum + 10);
  });
  const ctx = stone.getContext('2d');
  ctx.fillStyle = '#6b4522';
  ctx.fillRect(3, 5, 2, 22);
  ctx.fillRect(2, 4, 4, 2);
  return stone;
}

function buildOakChest(chestImg) {
  return cloneTransformed(chestImg, (d, i, x, y) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    const isBand = (x >= 13 && x <= 18) || (y >= 16 && y <= 18);
    if (avg > 120 && isBand) {
      d[i] = clampByte(avg * 1.25);
      d[i + 1] = clampByte(avg * 1.02);
      d[i + 2] = clampByte(avg * 0.32);
    } else if (avg > 35) {
      d[i] = clampByte(avg * 1.38 + 22);
      d[i + 1] = clampByte(avg * 0.92 + 10);
      d[i + 2] = clampByte(avg * 0.5 + 4);
    }
  });
}

function buildTorchFrames() {
  return [0, 1].map((idx) => {
    const c = createCanvas(16, 20);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#201812';
    ctx.fillRect(6, 10, 4, 8);
    ctx.fillStyle = '#6b4420';
    ctx.fillRect(7, 10, 2, 7);
    ctx.fillStyle = '#7e838c';
    ctx.fillRect(5, 13, 6, 2);
    // Warm flickering pixel flame
    ctx.fillStyle = '#ff6b1a';
    ctx.fillRect(5 + idx, 5, 5 - idx, 5);
    ctx.fillRect(6, 2 + idx, 3, 4);
    ctx.fillStyle = '#ffd54a';
    ctx.fillRect(6, 5, 3, 4);
    ctx.fillStyle = '#fff9c4';
    ctx.fillRect(7, 7, 1, 2);
    return c;
  });
}

function buildRatActors(labratImg) {
  const mkRat = (isCave) => {
    const base = cloneTransformed(labratImg, (d, i, x, y) => {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const isFur = r > g * 1.15 && r > 55;
      if (!isFur) return;
      const lum = (r * 0.45 + b * 0.35 + g * 0.2) / 255;
      if (isCave) {
        d[i] = clampByte(40 + lum * 95);
        d[i + 1] = clampByte(38 + lum * 88);
        d[i + 2] = clampByte(44 + lum * 96);
        if (y >= 9 && y <= 13 && (x === 9 || x === 13)) {
          d[i] = 225;
          d[i + 1] = 45;
          d[i + 2] = 45;
        }
      } else {
        d[i] = clampByte(70 + lum * 135);
        d[i + 1] = clampByte(44 + lum * 92);
        d[i + 2] = clampByte(24 + lum * 58);
      }
    });
    return buildDirectionsFromRightOrFront(base, shiftSprite(base, 0, -1));
  };

  return {
    rat: mkRat(false),
    cave_rat: mkRat(true),
  };
}

function buildSpiderActor(spiderImg) {
  const walk = shiftSprite(spiderImg, 0, -1);
  return buildDirectionsFromRightOrFront(spiderImg, walk);
}

function prepareDollLayers(imgs) {
  const clubLayer = cloneTransformed(imgs['hand1_club.png'], (d, i) => {
    if (d[i] > d[i + 1] * 1.2) {
      const lum = (d[i] + d[i + 1]) / 255;
      d[i] = clampByte(88 + lum * 85);
      d[i + 1] = clampByte(52 + lum * 54);
      d[i + 2] = clampByte(26 + lum * 28);
    }
  });

  const shieldLayer = cloneTransformed(imgs['hand2_shield.png'], (d, i) => {
    if (d[i] > d[i + 1] * 1.25 && d[i] > 70) {
      const lum = d[i] / 255;
      d[i] = clampByte(95 + lum * 78);
      d[i + 1] = clampByte(58 + lum * 48);
      d[i + 2] = clampByte(26 + lum * 25);
    }
  });

  const helmBrass = cloneTransformed(imgs['head_helm.png'], (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (avg > 45) {
      d[i] = clampByte(avg * 1.18 + 20);
      d[i + 1] = clampByte(avg * 1.0 + 10);
      d[i + 2] = clampByte(avg * 0.48);
    }
  });

  const monkRobe = cloneTransformed(imgs['body_robe_brown.png'], (d, i) => {
    if (d[i] > 60 && d[i + 1] > 40) {
      d[i] = clampByte(d[i] * 0.72 + 12);
      d[i + 1] = clampByte(d[i + 1] * 0.62 + 8);
      d[i + 2] = clampByte(d[i + 2] * 0.8 + 14);
    }
  });

  const monkHood = cloneTransformed(imgs['head_hood.png'], (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (avg > 35) {
      d[i] = clampByte(avg * 1.15 + 16);
      d[i + 1] = clampByte(avg * 0.82 + 8);
      d[i + 2] = clampByte(avg * 0.52);
    }
  });

  const beltTunic = cloneTransformed(imgs['body_belt.png'], (d, i) => {
    if (d[i] > 90 && d[i + 1] < 90) {
      d[i] = clampByte(d[i] * 0.42);
      d[i + 1] = clampByte(d[i] * 0.68);
      d[i + 2] = clampByte(d[i] * 1.05);
    }
  });

  return {
    base: imgs['human_m.png'],
    hair: imgs['hair_brown.png'],
    tunic: beltTunic,
    leatherArmor: imgs['body_leather.png'],
    monkRobe,
    monkHood,
    helmBrass,
    club: clubLayer,
    sword: imgs['hand1_sword.png'],
    shield: shieldLayer,
  };
}

function composePaperDoll(layers, equipment) {
  const buildPose = (isBack, walkBob) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const dy = walkBob ? -1 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(16, 28, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.drawImage(layers.base, 0, dy);
    if (equipment.boots === 'leather_boots') {
      // Crisp tan leather boot highlights over feet
      ctx.fillStyle = '#8b5628';
      ctx.fillRect(11, 25 + dy, 4, 3);
      ctx.fillRect(17, 25 + dy, 4, 3);
      ctx.fillStyle = '#c48647';
      ctx.fillRect(12, 25 + dy, 2, 1);
      ctx.fillRect(18, 25 + dy, 2, 1);
    }

    ctx.drawImage(equipment.armor === 'leather_armor' ? layers.leatherArmor : layers.tunic, 0, dy);

    if (equipment.helmet === 'brass_helmet') {
      ctx.drawImage(layers.helmBrass, 0, dy);
    } else {
      ctx.drawImage(layers.hair, 0, dy);
    }

    if (isBack) {
      ctx.fillStyle = equipment.helmet === 'brass_helmet' ? '#9c8338' : '#5c3114';
      ctx.fillRect(13, 6 + dy, 6, 5);
    }

    if (equipment.weapon === 'short_sword') {
      ctx.drawImage(layers.sword, 0, dy);
    } else if (equipment.weapon === 'club') {
      ctx.drawImage(layers.club, 0, dy);
    }

    if (equipment.shield === 'wooden_shield') {
      ctx.drawImage(layers.shield, 0, dy);
    }

    return c;
  };

  const front = buildPose(false, false);
  const frontWalk = buildPose(false, true);
  const back = buildPose(true, false);
  const backWalk = buildPose(true, true);
  const left = flipHorizontal(front);
  const leftWalk = flipHorizontal(frontWalk);

  return {
    frames: {
      S: [front, frontWalk],
      E: [front, frontWalk],
      W: [left, leftWalk],
      N: [back, backWalk],
    },
    flash: {
      S: [makeFlashMask(front), makeFlashMask(frontWalk)],
      E: [makeFlashMask(front), makeFlashMask(frontWalk)],
      W: [makeFlashMask(left), makeFlashMask(leftWalk)],
      N: [makeFlashMask(back), makeFlashMask(backWalk)],
    },
  };
}

function buildCipfried(layers) {
  const build = (dy) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(0,0,0,0.34)';
    ctx.beginPath();
    ctx.ellipse(16, 28, 7, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(layers.base, 0, dy);
    ctx.drawImage(layers.monkRobe, 0, dy);
    ctx.drawImage(layers.monkHood, 0, dy);
    // Monk wooden pilgrim staff
    ctx.fillStyle = '#241508';
    ctx.fillRect(6, 5 + dy, 3, 22);
    ctx.fillStyle = '#8b5a2c';
    ctx.fillRect(7, 6 + dy, 1, 20);
    return c;
  };
  return buildDirectionsFromRightOrFront(build(0), build(-1));
}

function buildBloodDecal() {
  const c = createCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(130, 14, 14, 0.78)';
  ctx.fillRect(10, 14, 9, 4);
  ctx.fillRect(13, 12, 5, 8);
  ctx.fillRect(8, 19, 4, 2);
  ctx.fillStyle = 'rgba(175, 24, 24, 0.72)';
  ctx.fillRect(12, 15, 4, 3);
  return c;
}

function buildCorpses(ratFrames, spiderImg) {
  const mkCorpse = (src) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#6f1111';
    ctx.beginPath();
    ctx.ellipse(16, 21, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(16, 17);
    ctx.scale(1, -0.72);
    ctx.drawImage(src, -16, -16);
    ctx.restore();
    return c;
  };
  return {
    corpse_rat: mkCorpse(ratFrames.rat.frames.S[0]),
    corpse_spider: mkCorpse(spiderImg),
  };
}

function buildSlashFrames() {
  return [0, 1, 2].map((frame) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    ctx.strokeStyle = frame === 0 ? '#ffffff' : frame === 1 ? '#ffe680' : '#ff9944';
    ctx.lineWidth = frame === 1 ? 3 : 2;
    ctx.beginPath();
    ctx.arc(16, 16, 10, -0.8 + frame * 0.45, 0.9 + frame * 0.5);
    ctx.stroke();
    return c;
  });
}

function buildSparkleFrames(colorHex, accentHex) {
  return [0, 1, 2].map((frame) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    const r = 3 + frame * 2;
    ctx.fillStyle = accentHex;
    ctx.fillRect(15 - r, 8, 3, 3);
    ctx.fillRect(15 + r, 11, 3, 3);
    ctx.fillRect(14, 18 - r, 3, 3);
    ctx.fillStyle = colorHex;
    ctx.fillRect(16 - r, 9, 1, 1);
    ctx.fillRect(16 + r, 12, 1, 1);
    ctx.fillRect(15, 19 - r, 1, 1);
    ctx.fillRect(19, 20 - frame, 2, 2);
    return c;
  });
}

function buildPoofFrames() {
  return [0, 1, 2].map((frame) => {
    const c = createCanvas(32, 32);
    const ctx = c.getContext('2d');
    const alpha = 0.7 - frame * 0.18;
    ctx.fillStyle = `rgba(210, 214, 222, ${alpha})`;
    const rad = 5 + frame * 2;
    ctx.fillRect(16 - rad, 14 - frame * 2, rad * 2, 6);
    ctx.fillRect(12, 11 - frame * 2, 8, 10);
    return c;
  });
}

/**
 * Asynchronously loads CC0 sprites and constructs the complete game atlas.
 */
export async function createSpriteAtlas() {
  const imgs = await loadAllImages(CC0_FILES);
  const dollLayers = prepareDollLayers(imgs);

  const ground = {
    GRASS: buildGrassVariants(imgs['grass0.png']),
    FLOWERS: buildFlowerOverlays(),
    TEMPLE_FLOOR: [
      buildTempleFloor(imgs['marble1.png']),
      buildTempleFloor(flipHorizontal(imgs['marble0.png'])),
    ],
    TEMPLE_CENTER: cloneTransformed(imgs['marble1.png'], (d, i, x, y) => {
      const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const inMedallion = x >= 4 && x <= 27 && y >= 4 && y <= 27 && (Math.abs(x - 15.5) + Math.abs(y - 15.5) <= 13);
      if (inMedallion) {
        d[i] = clampByte(avg * 1.08 + 18);
        d[i + 1] = clampByte(avg * 0.98 + 10);
        d[i + 2] = clampByte(avg * 0.65);
      } else {
        d[i] = clampByte(d[i] * 0.95);
        d[i + 1] = clampByte(d[i + 1] * 0.92);
        d[i + 2] = clampByte(d[i + 2] * 0.84);
      }
    }),
    COBBLESTONE: [
      buildCobblestone(imgs['rect_gray0.png']),
      buildCobblestone(flipHorizontal(imgs['rect_gray0.png'])),
      buildCobblestone(flipVertical(imgs['rect_gray0.png'])),
    ],
    WOOD_FLOOR: [buildWoodFloor(0), buildWoodFloor(1)],
    DIRT: [imgs['dirt0.png'], flipHorizontal(imgs['dirt0.png']), flipVertical(imgs['dirt0.png'])],
    SEWER_FLOOR: [
      buildSewerFloor(imgs['grey_dirt0.png'], 0),
      buildSewerFloor(flipHorizontal(imgs['grey_dirt0.png']), 1),
      buildSewerFloor(flipVertical(imgs['grey_dirt0.png']), 2),
    ],
    BRIDGE: [buildBridge()],
    WATER: [
      buildWaterFrame(imgs['water0.png'], 0),
      buildWaterFrame(imgs['water0.png'], 1),
      buildWaterFrame(imgs['water0.png'], 2),
    ],
  };

  const edges = {
    grassOnPath: buildGrassPathEdges(),
    shoreSurface: buildShoreEdges(false),
    shoreSewer: buildShoreEdges(true),
    ...buildShadowOverlays(),
  };

  const walls = buildWallTextures(imgs);

  const structures = {
    TREES: buildTallTrees(imgs),
    BUSH: imgs['bush1.png'],
    CRATE: buildCrate(),
    SIGN: buildSign(),
    SEWER_GRATE: buildSewerGrate(),
    LADDER: buildLadder(imgs['stairs_up.png']),
    CHEST: buildOakChest(imgs['chest.png']),
    TORCH: buildTorchFrames(),
  };

  const ratActors = buildRatActors(imgs['labrat.png']);
  const spiderActor = buildSpiderActor(imgs['spider.png']);
  const cipfriedActor = buildCipfried(dollLayers);

  const actors = {
    ...ratActors,
    spider: spiderActor,
    npc_cipfried: cipfriedActor,
  };

  const brassHelmItem = cloneTransformed(imgs['brass_helmet.png'], (d, i) => {
    const avg = (d[i] + d[i + 1] + d[i + 2]) / 3;
    if (avg > 45) {
      d[i] = clampByte(avg * 1.2 + 22);
      d[i + 1] = clampByte(avg * 1.02 + 12);
      d[i + 2] = clampByte(avg * 0.45);
    }
  });

  const corpses = buildCorpses(ratActors, imgs['spider.png']);
  const slashFrames = buildSlashFrames();
  const healFrames = buildSparkleFrames('#ffffff', '#52d6ff');
  const hitFrames = buildSparkleFrames('#ffdddd', '#e02828');
  const poofFrames = buildPoofFrames();

  const items = {
    gold_coin: imgs['gold_coin.png'],
    cheese: imgs['cheese.png'],
    meat: imgs['meat.png'],
    health_potion: imgs['health_potion.png'],
    club: imgs['club.png'],
    short_sword: imgs['short_sword.png'],
    wooden_shield: imgs['wooden_shield.png'],
    leather_armor: imgs['leather_armor.png'],
    brass_helmet: brassHelmItem,
    leather_boots: imgs['leather_boots.png'],
    blood_decal: buildBloodDecal(),
    corpse_rat: corpses.corpse_rat,
    corpse_spider: corpses.corpse_spider,
    vfx_fire_0: imgs['fire_cloud0.png'],
    vfx_fire_1: flipHorizontal(imgs['fire_cloud0.png']),
    vfx_fire_2: flipVertical(imgs['fire_cloud0.png']),
    vfx_heal_0: healFrames[0],
    vfx_heal_1: healFrames[1],
    vfx_heal_2: healFrames[2],
    vfx_hit_0: hitFrames[0],
    vfx_hit_1: hitFrames[1],
    vfx_hit_2: hitFrames[2],
    vfx_blood_0: hitFrames[0],
    vfx_blood_1: hitFrames[1],
    vfx_blood_2: hitFrames[2],
    vfx_poof_0: poofFrames[0],
    vfx_poof_1: poofFrames[1],
    vfx_poof_2: poofFrames[2],
    vfx_slash_0: slashFrames[0],
    vfx_slash_1: slashFrames[1],
    vfx_slash_2: slashFrames[2],
  };

  const playerCache = new Map();
  function getPlayerActorSet(equipment = {}) {
    const key = [
      equipment.helmet || '',
      equipment.armor || '',
      equipment.weapon || '',
      equipment.shield || '',
      equipment.boots || '',
    ].join('|');
    if (!playerCache.has(key)) {
      if (playerCache.size > 32) playerCache.clear();
      playerCache.set(key, composePaperDoll(dollLayers, equipment));
    }
    return playerCache.get(key);
  }

  const dataUrlCache = new Map();
  function getDataUrl(key) {
    if (dataUrlCache.has(key)) return dataUrlCache.get(key);
    let src = items[key];
    if (!src && actors[key]) src = actors[key].frames.S[0];
    if (!src) return '';

    let canvas = src;
    if (typeof src.toDataURL !== 'function') {
      canvas = createCanvas(src.width || 32, src.height || 32);
      canvas.getContext('2d').drawImage(src, 0, 0);
    }
    const url = canvas.toDataURL();
    dataUrlCache.set(key, url);
    return url;
  }

  return {
    ground,
    edges,
    walls,
    structures,
    items,
    actors,
    getPlayerActorSet,
    getDataUrl,
  };
}
