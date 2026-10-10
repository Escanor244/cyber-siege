// Cyber Siege - Bottom HUD Control Center
// Distinct Tabs: 1. Defense Armory | 2. Monster Raids | 3. Bosses & Sabotage | 4. Power Grid
import { useState, useEffect } from "react";
import {
  TOWERS,
  CREEP_RAIDS,
  BOSS_SUMMONS,
  SABOTAGE_SPELLS,
  ECO_UPGRADES,
} from "../lib/constants";
import {
  Shield,
  Swords,
  Skull,
  Zap,
  ArrowUpCircle,
  Trash2,
  X,
  BatteryCharging,
} from "lucide-react";

export default function ControlHUD({
  currentWave = 1,
  playerGold,
  selectedTowerType,
  onSelectTowerType,
  selectedPlacedTower,
  onCloseInspector,
  onUpgradeTower,
  onSellTower,
  onSendRaid,
  onUpgradeEconomy,
  onSabotageOpponent,
}) {
  const [activeTab, setActiveTab] = useState("defense"); // 'defense' | 'raids' | 'sabotage' | 'economy'
  const [cooldowns, setCooldowns] = useState({});

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    if (onCloseInspector) {
      onCloseInspector();
    }
    if (tab !== "defense") {
      onSelectTowerType(null);
    }
  };

  // Hotkeys 1-5 for tower selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT") return;
      const keyMap = { "1": "gatling", "2": "cryo", "3": "plasma", "4": "tesla", "5": "railgun" };
      if (keyMap[e.key]) {
        setActiveTab("defense");
        onSelectTowerType(selectedTowerType === keyMap[e.key] ? null : keyMap[e.key]);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTowerType, onSelectTowerType]);

  const handleCastSabotage = (spellKey) => {
    onSelectTowerType(null);
    const spell = SABOTAGE_SPELLS[spellKey];
    if (cooldowns[spellKey] || playerGold < spell.cost) return;

    onSabotageOpponent(spellKey);
    setCooldowns((prev) => ({ ...prev, [spellKey]: spell.cooldown }));

    const interval = setInterval(() => {
      setCooldowns((prev) => {
        const remaining = (prev[spellKey] || 0) - 1;
        if (remaining <= 0) {
          clearInterval(interval);
          const next = { ...prev };
          delete next[spellKey];
          return next;
        }
        return { ...prev, [spellKey]: remaining };
      });
    }, 1000);
  };

  return (
    <div className="control-hud">
      {/* 4 Distinct Tabs */}
      <div className="hud-tabs">
        <button
          onClick={() => handleSelectTab("defense")}
          className={`hud-tab-btn ${activeTab === "defense" ? "tab-active" : ""}`}
        >
          <Shield className="w-4 h-4 text-cyan-400" />
          <span>[1] DEFENSE ARMORY</span>
        </button>

        <button
          onClick={() => handleSelectTab("raids")}
          className={`hud-tab-btn ${activeTab === "raids" ? "tab-active" : ""}`}
        >
          <Swords className="w-4 h-4 text-green-400" />
          <span>[2] MONSTER RAIDS (SPAM)</span>
        </button>

        <button
          onClick={() => handleSelectTab("sabotage")}
          className={`hud-tab-btn ${activeTab === "sabotage" ? "tab-active" : ""}`}
        >
          <Skull className="w-4 h-4 text-red-400" />
          <span>[3] BOSSES & DEBUFFS</span>
        </button>

        <button
          onClick={() => handleSelectTab("economy")}
          className={`hud-tab-btn ${activeTab === "economy" ? "tab-active" : ""}`}
        >
          <BatteryCharging className="w-4 h-4 text-amber-400" />
          <span>[4] POWER GRID (ECO)</span>
        </button>
      </div>

      <div className="hud-content">
        {/* TAB 1: DEFENSE TOWERS */}
        {activeTab === "defense" && (
          <div className="hud-grid">
            {Object.values(TOWERS).map((t) => {
              const canAfford = playerGold >= t.cost;
              const isSelected = selectedTowerType === t.id;

              return (
                <button
                  key={t.id}
                  disabled={!canAfford && !isSelected}
                  onClick={() => onSelectTowerType(isSelected ? null : t.id)}
                  className={`card-btn tower-card ${isSelected ? "card-selected" : ""} ${
                    !canAfford ? "card-disabled" : ""
                  }`}
                  style={{ "--accent": t.color }}
                >
                  <div className="card-top">
                    <span className="hotkey-pill">{t.hotkey}</span>
                    <span className="card-title">{t.name}</span>
                    <span className="cost-tag">${t.cost}</span>
                  </div>
                  <div className="card-desc">{t.role}</div>
                  <div className="card-stats">
                    <span>DMG: {t.damage}</span>
                    <span>RNG: {t.range}</span>
                    <span>SPD: {t.fireRate}/s</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 2: MONSTER RAIDS (PURE OFFENSIVE SPAM) */}
        {activeTab === "raids" && (
          <div className="hud-grid grid-4col">
            {Object.values(CREEP_RAIDS).map((c) => {
              const canAfford = playerGold >= c.cost;
              // Regular creeps: Level rises every 2 waves (+25% HP per tier)
              const creepLevel = Math.max(1, Math.min(5, Math.ceil(currentWave / 2)));
              const hpMultiplier = 1 + (creepLevel - 1) * 0.25;
              const scaledHp = Math.round(c.hp * hpMultiplier);

              return (
                <button
                  key={c.id}
                  disabled={!canAfford}
                  onClick={() => {
                    onSelectTowerType(null);
                    onSendRaid(c.id);
                  }}
                  className={`card-btn creep-card ${!canAfford ? "card-disabled" : ""}`}
                  style={{ "--accent": c.color }}
                >
                  <div className="card-top">
                    <span className={`level-badge ${creepLevel >= 3 ? "lv-high" : ""}`}>
                      LV.{creepLevel} ({c.count}x)
                    </span>
                    <span className="card-title">{c.name}</span>
                    <span className="cost-tag">${c.cost}</span>
                  </div>
                  <div className="card-desc">{c.desc}</div>
                  <div className="card-stats">
                    <span className="font-bold text-white">
                      HP: {scaledHp}{" "}
                      {creepLevel > 1 && (
                        <span className="text-amber-400 font-normal">
                          (+{Math.round((hpMultiplier - 1) * 100)}%)
                        </span>
                      )}
                    </span>
                    <span>SPD: {c.speed}</span>
                    <span className="text-cyan-400 font-bold">➔ SPAM</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 3: BOSS SUMMONS & SABOTAGE DEBUFFS */}
        {activeTab === "sabotage" && (
          <div className="hud-grid grid-5col">
            {/* Bosses */}
            {Object.values(BOSS_SUMMONS).map((b) => {
              const canAfford = playerGold >= b.cost;
              // Bosses: Level rises every 4 waves (+35% HP per tier)
              const bossLevel = Math.max(1, Math.min(5, Math.ceil(currentWave / 4)));
              const bossHpMultiplier = 1 + (bossLevel - 1) * 0.35;
              const scaledBossHp = Math.round(b.hp * bossHpMultiplier);

              return (
                <button
                  key={b.id}
                  disabled={!canAfford}
                  onClick={() => {
                    onSelectTowerType(null);
                    onSendRaid(b.id);
                  }}
                  className={`card-btn boss-card ${!canAfford ? "card-disabled" : ""}`}
                >
                  <div className="card-top">
                    <span className="boss-level-badge">💀 BOSS LV.{bossLevel}</span>
                    <span className="card-title">{b.name}</span>
                    <span className="cost-tag">${b.cost}</span>
                  </div>
                  <div className="card-desc">{b.desc}</div>
                  <div className="card-stats">
                    <span className="font-bold text-white">
                      HP: {scaledBossHp.toLocaleString()}{" "}
                      {bossLevel > 1 && (
                        <span className="text-red-400 font-normal">
                          (+{Math.round((bossHpMultiplier - 1) * 100)}%)
                        </span>
                      )}
                    </span>
                    <span className="text-red-400 font-bold">LEAK: -{b.leakDamage} HP</span>
                  </div>
                </button>
              );
            })}

            {/* Sabotage Debuffs */}
            {Object.entries(SABOTAGE_SPELLS).map(([key, sp]) => {
              const onCooldown = !!cooldowns[key];
              const canAfford = playerGold >= sp.cost && !onCooldown;

              return (
                <button
                  key={key}
                  disabled={!canAfford}
                  onClick={() => handleCastSabotage(key)}
                  className={`card-btn sabotage-card ${!canAfford ? "card-disabled" : ""}`}
                >
                  <div className="card-top">
                    <span className="spell-icon">{sp.icon}</span>
                    <span className="card-title">{sp.name}</span>
                    <span className="cost-tag">${sp.cost}</span>
                  </div>
                  <div className="card-desc">{sp.desc}</div>
                  <div className="card-stats">
                    {onCooldown ? (
                      <span className="cooldown-tag">COOLING: {cooldowns[key]}s</span>
                    ) : (
                      <span className="ready-tag">READY (CD: {sp.cooldown}s)</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TAB 4: POWER GRID (DEDICATED INCOME UPGRADES) */}
        {activeTab === "economy" && (
          <div className="hud-grid grid-4col">
            {ECO_UPGRADES.map((eco) => {
              const canAfford = playerGold >= eco.cost;

              return (
                <button
                  key={eco.id}
                  disabled={!canAfford}
                  onClick={() => {
                    onSelectTowerType(null);
                    onUpgradeEconomy(eco.id);
                  }}
                  className={`card-btn eco-card ${!canAfford ? "card-disabled" : ""}`}
                >
                  <div className="card-top">
                    <span className="eco-badge">+{eco.incomeBoost} INC/2s</span>
                    <span className="card-title">{eco.name}</span>
                    <span className="cost-tag">${eco.cost}</span>
                  </div>
                  <div className="card-desc">{eco.desc}</div>
                  <div className="card-stats">
                    <span>TIER {eco.tier}</span>
                    <span className="text-amber-400">⚡ PERMANENT BOOST</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* TOWER INSPECTOR DRAWER (When placed tower is clicked) */}
        {selectedPlacedTower && (
          <div className="tower-inspector-panel">
            {(() => {
              const config = TOWERS[selectedPlacedTower.type];
              if (!config) return null;
              const upgradeCost = Math.floor(config.cost * 0.8 * selectedPlacedTower.level);
              const sellRefund = Math.floor(config.cost * 0.7 * selectedPlacedTower.level);
              const canUpgrade = playerGold >= upgradeCost;

              return (
                <div className="inspector-content">
                  <div className="inspector-header">
                    <div>
                      <h4 className="inspector-title">
                        {config.name} <span className="text-amber-400">Lv.{selectedPlacedTower.level}</span>
                      </h4>
                      <p className="inspector-role">{config.role}</p>
                    </div>
                    <button onClick={onCloseInspector} className="close-btn">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="inspector-stats">
                    <div className="stat-pill">
                      DMG: {Math.round(config.damage * (1 + (selectedPlacedTower.level - 1) * 0.35))}
                    </div>
                    <div className="stat-pill">
                      RNG: {Math.round(config.range * (1 + (selectedPlacedTower.level - 1) * 0.12))}
                    </div>
                    <div className="stat-pill">RATE: {config.fireRate}/s</div>
                  </div>

                  <div className="inspector-actions">
                    <button
                      disabled={!canUpgrade}
                      onClick={() => onUpgradeTower(selectedPlacedTower.id)}
                      className={`action-btn upgrade-btn ${!canUpgrade ? "btn-disabled" : ""}`}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>UPGRADE (${upgradeCost})</span>
                    </button>
                    <button
                      onClick={() => onSellTower(selectedPlacedTower.id)}
                      className="action-btn sell-btn"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>DISMANTLE (+${sellRefund})</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
