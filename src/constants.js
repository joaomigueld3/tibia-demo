/**
 * Core constants, enums, item catalog, creature templates, and spell configs
 * for the classic Tibia browser demo (Rookgaard vertical slice).
 */

export const VIEW_COLS = 15;
export const VIEW_ROWS = 11;
export const TILE_SIZE = 32;
export const OBLIQUE_OFFSET = 8;

export const CANVAS_WIDTH = VIEW_COLS * TILE_SIZE;  // 480
export const CANVAS_HEIGHT = VIEW_ROWS * TILE_SIZE; // 352

export const MAP_WIDTH = 36;
export const MAP_HEIGHT = 28;
export const MAX_BACKPACK_SLOTS = 12;

export const CARDINALS = {
  N: { dx: 0, dy: -1 },
  E: { dx: 1, dy: 0 },
  S: { dx: 0, dy: 1 },
  W: { dx: -1, dy: 0 },
};

export const TILES = {
  GRASS: {
    id: 'GRASS',
    walkable: true,
    opaque: false,
    minimapColor: '#3a7a22',
    look: 'grass',
  },
  COBBLESTONE: {
    id: 'COBBLESTONE',
    walkable: true,
    opaque: false,
    minimapColor: '#8d8b84',
    look: 'cobblestone paving',
  },
  TEMPLE_FLOOR: {
    id: 'TEMPLE_FLOOR',
    walkable: true,
    opaque: false,
    minimapColor: '#cfc2a6',
    look: 'sanctified temple marble',
  },
  WOOD_FLOOR: {
    id: 'WOOD_FLOOR',
    walkable: true,
    opaque: false,
    minimapColor: '#8c5a32',
    look: 'wooden planks',
  },
  DIRT: {
    id: 'DIRT',
    walkable: true,
    opaque: false,
    minimapColor: '#7b5d3b',
    look: 'packed earth',
  },
  SEWER_FLOOR: {
    id: 'SEWER_FLOOR',
    walkable: true,
    opaque: false,
    minimapColor: '#56585c',
    look: 'damp sewer stone',
  },
  BRIDGE: {
    id: 'BRIDGE',
    walkable: true,
    opaque: false,
    minimapColor: '#a6713d',
    look: 'a wooden bridge',
  },
  WATER: {
    id: 'WATER',
    walkable: false,
    opaque: false,
    minimapColor: '#2466a8',
    look: 'deep water',
  },
  STONE_WALL: {
    id: 'STONE_WALL',
    walkable: false,
    opaque: true,
    minimapColor: '#b5b2aa',
    look: 'a stone wall',
  },
  SEWER_WALL: {
    id: 'SEWER_WALL',
    walkable: false,
    opaque: true,
    minimapColor: '#2c2d30',
    look: 'a damp sewer wall',
  },
  TREE: {
    id: 'TREE',
    walkable: false,
    opaque: true,
    minimapColor: '#1e5214',
    look: 'an oak tree',
  },
  BUSH: {
    id: 'BUSH',
    walkable: false,
    opaque: false,
    minimapColor: '#2a691b',
    look: 'a green bush',
  },
  CRATE: {
    id: 'CRATE',
    walkable: false,
    opaque: false,
    minimapColor: '#9b6a35',
    look: 'a wooden crate',
  },
  SIGN: {
    id: 'SIGN',
    walkable: false,
    opaque: false,
    minimapColor: '#cfa050',
    look: 'a wooden signpost',
  },
  SEWER_GRATE: {
    id: 'SEWER_GRATE',
    walkable: true,
    opaque: false,
    minimapColor: '#f2e04b',
    look: 'a sewer grate. Step onto it or click to descend into the Rat Sewer',
  },
  LADDER: {
    id: 'LADDER',
    walkable: true,
    opaque: false,
    minimapColor: '#f2e04b',
    look: 'a wooden ladder. Step onto it or click to climb up to Rookgaard',
  },
};

export const ITEMS = {
  gold_coin: {
    id: 'gold_coin',
    name: 'gold coin',
    plural: 'gold coins',
    stackable: true,
    maxStack: 100,
    description: 'Shiny Rookgaard currency.',
  },
  cheese: {
    id: 'cheese',
    name: 'cheese',
    plural: 'cheeses',
    stackable: true,
    maxStack: 20,
    foodTicks: 45,
    description: 'Click to eat. Feeds you for faster HP & Mana regeneration.',
  },
  meat: {
    id: 'meat',
    name: 'meat',
    plural: 'pieces of meat',
    stackable: true,
    maxStack: 20,
    foodTicks: 90,
    description: 'Click to eat. Hearty roast meat for sustained regeneration.',
  },
  health_potion: {
    id: 'health_potion',
    name: 'health potion',
    plural: 'health potions',
    stackable: true,
    maxStack: 20,
    healMin: 40,
    healMax: 65,
    description: 'Click to drink. Instantly restores 40-65 hitpoints.',
  },
  club: {
    id: 'club',
    name: 'club',
    slot: 'weapon',
    atk: 7,
    def: 4,
    stackable: false,
    description: 'A sturdy wooden club (Atk:7, Def:4).',
  },
  short_sword: {
    id: 'short_sword',
    name: 'short sword',
    slot: 'weapon',
    atk: 13,
    def: 9,
    stackable: false,
    description: 'A sharp steel short sword (Atk:13, Def:9).',
  },
  wooden_shield: {
    id: 'wooden_shield',
    name: 'wooden shield',
    slot: 'shield',
    atk: 0,
    def: 14,
    stackable: false,
    description: 'A reinforced wooden shield (Def:14).',
  },
  leather_armor: {
    id: 'leather_armor',
    name: 'leather armor',
    slot: 'armor',
    atk: 0,
    def: 4,
    stackable: false,
    description: 'Stitched leather tunic (Arm:4).',
  },
  brass_helmet: {
    id: 'brass_helmet',
    name: 'brass helmet',
    slot: 'helmet',
    atk: 0,
    def: 3,
    stackable: false,
    description: 'Polished brass helmet (Arm:3).',
  },
  leather_boots: {
    id: 'leather_boots',
    name: 'leather boots',
    slot: 'boots',
    atk: 0,
    def: 1,
    stackable: false,
    description: 'Worn adventurer boots (Arm:1).',
  },
};

export const CREATURE_TEMPLATES = {
  rat: {
    id: 'rat',
    name: 'Rat',
    maxHp: 20,
    xp: 5,
    minDmg: 1,
    maxDmg: 4,
    def: 2,
    speedMs: 420,
    aggroRange: 6,
    attackMs: 2000,
    respawnMs: 18000,
    corpseSprite: 'corpse_rat',
    look: 'a rat',
    loot: [
      { itemId: 'gold_coin', chance: 0.78, min: 1, max: 4 },
      { itemId: 'cheese', chance: 0.48, min: 1, max: 1 },
    ],
  },
  cave_rat: {
    id: 'cave_rat',
    name: 'Cave Rat',
    maxHp: 35,
    xp: 10,
    minDmg: 2,
    maxDmg: 7,
    def: 4,
    speedMs: 360,
    aggroRange: 7,
    attackMs: 2000,
    respawnMs: 22000,
    corpseSprite: 'corpse_rat',
    look: 'a cave rat',
    loot: [
      { itemId: 'gold_coin', chance: 0.88, min: 2, max: 8 },
      { itemId: 'cheese', chance: 0.5, min: 1, max: 2 },
      { itemId: 'health_potion', chance: 0.22, min: 1, max: 1 },
    ],
  },
  spider: {
    id: 'spider',
    name: 'Spider',
    maxHp: 26,
    xp: 12,
    minDmg: 2,
    maxDmg: 6,
    def: 3,
    speedMs: 380,
    aggroRange: 6,
    attackMs: 2000,
    respawnMs: 20000,
    corpseSprite: 'corpse_spider',
    look: 'a spider',
    loot: [
      { itemId: 'gold_coin', chance: 0.68, min: 1, max: 5 },
      { itemId: 'meat', chance: 0.4, min: 1, max: 1 },
    ],
  },
  npc_cipfried: {
    id: 'npc_cipfried',
    name: 'Cipfried',
    isNpc: true,
    maxHp: 100,
    speedMs: 900,
    look: 'Cipfried. He is a monk',
  },
};

export const SPELLS = {
  exura: {
    words: 'exura',
    displayWords: 'Exura',
    name: 'Light Healing',
    manaCost: 20,
    cooldownMs: 1200,
    minHeal: 20,
    maxHeal: 34,
  },
  'exevo flam hur': {
    words: 'exevo flam hur',
    displayWords: 'Exevo Flam Hur',
    name: 'Fire Wave',
    manaCost: 25,
    cooldownMs: 2000,
    minDmg: 16,
    maxDmg: 28,
  },
};

export const STANCES = {
  offensive: { id: 'offensive', label: 'Offensive', atkMult: 1.22, defMult: 0.78 },
  balanced: { id: 'balanced', label: 'Balanced', atkMult: 1.0, defMult: 1.0 },
  defensive: { id: 'defensive', label: 'Defensive', atkMult: 0.75, defMult: 1.28 },
};
