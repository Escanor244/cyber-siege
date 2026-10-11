// Bottom HUD: Defense Armory | Monster Raids | Bosses & Sabotage | Power Grid,
// plus the tower inspector. Availability uses the same validators as the server.
import { useState } from "react";
import { Shield, Swords, Skull, ArrowUpCircle, Trash2, X, BatteryCharging, Crosshair } from "lucide-react";
import { TOWERS, MAX_TOWER_LEVEL } from "../shared/config/towers.js";
import { CREEP_RAIDS, BOSS_SUMMONS } from "../shared/config/creeps.js";
import { SABOTAGE_SPELLS } from "../shared/config/spells.js";
import { ECO_UPGRADES } from "../shared/config/economy.js";
import { TARGET_MODES } from "../shared/config/rules.js";
import { creepLevel, creepHpMultiplier, upgradeCost, sellRefund, towerDamage, towerRange } from "../shared/balance.js";
import * as V from "../shared/rules/validate.js";
import { matchups } from "../shared/sim/damage.js";
import { useTicker } from "../lib/useTicker.js";

const TABS = [
  { id: "defense", label: "DEFENSE", Icon: Shield, iconClass: "ic-cyan", key: "Q" },
  { id: "raids", label: "RAIDS", Icon: Swords, iconClass: "ic-green", key: "W" },
  { id: "sabotage", label: "BOSSES & DEBUFFS", Icon: Skull, iconClass: "ic-red", key: "E" },
  { id: "economy", label: "POWER GRID", Icon: BatteryCharging, iconClass: "ic-amber", key: "R" },
];

const TARGET_LABELS = { first: "FIRST", last: "LAST", strongest: "STRONG", closest: "CLOSE" };

export default function ControlHUD({ store, view, me, activeTab, setActiveTab, ghostType, onSelectTowerType, selectedTower, onCloseInspector }) {
  const [, force] = useState(0);
  const playing = view?.phase === "playing";
  const anyCooldown = playing && me && Object.values(me.cooldowns || {}).some((t) => t > (view?.matchMs || 0));
  useTicker(500, anyCooldown);

  const gold = me?.gold ?? 0;
  const wave = Math.max(1, view?.wave || 1);
  const match = view ? { ...view, matchMs: playing ? store.matchNow() : view.matchMs } : null;

  const selectTab = (tab) => {
    setActiveTab(tab);
    onCloseInspector();
    if (tab !== "defense") onSelectTowerType(null);
  };

  const why = (check) => (check.ok ? undefined : check.reason);

  return (
    <div className="control-hud">
      <div className="hud-tabs" role="tablist">
        {TABS.map(({ id, label, Icon, iconClass, key }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            onClick={() => selectTab(id)}
            className={`hud-tab-btn ${activeTab === id ? "tab-active" : ""}`}
            title={`${label} (${key})`}
          >
            <Icon size={16} className={iconClass} />
            <span className="tab-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="hud-content">
        {activeTab === "defense" && (
          <div className="hud-grid hud-grid-6">
            {Object.values(TOWERS).map((t) => {
              const canAfford = gold >= t.cost;
              const isSelected = ghostType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!playing || (!canAfford && !isSelected)}
                  onClick={() => onSelectTowerType(isSelected ? null : t.id)}
                  className={`card-btn tower-card ${isSelected ? "card-selected" : ""} ${!canAfford ? "card-disabled" : ""}`}
                  style={{ "--accent": t.color }}
                  title={canAfford ? t.desc : "Not enough gold"}
                >
                  <div className="card-top">
                    <span className="hotkey-pill">{t.hotkey}</span>
                    <span className="card-title">{t.name}</span>
                    <span className="cost-tag">${t.cost}</span>
                  </div>
                  <div className="card-desc">{t.role}</div>
                  <div className="card-stats">
                    <span>DMG {t.damage}</span>
                    <span className={t.canHitAir ? "txt-cyan" : "muted-tag"}>{t.canHitAir ? "✈ AIR" : "GND ONLY"}</span>
                    <span>{t.fireRate}/s</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "raids" && (
          <div className="hud-grid hud-grid-7">
            {Object.values(CREEP_RAIDS).map((c) => {
              const check = match && me ? V.canSendRaid(match, me, c.id) : { ok: false };
              const level = creepLevel(wave, false);
              const mult = creepHpMultiplier(level, false);
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!check.ok}
                  onClick={() => store.sendRaid(c.id)}
                  className={`card-btn creep-card ${!check.ok ? "card-disabled" : ""}`}
                  style={{ "--accent": c.color }}
                  title={why(check) || c.desc}
                >
                  <div className="card-top">
                    <span className={`level-badge ${level >= 3 ? "lv-high" : ""}`}>LV.{level}</span>
                    <span className="card-title">{c.name}</span>
                    <span className="cost-tag">${c.cost}</span>
                  </div>
                  <div className="card-desc">{c.desc}</div>
                  <div className="card-stats">
                    <span className="txt-white bold">
                      HP {Math.round(c.hp * mult)}
                      {level > 1 && <span className="txt-amber"> (+{Math.round((mult - 1) * 100)}%)</span>}
                    </span>
                    <CreepTag def={c} />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "sabotage" && (
          <div className="hud-grid hud-grid-7">
            {Object.values(BOSS_SUMMONS).map((b) => {
              const check = match && me ? V.canSendRaid(match, me, b.id) : { ok: false };
              const level = creepLevel(wave, true);
              const mult = creepHpMultiplier(level, true);
              return (
                <button
                  key={b.id}
                  type="button"
                  disabled={!check.ok}
                  onClick={() => store.sendRaid(b.id)}
                  className={`card-btn boss-card ${!check.ok ? "card-disabled" : ""}`}
                  title={why(check) || b.desc}
                >
                  <div className="card-top">
                    <span className="boss-level-badge">BOSS LV.{level}</span>
                    <span className="card-title">{b.name}</span>
                    <span className="cost-tag">${b.cost}</span>
                  </div>
                  <div className="card-desc">{b.desc}</div>
                  <div className="card-stats">
                    <span className="txt-white bold">HP {Math.round(b.hp * mult).toLocaleString()}</span>
                    <CreepTag def={b} fallback={<span className="txt-red bold">LEAK -{b.leakDamage}</span>} />
                  </div>
                </button>
              );
            })}

            {Object.values(SABOTAGE_SPELLS).map((sp) => {
              const check = match && me ? V.canCast(match, me, sp.id) : { ok: false };
              const cdMs = match && me ? V.spellCooldownRemainingMs(match, me, sp.id) : 0;
              return (
                <button
                  key={sp.id}
                  type="button"
                  disabled={!check.ok}
                  onClick={() => {
                    store.cast(sp.id);
                    force((n) => n + 1);
                  }}
                  className={`card-btn sabotage-card ${!check.ok ? "card-disabled" : ""}`}
                  title={why(check) || sp.desc}
                >
                  <div className="card-top">
                    <span className="spell-icon" aria-hidden="true">
                      {sp.icon}
                    </span>
                    <span className="card-title">{sp.name}</span>
                    <span className="cost-tag">${sp.cost}</span>
                  </div>
                  <div className="card-desc">{sp.desc}</div>
                  <div className="card-stats">
                    {cdMs > 0 ? (
                      <span className="cooldown-tag">COOLING {Math.ceil(cdMs / 1000)}s</span>
                    ) : (
                      <span className="ready-tag">READY · CD {sp.cooldown}s</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === "economy" && (
          <div className="hud-grid hud-grid-4">
            {ECO_UPGRADES.map((eco) => {
              const check = match && me ? V.canBuyEco(match, me, eco.id) : { ok: false };
              return (
                <button
                  key={eco.id}
                  type="button"
                  disabled={!check.ok}
                  onClick={() => store.buyEco(eco.id)}
                  className={`card-btn eco-card ${!check.ok ? "card-disabled" : ""}`}
                  title={why(check) || eco.desc}
                >
                  <div className="card-top">
                    <span className="eco-badge">+{eco.incomeBoost}/2s</span>
                    <span className="card-title">{eco.name}</span>
                    <span className="cost-tag">${eco.cost}</span>
                  </div>
                  <div className="card-desc">{eco.desc}</div>
                  <div className="card-stats">
                    <span>TIER {eco.tier}</span>
                    <span className="txt-amber">PERMANENT</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedTower && me && <TowerInspector store={store} match={match} me={me} tower={selectedTower} onClose={onCloseInspector} />}
      </div>
    </div>
  );
}

// One-word ability tag for a creep card
function CreepTag({ def, fallback = null }) {
  if (def.flying) return <span className="ability-tag tag-air">✈ AIR</span>;
  if (def.healAura) return <span className="ability-tag tag-heal">✚ HEAL AURA</span>;
  if (def.jamAura) return <span className="ability-tag tag-jam">📡 JAMS TURRETS</span>;
  if (def.empPulse) return <span className="ability-tag tag-emp">⚡ EMP PULSE</span>;
  if (def.shieldAuraRadius) return <span className="ability-tag tag-shield">🛡 SHIELD AURA</span>;
  return fallback || <span>SPD {def.speed}</span>;
}

function MatchupHint({ damageType }) {
  const { strong, weak } = matchups(damageType);
  return (
    <div className="matchup-hint">
      {strong.length > 0 && <span className="txt-green">▲ {strong.join(", ").toUpperCase()}</span>}
      {weak.length > 0 && <span className="txt-red">▼ {weak.join(", ").toUpperCase()}</span>}
    </div>
  );
}

function TowerInspector({ store, match, me, tower, onClose }) {
  const def = TOWERS[tower.type];
  if (!def) return null;
  const isMax = tower.level >= MAX_TOWER_LEVEL;
  const cost = upgradeCost(def, tower.level);
  const refund = sellRefund(def, tower.level);
  const canUpgrade = V.canUpgrade(match, me, tower.id);

  return (
    <div className="tower-inspector-panel" role="dialog" aria-label={`${def.name} inspector`}>
      <div className="inspector-content">
        <div className="inspector-head">
          <div>
            <h4 className="inspector-title">
              {def.name} <span className="txt-amber">Lv.{tower.level}</span>
            </h4>
            <p className="inspector-role">{def.role}</p>
          </div>
          <button type="button" onClick={onClose} className="close-btn" aria-label="Close inspector">
            <X size={18} />
          </button>
        </div>

        <div className="inspector-stats">
          <div className="stat-pill">DMG {towerDamage(def, tower.level)}</div>
          <div className="stat-pill">RNG {Math.round(towerRange(def, tower.level))}</div>
          <div className="stat-pill">{def.fireRate}/s</div>
          <MatchupHint damageType={def.damageType} />
        </div>

        <div className="target-modes" role="radiogroup" aria-label="Targeting">
          <Crosshair size={14} className="ic-cyan" />
          {TARGET_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={(tower.targetMode || "first") === mode}
              className={`segment segment-sm ${(tower.targetMode || "first") === mode ? "segment-active" : ""}`}
              onClick={() => store.setTarget(tower.id, mode)}
            >
              {TARGET_LABELS[mode]}
            </button>
          ))}
        </div>

        <div className="inspector-actions">
          <button
            type="button"
            disabled={!canUpgrade.ok}
            onClick={() => store.upgrade(tower.id)}
            className={`action-btn upgrade-btn ${!canUpgrade.ok ? "btn-disabled" : ""}`}
            title={canUpgrade.ok ? "Upgrade" : canUpgrade.reason}
          >
            <ArrowUpCircle size={16} />
            <span>{isMax ? "MAX LEVEL" : `UPGRADE $${cost}`}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              store.sell(tower.id);
              onClose();
            }}
            className="action-btn sell-btn"
          >
            <Trash2 size={16} />
            <span>SELL +${refund}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
