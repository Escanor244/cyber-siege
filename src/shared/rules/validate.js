// Action validation. The server uses these to accept/reject actions and the UI
// uses the same functions for disabled buttons and the placement preview, so a
// button can never offer something the server will refuse.
// Each returns { ok: true } or { ok: false, reason }.

import { isInBounds, isPathCell } from "../config/map.js";
import { getTowerDefinition, MAX_TOWER_LEVEL } from "../config/towers.js";
import { findCreepDefinition } from "../config/creeps.js";
import { getSpellDefinition } from "../config/spells.js";
import { getEcoUpgrade } from "../config/economy.js";
import { MAX_OUTSTANDING_RAID_CREEPS, TARGET_MODES } from "../config/rules.js";
import { upgradeCost } from "../balance.js";
import { openCount } from "./ledger.js";

const OK = Object.freeze({ ok: true });
const fail = (reason) => ({ ok: false, reason });

function canAct(match, player) {
  if (!player) return fail("Not in this match");
  if (match.phase !== "playing") return fail("Match is not running");
  if (match.pause) return fail("Match is paused");
  return OK;
}

export function canPlaceAt(player, gx, gy) {
  if (!isInBounds(gx, gy)) return fail("Outside the grid");
  if (isPathCell(gx, gy)) return fail("Can't build on the path");
  if (player.towers.some((t) => t.gridX === gx && t.gridY === gy)) return fail("Cell occupied");
  return OK;
}

export function canBuild(match, player, towerType, gx, gy) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  const def = getTowerDefinition(towerType);
  if (!def) return fail("Unknown tower");
  const place = canPlaceAt(player, gx, gy);
  if (!place.ok) return place;
  if (player.gold < def.cost) return fail("Not enough gold");
  return OK;
}

function findTower(player, towerId) {
  return player?.towers.find((t) => t.id === towerId) || null;
}

export function canUpgrade(match, player, towerId) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  const tower = findTower(player, towerId);
  if (!tower) return fail("Tower not found");
  if (tower.level >= MAX_TOWER_LEVEL) return fail("Max level");
  if (player.gold < upgradeCost(getTowerDefinition(tower.type), tower.level)) return fail("Not enough gold");
  return OK;
}

export function canSell(match, player, towerId) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  if (!findTower(player, towerId)) return fail("Tower not found");
  return OK;
}

export function canSetTarget(match, player, towerId, mode) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  if (!findTower(player, towerId)) return fail("Tower not found");
  if (!TARGET_MODES.includes(mode)) return fail("Unknown targeting mode");
  return OK;
}

export function canSendRaid(match, player, creepType) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  const def = findCreepDefinition(creepType);
  if (!def) return fail("Unknown unit");
  if (player.gold < def.cost) return fail("Not enough gold");
  const opponent = match.players.find((p) => p.id !== player.id);
  if (!opponent) return fail("No opponent");
  // Clients only see the public view (no ledger); the server enforces this limit.
  const outstanding = match.ledger ? openCount(match.ledger, opponent.id, "raid") : 0;
  if (outstanding + (def.count || 1) > MAX_OUTSTANDING_RAID_CREEPS) {
    return fail("Enemy lane is full");
  }
  return OK;
}

export function canBuyEco(match, player, ecoId) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  const eco = getEcoUpgrade(ecoId);
  if (!eco) return fail("Unknown upgrade");
  if (player.gold < eco.cost) return fail("Not enough gold");
  return OK;
}

export function spellCooldownRemainingMs(match, player, spellId) {
  return Math.max(0, (player.cooldowns?.[spellId] || 0) - match.matchMs);
}

export function canCast(match, player, spellId) {
  const base = canAct(match, player);
  if (!base.ok) return base;
  const spell = getSpellDefinition(spellId);
  if (!spell) return fail("Unknown spell");
  const cd = spellCooldownRemainingMs(match, player, spellId);
  if (cd > 0) return fail(`On cooldown (${Math.ceil(cd / 1000)}s)`);
  if (player.gold < spell.cost) return fail("Not enough gold");
  const opponent = match.players.find((p) => p.id !== player.id);
  if (!opponent) return fail("No opponent");
  if ((spell.destroysTower || spell.id === "emp_freeze") && opponent.towers.length === 0) {
    return fail("Enemy has no turrets");
  }
  return OK;
}
