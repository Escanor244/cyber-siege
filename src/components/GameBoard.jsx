// Cyber Siege - 60 FPS HTML5 Canvas Battleground Component
import { useEffect, useRef, useState } from "react";
import {
  GRID_COLS,
  GRID_ROWS,
  TILE_SIZE,
  PATH_WAYPOINTS,
  TOWERS,
  getCreepDefinition,
} from "../lib/constants";
import { sound } from "../lib/soundFx";

export default function GameBoard({
  isInteractive = true,
  towers = [],
  incomingWaves = [],
  selectedTowerType = null,
  selectedPlacedTower = null,
  onSelectPlacedTower = () => {},
  onBuildTower = () => {},
  onLeakDamage = () => {},
  activeSabotages = [],
  title = "SECTOR ALPHA",
  baseHp = 100,
  playerSlot = "p1",
  isPaused = false,
}) {
  const canvasRef = useRef(null);

  // Live simulation state (held in refs for 60fps canvas loop)
  const creepsRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatingTextsRef = useRef([]);
  const processedWaveIdsRef = useRef(new Set());
  const towerCooldownsRef = useRef({});
  const spawnTimeoutsRef = useRef([]);

  // Stable refs to prevent animation frame restarts on hover/selection
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const hoverGridRef = useRef(null);
  const towersRef = useRef(towers);
  towersRef.current = towers;
  const selectedPlacedTowerRef = useRef(selectedPlacedTower);
  selectedPlacedTowerRef.current = selectedPlacedTower;
  const selectedTowerTypeRef = useRef(selectedTowerType);
  selectedTowerTypeRef.current = selectedTowerType;
  const activeSabotagesRef = useRef(activeSabotages);
  activeSabotagesRef.current = activeSabotages;
  const baseHpRef = useRef(baseHp);
  baseHpRef.current = baseHp;
  const onLeakDamageRef = useRef(onLeakDamage);
  onLeakDamageRef.current = onLeakDamage;

  const width = GRID_COLS * TILE_SIZE; // 520px
  const height = GRID_ROWS * TILE_SIZE; // 416px

  // Convert waypoints (cols, rows) to canvas pixel coordinates
  const pixelPath = PATH_WAYPOINTS.map((wp) => ({
    x: wp.x * TILE_SIZE + TILE_SIZE / 2,
    y: wp.y * TILE_SIZE + TILE_SIZE / 2,
  }));

  // Set of grid cells occupied by the path
  const pathCells = new Set();
  for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
    const p1 = PATH_WAYPOINTS[i];
    const p2 = PATH_WAYPOINTS[i + 1];
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        pathCells.add(`${x},${y}`);
      }
    }
  }

  // Spawn incoming creep waves
  useEffect(() => {
    // Clear any previous scheduled spawns
    spawnTimeoutsRef.current.forEach(clearTimeout);
    spawnTimeoutsRef.current = [];

    if (incomingWaves.length === 0) {
      creepsRef.current = [];
      projectilesRef.current = [];
      processedWaveIdsRef.current.clear();
      return;
    }

    incomingWaves.forEach((wave) => {
      if (!processedWaveIdsRef.current.has(wave.id)) {
        processedWaveIdsRef.current.add(wave.id);

        const creepConfig = getCreepDefinition(wave.type);
        const count = wave.count || creepConfig.count || 1;
        const isBoss = wave.isBoss || creepConfig.isBoss;

        // Wave Escalation / Monster Level Scaling
        const waveNum = wave.waveNumber || 1;
        // Regular creeps: Level rises every 2 waves (+25% HP) | Bosses: Level rises every 4 waves (+35% HP)
        const creepLevel = isBoss
          ? Math.max(1, Math.min(5, Math.ceil(waveNum / 4)))
          : Math.max(1, Math.min(5, Math.ceil(waveNum / 2)));
        const hpMultiplier = isBoss
          ? 1 + (creepLevel - 1) * 0.35
          : 1 + (creepLevel - 1) * 0.25;
        const bountyMultiplier = 1 + (creepLevel - 1) * 0.20; // +20% bounty per tier
        const scaledHp = Math.round(creepConfig.hp * hpMultiplier);
        const scaledBounty = Math.round((creepConfig.bounty || 10) * bountyMultiplier);

        for (let i = 0; i < count; i++) {
          const timeoutId = setTimeout(() => {
            // Cap active creeps to prevent lag if tab was backgrounded
            if (creepsRef.current.length > 55) return;
            creepsRef.current.push({
              id: `creep_${Date.now()}_${Math.random()}`,
              type: wave.type,
              config: creepConfig,
              level: creepLevel,
              hp: scaledHp,
              maxHp: scaledHp,
              bounty: scaledBounty,
              speed: creepConfig.speed,
              x: pixelPath[0].x,
              y: pixelPath[0].y,
              waypointIdx: 1,
              radius: creepConfig.size || 14,
              slowUntil: 0,
              isBoss: isBoss,
              leakDamage: creepConfig.leakDamage || (isBoss ? 25 : 4),
              color: creepConfig.color,
            });
          }, i * 380); // Stagger multi-unit spawns
          spawnTimeoutsRef.current.push(timeoutId);
        }
      }
    });

    return () => {
      spawnTimeoutsRef.current.forEach(clearTimeout);
    };
  }, [incomingWaves]);

  const createExplosion = (x, y, color, count = 12) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 30;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: Math.random() * 3 + 1.5,
        alpha: 1,
      });
    }
  };

  // Watch activeSabotages for Orbital Strike demolition visual explosions
  const processedDemolitionsRef = useRef(new Set());
  useEffect(() => {
    if (!activeSabotages || !activeSabotages.length) return;
    activeSabotages.forEach((sab) => {
      if (
        sab.type === "orbital_nuke" &&
        sab.targetSlot === playerSlot &&
        sab.destroyedTower &&
        !processedDemolitionsRef.current.has(sab.id)
      ) {
        processedDemolitionsRef.current.add(sab.id);
        const dt = sab.destroyedTower;
        const tx = dt.gridX * TILE_SIZE + TILE_SIZE / 2;
        const ty = dt.gridY * TILE_SIZE + TILE_SIZE / 2;

        sound.playExplosion();
        createExplosion(tx, ty, "#ef4444", 45);
        createExplosion(tx, ty, "#f97316", 30);
        createExplosion(tx, ty, "#ffffff", 20);

        floatingTextsRef.current.push({
          text: "💥 DEMOLISHED!",
          x: tx - 25,
          y: ty - 18,
          color: "#ef4444",
          alpha: 1,
        });
      }
    });
  }, [activeSabotages, playerSlot]);

  // Main 60 FPS Canvas Game Loop (Runs continuously without resetting on hover)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let lastTime = performance.now();

    const loop = (currentTime) => {
      // Strictly clamp delta time to 0.05 (20 FPS min) to prevent physics jumps
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // 1. UPDATE SIMULATION
      updateGame(dt);

      // 2. RENDER CANVAS
      renderGame(ctx, currentTime);

      animId = requestAnimationFrame(loop);
    };

    // Tab visibility change handler to prevent freeze when switching tabs
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Game Physics & Logic Update
  const updateGame = (dt) => {
    if (isPausedRef.current) return;

    const creeps = creepsRef.current;
    const projectiles = projectilesRef.current;
    const particles = particlesRef.current;
    const floatingTexts = floatingTextsRef.current;

    // Check active sabotages affecting THIS player sector
    const curSabotages = activeSabotagesRef.current || [];
    const isEmped = curSabotages.some(
      (s) =>
        s.type === "emp_freeze" &&
        s.targetSlot === playerSlot &&
        Date.now() - s.timestamp < s.duration * 1000
    );
    const hasFrenzy = curSabotages.some(
      (s) =>
        s.type === "frenzy_rush" &&
        s.targetSlot === playerSlot &&
        Date.now() - s.timestamp < s.duration * 1000
    );

    // 1. Move Creeps
    for (let i = creeps.length - 1; i >= 0; i--) {
      const c = creeps[i];
      const targetWp = pixelPath[c.waypointIdx];

      if (!targetWp) {
        // Creep reached base core!
        const leakDmg = c.leakDamage || (c.isBoss ? 25 : 4);
        if (onLeakDamageRef.current) {
          onLeakDamageRef.current(leakDmg);
        }

        // Particle explosion at base core
        createExplosion(c.x, c.y, "#ef4444", c.isBoss ? 45 : 20);
        creeps.splice(i, 1);
        continue;
      }

      const dx = targetWp.x - c.x;
      const dy = targetWp.y - c.y;
      const dist = Math.hypot(dx, dy);

      // Check speed (slow vs frenzy)
      let currentSpeed = Date.now() < c.slowUntil ? c.speed * 0.55 : c.speed;
      if (hasFrenzy) currentSpeed *= 1.5;

      const step = currentSpeed * 60 * dt;

      if (dist <= step) {
        c.x = targetWp.x;
        c.y = targetWp.y;
        c.waypointIdx += 1;
      } else {
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
      }

      // If Frenzy active, emit speed sparks behind creeps
      if (hasFrenzy && Math.random() < 0.3) {
        particles.push({
          x: c.x,
          y: c.y,
          vx: (Math.random() - 0.5) * 40,
          vy: (Math.random() - 0.5) * 40,
          color: "#f59e0b",
          size: 2,
          alpha: 0.8,
        });
      }
    }

    // 2. Towers Targeting & Firing (disabled if EMP stunned!)
    const curTowers = towersRef.current || [];
    if (!isEmped) {
      curTowers.forEach((tower) => {
        const config = TOWERS[tower.type];
        if (!config) return;

        const towerX = tower.gridX * TILE_SIZE + TILE_SIZE / 2;
        const towerY = tower.gridY * TILE_SIZE + TILE_SIZE / 2;
        const range = config.range * (1 + (tower.level - 1) * 0.12);
        const fireInterval = 1000 / config.fireRate;

        // Find closest creep in range
        let target = null;
        let minDist = range;

        for (const creep of creeps) {
          const d = Math.hypot(creep.x - towerX, creep.y - towerY);
          if (d <= minDist) {
            minDist = d;
            target = creep;
          }
        }

        if (target) {
          tower.targetAngle = Math.atan2(target.y - towerY, target.x - towerX);
          const lastFire = towerCooldownsRef.current[tower.id] || 0;

          if (Date.now() - lastFire >= fireInterval) {
            towerCooldownsRef.current[tower.id] = Date.now();
            fireTower(tower, towerX, towerY, target, config);
          }
        }
      });
    }

    // 3. Update Projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;

      if (p.type === "bullet") {
        const dx = p.target.x - p.x;
        const dy = p.target.y - p.y;
        const dist = Math.hypot(dx, dy);
        const step = 450 * dt;

        if (dist <= step || p.life <= 0) {
          applyDamage(p.target, p.damage, p.color);
          createExplosion(p.target.x, p.target.y, p.color, 6);
          projectiles.splice(i, 1);
        } else {
          p.x += (dx / dist) * step;
          p.y += (dy / dist) * step;
        }
      } else if (p.type === "mortar") {
        p.progress += dt * 1.8;
        if (p.progress >= 1) {
          sound.playMortar();
          createExplosion(p.targetX, p.targetY, "#f59e0b", 35);
          creeps.forEach((creep) => {
            const d = Math.hypot(creep.x - p.targetX, creep.y - p.targetY);
            if (d <= p.splashRadius) {
              applyDamage(creep, p.damage, "#f59e0b");
            }
          });
          projectiles.splice(i, 1);
        }
      } else if (p.type === "beam" || p.type === "chain" || p.type === "laser") {
        if (p.life <= 0) {
          projectiles.splice(i, 1);
        }
      }
    }

    // 4. Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.alpha -= dt * 1.5;
      if (pt.alpha <= 0) particles.splice(i, 1);
    }

    // 5. Update Floating Texts
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.y -= 25 * dt;
      ft.alpha -= dt * 1.2;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }
  };

  // Fire Tower Action
  const fireTower = (tower, startX, startY, target, config) => {
    const dmg = Math.round(config.damage * (1 + (tower.level - 1) * 0.35));

    if (config.projectileType === "bullet") {
      sound.playLaser();
      projectilesRef.current.push({
        type: "bullet",
        x: startX,
        y: startY,
        target,
        damage: dmg,
        color: config.color,
        life: 1.2,
      });
    } else if (config.projectileType === "beam") {
      target.slowUntil = Date.now() + 1200;
      applyDamage(target, dmg, config.color);
      projectilesRef.current.push({
        type: "beam",
        x1: startX,
        y1: startY,
        x2: target.x,
        y2: target.y,
        color: config.color,
        life: 0.12,
      });
    } else if (config.projectileType === "mortar") {
      projectilesRef.current.push({
        type: "mortar",
        startX,
        startY,
        targetX: target.x,
        targetY: target.y,
        progress: 0,
        damage: dmg,
        splashRadius: config.splashRadius,
        life: 1.5,
      });
    } else if (config.projectileType === "chain") {
      sound.playLaser();
      const chainTargets = [target];
      const creeps = creepsRef.current;
      for (const other of creeps) {
        if (chainTargets.length >= config.chainTargets) break;
        if (!chainTargets.includes(other)) {
          const d = Math.hypot(other.x - target.x, other.y - target.y);
          if (d <= 95) chainTargets.push(other);
        }
      }

      chainTargets.forEach((ct) => {
        applyDamage(ct, dmg, config.color);
        projectilesRef.current.push({
          type: "chain",
          x1: startX,
          y1: startY,
          x2: ct.x,
          y2: ct.y,
          color: config.color,
          life: 0.15,
        });
      });
    } else if (config.projectileType === "laser") {
      sound.playLaser();
      applyDamage(target, dmg, config.color);
      projectilesRef.current.push({
        type: "laser",
        x1: startX,
        y1: startY,
        x2: target.x,
        y2: target.y,
        color: config.color,
        life: 0.2,
      });
      createExplosion(target.x, target.y, config.color, 15);
    }
  };

  // Damage & Creep Death
  const applyDamage = (creep, dmg, color) => {
    creep.hp -= dmg;

    floatingTextsRef.current.push({
      text: `-${dmg}`,
      x: creep.x + (Math.random() * 12 - 6),
      y: creep.y - 12,
      color: color || "#ffffff",
      alpha: 1,
    });

    if (creep.hp <= 0) {
      sound.playExplosion();
      createExplosion(creep.x, creep.y, creep.color, creep.isBoss ? 35 : 18);

      floatingTextsRef.current.push({
        text: `+$${creep.bounty || creep.config.bounty || 10}`,
        x: creep.x,
        y: creep.y - 18,
        color: "#fbbf24",
        alpha: 1,
      });

      const idx = creepsRef.current.indexOf(creep);
      if (idx !== -1) creepsRef.current.splice(idx, 1);
    }
  };

  // Render Canvas Scene
  const renderGame = (ctx, time) => {
    ctx.clearRect(0, 0, width, height);

    // 1. Background Grid & Sci-Fi Tiles
    ctx.fillStyle = "#070b14";
    ctx.fillRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(0, 240, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID_COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * TILE_SIZE, 0);
      ctx.lineTo(c * TILE_SIZE, height);
      ctx.stroke();
    }
    for (let r = 0; r <= GRID_ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * TILE_SIZE);
      ctx.lineTo(width, r * TILE_SIZE);
      ctx.stroke();
    }

    // 2. Render Path Corridor
    ctx.lineWidth = TILE_SIZE * 0.72;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.strokeStyle = "rgba(15, 23, 42, 0.95)";
    ctx.beginPath();
    pixelPath.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Path Neon Border
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.beginPath();
    pixelPath.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();

    // Animated Energy Pulse
    const pulseOffset = (time * 0.08) % 40;
    ctx.setLineDash([12, 28]);
    ctx.lineDashOffset = -pulseOffset;
    ctx.strokeStyle = "rgba(0, 240, 255, 0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Render Spawn Portal (Start)
    const portal = pixelPath[0];
    const portalSpin = time * 0.003;
    ctx.save();
    ctx.translate(portal.x, portal.y);
    ctx.rotate(portalSpin);
    ctx.strokeStyle = "#a855f7";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(-portalSpin * 2);
    ctx.strokeStyle = "#00f0ff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-10, -10, 20, 20);
    ctx.restore();

    // 4. Render Base Energy Core (End)
    const core = pixelPath[pixelPath.length - 1];
    const pulse = Math.sin(time * 0.005) * 3;
    const curHp = baseHpRef.current ?? 100;
    const hpRatio = curHp / 100;
    const coreColor = hpRatio > 0.5 ? "#00f0ff" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";

    ctx.save();
    ctx.translate(core.x, core.y);
    ctx.shadowColor = coreColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(0, 0, 16 + pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 5. Hover Placement Indicator (Interactive Board Only)
    const curHover = hoverGridRef.current;
    const curSelectedType = selectedTowerTypeRef.current;
    const curRenderTowers = towersRef.current || [];
    const curPlaced = selectedPlacedTowerRef.current;
    const curRenderSabotages = activeSabotagesRef.current || [];

    if (isInteractive && curHover) {
      const isPath = pathCells.has(`${curHover.x},${curHover.y}`);
      const isOccupied = curRenderTowers.some((t) => t.gridX === curHover.x && t.gridY === curHover.y);

      // ONLY show build indicator if a defense tower is actively selected!
      if (curSelectedType) {
        const canBuild = !isPath && !isOccupied;

        ctx.fillStyle = canBuild ? "rgba(34, 197, 94, 0.25)" : "rgba(239, 68, 68, 0.25)";
        ctx.fillRect(curHover.x * TILE_SIZE, curHover.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        ctx.strokeStyle = canBuild ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(curHover.x * TILE_SIZE, curHover.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

        if (canBuild && TOWERS[curSelectedType]) {
          const previewRange = TOWERS[curSelectedType].range;
          ctx.beginPath();
          ctx.arc(
            curHover.x * TILE_SIZE + TILE_SIZE / 2,
            curHover.y * TILE_SIZE + TILE_SIZE / 2,
            previewRange,
            0,
            Math.PI * 2
          );
          ctx.fillStyle = "rgba(0, 240, 255, 0.08)";
          ctx.fill();
          ctx.strokeStyle = "rgba(0, 240, 255, 0.4)";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      } else if (isOccupied) {
        // Highlight tower for inspection
        ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(curHover.x * TILE_SIZE, curHover.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    // 6. Check EMP Stun status on this sector
    const isEmped = curRenderSabotages.some(
      (s) =>
        s.type === "emp_freeze" &&
        s.targetSlot === playerSlot &&
        Date.now() - s.timestamp < s.duration * 1000
    );

    // Render Towers
    curRenderTowers.forEach((tower) => {
      const config = TOWERS[tower.type];
      if (!config) return;

      const tx = tower.gridX * TILE_SIZE + TILE_SIZE / 2;
      const ty = tower.gridY * TILE_SIZE + TILE_SIZE / 2;
      const isSelected = curPlaced?.id === tower.id;

      if (isSelected && isInteractive) {
        const currentRange = config.range * (1 + (tower.level - 1) * 0.12);
        ctx.beginPath();
        ctx.arc(tx, ty, currentRange, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 240, 255, 0.1)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Base Pedestal
      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = isSelected ? "#00f0ff" : config.accent;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.fillRect(tx - 20, ty - 20, 40, 40);
      ctx.strokeRect(tx - 20, ty - 20, 40, 40);

      // Rotating Turret Head
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(tower.targetAngle || 0);

      ctx.fillStyle = config.color;
      ctx.fillRect(0, -4, 18, 8);

      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fillStyle = "#0f172a";
      ctx.fill();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = config.color;
      ctx.fill();
      ctx.restore();

      // If EMP stunned, draw crackling blue electric arcs
      if (isEmped) {
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 24, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#38bdf8";
        ctx.font = "bold 9px Orbitron, sans-serif";
        ctx.fillText("STUNNED", tx - 22, ty - 24);
      }

      // Tower Level Badge
      if (tower.level > 1) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px Orbitron, sans-serif";
        ctx.fillText(`Lv.${tower.level}`, tx - 12, ty + 18);
      }
    });

    // 7. Render Creeps & Bosses
    creepsRef.current.forEach((creep) => {
      ctx.save();
      ctx.translate(creep.x, creep.y);

      // Special Boss Visuals
      if (creep.isBoss) {
        const dreadPulse = Math.sin(time * 0.008) * 6;
        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, creep.radius + 8 + dreadPulse, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Body Orb
      ctx.fillStyle = creep.color;
      ctx.shadowColor = creep.color;
      ctx.shadowBlur = creep.isBoss ? 16 : 8;
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner Core
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(0, 0, creep.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();

      // Health Bar
      const hpPct = Math.max(0, creep.hp / creep.maxHp);
      const barW = creep.radius * 2.4;
      const barH = creep.isBoss ? 5 : 3.5;
      const barY = -creep.radius - (creep.isBoss ? 12 : 8);

      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(-barW / 2, barY, barW, barH);
      ctx.fillStyle = hpPct > 0.5 ? "#22c55e" : hpPct > 0.25 ? "#f59e0b" : "#ef4444";
      ctx.fillRect(-barW / 2, barY, barW * hpPct, barH);

      // Boss & Level Labels
      if (creep.isBoss) {
        ctx.fillStyle = "#ef4444";
        ctx.font = "bold 9px Orbitron, sans-serif";
        ctx.fillText(`💀 BOSS Lv.${creep.level || 1}: ${creep.hp}/${creep.maxHp}`, -barW / 2, barY - 4);
      } else if ((creep.level || 1) > 1) {
        ctx.fillStyle = creep.level >= 3 ? "#ef4444" : "#f59e0b";
        ctx.font = "bold 8px Orbitron, sans-serif";
        ctx.fillText(`Lv.${creep.level}`, -barW / 2, barY - 3);
      }

      // Shield Aura (Aegis Vanguard)
      if (creep.type === "aegis_vanguard") {
        ctx.strokeStyle = "rgba(6, 182, 212, 0.65)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 38, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    });

    // 8. Render Projectiles
    projectilesRef.current.forEach((p) => {
      if (p.type === "bullet") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "beam" || p.type === "chain" || p.type === "laser") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.type === "laser" ? 4 : 2;
        ctx.beginPath();
        ctx.moveTo(p.x1, p.y1);
        ctx.lineTo(p.x2, p.y2);
        ctx.stroke();
      } else if (p.type === "mortar") {
        const mx = p.startX + (p.targetX - p.startX) * p.progress;
        const arcY = Math.sin(p.progress * Math.PI) * -60;
        const my = p.startY + (p.targetY - p.startY) * p.progress + arcY;

        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(mx, my, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 9. Render Particles
    particlesRef.current.forEach((pt) => {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = pt.alpha;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // 10. Render Floating Combat Text
    floatingTextsRef.current.forEach((ft) => {
      ctx.font = "bold 12px Rajdhani, sans-serif";
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = ft.alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.globalAlpha = 1;
    });
  };

  // Mouse Interaction Handlers (Zero Re-render updates for 60 FPS precision)
  const handleMouseMove = (e) => {
    if (!isInteractive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const gx = Math.floor(mouseX / TILE_SIZE);
    const gy = Math.floor(mouseY / TILE_SIZE);

    if (gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS) {
      hoverGridRef.current = { x: gx, y: gy };
    } else {
      hoverGridRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    hoverGridRef.current = null;
  };

  const handleClick = () => {
    if (!isInteractive || !hoverGridRef.current) return;
    const { x, y } = hoverGridRef.current;

    const curTowers = towersRef.current || [];
    const existing = curTowers.find((t) => t.gridX === x && t.gridY === y);
    if (existing) {
      onSelectPlacedTower(existing);
      return;
    }

    const isPath = pathCells.has(`${x},${y}`);
    const curSelectedType = selectedTowerTypeRef.current;
    if (!isPath && curSelectedType) {
      onBuildTower(curSelectedType, x, y);
    } else {
      onSelectPlacedTower(null);
    }
  };

  return (
    <div className="battleground-card">
      <div className="battleground-header">
        <div className="flex items-center gap-2">
          <span className={`status-dot ${isInteractive ? "dot-cyan" : "dot-purple"}`} />
          <h3 className="sector-title">{title}</h3>
        </div>
        <div className="base-hp-badge">
          <span className="hp-label">REACTOR CORE:</span>
          <span className={`hp-val ${baseHp < 30 ? "hp-danger" : ""}`}>{baseHp}%</span>
        </div>
      </div>

      <div className="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
          className={`game-canvas ${isInteractive ? "canvas-interactive" : "canvas-spectator"}`}
        />
      </div>
    </div>
  );
}
