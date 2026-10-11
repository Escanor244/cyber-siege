// Cyber Siege - Bespoke Visual Assets & Canvas Renderers
import { drawGlow } from "./glow.js";
// 3 Visual Tiers: Tier 1 (Lv. 1-4), Tier 2 (Lv. 5-9), Tier 3 (Lv. 10-100)

export function getEntityTier(level = 1) {
  if (level >= 10) return 3;
  if (level >= 5) return 2;
  return 1;
}

// ==========================================
// 1. DEFENSE TOWERS RENDERERS
// ==========================================

export function drawTowerAsset(ctx, tower, config, tx, ty, isSelected, time) {
  const tier = getEntityTier(tower.level || 1);
  const angle = tower.targetAngle || 0;

  ctx.save();

  // --- Pedestal Base ---
  drawPedestal(ctx, tx, ty, isSelected, config, tier, time);

  // --- Rotating Weapon Turret ---
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(angle);

  switch (tower.type) {
    case "gatling":
      drawGatlingWeapon(ctx, config, tier, time);
      break;
    case "cryo":
      drawCryoWeapon(ctx, config, tier, time);
      break;
    case "plasma":
      drawPlasmaWeapon(ctx, config, tier, time);
      break;
    case "tesla":
      drawTeslaWeapon(ctx, config, tier, time);
      break;
    case "railgun":
      drawRailgunWeapon(ctx, config, tier, time);
      break;
    default:
      drawDefaultWeapon(ctx, config, tier);
      break;
  }

  ctx.restore(); // Restore angle rotation
  ctx.restore(); // Restore base
}

function drawPedestal(ctx, tx, ty, isSelected, config, tier, time) {
  const size = 38;
  const half = size / 2;

  // Energy bleed under the plate: brighter as the turret is upgraded
  drawGlow(ctx, tx, ty, tier === 3 ? 34 : tier === 2 ? 30 : 26, tier === 3 ? "#f59e0b" : config.color, tier === 3 ? 0.55 : tier === 2 ? 0.4 : 0.22);

  // Base background
  ctx.fillStyle = tier === 3 ? "#0f172a" : tier === 2 ? "#172033" : "#1e293b";
  ctx.strokeStyle = isSelected
    ? "#00f0ff"
    : tier === 3
    ? "#f59e0b"
    : config.accent || "#0284c7";
  ctx.lineWidth = isSelected ? 2.5 : tier === 3 ? 2 : 1.5;

  // Pedestal Plate
  ctx.beginPath();
  ctx.roundRect(tx - half, ty - half, size, size, tier === 3 ? 8 : tier === 2 ? 6 : 4);
  ctx.fill();
  ctx.stroke();

  // Corner Rivets / Power Nodes
  const rOffset = half - 4;
  const corners = [
    [-rOffset, -rOffset],
    [rOffset, -rOffset],
    [-rOffset, rOffset],
    [rOffset, rOffset],
  ];

  corners.forEach(([cx, cy]) => {
    ctx.fillStyle = tier === 3 ? "#fbbf24" : tier === 2 ? config.color : "#475569";
    ctx.beginPath();
    ctx.arc(tx + cx, ty + cy, tier === 3 ? 2.5 : 2, 0, Math.PI * 2);
    ctx.fill();
  });

  // Tier 2 & 3: Plating & Conduits
  if (tier >= 2) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(tx - half + 5, ty - half + 5, size - 10, size - 10);
  }

  // Tier 3: Pulsing Apex Core Aura
  if (tier === 3) {
    const pulse = Math.sin(time * 0.006) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(245, 158, 11, ${pulse * 0.6})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(tx, ty, half + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// --- GATLING (Kinetic Rapid Fire) ---
function drawGatlingWeapon(ctx, config, tier, time) {
  // Center Turret Mount
  ctx.fillStyle = "#090d16";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (tier === 1) {
    // Single Heavy Rotary Barrel
    ctx.fillStyle = "#334155";
    ctx.fillRect(4, -3, 16, 6);
    // Muzzle tip
    ctx.fillStyle = config.color;
    ctx.fillRect(18, -4, 3, 8);
  } else if (tier === 2) {
    // Twin Heavy Rotary Barrels with Ammo Drums
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-6, -11, 8, 4); // Top ammo drum
    ctx.fillRect(-6, 7, 8, 4);  // Bottom ammo drum

    ctx.fillStyle = "#334155";
    ctx.fillRect(4, -5, 17, 4); // Barrel 1
    ctx.fillRect(4, 1, 17, 4);  // Barrel 2

    // Flash brakes
    ctx.fillStyle = config.color;
    ctx.fillRect(19, -6, 3, 5);
    ctx.fillRect(19, 1, 3, 5);
  } else {
    // Tier 3: Quad Heavy Rotary Minigun with Amber Coils
    const spin = (time * 0.015) % Math.PI;

    // Side Magazine Housings
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-8, -13, 10, 5);
    ctx.fillRect(-8, 8, 10, 5);

    // Quad barrels cluster
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(2, -7, 18, 14);

    ctx.fillStyle = "#64748b";
    ctx.fillRect(6, -6, 16, 3);
    ctx.fillRect(6, -2, 16, 3);
    ctx.fillRect(6, 3, 16, 3);

    // Rotating barrel ring
    ctx.strokeStyle = "#fbbf24";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(20, 0, 6 + Math.sin(spin) * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // Glowing core coil
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Cap
  ctx.fillStyle = tier === 3 ? "#fbbf24" : config.color;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
}

// --- CRYO (Area Frost Beam) ---
function drawCryoWeapon(ctx, config, tier, time) {
  ctx.fillStyle = "#091322";
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#00f0ff";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (tier === 1) {
    // Spherical cryo lens & forward nozzle
    ctx.fillStyle = "rgba(0, 240, 255, 0.5)";
    ctx.fillRect(5, -3.5, 12, 7);
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(17, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (tier === 2) {
    // Twin Sub-Zero Condenser Rods
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(16, -5);
    ctx.moveTo(0, 9);
    ctx.lineTo(16, 5);
    ctx.stroke();

    // Central Frosted Crystal
    ctx.fillStyle = "#00f0ff";
    drawGlow(ctx, 12, 0, 15, "#00f0ff");
        ctx.fillRect(6, -2.5, 12, 5);
  } else {
    // Tier 3: Tri-Crystal Glacial Focusing Prism
    const pulse = Math.sin(time * 0.008) * 3;

    // Arctic Radiator Wings
    ctx.fillStyle = "#0284c7";
    ctx.beginPath();
    ctx.moveTo(-6, -13);
    ctx.lineTo(8, -10);
    ctx.lineTo(2, -4);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 13);
    ctx.lineTo(8, 10);
    ctx.lineTo(2, 4);
    ctx.fill();

    // Focused Prism Core
    ctx.fillStyle = "#e0f2fe";
    drawGlow(ctx, 16, 0, 20, "#38bdf8");
        ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(18, -6);
    ctx.lineTo(22 + pulse * 0.5, 0);
    ctx.lineTo(18, 6);
    ctx.closePath();
    ctx.fill();
  }

  // Inner Frost Eye
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

// --- PLASMA (Heavy Splash Mortar) ---
function drawPlasmaWeapon(ctx, config, tier, time) {
  ctx.fillStyle = "#0a1f0d";
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (tier === 1) {
    // Heavy Single Bore Mortar
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(2, -6, 16, 12);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(16, -7, 3, 14); // Reinforced muzzle
  } else if (tier === 2) {
    // Twin-Vented Artillery Mortar with Thermal Coils
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, -8, 18, 16);

    // Green Thermal Coils
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(5, -9);
    ctx.lineTo(5, 9);
    ctx.moveTo(11, -9);
    ctx.lineTo(11, 9);
    ctx.stroke();

    ctx.fillStyle = "#22c55e";
    ctx.fillRect(17, -9, 4, 18);
  } else {
    // Tier 3: Orbital Siege Particle Cannon with Superheated Rails
    const boil = Math.sin(time * 0.012) * 2;

    // Heavy Hydraulic Dampers
    ctx.fillStyle = "#334155";
    ctx.fillRect(-10, -12, 12, 5);
    ctx.fillRect(-10, 7, 12, 5);

    // Accelerator Rails
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, -9, 21, 18);

    // Swirling Emerald Core
    ctx.fillStyle = "#22c55e";
    drawGlow(ctx, 10, 0, 17, "#4ade80");
        ctx.beginPath();
    ctx.arc(10, 0, 5 + boil * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Rail Tips
    ctx.fillStyle = "#86efac";
    ctx.fillRect(19, -10, 4, 6);
    ctx.fillRect(19, 4, 4, 6);
  }

  // Core Plug
  ctx.fillStyle = "#15803d";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
}

// --- TESLA (Chain Lightning Spire) ---
function drawTeslaWeapon(ctx, config, tier, time) {
  ctx.fillStyle = "#0c1527";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (tier === 1) {
    // Central Tesla Spire
    ctx.fillStyle = "#64748b";
    ctx.fillRect(3, -2.5, 14, 5);
    // Discharge Sphere
    ctx.fillStyle = "#00f0ff";
    ctx.beginPath();
    ctx.arc(18, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (tier === 2) {
    // Twin Resonant Tesla Coils with Arcing Energy
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -7);
    ctx.lineTo(16, -7);
    ctx.moveTo(2, 7);
    ctx.lineTo(16, 7);
    ctx.stroke();

    // Twin Electrodes
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.arc(17, -7, 4, 0, Math.PI * 2);
    ctx.arc(17, 7, 4, 0, Math.PI * 2);
    ctx.fill();

    // Crackling Arc between them
    if (Math.sin(time * 0.02) > 0.1) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(17, -7);
      ctx.lineTo(14, 0);
      ctx.lineTo(17, 7);
      ctx.stroke();
    }
  } else {
    // Tier 3: Tri-Pylon Dynamo with Rotating Induction Ring
    const pulse = (time * 0.01) % (Math.PI * 2);

    // Triple Pylons
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(18, -8);
    ctx.moveTo(0, 0);
    ctx.lineTo(21, 0);
    ctx.moveTo(0, 9);
    ctx.lineTo(18, 8);
    ctx.stroke();

    // Induction Rings
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(10, 0, 8 + Math.sin(pulse) * 2, 0, Math.PI * 2);
    ctx.stroke();

    // Supercharged Core
    ctx.fillStyle = "#ffffff";
    drawGlow(ctx, 20, 0, 18, "#38bdf8");
        ctx.beginPath();
    ctx.arc(20, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center Electrode
  ctx.fillStyle = "#00f0ff";
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

// --- RAILGUN (Crimson Sniper Laser) ---
function drawRailgunWeapon(ctx, config, tier, time) {
  ctx.fillStyle = "#1f0d12";
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (tier === 1) {
    // Long Slender Linear Accelerator
    ctx.fillStyle = "#334155";
    ctx.fillRect(2, -2, 22, 4);
    // Ruby Optic
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(22, -2.5, 3, 5);
  } else if (tier === 2) {
    // Dual Magnetic Guide Rails with Capacitor Banks
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(-4, -6, 8, 12); // Capacitor housing

    ctx.fillStyle = "#ef4444";
    ctx.fillRect(-2, -4, 4, 8); // Glowing capacitor cell

    // Dual Accelerator Rails
    ctx.fillStyle = "#475569";
    ctx.fillRect(4, -4, 22, 2.5);
    ctx.fillRect(4, 1.5, 22, 2.5);

    // Muzzle Guide Rings
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(16, -5, 2.5, 10);
    ctx.fillRect(24, -5, 2.5, 10);
  } else {
    // Tier 3: Apex Hyper-Velocity Particle Rifle with Stabilizer Fins
    const hum = Math.sin(time * 0.015) * 1.5;

    // Floating Stabilizer Fins
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(-6, -11);
    ctx.lineTo(8, -8);
    ctx.lineTo(0, -3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, 11);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 3);
    ctx.fill();

    // Heavy Magnetic Barrel
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(2, -4.5, 26, 9);

    // Core Particle Conduit
    ctx.fillStyle = "#f87171";
    drawGlow(ctx, 15, 0, 20, "#ef4444");
        ctx.fillRect(4, -1.5, 22 + hum, 3);

    // Laser Sight Beam
    ctx.strokeStyle = "rgba(239, 68, 68, 0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 0);
    ctx.lineTo(50, 0);
    ctx.stroke();
  }

  // Pivot Core
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawDefaultWeapon(ctx, config, tier) {
  ctx.fillStyle = config.color || "#00f0ff";
  ctx.fillRect(0, -4, 18, 8);
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = config.color;
  ctx.lineWidth = 2;
  ctx.stroke();
}


// ==========================================
// 2. MONSTER & BOSS RENDERERS
// ==========================================

export function drawCreepAsset(ctx, creep, time) {
  const tier = getEntityTier(creep.level || 1);
  const r = creep.radius || 14;

  ctx.save();

  switch (creep.type) {
    case "scout_rush":
      drawScoutCreep(ctx, creep, r, tier, time);
      break;
    case "armored_squad":
      drawMechCreep(ctx, creep, r, tier, time);
      break;
    case "drone_swarm":
      drawDroneCreep(ctx, creep, r, tier, time);
      break;
    case "aegis_vanguard":
      drawAegisCreep(ctx, creep, r, tier, time);
      break;
    case "cyber_behemoth":
      drawBehemothBoss(ctx, creep, r, tier, time);
      break;
    case "void_reaver":
      drawVoidReaverBoss(ctx, creep, r, tier, time);
      break;
    case "sky_skimmer":
      drawSkySkimmer(ctx, creep, r, tier, time);
      break;
    case "nanite_mender":
      drawNaniteMender(ctx, creep, r, tier, time);
      break;
    case "signal_jammer":
      drawSignalJammer(ctx, creep, r, tier, time);
      break;
    case "storm_leviathan":
      drawStormLeviathan(ctx, creep, r, tier, time);
      break;
    case "warden_titan":
      drawWardenTitan(ctx, creep, r, tier, time);
      break;
    default:
      drawDefaultCreep(ctx, creep, r, tier, time);
      break;
  }

  ctx.restore();
}

// --- SCOUT (Cyber Sprinter) ---
function drawScoutCreep(ctx, creep, r, tier, time) {
  const pulse = Math.sin(time * 0.015) * 2;

  // Ion Thruster Flame
  ctx.fillStyle = tier === 3 ? "#ef4444" : "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.3);
  ctx.lineTo(-r * 1.3 - pulse, 0);
  ctx.lineTo(-r * 0.7, r * 0.3);
  ctx.fill();

  // Delta Wing Body
  ctx.fillStyle = creep.color || "#00f0ff";
  ctx.beginPath();
  ctx.moveTo(r * 1.1, 0); // Nose tip
  ctx.lineTo(-r * 0.8, -r * 0.85); // Left wing
  ctx.lineTo(-r * 0.4, 0); // Center notch
  ctx.lineTo(-r * 0.8, r * 0.85); // Right wing
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cockpit Core
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(r * 0.2, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Tier 2 & 3: Additional Wing Vanes
  if (tier >= 2) {
    ctx.strokeStyle = tier === 3 ? "#fbbf24" : "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r * 0.3, -r * 0.9);
    ctx.lineTo(r * 0.3, -r * 0.4);
    ctx.moveTo(-r * 0.3, r * 0.9);
    ctx.lineTo(r * 0.3, r * 0.4);
    ctx.stroke();
  }
}

// --- ARMORED SQUAD (Mech Enforcer) ---
function drawMechCreep(ctx, creep, r, tier, time) {
  // Heavy Armored Hexagon
  ctx.fillStyle = creep.color || "#f97316";
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Inner Armor Plate
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  // Tier 2 & 3: Spikes & Shoulder Plates
  if (tier >= 2) {
    ctx.fillStyle = tier === 3 ? "#ef4444" : "#fbbf24";
    ctx.fillRect(-r * 1.1, -r * 0.3, r * 0.3, r * 0.6);
    ctx.fillRect(r * 0.8, -r * 0.3, r * 0.3, r * 0.6);
  }

  // Red Optic Eye
  ctx.fillStyle = "#ef4444";
  drawGlow(ctx, 0, 0, r * 0.95, "#ef4444");
    ctx.beginPath();
  ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

// --- DRONE SWARM (Micro-drones) ---
function drawDroneCreep(ctx, creep, r, tier, time) {
  const spin = time * 0.01;

  // Tri-Rotor Blades
  ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI * 2) / 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15);
    ctx.stroke();
  }

  // Central Disc
  ctx.fillStyle = creep.color || "#a855f7";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Core Sensor Light
  ctx.fillStyle = tier === 3 ? "#38bdf8" : "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

// --- AEGIS VANGUARD (Shield Vanguard) ---
function drawAegisCreep(ctx, creep, r, tier, time) {
  const shieldSpin = time * 0.004;

  // Outer Rotating Barrier Hex
  ctx.strokeStyle = "rgba(6, 182, 212, 0.75)";
  ctx.lineWidth = tier === 3 ? 3 : 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = shieldSpin + (i * Math.PI) / 3;
    const sx = Math.cos(a) * (r * 1.4);
    const sy = Math.sin(a) * (r * 1.4);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
  ctx.stroke();

  // Diamond Golem Core
  ctx.fillStyle = creep.color || "#06b6d4";
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r, 0);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner Power Node
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
  ctx.fill();
}

// --- CYBER BEHEMOTH (Boss Titan) ---
function drawBehemothBoss(ctx, creep, r, tier, time) {
  const pulse = Math.sin(time * 0.008) * 4;

  // Dread Shockwave Aura
  ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r + 9 + pulse, 0, Math.PI * 2);
  ctx.stroke();

  // Twin Heavy Treads
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(-r * 1.15, -r * 0.9, r * 0.35, r * 1.8);
  ctx.fillRect(r * 0.8, -r * 0.9, r * 0.35, r * 1.8);

  // Titan Carapace
  ctx.fillStyle = creep.color || "#ef4444";
  drawGlow(ctx, 0, 0, r * 2, "#ef4444");
    ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Armored Shell
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Dual Exhaust Plumes (Tier 2 & 3)
  if (tier >= 2) {
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(-r * 0.4, -r * 1.1, r * 0.25, r * 0.4);
    ctx.fillRect(r * 0.15, -r * 1.1, r * 0.25, r * 0.4);
  }

  // Molten Core
  ctx.fillStyle = tier === 3 ? "#fbbf24" : "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

// --- VOID REAVER (Boss Eldritch Leviathan) ---
function drawVoidReaverBoss(ctx, creep, r, tier, time) {
  const warp = Math.sin(time * 0.007) * 5;

  // Dark-Matter Event Horizon
  ctx.fillStyle = "rgba(30, 10, 40, 0.8)";
  ctx.beginPath();
  ctx.arc(0, 0, r + 10 + warp, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(168, 85, 247, 0.6)";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Eldritch Tentacles
  ctx.strokeStyle = "#c084fc";
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.sin(time * 0.005 + i) * 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * (r * 1.4), Math.sin(a) * (r * 1.4));
    ctx.stroke();
  }

  // Void Scythe Body
  ctx.fillStyle = creep.color || "#a855f7";
  drawGlow(ctx, 0, 0, r * 2.1, "#c084fc");
    ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Abyssal Eye
  ctx.fillStyle = tier === 3 ? "#ef4444" : "#ffffff";
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.5, r * 0.25, time * 0.002, 0, Math.PI * 2);
  ctx.fill();
}

// --- SKY SKIMMER (flying interceptor; drawn facing its flight direction) ---
function drawSkySkimmer(ctx, creep, r, tier, time) {
  const flicker = 0.7 + Math.sin(time * 0.05) * 0.3;
  // Twin engine glow
  drawGlow(ctx, -r * 0.9, -r * 0.35, r * 0.9, "#38bdf8", flicker);
  drawGlow(ctx, -r * 0.9, r * 0.35, r * 0.9, "#38bdf8", flicker);
  // Swept wings
  ctx.fillStyle = "#0c4a6e";
  ctx.beginPath();
  ctx.moveTo(r * 0.2, 0);
  ctx.lineTo(-r * 0.7, -r * 1.25);
  ctx.lineTo(-r * 0.95, -r * 1.1);
  ctx.lineTo(-r * 0.5, 0);
  ctx.lineTo(-r * 0.95, r * 1.1);
  ctx.lineTo(-r * 0.7, r * 1.25);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = tier === 3 ? "#fbbf24" : "#7dd3fc";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Fuselage
  ctx.fillStyle = creep.color || "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(r * 1.2, 0);
  ctx.lineTo(-r * 0.9, -r * 0.35);
  ctx.lineTo(-r * 0.9, r * 0.35);
  ctx.closePath();
  ctx.fill();
  // Canopy
  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.ellipse(r * 0.35, 0, r * 0.35, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
}

// --- NANITE MENDER (support: repairs allies; pink medic pod) ---
function drawNaniteMender(ctx, creep, r, tier, time) {
  const pulse = (time * 0.0012) % 1;
  // Expanding repair wave
  ctx.strokeStyle = `rgba(244, 114, 182, ${0.5 * (1 - pulse)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r + pulse * 50, 0, Math.PI * 2);
  ctx.stroke();
  // Rounded pod
  drawGlow(ctx, 0, 0, r * 1.6, "#f472b6", 0.45);
  ctx.fillStyle = "#4a1030";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = creep.color || "#f472b6";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Medical cross
  ctx.fillStyle = "#fdf2f8";
  const a = r * 0.55;
  const b = r * 0.2;
  ctx.fillRect(-a, -b, a * 2, b * 2);
  ctx.fillRect(-b, -a, b * 2, a * 2);
  // Orbiting nanite swarm
  const motes = tier + 3;
  ctx.fillStyle = "#fbcfe8";
  for (let i = 0; i < motes; i++) {
    const ang = time * 0.004 + (i * Math.PI * 2) / motes;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * (r + 5), Math.sin(ang) * (r + 5), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- SIGNAL JAMMER (debuffs turrets; walker with a broadcasting dish) ---
function drawSignalJammer(ctx, creep, r, tier, time) {
  // Interference rings broadcasting outward
  for (let i = 0; i < 2; i++) {
    const p = (time * 0.001 + i * 0.5) % 1;
    ctx.strokeStyle = `rgba(253, 224, 71, ${0.55 * (1 - p)})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(0, 0, r + p * 55, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  // Four-legged walker body (square, rotated 45deg)
  ctx.fillStyle = "#3f3a10";
  ctx.save();
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 4);
  ctx.fill();
  ctx.strokeStyle = creep.color || "#fde047";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  // Legs
  ctx.strokeStyle = "#a16207";
  ctx.lineWidth = 2.5;
  const step = Math.sin(time * 0.012) * 2;
  for (const [x, y] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    ctx.beginPath();
    ctx.moveTo(x * r * 0.5, y * r * 0.5);
    ctx.lineTo(x * (r + 3 + step * x * y), y * (r + 3));
    ctx.stroke();
  }
  // Rotating dish
  ctx.save();
  ctx.rotate(time * 0.003);
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, -1, 1);
  ctx.stroke();
  ctx.fillStyle = "#fef08a";
  ctx.fillRect(0, -1, r * 0.6, 2);
  ctx.restore();
  ctx.fillStyle = tier === 3 ? "#ef4444" : "#facc15";
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
}

// --- STORM LEVIATHAN (flying boss: storm manta, faces its flight direction) ---
function drawStormLeviathan(ctx, creep, r, tier, time) {
  const flap = Math.sin(time * 0.004) * 0.12;
  drawGlow(ctx, 0, 0, r * 2.2, "#60a5fa", 0.55);
  // Manta wings
  ctx.fillStyle = "#1e3a8a";
  ctx.beginPath();
  ctx.moveTo(r * 0.9, 0);
  ctx.quadraticCurveTo(r * 0.1, -r * (1.5 + flap), -r * 0.6, -r * (1.35 + flap));
  ctx.quadraticCurveTo(-r * 0.3, -r * 0.4, -r * 0.8, 0);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.4, -r * 0.6, r * (1.35 + flap));
  ctx.quadraticCurveTo(r * 0.1, r * (1.5 + flap), r * 0.9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = creep.color || "#60a5fa";
  ctx.lineWidth = 2;
  ctx.stroke();
  // Tail
  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.8, 0);
  ctx.quadraticCurveTo(-r * 1.4, Math.sin(time * 0.006) * r * 0.3, -r * 1.9, 0);
  ctx.stroke();
  // Storm core + lightning crackle along the wings
  ctx.fillStyle = tier === 3 ? "#fbbf24" : "#dbeafe";
  ctx.beginPath();
  ctx.ellipse(r * 0.2, 0, r * 0.35, r * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  if (Math.sin(time * 0.02) > 0.3) {
    ctx.strokeStyle = "rgba(224, 242, 254, 0.9)";
    ctx.lineWidth = 1.3;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(r * 0.1, side * r * 0.2);
      ctx.lineTo(-r * 0.15, side * r * 0.65);
      ctx.lineTo(r * 0.05, side * r * 0.8);
      ctx.lineTo(-r * 0.35, side * r * 1.2);
      ctx.stroke();
    }
  }
}

// --- WARDEN TITAN (boss: fortress walker that EMPs turrets) ---
function drawWardenTitan(ctx, creep, r, tier, time) {
  drawGlow(ctx, 0, 0, r * 1.9, "#a3e635", 0.45);
  // Heavy octagon hull
  ctx.fillStyle = "#1a2e05";
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = creep.color || "#a3e635";
  ctx.lineWidth = 3;
  ctx.stroke();
  // Four EMP emitter nodes that charge between pulses
  const charge = (time * 0.0004) % 1;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const x = Math.cos(a) * r * 0.62;
    const y = Math.sin(a) * r * 0.62;
    drawGlow(ctx, x, y, 8, "#bef264", 0.3 + charge * 0.7);
    ctx.fillStyle = `rgba(217, 249, 157, ${0.4 + charge * 0.6})`;
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Armoured core with a visor
  ctx.fillStyle = "#365314";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tier === 3 ? "#fbbf24" : "#ecfccb";
  ctx.fillRect(-r * 0.3, -2.5, r * 0.6, 5);
}

function drawDefaultCreep(ctx, creep, r, tier, time) {
  ctx.fillStyle = creep.color || "#00f0ff";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}
