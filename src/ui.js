/**
 * Sidebar HUD, Battle List, Equipment, Backpack, Loot Container, and Console Log controller.
 */

import { ITEMS, MAX_BACKPACK_SLOTS, STANCES, VIEW_COLS, VIEW_ROWS } from './constants.js';
import { formatItemStack, getPlayerStats, xpForLevel } from './entities.js';
import { isProtectionZone } from './world.js';

export class GameUI {
  constructor(atlas, actions) {
    this.atlas = atlas;
    this.actions = actions;
    this.lastBattleSig = '';

    this.el = {
      floorLabel: document.getElementById('floor-label'),
      coordsLabel: document.getElementById('coords-label'),
      pzBadge: document.getElementById('pz-badge'),
      hpText: document.getElementById('hp-text'),
      hpFill: document.getElementById('hp-fill'),
      manaText: document.getElementById('mana-text'),
      manaFill: document.getElementById('mana-fill'),
      levelText: document.getElementById('level-text'),
      xpText: document.getElementById('xp-text'),
      xpFill: document.getElementById('xp-fill'),
      statsSummary: document.getElementById('stats-summary'),
      fedStatus: document.getElementById('fed-status'),
      equipGrid: document.getElementById('equip-grid'),
      stanceButtons: Array.from(document.querySelectorAll('.stance-btn')),
      battleList: document.getElementById('battle-list'),
      lootPanel: document.getElementById('loot-panel'),
      lootTitle: document.getElementById('loot-title'),
      lootGrid: document.getElementById('loot-grid'),
      takeAllBtn: document.getElementById('take-all-btn'),
      closeLootBtn: document.getElementById('close-loot-btn'),
      backpackGrid: document.getElementById('backpack-grid'),
      consoleLog: document.getElementById('console-log'),
      chatForm: document.getElementById('chat-form'),
      chatInput: document.getElementById('chat-input'),
      btnExura: document.getElementById('hk-exura'),
      btnFlam: document.getElementById('hk-flam'),
      btnPotion: document.getElementById('hk-potion'),
      btnLook: document.getElementById('hk-look'),
      btnSfx: document.getElementById('sfx-toggle'),
      btnHelp: document.getElementById('help-toggle'),
      helpModal: document.getElementById('help-modal'),
      closeHelpBtn: document.getElementById('close-help-btn'),
    };

    this.bindStaticEvents();
  }

  bindStaticEvents() {
    for (const btn of this.el.stanceButtons) {
      btn.addEventListener('click', () => {
        this.actions.onStance(btn.dataset.stance);
      });
    }

    this.el.takeAllBtn.addEventListener('click', () => this.actions.onTakeAll());
    this.el.closeLootBtn.addEventListener('click', () => this.actions.onCloseLoot());

    this.el.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = this.el.chatInput.value;
      if (val.trim()) {
        this.actions.onChat(val);
        this.el.chatInput.value = '';
      }
      this.el.chatInput.blur();
    });

    this.el.btnExura.addEventListener('click', () => this.actions.onSpell('exura'));
    this.el.btnFlam.addEventListener('click', () => this.actions.onSpell('exevo flam hur'));
    this.el.btnPotion.addEventListener('click', () => this.actions.onPotion());
    this.el.btnLook.addEventListener('click', () => this.actions.onToggleLook());
    this.el.btnSfx.addEventListener('click', () => this.actions.onToggleSfx());
    this.el.btnHelp.addEventListener('click', () => {
      this.el.helpModal.classList.toggle('hidden');
    });
    this.el.closeHelpBtn.addEventListener('click', () => {
      this.el.helpModal.classList.add('hidden');
    });
  }

  log(text, category = 'server') {
    const line = document.createElement('div');
    line.className = `log-line log-${category}`;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    line.textContent = `${hh}:${mm} ${text}`;
    this.el.consoleLog.appendChild(line);

    while (this.el.consoleLog.children.length > 140) {
      this.el.consoleLog.removeChild(this.el.consoleLog.firstChild);
    }
    this.el.consoleLog.scrollTop = this.el.consoleLog.scrollHeight;
  }

  setSfxEnabled(enabled) {
    this.el.btnSfx.textContent = enabled ? 'SFX: ON' : 'SFX: OFF';
    this.el.btnSfx.classList.toggle('active', enabled);
  }

  setLookMode(active) {
    this.el.btnLook.classList.toggle('active', active);
  }

  getVisibleCreatures(game) {
    const { player, world } = game;
    const halfW = Math.floor(VIEW_COLS / 2);
    const halfH = Math.floor(VIEW_ROWS / 2);
    return world.creatures.filter(
      (c) =>
        c.alive &&
        c.z === player.z &&
        Math.abs(c.x - player.x) <= halfW &&
        Math.abs(c.y - player.y) <= halfH,
    );
  }

  sync(game, force = false) {
    const { player } = game;
    const stats = getPlayerStats(player);

    // Top bar
    const floorName = player.z === 0 ? 'Surface (z=0)' : 'Rat Sewer (z=1)';
    this.el.floorLabel.textContent = floorName;
    this.el.coordsLabel.textContent = `${player.x}, ${player.y}`;
    this.el.pzBadge.classList.toggle('hidden', !isProtectionZone(player.z, player.x, player.y));

    // Bars
    this.el.hpText.textContent = `${player.hp}/${player.maxHp}`;
    this.el.hpFill.style.width = `${Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100))}%`;

    this.el.manaText.textContent = `${player.mana}/${player.maxMana}`;
    this.el.manaFill.style.width = `${Math.max(0, Math.min(100, (player.mana / player.maxMana) * 100))}%`;

    const curFloorXp = xpForLevel(player.level);
    const nextLevelXp = xpForLevel(player.level + 1);
    const span = Math.max(1, nextLevelXp - curFloorXp);
    const xpPct = Math.max(0, Math.min(100, ((player.xp - curFloorXp) / span) * 100));
    this.el.levelText.textContent = `Lvl ${player.level}`;
    this.el.xpText.textContent = `${player.xp}/${nextLevelXp} XP`;
    this.el.xpFill.style.width = `${xpPct}%`;

    this.el.statsSummary.textContent = `Atk ${stats.effectiveAtk} · Def ${stats.effectiveDef}`;
    this.el.fedStatus.textContent = player.fedTicks > 0 ? `Fed (${player.fedTicks})` : 'Hungry';
    this.el.fedStatus.className = player.fedTicks > 0 ? 'status-fed' : 'status-hungry';

    // Battle List update check
    const visible = this.getVisibleCreatures(game);
    const battleSig = visible
      .map((c) => `${c.id}:${c.hp}:${player.targetId === c.id ? 1 : 0}`)
      .join('|');

    if (force || battleSig !== this.lastBattleSig) {
      this.lastBattleSig = battleSig;
      this.renderBattleList(visible, player.targetId);
    }

    if (!force) return;

    // Stance buttons
    for (const btn of this.el.stanceButtons) {
      btn.classList.toggle('active', btn.dataset.stance === player.stance);
      btn.title = STANCES[btn.dataset.stance]?.label || '';
    }

    this.renderEquipment(player);
    this.renderBackpack(player);
    this.renderLootContainer(game.openContainer);
  }

  renderEquipment(player) {
    // Classic 3x3 Tibia paper-doll cross silhouette
    const slots = [
      { key: null, label: 'Neck', deco: true },
      { key: 'helmet', label: 'Head' },
      { key: null, label: 'Bag', deco: true },
      { key: 'weapon', label: 'Wpn' },
      { key: 'armor', label: 'Armor' },
      { key: 'shield', label: 'Shld' },
      { key: null, label: 'Ring', deco: true },
      { key: 'boots', label: 'Boots' },
      { key: null, label: 'Torch', deco: true },
    ];
    this.el.equipGrid.innerHTML = '';

    for (const slot of slots) {
      const div = document.createElement('div');
      div.className = slot.deco ? 'item-slot equip-slot equip-deco' : 'item-slot equip-slot';
      if (slot.deco) {
        const lbl = document.createElement('span');
        lbl.className = 'slot-placeholder';
        lbl.textContent = slot.label;
        div.appendChild(lbl);
        div.title = `${slot.label} slot`;
      } else {
        const itemId = player.equipment[slot.key];
        if (itemId && ITEMS[itemId]) {
          const def = ITEMS[itemId];
          const img = document.createElement('img');
          img.src = this.atlas.getDataUrl(itemId);
          img.alt = def.name;
          div.appendChild(img);
          div.title = `${def.name}\n${def.description}`;
        } else {
          const lbl = document.createElement('span');
          lbl.className = 'slot-placeholder';
          lbl.textContent = slot.label;
          div.appendChild(lbl);
          div.title = `Empty ${slot.label} slot`;
        }
      }
      this.el.equipGrid.appendChild(div);
    }
  }

  renderBattleList(visible, targetId) {
    this.el.battleList.innerHTML = '';
    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'battle-empty';
      empty.textContent = 'No creatures nearby';
      this.el.battleList.appendChild(empty);
      return;
    }

    for (const creature of visible) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'battle-row';
      if (targetId === creature.id) row.classList.add('targeted');
      if (creature.isNpc) row.classList.add('npc-row');

      const icon = document.createElement('img');
      icon.src = this.atlas.getDataUrl(creature.templateId);
      icon.alt = creature.name;

      const info = document.createElement('div');
      info.className = 'battle-info';

      const name = document.createElement('div');
      name.className = 'battle-name';
      name.textContent = creature.name;

      const bar = document.createElement('div');
      bar.className = 'battle-hp-bar';
      const fill = document.createElement('div');
      fill.className = 'battle-hp-fill';
      const pct = Math.max(0, Math.min(100, (creature.hp / creature.maxHp) * 100));
      fill.style.width = `${pct}%`;
      fill.style.backgroundColor = creature.isNpc
        ? '#4bc9f5'
        : pct > 60
          ? '#00bf00'
          : pct > 30
            ? '#c0c000'
            : '#d12626';
      bar.appendChild(fill);

      info.appendChild(name);
      info.appendChild(bar);
      row.appendChild(icon);
      row.appendChild(info);

      row.addEventListener('click', () => this.actions.onTarget(creature.id));
      this.el.battleList.appendChild(row);
    }
  }

  renderBackpack(player) {
    this.el.backpackGrid.innerHTML = '';
    for (let i = 0; i < MAX_BACKPACK_SLOTS; i++) {
      const stack = player.backpack[i];
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'item-slot';

      if (stack && ITEMS[stack.itemId]) {
        const def = ITEMS[stack.itemId];
        const img = document.createElement('img');
        img.src = this.atlas.getDataUrl(stack.itemId);
        img.alt = def.name;
        slot.appendChild(img);

        if (stack.count > 1) {
          const badge = document.createElement('span');
          badge.className = 'item-count';
          badge.textContent = String(stack.count);
          slot.appendChild(badge);
        }

        slot.title = `${formatItemStack(stack)}\n${def.description}`;
        slot.addEventListener('click', () => this.actions.onUseBackpack(i));
      } else {
        slot.disabled = true;
      }

      this.el.backpackGrid.appendChild(slot);
    }
  }

  renderLootContainer(container) {
    if (!container || container.items.length === 0) {
      this.el.lootPanel.classList.add('hidden');
      return;
    }

    this.el.lootPanel.classList.remove('hidden');
    this.el.lootTitle.textContent = container.name;
    this.el.lootGrid.innerHTML = '';

    container.items.forEach((stack, idx) => {
      const def = ITEMS[stack.itemId];
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'item-slot';

      const img = document.createElement('img');
      img.src = this.atlas.getDataUrl(stack.itemId);
      img.alt = def?.name || stack.itemId;
      slot.appendChild(img);

      if (stack.count > 1) {
        const badge = document.createElement('span');
        badge.className = 'item-count';
        badge.textContent = String(stack.count);
        slot.appendChild(badge);
      }

      slot.title = `Take ${formatItemStack(stack)}`;
      slot.addEventListener('click', () => this.actions.onTakeItem(idx));
      this.el.lootGrid.appendChild(slot);
    });
  }
}
