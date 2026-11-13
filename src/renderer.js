/**
 * Architectural Tibia 7.x HTML5 Canvas Renderer:
 * - Seamless CC0 ground textures with flower accents & organic grass-on-path transitions
 * - Thin oblique sandstone masonry walls (recessed South brick facades + East bevels + doorway jambs)
 * - Continuous dark cavern void with rugged mossy rock walls in the Rat Sewer (z=1)
 * - 64x64 two-tile tall multi-layered oak trees & equipment-reactive CC0 player paper-dolls
 * - Smooth tile-vertex bilinear lightmap + warm torchlight + 1px crisp bitmap pixel font
 */

import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  TILE_SIZE,
  TILES,
  VIEW_COLS,
  VIEW_ROWS,
} from './constants.js';
import { drawPixelText } from './pixelfont.js';
import { getTileId, inBounds, isProtectionZone } from './world.js';

let lmCanvas = null;
let lmCtx = null;

function getLightmapLayer(gw, gh) {
  if (!lmCanvas && typeof document !== 'undefined') {
    lmCanvas = document.createElement('canvas');
    lmCanvas.width = gw;
    lmCanvas.height = gh;
    lmCtx = lmCanvas.getContext('2d');
  } else if (lmCanvas && (lmCanvas.width !== gw || lmCanvas.height !== gh)) {
    lmCanvas.width = gw;
    lmCanvas.height = gh;
  }
  return { lmCanvas, lmCtx };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function getInterpPos(entity) {
  const t = Math.min(1, Math.max(0, entity.moveProgress));
  return {
    x: lerp(entity.fromX, entity.x, t),
    y: lerp(entity.fromY, entity.y, t),
  };
}

function hpBarColor(ratio) {
  if (ratio > 0.6) return '#00bf00';
  if (ratio > 0.3) return '#c0c000';
  if (ratio > 0.15) return '#e06b00';
  return '#cf1d1d';
}

/**
 * Resolves underlying floor tile beneath walls, props, and structures so interiors
 * meet South/East thin walls seamlessly without grass slivers.
 */
function resolveGroundTileId(world, z, tx, ty, tileId) {
  if (tileId === 'SEWER_WALL') return 'SEWER_FLOOR';
  if (
    tileId === 'STONE_WALL' ||
    tileId === 'TREE' ||
    tileId === 'BUSH' ||
    tileId === 'CRATE' ||
    tileId === 'SIGN'
  ) {
    if (z === 1) return 'SEWER_FLOOR';
    // Interior floor meets South & East enclosing walls cleanly
    if (tx >= 11 && tx <= 17 && ty >= 12 && ty <= 17) return 'TEMPLE_FLOOR';
    if (tx >= 20 && tx <= 24 && ty >= 7 && ty <= 10) return 'WOOD_FLOOR';
    if (tx >= 18 && tx <= 23 && ty >= 12 && ty <= 16) return 'COBBLESTONE';
    return 'GRASS';
  }
  return tileId;
}

function isOpaqueAt(world, z, tx, ty) {
  if (!inBounds(tx, ty)) return false;
  return Boolean(TILES[getTileId(world, z, tx, ty)]?.opaque);
}

function isWallAt(world, z, tx, ty, wallType = 'STONE_WALL') {
  return inBounds(tx, ty) && getTileId(world, z, tx, ty) === wallType;
}

function isAllEnclosedSewerWall(world, z, tx, ty) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (!inBounds(tx + dx, ty + dy)) continue;
      if (getTileId(world, z, tx + dx, ty + dy) !== 'SEWER_WALL') return false;
    }
  }
  return true;
}

/**
 * Draws an extruded oblique wall prism [x1..x2] x [y1..y2] with 18px sandstone brick elevation
 * sheared (-6, -18) into true 45-degree Tibia perspective.
 */
function drawWallSlab(
  ctx,
  southFace,
  capH,
  capV,
  x1,
  y1,
  x2,
  y2,
  drawSouth,
  drawEast,
  isVert,
  borders = { n: true, s: true, w: true, e: true },
) {
  const ox = -6;
  const oy = -18;
  const w = x2 - x1;
  const h = y2 - y1;
  if (w <= 0 || h <= 0) return;

  // 1. Top masonry coping cap at (x1+ox, y1+oy)
  const capX = x1 + ox;
  const capY = y1 + oy;
  if (isVert && !drawSouth && w <= 12) {
    ctx.drawImage(capV, 0, Math.max(0, y1 % 32), w, h, capX, capY, w, h);
  } else {
    ctx.drawImage(capH, Math.max(0, x1 % 32), 0, w, Math.min(10, h), capX, capY, w, h);
  }
  // Stroke ONLY exposed exterior edges of top coping so connected walls join smoothly
  ctx.fillStyle = '#241f18';
  if (borders.n) ctx.fillRect(capX, capY, w, 1);
  if (borders.s) ctx.fillRect(capX, capY + h - 1, w, 1);
  if (borders.w) ctx.fillRect(capX, capY, 1, h);
  if (borders.e) ctx.fillRect(capX + w - 1, capY, 1, h);

  // 2. East oblique shaded face (parallelogram from top cap right edge to base right edge)
  if (drawEast) {
    ctx.save();
    ctx.fillStyle = '#5c5446';
    ctx.beginPath();
    ctx.moveTo(x2 + ox, y1 + oy);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + ox, y2 + oy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#241f18';
    ctx.stroke();

    // Subtle mortar lines along vertical height
    ctx.fillStyle = '#3d372d';
    for (let k = 4; k < 17; k += 5) {
      const lx = Math.round(x2 + ox * (1 - k / 18));
      const ly = Math.round(y1 + oy + k);
      ctx.fillRect(lx, ly, 2, h);
    }
    ctx.restore();
  }

  // 3. South front brick face: horizontal 3px sheared CC0 sandstone slices
  if (drawSouth) {
    const sliceOffset = Math.abs(x1) % 32;
    const drawW = Math.min(w, 32 - sliceOffset);
    for (let row = 0; row < 18; row += 3) {
      const frac = 1 - row / 18;
      const sxOff = Math.round(ox * frac);
      ctx.drawImage(
        southFace,
        sliceOffset,
        row,
        drawW,
        3,
        x1 + sxOff,
        y2 + oy + row,
        w,
        3,
      );
    }
    ctx.strokeStyle = '#211c16';
    ctx.beginPath();
    ctx.moveTo(x1 + ox, y2 + oy);
    ctx.lineTo(x1, y2);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 + ox, y2 + oy);
    ctx.stroke();
  }
}

/**
 * Draws connected thin architectural Tibia stone walls with doorways & corners.
 */
function drawStoneWallTile(ctx, atlas, world, z, tx, ty, sx, sy) {
  const n = isWallAt(world, z, tx, ty - 1);
  const s = isWallAt(world, z, tx, ty + 1);
  const w = isWallAt(world, z, tx - 1, ty);
  const e = isWallAt(world, z, tx + 1, ty);

  const variant = Math.abs(tx * 5 + ty * 11) % atlas.walls.southFaces.length;
  const southFace = atlas.walls.southFaces[variant];
  const { capH, capV } = atlas.walls;

  const hasHoriz = w || e || (!n && !s);
  const hasVert = n || s;

  // Draw vertical (North-South) wall strip along x+22..x+32
  if (hasVert) {
    const vy1 = !n && (w || e) ? sy + 22 : sy;
    const vy2 = sy + 32;
    drawWallSlab(ctx, southFace, capH, capV, sx + 22, vy1, sx + 32, vy2, !s, !e, true, {
      n: !n && !w,
      s: !s,
      w: true,
      e: !e,
    });
  }

  // Draw horizontal (East-West) wall strip along y+22..y+32
  if (hasHoriz) {
    const hx1 = !w && (n || s) ? sx + 22 : sx;
    const hx2 = sx + 32;
    const eastExposed = !e && !hasVert;
    drawWallSlab(ctx, southFace, capH, capV, hx1, sy + 22, hx2, sy + 32, true, eastExposed, false, {
      n: !n,
      s: true,
      w: !w && !n,
      e: !e,
    });
  }
}

/**
 * Draws weathered threshold trim & wooden archway posts on Temple / Outpost doorways.
 */
function drawDoorwayArchwayIfPresent(ctx, world, z, tx, ty, sx, sy, tileId) {
  if (z !== 0 || (tileId !== 'TEMPLE_FLOOR' && tileId !== 'WOOD_FLOOR')) return;
  const w = isWallAt(world, z, tx - 1, ty);
  const e = isWallAt(world, z, tx + 1, ty);
  const n = isWallAt(world, z, tx, ty - 1);
  const s = isWallAt(world, z, tx, ty + 1);

  if (w && e) {
    // Single South doorway (e.g., Outpost 21,10)
    ctx.fillStyle = '#5f584b';
    ctx.fillRect(sx, sy + 22, 32, 10);
    ctx.fillStyle = '#8b8272';
    ctx.fillRect(sx, sy + 23, 32, 8);
    ctx.fillStyle = '#4a2e16';
    ctx.fillRect(sx, sy + 12, 3, 20);
    ctx.fillRect(sx + 29, sy + 12, 3, 20);
  } else if (n && s) {
    // East/West Temple archway (10,14 / 17,14)
    ctx.fillStyle = '#5f584b';
    ctx.fillRect(sx + 22, sy, 10, 32);
    ctx.fillStyle = '#8b8272';
    ctx.fillRect(sx + 23, sy, 8, 32);
    ctx.fillStyle = '#4a2e16';
    ctx.fillRect(sx + 22, sy, 10, 3);
    ctx.fillRect(sx + 22, sy + 29, 10, 3);
  } else if ((w && !e && isWallAt(world, z, tx + 2, ty)) || (e && !w && isWallAt(world, z, tx - 2, ty))) {
    // Double Temple South archway threshold (13,17 & 14,17)
    ctx.fillStyle = '#5f584b';
    ctx.fillRect(sx, sy + 22, 32, 10);
    ctx.fillStyle = '#99907e';
    ctx.fillRect(sx, sy + 23, 32, 8);
  }
}

/**
 * Draws organic subterranean cavern walls & pillars surrounded by dark rock void on z=1.
 */
function drawSewerWallTile(ctx, atlas, world, z, tx, ty, sx, sy) {
  if (isAllEnclosedSewerWall(world, z, tx, ty)) return; // solid underground rock stays pitch black

  const openS = inBounds(tx, ty + 1) && getTileId(world, z, tx, ty + 1) !== 'SEWER_WALL';
  const openN = inBounds(tx, ty - 1) && getTileId(world, z, tx, ty - 1) !== 'SEWER_WALL';
  const openE = inBounds(tx + 1, ty) && getTileId(world, z, tx + 1, ty) !== 'SEWER_WALL';
  const openW = inBounds(tx - 1, ty) && getTileId(world, z, tx - 1, ty) !== 'SEWER_WALL';

  const variant = Math.abs(tx * 3 + ty * 7) % atlas.walls.sewerRocks.length;
  const rock = atlas.walls.sewerRocks[variant];

  // Draw rugged cavern cliff mass slightly elevated (-4, -8)
  ctx.drawImage(rock, sx - 2, sy - 6, 36, 38);

  // Darken interior sides blending seamlessly into deep rock void (#050608)
  if (!openN) {
    const gradN = ctx.createLinearGradient(0, sy - 6, 0, sy + 12);
    gradN.addColorStop(0, '#050608');
    gradN.addColorStop(1, 'rgba(5,6,8,0)');
    ctx.fillStyle = gradN;
    ctx.fillRect(sx - 2, sy - 6, 36, 18);
  }
  if (!openW) {
    const gradW = ctx.createLinearGradient(sx - 2, 0, sx + 12, 0);
    gradW.addColorStop(0, '#050608');
    gradW.addColorStop(1, 'rgba(5,6,8,0)');
    ctx.fillStyle = gradW;
    ctx.fillRect(sx - 2, sy - 6, 14, 38);
  }
  if (!openS) {
    const gradS = ctx.createLinearGradient(0, sy + 18, 0, sy + 32);
    gradS.addColorStop(0, 'rgba(5,6,8,0)');
    gradS.addColorStop(1, '#050608');
    ctx.fillStyle = gradS;
    ctx.fillRect(sx - 2, sy + 18, 36, 14);
  }
  if (!openE) {
    const gradE = ctx.createLinearGradient(sx + 18, 0, sx + 34, 0);
    gradE.addColorStop(0, 'rgba(5,6,8,0)');
    gradE.addColorStop(1, '#050608');
    ctx.fillStyle = gradE;
    ctx.fillRect(sx + 18, sy - 6, 16, 38);
  }

  // Exposed cavern rim drop-edge shadow on open sides
  if (openS) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(sx, sy + 29, 32, 3);
  }
  if (openE) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(sx + 30, sy, 2, 32);
  }
}

function drawAdditiveGlow(ctx, x, y, radius, rgb, alpha) {
  const grad = ctx.createRadialGradient(x, y, 2, x, y, radius);
  grad.addColorStop(0, `rgba(${rgb},${alpha})`);
  grad.addColorStop(0.55, `rgba(${rgb},${alpha * 0.35})`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Evaluates smooth vertex lightmap across the viewport and multiplies over the scene,
 * eliminating sharp circular spotlight boundaries.
 */
function applyTileVertexLightmap(ctx, world, player, effects, camX, camY, pPos, nowMs) {
  if (player.z !== 1) return;

  const gx0 = Math.floor(camX) - 1;
  const gy0 = Math.floor(camY) - 1;
  const gw = VIEW_COLS + 4;
  const gh = VIEW_ROWS + 4;
  const { lmCanvas: canvas, lmCtx: lCtx } = getLightmapLayer(gw, gh);
  if (!canvas || !lCtx) return;

  const flicker = Math.sin(nowMs * 0.009) * 0.25 + Math.cos(nowMs * 0.021) * 0.14;

  // Light emitters in tile coordinates
  const emitters = [
    { x: pPos.x + 0.5, y: pPos.y + 0.5, radius: 5.5 + flicker, color: [255, 228, 190], power: 1.0 },
  ];

  for (const light of world.lightSources || []) {
    if (light.z !== 1) continue;
    emitters.push({
      x: light.x + 0.5,
      y: light.y + 0.5,
      radius: (light.radius || 120) / TILE_SIZE + flicker * 0.7,
      color: light.warm ? [255, 190, 120] : [185, 215, 238],
      power: light.warm ? 0.85 : 0.42,
    });
  }

  for (const fx of effects) {
    if (fx.z !== 1) continue;
    if (fx.sprite === 'fire') {
      emitters.push({ x: fx.x + 0.5, y: fx.y + 0.5, radius: 3.1, color: [255, 145, 70], power: 0.7 });
    } else if (fx.sprite === 'heal') {
      emitters.push({ x: fx.x + 0.5, y: fx.y + 0.5, radius: 3.0, color: [115, 210, 255], power: 0.7 });
    }
  }

  const imgData = lCtx.createImageData(gw, gh);
  const d = imgData.data;

  for (let vy = 0; vy < gh; vy++) {
    const wy = gy0 + vy;
    for (let vx = 0; vx < gw; vx++) {
      const wx = gx0 + vx;
      let r = 18;
      let g = 21;
      let b = 32;

      for (const em of emitters) {
        const dist = Math.hypot(wx - em.x, wy - em.y);
        if (dist >= em.radius) continue;
        const t = 1 - dist / em.radius;
        const falloff = t * t * (3 - 2 * t) * em.power;
        r += em.color[0] * falloff;
        g += em.color[1] * falloff;
        b += em.color[2] * falloff;
      }

      // Soft highlight shoulder prevents multi-light overlap from blowing out white
      const softCap = (v) => Math.min(244, Math.round(250 * (1 - Math.exp(-v / 175))));
      const idx = (vy * gw + vx) * 4;
      d[idx] = softCap(r);
      d[idx + 1] = softCap(g);
      d[idx + 2] = softCap(b);
      d[idx + 3] = 255;
    }
  }

  lCtx.putImageData(imgData, 0, 0);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.globalCompositeOperation = 'multiply';
  const drawX = (gx0 - camX) * TILE_SIZE - TILE_SIZE / 2;
  const drawY = (gy0 - camY) * TILE_SIZE - TILE_SIZE / 2;
  ctx.drawImage(canvas, drawX, drawY, gw * TILE_SIZE, gh * TILE_SIZE);
  ctx.restore();
  return emitters;
}

/**
 * Maps pixel coordinates on the main canvas to world tile coordinates (tx, ty).
 */
export function screenToWorldTile(player, canvasX, canvasY) {
  const p = getInterpPos(player);
  const camX = p.x - Math.floor(VIEW_COLS / 2);
  const camY = p.y - Math.floor(VIEW_ROWS / 2);
  return {
    tx: Math.floor(camX + canvasX / TILE_SIZE),
    ty: Math.floor(camY + canvasY / TILE_SIZE),
  };
}

/**
 * Renders the 15x11 oblique game viewport.
 */
export function renderViewport(ctx, game, atlas, nowMs, hoverTile = null) {
  const { player, world, effects, floatingTexts } = game;
  const pPos = getInterpPos(player);

  const camX = pPos.x - Math.floor(VIEW_COLS / 2);
  const camY = pPos.y - Math.floor(VIEW_ROWS / 2);

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const minX = Math.floor(camX) - 1;
  const maxX = Math.ceil(camX) + VIEW_COLS + 1;
  const minY = Math.floor(camY) - 1;
  const maxY = Math.ceil(camY) + VIEW_ROWS + 2;
  const waterFrame = Math.floor(nowMs / 430) % 3;
  const torchFrame = Math.floor(nowMs / 180) % 2;

  const neighborOffsets = [
    ['N', 0, -1],
    ['E', 1, 0],
    ['S', 0, 1],
    ['W', -1, 0],
  ];

  // PASS 1: Ground tiles, wildflower accents, auto-tiled borders, cast shadows, decals, corpses
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!inBounds(tx, ty)) continue;

      const sx = Math.round((tx - camX) * TILE_SIZE);
      const sy = Math.round((ty - camY) * TILE_SIZE);
      const tileId = getTileId(world, player.z, tx, ty);

      // Pure underground rock void tiles stay dark pitch black without rendering floor under them
      if (tileId === 'SEWER_WALL' && isAllEnclosedSewerWall(world, player.z, tx, ty)) {
        ctx.fillStyle = '#050608';
        ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
        continue;
      }

      const groundId = resolveGroundTileId(world, player.z, tx, ty, tileId);

      let sprite;
      if (groundId === 'WATER') {
        sprite = atlas.ground.WATER[waterFrame];
      } else if (groundId === 'TEMPLE_FLOOR' && tx >= 13 && tx <= 14 && ty >= 13 && ty <= 14) {
        sprite = atlas.ground.TEMPLE_CENTER; // Mosaic sanctuary emblem
      } else {
        const variants = atlas.ground[groundId] || atlas.ground.GRASS;
        sprite = variants[Math.abs(tx * 7 + ty * 13) % variants.length];
      }
      ctx.drawImage(sprite, sx, sy);

      // Occasional wildflower accents on open grass meadows
      if (tileId === 'GRASS' && ((tx * 17 + ty * 31) % 11 === 0)) {
        const flower = atlas.ground.FLOWERS[Math.abs(tx + ty) % atlas.ground.FLOWERS.length];
        ctx.drawImage(flower, sx, sy);
      }

      drawDoorwayArchwayIfPresent(ctx, world, player.z, tx, ty, sx, sy, tileId);

      // Organic grass tufts creeping over adjacent trails/cobblestone
      if (groundId === 'DIRT' || groundId === 'COBBLESTONE') {
        for (const [dir, dx, dy] of neighborOffsets) {
          if (inBounds(tx + dx, ty + dy) && getTileId(world, player.z, tx + dx, ty + dy) === 'GRASS') {
            ctx.drawImage(atlas.edges.grassOnPath[dir], sx, sy);
          }
        }
      }

      // Water shorelines
      if (groundId === 'WATER') {
        const shoreSet = player.z === 1 ? atlas.edges.shoreSewer : atlas.edges.shoreSurface;
        for (const [dir, dx, dy] of neighborOffsets) {
          if (!inBounds(tx + dx, ty + dy)) continue;
          const nId = getTileId(world, player.z, tx + dx, ty + dy);
          if (nId !== 'WATER' && nId !== 'BRIDGE') {
            ctx.drawImage(shoreSet[dir], sx, sy);
          }
        }
      }

      // Oblique cast shadows from opaque walls & trees onto walkable tiles
      if (!isOpaqueAt(world, player.z, tx, ty)) {
        const northOpaque = isOpaqueAt(world, player.z, tx, ty - 1);
        const westOpaque = isOpaqueAt(world, player.z, tx - 1, ty);
        if (northOpaque) ctx.drawImage(atlas.edges.shadowSouth, sx, sy);
        if (westOpaque) ctx.drawImage(atlas.edges.shadowEast, sx, sy);
        if (!northOpaque && !westOpaque && isOpaqueAt(world, player.z, tx - 1, ty - 1)) {
          ctx.drawImage(atlas.edges.shadowCorner, sx, sy);
        }
      }

      // Blood decals
      for (const decal of world.bloodDecals) {
        if (decal.z === player.z && decal.x === tx && decal.y === ty) {
          ctx.drawImage(atlas.items.blood_decal, sx, sy);
          break;
        }
      }

      // Corpses
      const corpse = world.corpses.find((c) => c.z === player.z && c.x === tx && c.y === ty);
      if (corpse && atlas.items[corpse.sprite]) {
        ctx.drawImage(atlas.items[corpse.sprite], sx, sy);
      }
    }
  }

  // Click-to-walk destination indicator
  if (player.walkQueue.length > 0) {
    const dest = player.walkQueue[player.walkQueue.length - 1];
    const dx = Math.round((dest.x - camX) * TILE_SIZE);
    const dy = Math.round((dest.y - camY) * TILE_SIZE);
    ctx.strokeStyle = 'rgba(255, 232, 102, 0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + 3, dy + 3, TILE_SIZE - 6, TILE_SIZE - 6);
  }

  // Hover reticle
  if (hoverTile && inBounds(hoverTile.tx, hoverTile.ty)) {
    const hx = Math.round((hoverTile.tx - camX) * TILE_SIZE);
    const hy = Math.round((hoverTile.ty - camY) * TILE_SIZE);
    ctx.strokeStyle = game.lookMode ? 'rgba(92, 230, 120, 0.9)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 1, hy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }

  // Bucket living actors by rounded sort tile
  const actorBuckets = new Map();
  const pushActor = (actor, isPlayer = false) => {
    const pos = getInterpPos(actor);
    const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
    if (!actorBuckets.has(key)) actorBuckets.set(key, []);
    actorBuckets.get(key).push({ actor, pos, isPlayer });
  };

  pushActor(player, true);
  for (const creature of world.creatures) {
    if (creature.alive && creature.z === player.z) {
      pushActor(creature, false);
    }
  }

  const labelDrawList = [];

  // PASS 2: Architectural thin walls, cavern rocks, tall 64x64 trees, torches, chests, and actors in strict y -> x order
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const sx = Math.round((tx - camX) * TILE_SIZE);
      const sy = Math.round((ty - camY) * TILE_SIZE);

      if (inBounds(tx, ty)) {
        const tileId = getTileId(world, player.z, tx, ty);
        if (tileId === 'TREE') {
          const tVar = atlas.structures.TREES[Math.abs(tx * 5 + ty * 9) % atlas.structures.TREES.length];
          ctx.drawImage(tVar, sx - 16, sy - 32);
        } else if (tileId === 'STONE_WALL') {
          drawStoneWallTile(ctx, atlas, world, player.z, tx, ty, sx, sy);
        } else if (tileId === 'SEWER_WALL') {
          drawSewerWallTile(ctx, atlas, world, player.z, tx, ty, sx, sy);
        } else if (tileId === 'SEWER_GRATE' || tileId === 'LADDER') {
          ctx.drawImage(atlas.structures[tileId], sx, sy);
        } else if (atlas.structures[tileId]) {
          ctx.drawImage(atlas.structures[tileId], sx - 4, sy - 6);
        }

        // Wall-mounted flickering torches
        const wallTorch = world.lightSources?.find(
          (l) => l.z === player.z && l.x === tx && l.y === ty && l.warm,
        );
        if (wallTorch) {
          ctx.drawImage(atlas.structures.TORCH[torchFrame], sx + 8, sy + 12);
        }

        const chest = world.chests.find((c) => c.z === player.z && c.x === tx && c.y === ty);
        if (chest) {
          ctx.drawImage(atlas.structures.CHEST, sx - 2, sy - 6);
        }
      }

      const bucket = actorBuckets.get(`${tx},${ty}`);
      if (bucket) {
        for (const entry of bucket) {
          const { actor, pos, isPlayer } = entry;
          const ax = Math.round((pos.x - camX) * TILE_SIZE);
          const ay = Math.round((pos.y - camY) * TILE_SIZE);

          if (!isPlayer && player.targetId === actor.id) {
            ctx.strokeStyle = '#ff2b2b';
            ctx.lineWidth = 2;
            ctx.strokeRect(ax + 1, ay + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          }

          const actorSet = isPlayer
            ? atlas.getPlayerActorSet(player.equipment)
            : atlas.actors[actor.templateId];
          if (actorSet) {
            const dirFrames = actorSet.frames[actor.facing] || actorSet.frames.S;
            const frame = actor.moveProgress < 1 ? (Math.floor(nowMs / 100) % 2) : 0;
            ctx.drawImage(dirFrames[frame], ax, ay - 6);

            if (actor.hitFlashMs > 0) {
              const flashFrames = actorSet.flash[actor.facing] || actorSet.flash.S;
              ctx.drawImage(flashFrames[frame], ax, ay - 6);
            }
          }

          labelDrawList.push({ actor, pos, ax, ay, isPlayer });
        }
      }
    }
  }

  // PASS 3: Multi-frame animated visual effects
  for (const fx of effects) {
    if (fx.z !== player.z) continue;
    const fxX = Math.round((fx.x - camX) * TILE_SIZE);
    const fxY = Math.round((fx.y - camY) * TILE_SIZE);
    const vfxFrame = Math.min(2, Math.floor((fx.elapsedMs / fx.durationMs) * 3));
    const sprite = atlas.items[`vfx_${fx.sprite}_${vfxFrame}`];
    if (sprite) {
      ctx.globalAlpha = Math.max(0.35, 1 - (fx.elapsedMs / fx.durationMs) * 0.55);
      ctx.drawImage(sprite, fxX, fxY - 4);
      ctx.globalAlpha = 1;
    }
  }

  // PASS 4: Tile-vertex bilinear lightmap (z=1) & warm torch/spell glow halos
  const emitters = applyTileVertexLightmap(ctx, world, player, effects, camX, camY, pPos, nowMs) || [];

  const flicker = Math.sin(nowMs * 0.0085) * 4 + Math.cos(nowMs * 0.019) * 2;
  const playerScreenX = Math.round((pPos.x - camX) * TILE_SIZE + 16);
  const playerScreenY = Math.round((pPos.y - camY) * TILE_SIZE + 14);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (player.z === 1) {
    drawAdditiveGlow(ctx, playerScreenX, playerScreenY, 88 + flicker, '255,165,65', 0.09);
  }
  for (const light of world.lightSources || []) {
    if (light.z !== player.z) continue;
    const lx = Math.round((light.x - camX) * TILE_SIZE + 16);
    const ly = Math.round((light.y - camY) * TILE_SIZE + 18);
    if (light.warm) {
      drawAdditiveGlow(ctx, lx, ly, 58 + flicker * 0.5, '255,155,55', player.z === 1 ? 0.12 : 0.07);
    }
  }
  for (const fx of effects) {
    if (fx.z !== player.z) continue;
    const fxX = Math.round((fx.x - camX) * TILE_SIZE + 16);
    const fxY = Math.round((fx.y - camY) * TILE_SIZE + 14);
    if (fx.sprite === 'fire') {
      drawAdditiveGlow(ctx, fxX, fxY, 40, '255,120,30', 0.16);
    } else if (fx.sprite === 'heal') {
      drawAdditiveGlow(ctx, fxX, fxY, 42, '70,185,255', 0.16);
    }
  }
  ctx.restore();

  // PASS 5: Sharp 1px-outlined bitmap names, HP bars, floating combat/speech text
  for (const item of labelDrawList) {
    const { actor, pos, ax, ay, isPlayer } = item;
    if (player.z === 1 && !isPlayer) {
      const lit = emitters.some(
        (em) => Math.hypot(pos.x + 0.5 - em.x, pos.y + 0.5 - em.y) < em.radius * 0.9,
      );
      if (!lit) continue;
    }
    const centerX = ax + 16;
    const barY = ay - 10;
    const ratio = actor.maxHp > 0 ? actor.hp / actor.maxHp : 1;
    const barW = 28;
    const barX = centerX - Math.floor(barW / 2);

    const nameColor = actor.isNpc ? '#6de0ff' : isPlayer ? '#73ff73' : '#e6ebe0';
    drawPixelText(ctx, actor.name, centerX, barY - 2, nameColor, 'center', 'bottom');

    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, 5);
    ctx.fillStyle = '#242424';
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = actor.isNpc ? '#4bc9f5' : hpBarColor(ratio);
    ctx.fillRect(barX, barY, Math.max(1, Math.round(barW * ratio)), 3);
  }

  for (const ft of floatingTexts) {
    if (ft.z !== player.z) continue;
    const progress = ft.elapsedMs / ft.durationMs;
    const tx = Math.round((ft.x - camX) * TILE_SIZE) + 16;
    const ty = Math.round((ft.y - camY) * TILE_SIZE) - 16 - Math.round(progress * 18);
    ctx.globalAlpha = Math.max(0, 1 - Math.max(0, progress - 0.65) / 0.35);
    drawPixelText(ctx, ft.text, tx, ty, ft.color, 'center', 'bottom');
    ctx.globalAlpha = 1;
  }

  if (isProtectionZone(player.z, player.x, player.y)) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(6, 6, 28, 15);
    ctx.strokeStyle = '#d9b54a';
    ctx.lineWidth = 1;
    ctx.strokeRect(6.5, 6.5, 27, 14);
    drawPixelText(ctx, 'PZ', 20, 14, '#ffe57f', 'center', 'middle');
  }
}

/**
 * Renders the 112x112 auto-exploring minimap centered on the player.
 */
export function renderMinimap(ctx, game) {
  const { player, world } = game;
  const size = 112;
  const scale = 3;
  const halfTiles = Math.floor(size / (scale * 2));

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#09090b';
  ctx.fillRect(0, 0, size, size);

  const explored = world.explored[player.z];
  const centerPx = Math.floor(size / 2);

  for (let dy = -halfTiles; dy <= halfTiles; dy++) {
    for (let dx = -halfTiles; dx <= halfTiles; dx++) {
      const tx = player.x + dx;
      const ty = player.y + dy;
      if (!inBounds(tx, ty) || !explored[ty][tx]) continue;

      const tileId = getTileId(world, player.z, tx, ty);
      const tile = TILES[tileId];
      ctx.fillStyle = tile ? tile.minimapColor : '#333333';
      ctx.fillRect(centerPx + dx * scale - 1, centerPx + dy * scale - 1, scale, scale);
    }
  }

  for (const c of world.creatures) {
    if (!c.alive || c.z !== player.z) continue;
    const dx = c.x - player.x;
    const dy = c.y - player.y;
    if (Math.abs(dx) > halfTiles || Math.abs(dy) > halfTiles) continue;
    if (!explored[c.y]?.[c.x]) continue;
    ctx.fillStyle = c.isNpc ? '#5cd6ff' : '#ff3b3b';
    ctx.fillRect(centerPx + dx * scale - 1, centerPx + dy * scale - 1, scale, scale);
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerPx - 3, centerPx - 1, 7, 2);
  ctx.fillRect(centerPx - 1, centerPx - 3, 2, 7);
}
