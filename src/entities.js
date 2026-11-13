/**
 * Entity factories, progression formulas, and inventory helpers.
 */

import { CREATURE_TEMPLATES, ITEMS, MAX_BACKPACK_SLOTS, STANCES } from './constants.js';

let nextEntityId = 1;

/**
 * Generates a unique integer ID for creatures, corpses, and effects.
 */
export function genId() {
  return nextEntityId++;
}

/**
 * Total cumulative XP required to reach `level`.
 * Tuned so players experience their first level-up quickly after ~7 rats.
 */
export function xpForLevel(level) {
  if (level <= 1) return 0;
  return Math.floor(35 * Math.pow(level - 1, 1.75));
}

/**
 * Creates the initial Rookgaard adventurer state.
 */
export function createPlayer(spawn = { x: 14, y: 14, z: 0 }) {
  return {
    id: 'player',
    name: 'Adventurer',
    x: spawn.x,
    y: spawn.y,
    z: spawn.z,
    fromX: spawn.x,
    fromY: spawn.y,
    moveProgress: 1,
    moveDuration: 190,
    facing: 'S',
    stepFrame: 0,
    hitFlashMs: 0,
    level: 1,
    xp: 0,
    hp: 150,
    maxHp: 150,
    mana: 55,
    maxMana: 55,
    soul: 100,
    cap: 400,
    fedTicks: 15,
    stance: 'balanced',
    targetId: null,
    attackCooldownMs: 0,
    spellCooldownMs: 0,
    potionCooldownMs: 0,
    regenAccumMs: 0,
    walkQueue: [],
    equipment: {
      helmet: null,
      armor: 'leather_armor',
      weapon: 'club',
      shield: 'wooden_shield',
      boots: 'leather_boots',
    },
    backpack: [
      { itemId: 'cheese', count: 2 },
      { itemId: 'health_potion', count: 2 },
      { itemId: 'gold_coin', count: 10 },
    ],
  };
}

/**
 * Computes effective player attack, defense, and step duration from gear and level.
 */
export function getPlayerStats(player) {
  const weapon = player.equipment.weapon ? ITEMS[player.equipment.weapon] : null;
  const shield = player.equipment.shield ? ITEMS[player.equipment.shield] : null;
  const armor = player.equipment.armor ? ITEMS[player.equipment.armor] : null;
  const helmet = player.equipment.helmet ? ITEMS[player.equipment.helmet] : null;
  const boots = player.equipment.boots ? ITEMS[player.equipment.boots] : null;
  const stance = STANCES[player.stance] || STANCES.balanced;

  const weaponAtk = weapon ? weapon.atk : 3;
  const shieldDef = (shield ? shield.def : 0) + (weapon ? weapon.def : 0);
  const totalArm = (armor ? armor.def : 0) + (helmet ? helmet.def : 0) + (boots ? boots.def : 0);

  const effectiveAtk = Math.round((weaponAtk + (player.level - 1) * 2) * stance.atkMult);
  const effectiveDef = Math.round((shieldDef + totalArm + (player.level - 1)) * stance.defMult);
  const stepMs = Math.max(135, 200 - (player.level - 1) * 8);

  return {
    weaponAtk,
    shieldDef,
    totalArm,
    effectiveAtk,
    effectiveDef,
    stepMs,
  };
}

/**
 * Spawns a Creature or NPC instance from a CREATURE_TEMPLATES key.
 */
export function createCreature(templateId, x, y, z) {
  const tpl = CREATURE_TEMPLATES[templateId];
  if (!tpl) {
    throw new Error(`Unknown creature template: ${templateId}`);
  }
  return {
    id: genId(),
    templateId,
    name: tpl.name,
    isNpc: Boolean(tpl.isNpc),
    x,
    y,
    z,
    spawnX: x,
    spawnY: y,
    spawnZ: z,
    fromX: x,
    fromY: y,
    moveProgress: 1,
    moveDuration: tpl.speedMs,
    facing: 'S',
    stepFrame: 0,
    hitFlashMs: 0,
    hp: tpl.maxHp,
    maxHp: tpl.maxHp,
    xp: tpl.xp || 0,
    minDmg: tpl.minDmg || 0,
    maxDmg: tpl.maxDmg || 0,
    def: tpl.def || 0,
    aggroRange: tpl.aggroRange || 0,
    attackMs: tpl.attackMs || 2000,
    attackCooldownMs: 800,
    wanderCooldownMs: 1200 + Math.floor(Math.random() * 1800),
    respawnMs: tpl.respawnMs || 20000,
    alive: true,
    respawnRemainingMs: 0,
    look: tpl.look,
  };
}

/**
 * Creates a lootable corpse left behind on a tile after a monster dies.
 */
export function createCorpse(creature, lootItems) {
  const tpl = CREATURE_TEMPLATES[creature.templateId];
  return {
    id: genId(),
    kind: 'corpse',
    name: `Dead ${creature.name}`,
    sprite: tpl?.corpseSprite || 'corpse_rat',
    x: creature.x,
    y: creature.y,
    z: creature.z,
    items: lootItems,
    ttlMs: 45000,
  };
}

/**
 * Creates a one-time treasure chest container on the map.
 */
export function createWorldChest(name, x, y, z, items) {
  return {
    id: genId(),
    kind: 'chest',
    name,
    sprite: 'chest',
    x,
    y,
    z,
    items,
    opened: false,
  };
}

/**
 * Formats an item stack cleanly in classic Tibia style ("5 gold coins", "a short sword").
 */
export function formatItemStack(stack) {
  const def = ITEMS[stack.itemId];
  if (!def) return stack.itemId;
  if (stack.count > 1) {
    return `${stack.count} ${def.plural || `${def.name}s`}`;
  }
  const article = /^[aeiou]/i.test(def.name) ? 'an' : 'a';
  return `${article} ${def.name}`;
}

/**
 * Adds items into the player's backpack, merging stackables first.
 * Returns { added, remaining }.
 */
export function addItemToBackpack(player, itemId, count = 1) {
  const def = ITEMS[itemId];
  if (!def || count <= 0) return { added: 0, remaining: count };

  let remaining = count;

  if (def.stackable) {
    for (const slot of player.backpack) {
      if (slot.itemId === itemId && slot.count < def.maxStack) {
        const space = def.maxStack - slot.count;
        const delta = Math.min(space, remaining);
        slot.count += delta;
        remaining -= delta;
        if (remaining === 0) return { added: count, remaining: 0 };
      }
    }
  }

  while (remaining > 0 && player.backpack.length < MAX_BACKPACK_SLOTS) {
    const chunk = def.stackable ? Math.min(def.maxStack, remaining) : 1;
    player.backpack.push({ itemId, count: chunk });
    remaining -= chunk;
  }

  return { added: count - remaining, remaining };
}

/**
 * Consumes `amount` from a specific backpack slot index, removing empty stacks.
 */
export function consumeBackpackSlot(player, index, amount = 1) {
  const slot = player.backpack[index];
  if (!slot) return false;
  slot.count -= amount;
  if (slot.count <= 0) {
    player.backpack.splice(index, 1);
  }
  return true;
}

/**
 * Spawns floating combat/XP/speech text above a world tile.
 */
export function createFloatingText(x, y, z, text, color = '#ffffff', durationMs = 1100) {
  return {
    id: genId(),
    x,
    y,
    z,
    text,
    color,
    elapsedMs: 0,
    durationMs,
  };
}

/**
 * Spawns a brief visual particle sprite on a world tile (blood, puff, fire, heal).
 */
export function createVisualEffect(x, y, z, sprite, durationMs = 450) {
  return {
    id: genId(),
    x,
    y,
    z,
    sprite,
    elapsedMs: 0,
    durationMs,
  };
}
