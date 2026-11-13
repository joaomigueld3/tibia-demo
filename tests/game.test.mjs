import assert from 'node:assert/strict';
import test from 'node:test';
import {
  castSpell,
  grantXp,
  handleChatInput,
  openContainerAt,
  takeAllContainerItems,
  toggleTarget,
  triggerPortalIfPresent,
  tryStepPlayer,
  updateCombat,
  useBackpackSlot,
} from '../src/combat.js';
import { MAP_HEIGHT, MAP_WIDTH } from '../src/constants.js';
import { addItemToBackpack, createPlayer, getPlayerStats, xpForLevel } from '../src/entities.js';
import { createWorld, findPath, getTileId, isProtectionZone } from '../src/world.js';

function makeHeadlessGame() {
  const world = createWorld();
  const player = createPlayer({ x: 14, y: 14, z: 0 });
  const logs = [];
  return {
    world,
    player,
    floatingTexts: [],
    effects: [],
    openContainer: null,
    lookMode: false,
    uiDirty: false,
    logs,
    onLog: (msg, cat) => logs.push({ msg, cat }),
    onSfx: () => {},
    onDirty: () => {},
  };
}

test('world generation creates 2 floors with PZ temple and bidirectional sewer portals', () => {
  const world = createWorld();
  assert.equal(world.floors.length, 2);
  assert.equal(world.floors[0].length, MAP_HEIGHT);
  assert.equal(world.floors[0][0].length, MAP_WIDTH);
  assert.equal(world.floors[1].length, MAP_HEIGHT);

  assert.equal(isProtectionZone(0, 14, 14), true);
  assert.equal(isProtectionZone(0, 21, 14), false);
  assert.equal(getTileId(world, 0, 21, 14), 'SEWER_GRATE');
  assert.equal(getTileId(world, 1, 21, 14), 'LADDER');
});

test('BFS pathfinding routes out of Temple to Sewer Grate without cutting stone corners', () => {
  const { world, player } = makeHeadlessGame();
  const path = findPath(world, 0, player.x, player.y, 21, 14, player, 'player');
  assert.ok(path.length > 0, 'Expected valid path to sewer grate');
  assert.deepEqual(path[path.length - 1], { x: 21, y: 14 });
  assert.equal(getTileId(world, 0, path[0].x, path[0].y) !== 'STONE_WALL', true);
});

test('floor portal transitions between surface (z=0) and rat sewer (z=1)', () => {
  const game = makeHeadlessGame();
  game.player.x = 20;
  game.player.y = 14;
  assert.equal(tryStepPlayer(game, 1, 0), true);
  assert.equal(game.player.x, 21);
  assert.equal(triggerPortalIfPresent(game), true);
  assert.equal(game.player.z, 1);
  assert.equal(triggerPortalIfPresent(game), true);
  assert.equal(game.player.z, 0);
});

test('melee combat damages targeted rat, creates lootable corpse, and leveling works', () => {
  const game = makeHeadlessGame();
  game.player.z = 1;
  game.player.x = 18;
  game.player.y = 14;

  const rat = game.world.creatures.find((c) => c.z === 1 && c.templateId === 'rat');
  assert.ok(rat, 'Expected a sewer rat on z=1');
  rat.x = 19;
  rat.y = 14;

  toggleTarget(game, rat.id);
  assert.equal(game.player.targetId, rat.id);

  for (let i = 0; i < 30 && rat.alive; i++) {
    game.player.attackCooldownMs = 0;
    updateCombat(game, 100);
  }

  assert.equal(rat.alive, false);
  assert.equal(game.player.targetId, null);
  assert.ok(game.player.xp >= rat.xp);
  assert.ok(game.world.corpses.some((c) => c.x === 19 && c.y === 14 && c.z === 1));

  grantXp(game, xpForLevel(2));
  assert.ok(game.player.level >= 2);
});

test('spells (exura, exevo flam hur), equipment, food, and Cipfried healing work', () => {
  const game = makeHeadlessGame();
  game.player.hp = 80;
  assert.equal(castSpell(game, 'exura'), true);
  assert.ok(game.player.hp > 80);
  assert.equal(game.player.mana, 35);

  // Move outside PZ and blast a monster with exevo flam hur
  game.player.z = 1;
  game.player.x = 18;
  game.player.y = 14;
  game.player.facing = 'E';
  game.player.spellCooldownMs = 0;
  const rat = game.world.creatures.find((c) => c.z === 1 && c.templateId === 'rat');
  rat.x = 20;
  rat.y = 14;
  const prevRatHp = rat.hp;
  assert.equal(castSpell(game, 'exevo flam hur'), true);
  assert.ok(rat.hp < prevRatHp || !rat.alive);

  // Equip short sword from backpack
  const prevAtk = getPlayerStats(game.player).effectiveAtk;
  addItemToBackpack(game.player, 'short_sword', 1);
  const idx = game.player.backpack.findIndex((s) => s.itemId === 'short_sword');
  assert.equal(useBackpackSlot(game, idx), true);
  assert.equal(game.player.equipment.weapon, 'short_sword');
  assert.ok(getPlayerStats(game.player).effectiveAtk > prevAtk);

  // Eat cheese
  const cheeseIdx = game.player.backpack.findIndex((s) => s.itemId === 'cheese');
  const prevFed = game.player.fedTicks;
  assert.equal(useBackpackSlot(game, cheeseIdx), true);
  assert.ok(game.player.fedTicks > prevFed);

  // Loot sewer chest
  game.player.z = 1;
  game.player.x = 30;
  game.player.y = 22;
  const chest = game.world.chests.find((c) => c.z === 1);
  assert.equal(openContainerAt(game, chest), true);
  takeAllContainerItems(game);
  assert.equal(chest.opened, true);

  // Return to temple and ask Cipfried for heal
  game.player.z = 0;
  game.player.x = 14;
  game.player.y = 14;
  game.player.hp = 50;
  game.player.mana = 10;
  handleChatInput(game, 'heal');
  assert.equal(game.player.hp, game.player.maxHp);
  assert.equal(game.player.mana, game.player.maxMana);
});
