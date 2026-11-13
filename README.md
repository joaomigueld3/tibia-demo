# Tibia Browser Demo (Rookgaard Vertical Slice)

A zero-dependency browser RPG demo inspired by classic **7.x-era Tibia**, built with **HTML5 Canvas**, **CSS**, **Web Audio API**, and native **ES Modules**, featuring architectural 45-degree oblique rendering, tile-vertex torch lighting, and verified **CC0 32×32 pixel-art sprites**.

---

## Features

- **Two-Floor Rookgaard World (`36 × 28` tiles)**
  - **Surface (`z = 0`):** Sanctified Rookgaard Temple (**Protection Zone** with monk NPC **Cipfried**), Cobblestone Town Square, wooden Outpost, scenic river & bridge, forest oak clusters, Spiders, and town Rats.
  - **Rat Sewer (`z = 1`):** Subterranean stone passages, flooded canal with bridges, wooden treasure chest, Rats, and Cave Rats — accessible via the **Sewer Grate / Ladder** at `(21, 14)`.
- **Classic Tibia Mechanics**
  - Smooth interpolated tile movement (`WASD`, Arrow keys, diagonals `Q / E / Z / C`, or **click-to-walk** BFS pathfinding without corner-cutting).
  - **2-second melee combat clock** with **Offensive / Balanced / Defensive** stances, Battle List & click targeting, hit-flash masks, blood decals, and lootable corpses (`45s` decay).
  - **Spells & Potions:** `Exura` (Light Healing, `20` Mana), `Exevo Flam Hur` (3-tile directional Fire Wave, `25` Mana), and `Health Potion` (`40–65` HP).
  - **Equipment & Inventory:** `12`-slot backpack, stackable gold & food regeneration (`Cheese` / `Meat`), one-time treasure chest, and a classic **3×3 paper-doll equipment cross** (`Head`, `Weapon`, `Armor`, `Shield`, `Boots`) that dynamically updates the player's canvas sprite.
  - **NPC Dialogue:** Speak near **Cipfried** in the Temple (`hi`, `heal`, `help`) for free healing and tips.
  - **Auto-Exploring Minimap & Synthesized SFX:** Fog-of-war minimap (`3px/tile`) and toggleable retro Web Audio sound effects (`AudioEngine`).
- **Architectural Pixel-Art Renderer**
  - Thin oblique sandstone masonry walls with sheared South brick facades, shaded East faces, and doorway archways.
  - Enclosed cavern void (`#050608`) with beveled stone cliff edges and a smooth **tile-vertex bilinear multiply lightmap** on `z = 1`.
  - Tall `64 × 64` two-tile-high oak canopies, palette-remapped CC0 creatures & chests, and a crisp `1px`-outlined **bitmap pixel font** (`src/pixelfont.js`) with zero browser text blur.

---

## Quick Start

Because the client uses native `<script type="module">` imports and loads local PNG sprites, serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Or via npm script:

```bash
npm run serve
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

---

## Controls

| Action | Input |
| --- | --- |
| **Walk (Cardinal)** | `W / A / S / D` or Arrow keys |
| **Walk (Diagonal)** | `Q` (NW), `E` (NE), `Z` (SW), `C` (SE) |
| **Click-to-Walk** | **Left-Click** any reachable floor tile |
| **Use Grate / Ladder** | Walk onto `(21, 14)` or **Left-Click** when adjacent |
| **Attack / Target** | **Left-Click** monster on canvas or **Battle List** (`Esc` clears target) |
| **Look / Inspect** | **Right-Click**, `Shift + Left-Click`, or toggle **Look** button |
| **Open Corpse / Chest** | **Left-Click** an adjacent corpse or chest |
| **Quick Loot** | `Space` (takes items from nearby corpse/chest or opens loot panel) |
| **Spells & Potions** | `F1` (`Exura`) · `F2` (`Exevo Flam Hur`) · `F3` (`Health Potion`) |
| **Chat / Cast** | `Enter` to focus input · type `exura`, `exevo flam hur`, or `hi` / `heal` near Cipfried |

---

## Running Tests

Headless unit tests cover world generation, Protection Zones, BFS pathfinding, floor portals, melee combat, corpse looting, leveling, spells, equipment stats, food ticks, and NPC healing using Node's built-in test runner (`node --test`):

```bash
npm test
# or
node --test tests/game.test.mjs
```

---

## Project Structure

```text
tibia-demo/
├── index.html              # Classic retro beveled client shell & modals
├── styles.css              # Dark slate bevel HUD, 3x3 paper-doll, chat & responsive layout
├── package.json            # Module config & npm scripts (serve, test)
├── README.md
├── docs/
│   └── ARCHITECTURE.md     # Module dependency graph, rendering pipeline & systems guide
├── assets/
│   ├── ATTRIBUTION.md      # CC0 1.0 Public Domain attribution (crawl/tiles Nov-2015)
│   └── cc0/                # 32x32 CC0 pixel-art sprites
├── src/
│   ├── main.js             # Entry point, input handlers, and requestAnimationFrame loop
│   ├── constants.js        # Viewport dimensions, tiles, items, creatures, spells, stances
│   ├── entities.js         # Player/creature factories, stats, XP curve, inventory helpers
│   ├── world.js            # 2-floor Rookgaard generator, PZ bounds, fog-of-war, BFS pathfinder
│   ├── combat.js           # Combat clock, monster AI, corpses, loot, spells, NPC chat
│   ├── sprites.js          # Async CC0 loader, palette transforms, paper-doll compositor
│   ├── pixelfont.js        # 1px-outlined bitmap glyph renderer with offscreen cache
│   ├── renderer.js         # 5-pass oblique Canvas viewport renderer, lightmap & minimap
│   ├── ui.js               # Sidebar HUD, Battle List, 3x3 equipment doll, backpack & console
│   └── audio.js            # Web Audio API retro SFX synthesizer
└── tests/
    └── game.test.mjs       # Node.js headless gameplay test suite
```

---

## Asset License

All pixel-art sprites in `assets/cc0/` are sourced from **Dungeon Crawl Stone Soup (DCSS) Tiles** (`releases/Nov-2015`) under **CC0 1.0 Universal (Public Domain)**. See [`assets/ATTRIBUTION.md`](./assets/ATTRIBUTION.md) for details.
