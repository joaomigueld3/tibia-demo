/**
 * Core Tibia gameplay simulation: movement, targeting, melee combat,
 * creature AI, spells, loot, equipment, NPC chat, and regeneration.
 */

import { CARDINALS, CREATURE_TEMPLATES, ITEMS, SPELLS, TILES } from './constants.js';
import {
  addItemToBackpack,
  consumeBackpackSlot,
  createCorpse,
  createFloatingText,
  createVisualEffect,
  formatItemStack,
  getPlayerStats,
  xpForLevel,
} from './entities.js';
import { findPath, getTileId, isProtectionZone, isTileWalkable, revealFog } from './world.js';

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function emitLog(game, text, category = 'server') {
  game.onLog?.(text, category);
}

function emitSfx(game, name) {
  game.onSfx?.(name);
}

function markDirty(game) {
  game.onDirty?.();
}

/**
 * Computes cardinal facing direction from delta (dx, dy).
 */
export function facingFromDelta(dx, dy, fallback = 'S') {
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx > 0) return 'E';
    if (dx < 0) return 'W';
  }
  if (dy > 0) return 'S';
  if (dy < 0) return 'N';
  return fallback;
}

/**
 * Transitions the player through a portal (Sewer Grate or Ladder) if standing on one.
 */
export function triggerPortalIfPresent(game) {
  const { player, world } = game;
  const key = `${player.z},${player.x},${player.y}`;
  const portal = world.portals[key];
  if (!portal) return false;

  player.z = portal.z;
  player.x = portal.x;
  player.y = portal.y;
  player.fromX = portal.x;
  player.fromY = portal.y;
  player.moveProgress = 1;
  player.walkQueue = [];
  player.targetId = null;
  game.openContainer = null;

  revealFog(world, player.z, player.x, player.y, 8);
  emitLog(game, portal.message, 'system');
  emitSfx(game, 'step');
  markDirty(game);
  return true;
}

/**
 * Attempts to move the player one tile by (dx, dy).
 */
export function tryStepPlayer(game, dx, dy) {
  const { player, world } = game;
  if (player.moveProgress < 1) return false;
  if (dx === 0 && dy === 0) return false;

  player.facing = facingFromDelta(dx, dy, player.facing);

  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!isTileWalkable(world, player.z, nx, ny, player, 'player')) {
    return false;
  }

  // Prevent diagonal corner cutting through unwalkable adjacent tiles
  if (dx !== 0 && dy !== 0) {
    const sideA = TILES[getTileId(world, player.z, player.x + dx, player.y)]?.walkable;
    const sideB = TILES[getTileId(world, player.z, player.x, player.y + dy)]?.walkable;
    if (!sideA || !sideB) return false;
  }

  const stats = getPlayerStats(player);
  const isDiag = dx !== 0 && dy !== 0;

  player.fromX = player.x;
  player.fromY = player.y;
  player.x = nx;
  player.y = ny;
  player.moveProgress = 0;
  player.moveDuration = isDiag ? Math.round(stats.stepMs * 1.35) : stats.stepMs;
  player.stepFrame = player.stepFrame === 0 ? 1 : 0;

  revealFog(world, player.z, nx, ny, 8);

  if (game.openContainer && chebyshev(nx, ny, game.openContainer.x, game.openContainer.y) > 1) {
    game.openContainer = null;
    markDirty(game);
  }

  return true;
}

/**
 * Selects or clears the player's combat target.
 */
export function toggleTarget(game, creatureId) {
  const { player, world } = game;
  if (creatureId == null || player.targetId === creatureId) {
    if (player.targetId !== null) {
      player.targetId = null;
      markDirty(game);
    }
    return;
  }

  const target = world.creatures.find((c) => c.id === creatureId && c.alive && c.z === player.z);
  if (!target) return;
  if (target.isNpc) {
    emitLog(game, `You cannot attack ${target.name}. Say "hi" in chat to talk.`, 'system');
    return;
  }

  player.targetId = target.id;
  markDirty(game);
}

/**
 * Grants XP and handles level advancements.
 */
export function grantXp(game, amount) {
  const { player, floatingTexts } = game;
  if (amount <= 0) return;

  player.xp += amount;
  floatingTexts.push(createFloatingText(player.x, player.y, player.z, `+${amount} exp`, '#d8f7d0', 1100));

  let leveled = false;
  while (player.xp >= xpForLevel(player.level + 1)) {
    player.level += 1;
    player.maxHp += 15;
    player.maxMana += 10;
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    leveled = true;
    emitLog(game, `You advanced from Level ${player.level - 1} to Level ${player.level}.`, 'server');
  }

  if (leveled) {
    floatingTexts.push(createFloatingText(player.x, player.y, player.z, 'LEVEL UP!', '#ffe359', 1500));
    game.effects.push(createVisualEffect(player.x, player.y, player.z, 'heal', 650));
    emitSfx(game, 'levelup');
  }

  markDirty(game);
}

/**
 * Rolls loot drops for a defeated monster template.
 */
export function rollCreatureLoot(templateId) {
  const tpl = CREATURE_TEMPLATES[templateId];
  if (!tpl?.loot) return [];

  const drops = [];
  for (const entry of tpl.loot) {
    if (Math.random() <= entry.chance) {
      const count = randInt(entry.min, entry.max);
      drops.push({ itemId: entry.itemId, count });
    }
  }
  return drops;
}

/**
 * Converts a dead creature into a lootable corpse and awards XP.
 */
export function killCreature(game, creature) {
  const { player, world } = game;
  creature.alive = false;
  creature.hp = 0;
  creature.respawnRemainingMs = creature.respawnMs;

  if (player.targetId === creature.id) {
    player.targetId = null;
  }

  const loot = rollCreatureLoot(creature.templateId);
  const corpse = createCorpse(creature, loot);
  world.corpses.push(corpse);

  const lootText = loot.length > 0 ? loot.map(formatItemStack).join(', ') : 'nothing';
  emitLog(game, `Loot of ${creature.look}: ${lootText}.`, 'loot');

  grantXp(game, creature.xp);
  markDirty(game);
}

/**
 * Handles player defeat by respawning safely in Cipfried's Temple.
 */
export function handlePlayerDeath(game) {
  const { player, world, effects, floatingTexts } = game;
  emitLog(game, 'You are dead. Cipfried rescues your spirit back to Rookgaard Temple!', 'combat');
  emitSfx(game, 'hurt');

  player.z = 0;
  player.x = 14;
  player.y = 14;
  player.fromX = 14;
  player.fromY = 14;
  player.moveProgress = 1;
  player.walkQueue = [];
  player.targetId = null;
  player.hp = player.maxHp;
  player.mana = player.maxMana;
  game.openContainer = null;

  revealFog(world, 0, 14, 14, 8);
  effects.push(createVisualEffect(14, 14, 0, 'heal', 650));
  floatingTexts.push(createFloatingText(14, 14, 0, 'Saved!', '#66ccff', 1400));
  markDirty(game);
}

/**
 * Executes player melee swings on the 2-second Tibia combat clock.
 */
export function updateCombat(game, dtMs) {
  const { player, world, floatingTexts, effects } = game;

  player.attackCooldownMs = Math.max(0, player.attackCooldownMs - dtMs);
  player.spellCooldownMs = Math.max(0, player.spellCooldownMs - dtMs);
  player.potionCooldownMs = Math.max(0, player.potionCooldownMs - dtMs);

  if (!player.targetId) return;

  const target = world.creatures.find(
    (c) => c.id === player.targetId && c.alive && c.z === player.z,
  );
  if (!target) {
    player.targetId = null;
    markDirty(game);
    return;
  }

  const dist = chebyshev(player.x, player.y, target.x, target.y);
  if (dist > 1 || player.attackCooldownMs > 0) return;

  if (isProtectionZone(player.z, player.x, player.y) || isProtectionZone(target.z, target.x, target.y)) {
    return;
  }

  player.facing = facingFromDelta(target.x - player.x, target.y - player.y, player.facing);
  player.attackCooldownMs = 2000;

  const stats = getPlayerStats(player);
  const rawRoll = randInt(1, Math.max(2, stats.effectiveAtk));
  const blockRoll = randInt(0, target.def);
  const dmg = Math.max(0, rawRoll - blockRoll);

  if (dmg === 0) {
    effects.push(createVisualEffect(target.x, target.y, target.z, 'slash', 240));
    effects.push(createVisualEffect(target.x, target.y, target.z, 'poof', 420));
    emitSfx(game, 'poof');
    return;
  }

  target.hp = Math.max(0, target.hp - dmg);
  target.hitFlashMs = 150;
  effects.push(createVisualEffect(target.x, target.y, target.z, 'slash', 240));
  effects.push(createVisualEffect(target.x, target.y, target.z, 'blood', 420));
  world.bloodDecals.push({ x: target.x, y: target.y, z: target.z, ttlMs: 18000 });
  floatingTexts.push(createFloatingText(target.x, target.y, target.z, `-${dmg}`, '#ff4d4d', 900));
  emitLog(game, `A ${target.name.toLowerCase()} loses ${dmg} hitpoints due to your attack.`, 'combat');
  emitSfx(game, 'hit');

  if (target.hp <= 0) {
    killCreature(game, target);
  } else {
    markDirty(game);
  }
}

/**
 * Moves a creature one step if the target tile is walkable and outside PZ (for monsters).
 */
function stepCreature(game, creature, dx, dy) {
  const { world, player } = game;
  if (dx === 0 && dy === 0) return false;
  const nx = creature.x + dx;
  const ny = creature.y + dy;

  if (!creature.isNpc && isProtectionZone(creature.z, nx, ny)) {
    return false;
  }
  if (!isTileWalkable(world, creature.z, nx, ny, player, creature.id)) {
    return false;
  }
  if (dx !== 0 && dy !== 0) {
    const sideA = TILES[getTileId(world, creature.z, creature.x + dx, creature.y)]?.walkable;
    const sideB = TILES[getTileId(world, creature.z, creature.x, creature.y + dy)]?.walkable;
    if (!sideA || !sideB) return false;
  }

  creature.facing = facingFromDelta(dx, dy, creature.facing);
  creature.fromX = creature.x;
  creature.fromY = creature.y;
  creature.x = nx;
  creature.y = ny;
  creature.moveProgress = 0;
  creature.stepFrame = creature.stepFrame === 0 ? 1 : 0;
  return true;
}

/**
 * Updates monster respawns, AI movement, melee attacks, and NPC wandering.
 */
export function updateCreatures(game, dtMs) {
  const { world, player, effects, floatingTexts } = game;
  const stats = getPlayerStats(player);

  for (const creature of world.creatures) {
    if (!creature.alive) {
      creature.respawnRemainingMs -= dtMs;
      if (creature.respawnRemainingMs <= 0) {
        const occupiedByPlayer =
          player.z === creature.spawnZ &&
          player.x === creature.spawnX &&
          player.y === creature.spawnY;
        const canSpawn =
          !occupiedByPlayer &&
          isTileWalkable(world, creature.spawnZ, creature.spawnX, creature.spawnY, player, creature.id);

        if (canSpawn) {
          creature.alive = true;
          creature.hp = creature.maxHp;
          creature.x = creature.spawnX;
          creature.y = creature.spawnY;
          creature.z = creature.spawnZ;
          creature.fromX = creature.spawnX;
          creature.fromY = creature.spawnY;
          creature.moveProgress = 1;
          creature.attackCooldownMs = 900;
          effects.push(createVisualEffect(creature.x, creature.y, creature.z, 'poof', 400));
          markDirty(game);
        } else {
          creature.respawnRemainingMs = 2000;
        }
      }
      continue;
    }

    if (creature.moveProgress < 1) {
      creature.moveProgress = Math.min(1, creature.moveProgress + dtMs / creature.moveDuration);
    }
    if (creature.hitFlashMs > 0) {
      creature.hitFlashMs = Math.max(0, creature.hitFlashMs - dtMs);
    }

    creature.attackCooldownMs = Math.max(0, creature.attackCooldownMs - dtMs);
    creature.wanderCooldownMs -= dtMs;

    if (creature.isNpc) {
      if (creature.z === player.z && chebyshev(creature.x, creature.y, player.x, player.y) <= 3) {
        creature.facing = facingFromDelta(player.x - creature.x, player.y - creature.y, creature.facing);
      } else if (creature.moveProgress >= 1 && creature.wanderCooldownMs <= 0) {
        creature.wanderCooldownMs = 2200 + randInt(0, 2000);
        const dirs = Object.values(CARDINALS);
        const pick = dirs[randInt(0, dirs.length - 1)];
        if (chebyshev(creature.x + pick.dx, creature.y + pick.dy, creature.spawnX, creature.spawnY) <= 2) {
          if (isProtectionZone(creature.z, creature.x + pick.dx, creature.y + pick.dy)) {
            stepCreature(game, creature, pick.dx, pick.dy);
          }
        }
      }
      continue;
    }

    const sameFloor = creature.z === player.z;
    const playerInPz = isProtectionZone(player.z, player.x, player.y);
    const dist = sameFloor ? chebyshev(creature.x, creature.y, player.x, player.y) : 999;

    // Aggro & attack
    if (sameFloor && !playerInPz && dist <= creature.aggroRange) {
      if (dist <= 1) {
        creature.facing = facingFromDelta(player.x - creature.x, player.y - creature.y, creature.facing);
        if (creature.attackCooldownMs <= 0) {
          creature.attackCooldownMs = creature.attackMs;
          const armorBlock = randInt(0, Math.floor(stats.effectiveDef * 0.25));
          const dmg = Math.max(0, randInt(creature.minDmg, creature.maxDmg) - armorBlock);

          if (dmg === 0) {
            effects.push(createVisualEffect(player.x, player.y, player.z, 'poof', 380));
            emitSfx(game, 'poof');
          } else {
            player.hp = Math.max(0, player.hp - dmg);
            player.hitFlashMs = 150;
            effects.push(createVisualEffect(player.x, player.y, player.z, 'blood', 380));
            floatingTexts.push(createFloatingText(player.x, player.y, player.z, `-${dmg}`, '#ff4d4d', 900));
            emitLog(
              game,
              `You lose ${dmg} hitpoints due to an attack by a ${creature.name.toLowerCase()}.`,
              'combat',
            );
            emitSfx(game, 'hurt');
            markDirty(game);

            if (player.hp <= 0) {
              handlePlayerDeath(game);
              break;
            }
          }
        }
      } else if (creature.moveProgress >= 1 && creature.wanderCooldownMs <= 0) {
        creature.wanderCooldownMs = creature.moveDuration + 80;
        const stepX = Math.sign(player.x - creature.x);
        const stepY = Math.sign(player.y - creature.y);
        const candidates = [
          [stepX, stepY],
          [stepX, 0],
          [0, stepY],
        ];
        let moved = false;
        for (const [cx, cy] of candidates) {
          if (stepCreature(game, creature, cx, cy)) {
            moved = true;
            break;
          }
        }
        if (!moved) {
          const path = findPath(world, creature.z, creature.x, creature.y, player.x, player.y, player, creature.id, 120);
          if (path.length > 0) {
            stepCreature(game, creature, path[0].x - creature.x, path[0].y - creature.y);
          }
        }
      }
      continue;
    }

    // Idle wandering near spawn
    if (creature.moveProgress >= 1 && creature.wanderCooldownMs <= 0) {
      creature.wanderCooldownMs = 1800 + randInt(0, 2200);
      const dirs = Object.values(CARDINALS);
      const pick = dirs[randInt(0, dirs.length - 1)];
      if (chebyshev(creature.x + pick.dx, creature.y + pick.dy, creature.spawnX, creature.spawnY) <= 3) {
        stepCreature(game, creature, pick.dx, pick.dy);
      }
    }
  }
}

/**
 * Updates passive HP/Mana regeneration ticks, corpse expiration, and VFX timers.
 */
export function updateWorldTimers(game, dtMs) {
  const { player, world, floatingTexts, effects } = game;

  if (player.hitFlashMs > 0) {
    player.hitFlashMs = Math.max(0, player.hitFlashMs - dtMs);
  }

  // Player walk interpolation + path queue
  if (player.moveProgress < 1) {
    player.moveProgress = Math.min(1, player.moveProgress + dtMs / player.moveDuration);
    if (player.moveProgress >= 1) {
      const transitioned = triggerPortalIfPresent(game);
      if (!transitioned && player.walkQueue.length > 0) {
        const next = player.walkQueue.shift();
        const stepped = tryStepPlayer(game, next.x - player.x, next.y - player.y);
        if (!stepped) {
          player.walkQueue = [];
        }
      }
    }
  } else if (player.walkQueue.length > 0) {
    const next = player.walkQueue.shift();
    if (!tryStepPlayer(game, next.x - player.x, next.y - player.y)) {
      player.walkQueue = [];
    }
  }

  // Regeneration
  const inPz = isProtectionZone(player.z, player.x, player.y);
  const regenInterval = inPz || player.fedTicks > 0 ? 1200 : 2500;
  player.regenAccumMs += dtMs;
  if (player.regenAccumMs >= regenInterval) {
    player.regenAccumMs -= regenInterval;
    const hpGain = inPz ? 2 : player.fedTicks > 0 ? 1 : 0;
    const manaGain = inPz ? 3 : player.fedTicks > 0 ? 2 : 1;
    let changed = false;

    if (hpGain > 0 && player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + hpGain);
      changed = true;
    }
    if (manaGain > 0 && player.mana < player.maxMana) {
      player.mana = Math.min(player.maxMana, player.mana + manaGain);
      changed = true;
    }
    if (player.fedTicks > 0) {
      player.fedTicks -= 1;
      changed = true;
    }
    if (changed) markDirty(game);
  }

  // Expire corpses, decals, floating texts, and visual effects
  for (let i = world.corpses.length - 1; i >= 0; i--) {
    world.corpses[i].ttlMs -= dtMs;
    if (world.corpses[i].ttlMs <= 0) {
      if (game.openContainer?.id === world.corpses[i].id) {
        game.openContainer = null;
        markDirty(game);
      }
      world.corpses.splice(i, 1);
    }
  }

  for (let i = world.bloodDecals.length - 1; i >= 0; i--) {
    world.bloodDecals[i].ttlMs -= dtMs;
    if (world.bloodDecals[i].ttlMs <= 0) world.bloodDecals.splice(i, 1);
  }

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    floatingTexts[i].elapsedMs += dtMs;
    if (floatingTexts[i].elapsedMs >= floatingTexts[i].durationMs) floatingTexts.splice(i, 1);
  }

  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].elapsedMs += dtMs;
    if (effects[i].elapsedMs >= effects[i].durationMs) effects.splice(i, 1);
  }
}

/**
 * Computes the 3-tile directional Fire Wave area in front of the player.
 */
export function getFlameWaveTiles(player) {
  const dir = CARDINALS[player.facing] || CARDINALS.S;
  const perpX = dir.dy === 0 ? 0 : 1;
  const perpY = dir.dx === 0 ? 0 : 1;
  const tiles = [];

  for (let dist = 1; dist <= 3; dist++) {
    const cx = player.x + dir.dx * dist;
    const cy = player.y + dir.dy * dist;
    const spread = dist === 1 ? 0 : 1;
    for (let s = -spread; s <= spread; s++) {
      tiles.push({ x: cx + perpX * s, y: cy + perpY * s });
    }
  }
  return tiles;
}

/**
 * Casts a spell by incantation words ("exura" or "exevo flam hur").
 */
export function castSpell(game, rawWords) {
  const { player, world, effects, floatingTexts } = game;
  const key = rawWords.trim().toLowerCase();
  const spell = SPELLS[key];
  if (!spell) return false;

  if (player.spellCooldownMs > 0) {
    emitLog(game, 'You are exhausted.', 'system');
    return true;
  }

  if (player.mana < spell.manaCost) {
    effects.push(createVisualEffect(player.x, player.y, player.z, 'poof', 350));
    emitLog(game, 'You do not have enough mana.', 'system');
    emitSfx(game, 'poof');
    return true;
  }

  player.mana -= spell.manaCost;
  player.spellCooldownMs = spell.cooldownMs;
  floatingTexts.push(createFloatingText(player.x, player.y, player.z, spell.displayWords, '#fff275', 1100));
  emitLog(game, `${player.name}: ${spell.displayWords}`, 'spell');

  if (key === 'exura') {
    const amount = randInt(spell.minHeal, spell.maxHeal);
    const actual = Math.min(player.maxHp - player.hp, amount);
    player.hp += actual;
    effects.push(createVisualEffect(player.x, player.y, player.z, 'heal', 550));
    if (actual > 0) {
      floatingTexts.push(createFloatingText(player.x, player.y, player.z, `+${actual}`, '#5cff7a', 950));
    }
    emitSfx(game, 'heal');
    markDirty(game);
    return true;
  }

  if (key === 'exevo flam hur') {
    if (isProtectionZone(player.z, player.x, player.y)) {
      emitLog(game, 'You cannot cast offensive spells inside a protection zone.', 'system');
      player.mana += spell.manaCost;
      player.spellCooldownMs = 0;
      return true;
    }

    const area = getFlameWaveTiles(player);
    emitSfx(game, 'fire');

    for (const pt of area) {
      const tile = TILES[getTileId(world, player.z, pt.x, pt.y)];
      if (!tile || tile.opaque) continue;
      effects.push(createVisualEffect(pt.x, pt.y, player.z, 'fire', 480));

      if (isProtectionZone(player.z, pt.x, pt.y)) continue;
      const hitTarget = world.creatures.find(
        (c) => c.alive && !c.isNpc && c.z === player.z && c.x === pt.x && c.y === pt.y,
      );
      if (hitTarget) {
        const dmg = randInt(spell.minDmg, spell.maxDmg) + (player.level - 1) * 2;
        hitTarget.hp = Math.max(0, hitTarget.hp - dmg);
        hitTarget.hitFlashMs = 150;
        floatingTexts.push(createFloatingText(hitTarget.x, hitTarget.y, hitTarget.z, `-${dmg}`, '#ff9436', 950));
        emitLog(game, `A ${hitTarget.name.toLowerCase()} loses ${dmg} hitpoints due to your fire wave.`, 'combat');
        if (hitTarget.hp <= 0) {
          killCreature(game, hitTarget);
        }
      }
    }
    markDirty(game);
    return true;
  }

  return false;
}

/**
 * Uses, drinks, eats, or equips an item from the player's backpack slot index.
 */
export function useBackpackSlot(game, slotIndex) {
  const { player, effects, floatingTexts } = game;
  const stack = player.backpack[slotIndex];
  if (!stack) return false;
  const def = ITEMS[stack.itemId];
  if (!def) return false;

  if (def.foodTicks) {
    consumeBackpackSlot(player, slotIndex, 1);
    player.fedTicks = Math.min(240, player.fedTicks + def.foodTicks);
    floatingTexts.push(createFloatingText(player.x, player.y, player.z, 'Munch.', '#ffaa44', 900));
    emitLog(game, `You eat ${def.name === 'meat' ? 'a piece of meat' : 'some cheese'}.`, 'server');
    emitSfx(game, 'coin');
    markDirty(game);
    return true;
  }

  if (def.healMin) {
    if (player.potionCooldownMs > 0) {
      emitLog(game, 'Wait a moment before drinking another potion.', 'system');
      return false;
    }
    consumeBackpackSlot(player, slotIndex, 1);
    player.potionCooldownMs = 1000;
    const heal = randInt(def.healMin, def.healMax);
    const actual = Math.min(player.maxHp - player.hp, heal);
    player.hp += actual;
    effects.push(createVisualEffect(player.x, player.y, player.z, 'heal', 550));
    floatingTexts.push(createFloatingText(player.x, player.y, player.z, 'Aaaah...', '#ff9c38', 1000));
    if (actual > 0) {
      floatingTexts.push(createFloatingText(player.x, player.y, player.z, `+${actual}`, '#5cff7a', 950));
    }
    emitLog(game, `You drink a health potion (+${actual} HP).`, 'loot');
    emitSfx(game, 'heal');
    markDirty(game);
    return true;
  }

  if (def.slot) {
    const prevEquipped = player.equipment[def.slot];
    player.equipment[def.slot] = def.id;
    consumeBackpackSlot(player, slotIndex, 1);
    if (prevEquipped) {
      addItemToBackpack(player, prevEquipped, 1);
    }
    emitLog(game, `You equip ${formatItemStack({ itemId: def.id, count: 1 })}.`, 'server');
    emitSfx(game, 'coin');
    markDirty(game);
    return true;
  }

  emitLog(game, `You inspect ${formatItemStack(stack)}: ${def.description}`, 'loot');
  return false;
}

/**
 * Uses the first health potion found in the player's backpack (F3 hotkey).
 */
export function useQuickHealthPotion(game) {
  const idx = game.player.backpack.findIndex((s) => s.itemId === 'health_potion');
  if (idx === -1) {
    emitLog(game, 'You do not have any health potions left.', 'system');
    return false;
  }
  return useBackpackSlot(game, idx);
}

/**
 * Opens a corpse or chest container in the sidebar if within reach (<= 1 tile).
 */
export function openContainerAt(game, container) {
  const { player } = game;
  if (!container || container.z !== player.z) return false;
  if (chebyshev(player.x, player.y, container.x, container.y) > 1) {
    emitLog(game, 'Move closer to inspect that.', 'system');
    return false;
  }

  if (container.kind === 'chest' && container.items.length === 0) {
    emitLog(game, 'The chest is empty.', 'loot');
    return false;
  }

  game.openContainer = container;
  markDirty(game);
  return true;
}

/**
 * Moves a specific slot from the active loot container into the backpack.
 */
export function takeContainerItem(game, slotIndex) {
  const container = game.openContainer;
  if (!container || !container.items[slotIndex]) return false;

  const stack = container.items[slotIndex];
  const { added, remaining } = addItemToBackpack(game.player, stack.itemId, stack.count);
  if (added === 0) {
    emitLog(game, 'Your backpack is full!', 'system');
    return false;
  }

  emitLog(game, `You loot ${formatItemStack({ itemId: stack.itemId, count: added })}.`, 'loot');
  emitSfx(game, 'coin');

  if (remaining > 0) {
    stack.count = remaining;
  } else {
    container.items.splice(slotIndex, 1);
  }

  if (container.kind === 'chest' && container.items.length === 0) {
    container.opened = true;
  }
  if (container.items.length === 0) {
    game.openContainer = null;
  }

  markDirty(game);
  return true;
}

/**
 * Takes all items from the currently open loot container.
 */
export function takeAllContainerItems(game) {
  const container = game.openContainer;
  if (!container) return false;
  while (container.items.length > 0) {
    const before = container.items.length;
    const prevCount = container.items[0].count;
    takeContainerItem(game, 0);
    if (container.items.length === before && container.items[0]?.count === prevCount) {
      break;
    }
  }
  return true;
}

/**
 * Handles player chat input: casts spells if matching incantation, or talks to nearby Cipfried NPC.
 */
export function handleChatInput(game, rawText) {
  const text = rawText.trim();
  if (!text) return;

  const lower = text.toLowerCase();
  if (SPELLS[lower]) {
    castSpell(game, lower);
    return;
  }

  const { player, world, floatingTexts, effects } = game;
  floatingTexts.push(createFloatingText(player.x, player.y, player.z, text, '#fff275', 1400));
  emitLog(game, `${player.name}: ${text}`, 'speech');

  const cipfried = world.creatures.find(
    (c) =>
      c.alive &&
      c.isNpc &&
      c.z === player.z &&
      chebyshev(player.x, player.y, c.x, c.y) <= 4,
  );

  if (!cipfried) return;

  if (lower.includes('hi') || lower.includes('hello')) {
    const reply =
      player.hp < player.maxHp
        ? 'Welcome, adventurer! You look hurt — let me heal you. Ask for "help" anytime.'
        : 'Greetings, young adventurer! Say "heal" when wounded, or "help" for Rookgaard tips.';
    if (player.hp < player.maxHp) {
      player.hp = player.maxHp;
      player.mana = player.maxMana;
      effects.push(createVisualEffect(player.x, player.y, player.z, 'heal', 550));
      emitSfx(game, 'heal');
    }
    floatingTexts.push(createFloatingText(cipfried.x, cipfried.y, cipfried.z, reply.slice(0, 36) + '...', '#7de3ff', 1700));
    emitLog(game, `Cipfried: ${reply}`, 'npc');
    markDirty(game);
    return;
  }

  if (lower.includes('heal')) {
    player.hp = player.maxHp;
    player.mana = player.maxMana;
    effects.push(createVisualEffect(player.x, player.y, player.z, 'heal', 600));
    floatingTexts.push(createFloatingText(cipfried.x, cipfried.y, cipfried.z, 'May the light restore you!', '#7de3ff', 1500));
    emitLog(game, 'Cipfried: May the light restore your strength and mana!', 'npc');
    emitSfx(game, 'heal');
    markDirty(game);
    return;
  }

  if (lower.includes('help') || lower.includes('quest') || lower.includes('sewer')) {
    const msg = 'Head east across Town Square to the Rat Sewer grate. Beware Cave Rats — a Short Sword awaits in the deep east chest!';
    floatingTexts.push(createFloatingText(cipfried.x, cipfried.y, cipfried.z, 'Check the eastern Rat Sewer!', '#7de3ff', 1600));
    emitLog(game, `Cipfried: ${msg}`, 'npc');
  }
}
