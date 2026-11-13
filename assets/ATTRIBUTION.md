# Sprite Asset Attribution

All 32×32 pixel-art PNG sprites under `assets/cc0/` are sourced from the
**Dungeon Crawl Stone Soup (DCSS) Tiles** collection (`crawl/tiles`, `releases/Nov-2015`),
released into the public domain under **CC0 1.0 Universal (CC0 1.0) Public Domain Dedication**.

- Repository: https://github.com/crawl/tiles
- License: CC0 1.0 Universal (No Copyright / Public Domain)
- Integration & Architectural Overhaul:
  - Layered modular player/NPC paper-dolls (`human_m`, `body_*`, `legs_*`, `boots_*`, `head_*`, `hand1_*`, `hand2_*`).
  - Offscreen palette adjustments (e.g., `labrat.png` -> earthy brown Rat and charcoal Cave Rat; `chest.png` -> warm oak & brass chest; `stairs_up.png` / `stairs_down.png` -> stone stairs; `brass_helmet.png`, `hand1_club.png`, `hand2_shield.png`).
  - Architectural Tibia 7.x oblique wall slicing, multi-tile 64×64 canopies, and tile-vertex lightmaps rendered dynamically on the HTML5 canvas.
