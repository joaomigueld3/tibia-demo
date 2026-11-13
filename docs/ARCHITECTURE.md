# Architecture Guide

This document describes the module boundaries, simulation state, rendering pipeline, and sprite composition system used in the **Tibia Browser Demo**.

---

## 1. Design Principles

1. **Zero Runtime Build Step:** Runs natively in any modern browser via ES Modules (`<script type="module" src="./src/main.js">`).
2. **Headless Simulation Decoupling:** Game state and rules (`constants.js`, `entities.js`, `world.js`, `combat.js`) do not depend on the DOM or HTML5 Canvas APIs, enabling direct unit testing under `node --test`.
3. **Pixel-Exact Oblique Rendering:** All canvas drawing (`sprites.js`, `pixelfont.js`, `renderer.js`) disables smoothing where pixel art is drawn (`imageSmoothingEnabled = false`) and isolates smooth interpolation solely to the low-resolution vertex lightmap overlay.

---

## 2. Module Dependency Graph

```text
constants.js
   ├──▶ entities.js ──▶ world.js ──▶ combat.js
   │                      │              │
   │                      ▼              ▼
   ├──▶ pixelfont.js ──▶ renderer.js     │
   │                      ▲              │
   └──▶ sprites.js ───────┴──▶ ui.js ◀───┼── audio.js
                                 ▲       │
                                 └─── main.js
```

| Module | Responsibility |
| --- | --- |
| `src/constants.js` | Tile catalog (`TILES`), items (`ITEMS`), monster templates (`CREATURE_TEMPLATES`), spells (`SPELLS`), stances (`STANCES`), and grid/viewport dimensions (`15×11` view, `36×28` map, `32px` tiles). |
| `src/entities.js` | Factory functions (`createPlayer`, `createCreature`, `createCorpse`, `createWorldChest`), XP formula `xpForLevel(level) = floor(35 * (level - 1)^1.75)`, stat aggregation (`getPlayerStats`), and backpack stack management. |
| `src/world.js` | Generates `floor0` (Surface) and `floor1` (Rat Sewer), portal links `(21, 14)` (`SEWER_GRATE` ↔ `LADDER`), signposts, `lightSources`, Protection Zone query (`isProtectionZone`), fog-of-war (`revealFog`), and 8-directional BFS (`findPath`) with strict diagonal corner-cutting guards. |
| `src/combat.js` | Executes 2-second melee attack ticks (`updateCombat`), monster aggro/wandering & respawns (`updateCreatures`), corpse/decal/VFX decay & food/mana regen (`updateWorldTimers`), loot transfer, spell casting (`castSpell`), and NPC keyword handling (`handleChatInput`). |
| `src/sprites.js` | `createSpriteAtlas()` asynchronously preloads 39 verified CC0 sprites from `assets/cc0/`, transforms palettes on offscreen canvases (e.g., magenta `labrat.png` → brown `rat` and red-eyed charcoal `cave_rat`, dark metal `chest.png` → oak/gold chest, `stairs_up.png` → stone steps), builds `64×64` tree canopies, and caches modular player paper-dolls keyed by `player.equipment`. |
| `src/pixelfont.js` | Renders crisp 1px-outlined ASCII bitmap strings into an LRU offscreen canvas cache (`LABEL_CACHE`) for overhead creature names, HP popups, and the `PZ` badge. |
| `src/renderer.js` | Five-pass `480×352` Canvas viewport renderer (`renderViewport`) plus `112×112` fog-of-war minimap (`renderMinimap`). |
| `src/ui.js` | `GameUI` manages DOM bindings, `uiDirty` synchronization, Battle List rows, classic 3×3 paper-doll equipment cross, backpack/loot slot grids, and timestamped server/chat log. |
| `src/audio.js` | `AudioEngine` synthesizes short retro sound effects (`hit`, `hurt`, `poof`, `heal`, `fire`, `coin`, `step`, `levelup`) via Web Audio oscillators with no audio files required. |
| `src/main.js` | Awaits `createSpriteAtlas()`, creates the `game` state object, wires keyboard/mouse listeners, and drives the fixed-interval `requestAnimationFrame` update/render loop. |

---

## 3. Five-Pass Viewport Rendering Pipeline (`src/renderer.js`)

The viewport renders a `15 × 11` tile camera centered smoothly on the player's interpolated position (`fromX/Y → x/y` via `moveProgress`):

1. **Pass 1 — Ground, Transitions & Decals:**
   - Draws ground variants (`GRASS` + wildflower accents, cropped seamless `TEMPLE_FLOOR` marble + `TEMPLE_CENTER` medallion, lightened `COBBLESTONE`, plank `WOOD_FLOOR`, `DIRT`, damp `SEWER_FLOOR`, `WATER`, `BRIDGE`).
   - Skips floor drawing under fully enclosed `SEWER_WALL` tiles (rendered as `#050608` rock void).
   - Overlays serrated grass-on-path edges, undercut water shorelines, oblique SE cast shadows from opaque tiles, blood decals, and decayable corpses.
2. **Pass 2 — Architectural Structures & Actors (`Y → X` Painter's Order):**
   - **Thin Stone Walls (`drawStoneWallTile`):** Connects `10px` masonry footings along exposed runs and shears South brick faces `(-6, -18)` in `3px` horizontal slices from CC0 brick textures, stroking only exposed outer coping boundaries so walls join seamlessly across tiles.
   - **Underground Cavern Walls (`drawSewerWallTile`):** Renders jagged stone cliff borders on wall tiles touching walkable passages and fades inward sides seamlessly into `#050608`.
   - **Multi-tile Trees & Props:** Renders `64×64` oak canopies at `(sx - 16, sy - 32)`, recessed `SEWER_GRATE`, `LADDER`, chests, crates, signposts, and flickering wall sconces.
   - **Equipment-Reactive Paper-Dolls:** Resolves `atlas.getPlayerActorSet(player.equipment)` (layering `human_m`, boots highlight, tunic/leather armor, hair/brass helmet, club/short sword, and wooden shield across `N/S/E/W` + walk bob + hit-flash).
3. **Pass 3 — Multi-Frame Visual Effects:**
   - Draws animated 3-frame `fire`, `heal`, `blood`, `slash`, and `poof` overlays.
4. **Pass 4 — Tile-Vertex Bilinear Lightmap (`z = 1`) & Glow Halos:**
   - Evaluates smooth RGB illumination across a `(VIEW_COLS + 4) × (VIEW_ROWS + 4)` vertex grid centered on active emitters (player personal torch, wall sconces, ladder skylight, and spell VFX), applies a soft exponential highlight shoulder (`250 * (1 - exp(-v / 175))`), and composites via `multiply` with `imageSmoothingEnabled = true`.
   - Adds subtle `'lighter'` additive halos around flickering flames and active spells.
5. **Pass 5 — Pixel Bitmap Labels & Overhead Bars:**
   - Renders `drawPixelText` actor names, HP bars, floating combat/heal text, and the top-left `PZ` indicator. On `z = 1`, non-player labels outside active emitter light radii remain hidden in darkness.

---

## 4. Extending the Demo

- **Adding an Item:** Add a definition under `ITEMS` in `src/constants.js`, ensure its key maps to an entry in `atlas.items` inside `src/sprites.js`, and handle any custom use behavior in `combat.js` (`useBackpackSlot`).
- **Adding a Monster:** Add a template under `CREATURE_TEMPLATES` in `src/constants.js`, add its directional sprite frames/flash masks to `atlas.actors` in `src/sprites.js`, and place spawns in `createWorld()` (`src/world.js`).
- **Adding a Floor or Portal:** Append a `MAP_HEIGHT × MAP_WIDTH` tile matrix to `floors` in `createWorld()`, add corresponding `explored` tracking, and register portal coordinates in `world.portals`.
