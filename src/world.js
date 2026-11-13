/**
 * Two-floor Rookgaard map generator (Surface z=0 & Rat Sewer z=1),
 * tile/protection-zone queries, minimap fog-of-war, and BFS pathfinding.
 */

import { MAP_HEIGHT, MAP_WIDTH, TILES } from './constants.js';
import { createCreature, createWorldChest } from './entities.js';

/**
 * Helper to create a 2D array filled with `fillTileId`.
 */
function createGrid(fillTileId) {
  return Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(fillTileId));
}

/**
 * Helper to fill a rectangular region on a tile grid.
 */
function fillRect(grid, x1, y1, x2, y2, tileId) {
  for (let y = Math.max(0, y1); y <= Math.min(MAP_HEIGHT - 1, y2); y++) {
    for (let x = Math.max(0, x1); x <= Math.min(MAP_WIDTH - 1, x2); x++) {
      grid[y][x] = tileId;
    }
  }
}

/**
 * Helper to stroke a 1-tile rectangular border on a tile grid.
 */
function strokeRect(grid, x1, y1, x2, y2, tileId) {
  for (let x = x1; x <= x2; x++) {
    if (y1 >= 0 && y1 < MAP_HEIGHT) grid[y1][x] = tileId;
    if (y2 >= 0 && y2 < MAP_HEIGHT) grid[y2][x] = tileId;
  }
  for (let y = y1; y <= y2; y++) {
    if (x1 >= 0 && x1 < MAP_WIDTH) grid[y][x1] = tileId;
    if (x2 >= 0 && x2 < MAP_WIDTH) grid[y][x2] = tileId;
  }
}

/**
 * Builds the 2-floor Rookgaard vertical slice world.
 */
export function createWorld() {
  const floor0 = createGrid('GRASS');
  const floor1 = createGrid('SEWER_WALL');

  // --- FLOOR 0: ROOKGAARD SURFACE ---
  strokeRect(floor0, 0, 0, MAP_WIDTH - 1, MAP_HEIGHT - 1, 'TREE');

  // Scenic river running across y=20..21 with wooden bridge at x=13..15
  fillRect(floor0, 1, 20, MAP_WIDTH - 2, 21, 'WATER');
  fillRect(floor0, 13, 20, 15, 21, 'BRIDGE');

  // Dirt paths in wilderness
  fillRect(floor0, 13, 18, 15, 19, 'DIRT');
  fillRect(floor0, 13, 22, 15, 25, 'DIRT');
  fillRect(floor0, 5, 14, 9, 14, 'DIRT');
  fillRect(floor0, 24, 14, 30, 14, 'DIRT');
  fillRect(floor0, 29, 6, 30, 14, 'DIRT');

  // Rookgaard Temple (Protection Zone x:11..16, y:12..16)
  strokeRect(floor0, 10, 11, 17, 17, 'STONE_WALL');
  fillRect(floor0, 11, 12, 16, 16, 'TEMPLE_FLOOR');
  // Temple entrances (West, East, South)
  floor0[14][10] = 'TEMPLE_FLOOR';
  floor0[14][17] = 'TEMPLE_FLOOR';
  floor0[17][13] = 'TEMPLE_FLOOR';
  floor0[17][14] = 'TEMPLE_FLOOR';

  // Town Square paving & Sewer Grate
  fillRect(floor0, 18, 12, 23, 16, 'COBBLESTONE');
  floor0[14][21] = 'SEWER_GRATE';

  // Small Town Outpost Building (north of square)
  strokeRect(floor0, 19, 6, 24, 10, 'STONE_WALL');
  fillRect(floor0, 20, 7, 23, 9, 'WOOD_FLOOR');
  floor0[10][21] = 'WOOD_FLOOR'; // doorway south
  floor0[8][20] = 'CRATE';
  floor0[7][23] = 'CRATE';

  // Decorative crates & signposts
  floor0[12][18] = 'CRATE';
  floor0[16][18] = 'CRATE';
  floor0[13][18] = 'SIGN';
  floor0[13][20] = 'SIGN';

  // Forest clusters (avoiding paths and clearings)
  const treeCoords = [
    [3, 3], [4, 3], [7, 4], [8, 4], [11, 4], [14, 3], [16, 5], [27, 3], [33, 4],
    [3, 8], [5, 9], [7, 10], [3, 17], [5, 18], [8, 17], [27, 17], [32, 17],
    [4, 24], [7, 25], [20, 24], [26, 25], [31, 24], [33, 22],
  ];
  for (const [tx, ty] of treeCoords) {
    floor0[ty][tx] = 'TREE';
  }

  const bushCoords = [
    [5, 5], [9, 6], [12, 7], [16, 8], [26, 6], [32, 8],
    [4, 12], [6, 16], [26, 12], [28, 16], [10, 23], [18, 23], [29, 23],
  ];
  for (const [bx, by] of bushCoords) {
    floor0[by][bx] = 'BUSH';
  }

  // --- FLOOR 1: RAT SEWER ---
  // Entry chamber around ladder (21, 14)
  fillRect(floor1, 18, 12, 24, 16, 'SEWER_FLOOR');
  floor1[14][21] = 'LADDER';

  // West corridor & flooded canal room
  fillRect(floor1, 13, 13, 17, 15, 'SEWER_FLOOR');
  fillRect(floor1, 5, 5, 13, 16, 'SEWER_FLOOR');
  // Canal running N-S inside west chamber with 2 bridges
  fillRect(floor1, 9, 6, 10, 15, 'WATER');
  fillRect(floor1, 9, 9, 10, 9, 'BRIDGE');
  fillRect(floor1, 9, 14, 10, 14, 'BRIDGE');

  // East corridor & deep Cave Rat rooms
  fillRect(floor1, 25, 13, 28, 15, 'SEWER_FLOOR');
  fillRect(floor1, 27, 5, 32, 16, 'SEWER_FLOOR');
  fillRect(floor1, 27, 17, 32, 23, 'SEWER_FLOOR');

  // South connecting sewer loop
  fillRect(floor1, 12, 20, 26, 22, 'SEWER_FLOOR');
  fillRect(floor1, 11, 17, 13, 21, 'SEWER_FLOOR');

  // Sewer pillars / obstacles
  floor1[8][7] = 'SEWER_WALL';
  floor1[12][7] = 'SEWER_WALL';
  floor1[10][29] = 'SEWER_WALL';
  floor1[19][29] = 'SEWER_WALL';
  floor1[12][19] = 'CRATE';
  floor1[16][23] = 'CRATE';

  const floors = [floor0, floor1];

  // Fog-of-war explored tracking per floor
  const explored = [
    Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false)),
    Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(false)),
  ];

  // Signpost messages keyed by "z,x,y"
  const signs = {
    '0,18,13': 'You read: <- Rookgaard Temple (Protection Zone) | -> Town Square & Sewer',
    '0,20,13': 'You read: Danger! Rat Sewer below. Step on the grate or click to descend.',
  };

  // Floor transition portals keyed by "z,x,y"
  const portals = {
    '0,21,14': { z: 1, x: 21, y: 14, message: 'You descend into the damp Rat Sewer.' },
    '1,21,14': { z: 0, x: 21, y: 14, message: 'You climb back up to Rookgaard surface.' },
  };

  // Creatures (Surface + Sewer)
  const creatures = [
    // Temple NPC
    createCreature('npc_cipfried', 13, 13, 0),

    // Surface outskirts rats & spiders
    createCreature('rat', 16, 23, 0),
    createCreature('rat', 25, 15, 0),
    createCreature('rat', 23, 24, 0),
    createCreature('spider', 6, 6, 0),
    createCreature('spider', 6, 23, 0),
    createCreature('spider', 28, 7, 0),
    createCreature('spider', 31, 13, 0),

    // Sewer Rats & Cave Rats (z = 1)
    createCreature('rat', 19, 14, 1),
    createCreature('rat', 23, 13, 1),
    createCreature('rat', 12, 12, 1),
    createCreature('rat', 7, 13, 1),
    createCreature('rat', 6, 7, 1),
    createCreature('cave_rat', 12, 6, 1),
    createCreature('cave_rat', 29, 7, 1),
    createCreature('cave_rat', 30, 14, 1),
    createCreature('cave_rat', 29, 21, 1),
    createCreature('cave_rat', 18, 21, 1),
  ];

  // Interactive treasure chests
  const chests = [
    createWorldChest('Wooden Chest', 31, 5, 0, [
      { itemId: 'brass_helmet', count: 1 },
      { itemId: 'meat', count: 2 },
      { itemId: 'gold_coin', count: 10 },
    ]),
    createWorldChest('Sewer Treasure Chest', 31, 22, 1, [
      { itemId: 'short_sword', count: 1 },
      { itemId: 'health_potion', count: 2 },
      { itemId: 'gold_coin', count: 25 },
    ]),
  ];

  // Wall-mounted torch sconces for atmospheric lighting
  const lightSources = [
    { z: 0, x: 12, y: 11, radius: 135, warm: true },
    { z: 0, x: 15, y: 11, radius: 135, warm: true },
    { z: 0, x: 20, y: 10, radius: 120, warm: true },
    { z: 1, x: 19, y: 11, radius: 125, warm: true },
    { z: 1, x: 23, y: 11, radius: 125, warm: true },
    { z: 1, x: 21, y: 14, radius: 105, warm: false },
  ];

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    floors,
    explored,
    signs,
    portals,
    creatures,
    chests,
    lightSources,
    corpses: [],
    bloodDecals: [],
  };
}

/**
 * Checks whether (x, y) is inside map bounds.
 */
export function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < MAP_WIDTH && y < MAP_HEIGHT;
}

/**
 * Returns the tile ID at (z, x, y), or 'STONE_WALL' if out of bounds.
 */
export function getTileId(world, z, x, y) {
  if (!inBounds(x, y) || !world.floors[z]) return 'STONE_WALL';
  return world.floors[z][y][x];
}

/**
 * Returns true if (z, x, y) is inside the Rookgaard Temple Protection Zone.
 */
export function isProtectionZone(z, x, y) {
  return z === 0 && x >= 11 && x <= 16 && y >= 12 && y <= 16;
}

/**
 * Checks whether an entity can walk onto tile (z, x, y).
 */
export function isTileWalkable(world, z, x, y, player, ignoreActorId = null) {
  if (!inBounds(x, y)) return false;
  const tile = TILES[getTileId(world, z, x, y)];
  if (!tile || !tile.walkable) return false;

  // Chest tiles act like solid obstacles
  if (world.chests.some((c) => c.z === z && c.x === x && c.y === y)) {
    return false;
  }

  if (player && ignoreActorId !== 'player' && player.z === z && player.x === x && player.y === y) {
    return false;
  }

  for (const creature of world.creatures) {
    if (!creature.alive || creature.z !== z || creature.id === ignoreActorId) continue;
    if (creature.x === x && creature.y === y) return false;
  }

  return true;
}

/**
 * Reveals minimap tiles around (x, y) on floor `z`.
 */
export function revealFog(world, z, x, y, radius = 8) {
  const grid = world.explored[z];
  if (!grid) return;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny) && dx * dx + dy * dy <= radius * radius + 2) {
        grid[ny][nx] = true;
      }
    }
  }
}

/**
 * Finds the shortest path on floor `z` using BFS with 8 directions and corner-cut safety.
 * Returns an array of `{ x, y }` steps excluding the start tile.
 */
export function findPath(world, z, startX, startY, goalX, goalY, player, ignoreActorId = null, maxNodes = 450) {
  if (startX === goalX && startY === goalY) return [];
  if (!isTileWalkable(world, z, goalX, goalY, player, ignoreActorId)) return [];

  const queue = [{ x: startX, y: startY }];
  const visited = new Set([`${startX},${startY}`]);
  const parent = new Map();

  const dirs = [
    { dx: 0, dy: -1, diag: false },
    { dx: 1, dy: 0, diag: false },
    { dx: 0, dy: 1, diag: false },
    { dx: -1, dy: 0, diag: false },
    { dx: 1, dy: -1, diag: true },
    { dx: 1, dy: 1, diag: true },
    { dx: -1, dy: 1, diag: true },
    { dx: -1, dy: -1, diag: true },
  ];

  let head = 0;
  let found = false;

  while (head < queue.length && visited.size < maxNodes) {
    const cur = queue[head++];
    if (cur.x === goalX && cur.y === goalY) {
      found = true;
      break;
    }

    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;

      if (!isTileWalkable(world, z, nx, ny, player, ignoreActorId)) continue;

      // Prevent diagonal corner cutting through solid tiles
      if (d.diag) {
        const sideA = TILES[getTileId(world, z, cur.x + d.dx, cur.y)]?.walkable;
        const sideB = TILES[getTileId(world, z, cur.x, cur.y + d.dy)]?.walkable;
        if (!sideA || !sideB) continue;
      }

      visited.add(key);
      parent.set(key, cur);
      queue.push({ x: nx, y: ny });
    }
  }

  if (!found) return [];

  const path = [];
  let stepKey = `${goalX},${goalY}`;
  let cur = { x: goalX, y: goalY };
  while (cur.x !== startX || cur.y !== startY) {
    path.push(cur);
    cur = parent.get(stepKey);
    if (!cur) break;
    stepKey = `${cur.x},${cur.y}`;
  }
  path.reverse();
  return path;
}

/**
 * Returns classic green "You see ..." text for inspecting any tile.
 */
export function getLookText(world, player, z, x, y) {
  if (!inBounds(x, y)) return 'You see nothing of note.';

  if (player.z === z && player.x === x && player.y === y) {
    return `You see yourself. You are an adventurer (Level ${player.level}).`;
  }

  const creature = world.creatures.find(
    (c) => c.alive && c.z === z && c.x === x && c.y === y,
  );
  if (creature) {
    return `You see ${creature.look}.`;
  }

  const chest = world.chests.find((c) => c.z === z && c.x === x && c.y === y);
  if (chest) {
    return chest.opened
      ? `You see an empty ${chest.name.toLowerCase()}.`
      : `You see a ${chest.name.toLowerCase()}. Click it when adjacent to open.`;
  }

  const corpse = world.corpses.find((c) => c.z === z && c.x === x && c.y === y);
  if (corpse) {
    const count = corpse.items.length;
    return count > 0
      ? `You see ${corpse.name.toLowerCase()}. Click to inspect its loot.`
      : `You see an empty ${corpse.name.toLowerCase()}.`;
  }

  const signKey = `${z},${x},${y}`;
  if (world.signs[signKey]) {
    return world.signs[signKey];
  }

  const tile = TILES[getTileId(world, z, x, y)];
  const pzTag = isProtectionZone(z, x, y) ? ' (Protection Zone)' : '';
  return `You see ${tile ? tile.look : 'terrain'}.${pzTag}`;
}
