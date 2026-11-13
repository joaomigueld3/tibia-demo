/**
 * Entry point: initializes world, sprite atlas, audio, HUD, input handlers, and main loop.
 */

import { AudioEngine } from './audio.js';
import {
  castSpell,
  handleChatInput,
  openContainerAt,
  takeAllContainerItems,
  takeContainerItem,
  toggleTarget,
  triggerPortalIfPresent,
  tryStepPlayer,
  updateCombat,
  updateCreatures,
  updateWorldTimers,
  useBackpackSlot,
  useQuickHealthPotion,
} from './combat.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, TILES } from './constants.js';
import { createPlayer } from './entities.js';
import { renderMinimap, renderViewport, screenToWorldTile } from './renderer.js';
import { createSpriteAtlas } from './sprites.js';
import { GameUI } from './ui.js';
import { createWorld, findPath, getLookText, getTileId, inBounds, isTileWalkable, revealFog } from './world.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

const atlas = await createSpriteAtlas();
const audio = new AudioEngine();
const world = createWorld();
const player = createPlayer({ x: 14, y: 14, z: 0 });
revealFog(world, player.z, player.x, player.y, 8);

const game = {
  world,
  player,
  floatingTexts: [],
  effects: [],
  openContainer: null,
  lookMode: false,
  uiDirty: true,
  onLog: null,
  onSfx: (name) => audio.play(name),
  onDirty: () => {
    game.uiDirty = true;
  },
};

const ui = new GameUI(atlas, {
  onTarget: (id) => toggleTarget(game, id),
  onUseBackpack: (idx) => useBackpackSlot(game, idx),
  onTakeItem: (idx) => takeContainerItem(game, idx),
  onTakeAll: () => takeAllContainerItems(game),
  onCloseLoot: () => {
    game.openContainer = null;
    game.uiDirty = true;
  },
  onStance: (stance) => {
    game.player.stance = stance;
    game.uiDirty = true;
  },
  onChat: (text) => handleChatInput(game, text),
  onSpell: (words) => castSpell(game, words),
  onPotion: () => useQuickHealthPotion(game),
  onToggleLook: () => {
    game.lookMode = !game.lookMode;
    ui.setLookMode(game.lookMode);
  },
  onToggleSfx: () => {
    audio.enabled = !audio.enabled;
    ui.setSfxEnabled(audio.enabled);
  },
});

game.onLog = (text, cat) => ui.log(text, cat);
ui.setSfxEnabled(audio.enabled);

// Startup console tips
ui.log('Welcome to Tibia Browser Demo (Mini-Rookgaard).', 'server');
ui.log('Move: WASD / Arrows / Click | Attack: Click monster or Battle List | Look: Right-Click or Shift+Click', 'system');
ui.log('Hotkeys: F1 Exura | F2 Exevo Flam Hur | F3 Health Potion | Space: Quick Loot', 'system');
ui.log('Tip: Type "hi" or "heal" near Cipfried, then head East to the Rat Sewer grate!', 'npc');

// Input state
const heldKeys = new Set();
let hoverTile = null;

function isChatFocused() {
  return document.activeElement === ui.el.chatInput;
}

function getHeldMoveDelta() {
  let dx = 0;
  let dy = 0;
  if (heldKeys.has('KeyW') || heldKeys.has('ArrowUp')) dy -= 1;
  if (heldKeys.has('KeyS') || heldKeys.has('ArrowDown')) dy += 1;
  if (heldKeys.has('KeyA') || heldKeys.has('ArrowLeft')) dx -= 1;
  if (heldKeys.has('KeyD') || heldKeys.has('ArrowRight')) dx += 1;

  if (dx === 0 && dy === 0) {
    if (heldKeys.has('KeyQ')) { dx = -1; dy = -1; }
    else if (heldKeys.has('KeyE')) { dx = 1; dy = -1; }
    else if (heldKeys.has('KeyZ')) { dx = -1; dy = 1; }
    else if (heldKeys.has('KeyC')) { dx = 1; dy = 1; }
  }
  return { dx, dy };
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    if (!ui.el.helpModal.classList.contains('hidden')) {
      ui.el.helpModal.classList.add('hidden');
      return;
    }
    if (isChatFocused()) {
      ui.el.chatInput.blur();
      return;
    }
    if (game.lookMode) {
      game.lookMode = false;
      ui.setLookMode(false);
    }
    if (game.openContainer) {
      game.openContainer = null;
      game.uiDirty = true;
    }
    if (player.targetId !== null) {
      toggleTarget(game, null);
      ui.log('Target lost.', 'system');
    }
    player.walkQueue = [];
    return;
  }

  if (e.code === 'Enter' && !isChatFocused()) {
    e.preventDefault();
    ui.el.chatInput.focus();
    return;
  }

  if (isChatFocused()) return;

  if (e.code === 'F1') {
    e.preventDefault();
    castSpell(game, 'exura');
    return;
  }
  if (e.code === 'F2') {
    e.preventDefault();
    castSpell(game, 'exevo flam hur');
    return;
  }
  if (e.code === 'F3') {
    e.preventDefault();
    useQuickHealthPotion(game);
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    quickInteractAdjacent();
    return;
  }

  if (
    ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyC', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(
      e.code,
    )
  ) {
    e.preventDefault();
    heldKeys.add(e.code);
    player.walkQueue = [];
  }
});

window.addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
});

window.addEventListener('blur', () => {
  heldKeys.clear();
});

function quickInteractAdjacent() {
  if (game.openContainer && game.openContainer.items.length > 0) {
    takeAllContainerItems(game);
    return;
  }
  const nearbyCorpse = world.corpses.find(
    (c) => c.z === player.z && Math.max(Math.abs(c.x - player.x), Math.abs(c.y - player.y)) <= 1 && c.items.length > 0,
  );
  if (nearbyCorpse) {
    openContainerAt(game, nearbyCorpse);
    takeAllContainerItems(game);
    return;
  }
  const nearbyChest = world.chests.find(
    (c) => c.z === player.z && Math.max(Math.abs(c.x - player.x), Math.abs(c.y - player.y)) <= 1 && !c.opened,
  );
  if (nearbyChest) {
    openContainerAt(game, nearbyChest);
  }
}

function getCanvasTileFromMouse(e) {
  const rect = canvas.getBoundingClientRect();
  const cx = ((e.clientX - rect.left) / rect.width) * CANVAS_WIDTH;
  const cy = ((e.clientY - rect.top) / rect.height) * CANVAS_HEIGHT;
  return screenToWorldTile(player, cx, cy);
}

function findAdjacentWalkable(tx, ty) {
  let best = null;
  let bestLen = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const ax = tx + dx;
      const ay = ty + dy;
      if (!isTileWalkable(world, player.z, ax, ay, player, 'player')) continue;
      const p = findPath(world, player.z, player.x, player.y, ax, ay, player, 'player');
      if (p.length > 0 && p.length < bestLen) {
        best = p;
        bestLen = p.length;
      }
    }
  }
  return best || [];
}

canvas.addEventListener('mousemove', (e) => {
  hoverTile = getCanvasTileFromMouse(e);
});

canvas.addEventListener('mouseleave', () => {
  hoverTile = null;
});

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const { tx, ty } = getCanvasTileFromMouse(e);
  ui.log(getLookText(world, player, player.z, tx, ty), 'loot');
});

canvas.addEventListener('click', (e) => {
  const { tx, ty } = getCanvasTileFromMouse(e);
  if (!inBounds(tx, ty)) return;

  if (e.shiftKey || game.lookMode) {
    ui.log(getLookText(world, player, player.z, tx, ty), 'loot');
    if (game.lookMode) {
      game.lookMode = false;
      ui.setLookMode(false);
    }
    return;
  }

  // 1. Living creature on tile
  const creature = world.creatures.find(
    (c) => c.alive && c.z === player.z && c.x === tx && c.y === ty,
  );
  if (creature) {
    if (creature.isNpc) {
      handleChatInput(game, 'hi');
    } else {
      toggleTarget(game, creature.id);
    }
    return;
  }

  const dist = Math.max(Math.abs(tx - player.x), Math.abs(ty - player.y));

  // 2. Treasure Chest
  const chest = world.chests.find((c) => c.z === player.z && c.x === tx && c.y === ty);
  if (chest) {
    if (dist <= 1) {
      openContainerAt(game, chest);
    } else {
      player.walkQueue = findAdjacentWalkable(tx, ty);
    }
    return;
  }

  // 3. Corpse
  const corpse = world.corpses.find((c) => c.z === player.z && c.x === tx && c.y === ty);
  if (corpse) {
    if (dist <= 1) {
      if (corpse.items.length === 0) {
        ui.log('The corpse is empty.', 'loot');
      } else {
        openContainerAt(game, corpse);
      }
    } else {
      player.walkQueue = isTileWalkable(world, player.z, tx, ty, player, 'player')
        ? findPath(world, player.z, player.x, player.y, tx, ty, player, 'player')
        : findAdjacentWalkable(tx, ty);
    }
    return;
  }

  // 4. Signpost
  const signKey = `${player.z},${tx},${ty}`;
  if (world.signs[signKey]) {
    ui.log(world.signs[signKey], 'loot');
    return;
  }

  // 5. Sewer Grate / Ladder click when standing on or adjacent
  const portalKey = `${player.z},${tx},${ty}`;
  if (world.portals[portalKey] && dist <= 1) {
    player.x = tx;
    player.y = ty;
    triggerPortalIfPresent(game);
    return;
  }

  // 6. Click-to-walk
  if (tx === player.x && ty === player.y) {
    triggerPortalIfPresent(game);
    return;
  }

  const tile = TILES[getTileId(world, player.z, tx, ty)];
  if (!tile || !tile.walkable) return;

  const path = findPath(world, player.z, player.x, player.y, tx, ty, player, 'player');
  if (path.length > 0) {
    player.walkQueue = path;
  }
});

// Main loop
let lastTime = performance.now();

function frame(now) {
  const dtMs = Math.min(100, Math.max(0, now - lastTime));
  lastTime = now;

  if (player.moveProgress >= 1 && heldKeys.size > 0 && !isChatFocused()) {
    const { dx, dy } = getHeldMoveDelta();
    if (dx !== 0 || dy !== 0) {
      tryStepPlayer(game, dx, dy);
    }
  }

  updateWorldTimers(game, dtMs);
  updateCombat(game, dtMs);
  updateCreatures(game, dtMs);

  renderViewport(ctx, game, atlas, now, hoverTile);
  renderMinimap(minimapCtx, game);

  ui.sync(game, game.uiDirty);
  game.uiDirty = false;

  requestAnimationFrame(frame);
}

ui.sync(game, true);
requestAnimationFrame(frame);
