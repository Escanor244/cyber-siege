// Canvas host for one battlefield. Owns sizing (crisp on high-DPI phones),
// pointer input and the frame loop; drawing is in render/boardRenderer.js and
// game logic in the lane simulation.
import { useEffect, useRef } from "react";
import { BOARD_WIDTH, BOARD_HEIGHT, GRID_COLS, GRID_ROWS, cellCenter } from "../shared/config/map.js";
import { drawBoard } from "../render/boardRenderer.js";
import { createFx } from "../render/fx.js";
import { ownScene } from "../game/scenes.js";
import { settings } from "../lib/settings.js";
import { isLowQuality, reportFrame, onQualityChange } from "../render/perf.js";

const MAX_DPR = 2;

export default function GameBoard({
  kind, // 'own' | 'enemy'
  handle,
  coreHp,
  ghostType = null,
  ghostOk = false,
  pendingCell = null,
  selectedTowerId = null,
  onCellTap,
  onCellHover,
  className = "",
  children,
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const hoverRef = useRef(null);
  const props = useRef({});
  props.current = { coreHp, ghostType, ghostOk, pendingCell, selectedTowerId, onCellTap, onCellHover };

  // Size the backing store to the element's CSS size × devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      const scale = Math.min(rect.width / BOARD_WIDTH, rect.height / BOARD_HEIGHT);
      const cssW = Math.max(1, Math.floor(BOARD_WIDTH * scale));
      const cssH = Math.max(1, Math.floor(BOARD_HEIGHT * scale));
      const dpr = isLowQuality() ? 1 : Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const offQuality = onQualityChange(resize);
    return () => {
      ro.disconnect();
      offQuality();
    };
  }, []);

  // Frame loop
  useEffect(() => {
    if (!handle) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { store, lane, remote } = handle;
    const fx = createFx({ audible: kind === "own", volume: 1 });
    let raf = 0;
    let last = performance.now();

    const applySettings = () => {
      fx.setQuality(isLowQuality() ? "low" : "high");
      fx.setShowDamage(settings.get().damageNumbers);
    };
    applySettings();
    const offSettings = onQualityChange(applySettings);

    // Spell visuals on this board
    const offSpell = store.on("spell", (msg) => {
      const boardOwner = kind === "own" ? store.getState().playerId : store.opponent()?.id;
      if (msg.targetId !== boardOwner) return;
      if (msg.destroyedTower) {
        const { x, y } = cellCenter(msg.destroyedTower.gridX, msg.destroyedTower.gridY);
        fx.consume([{ type: "demolished", x, y }]);
      }
      if (msg.spellId === "emp_freeze") {
        const owner = kind === "own" ? store.me() : store.opponent();
        for (const t of owner?.towers || []) {
          if (msg.towerIds.includes(t.id)) fx.consume([{ type: "emp", ...cellCenter(t.gridX, t.gridY) }]);
        }
      }
    });

    // Keep our lane simulated while the tab is hidden (rAF stops in background tabs)
    const bg = kind === "own" ? setInterval(() => document.hidden && lane.update(), 250) : 0;

    const frame = (t) => {
      const dt = Math.min(100, t - last);
      last = t;
      if (kind === "own") reportFrame(dt);
      const p = props.current;
      let scene;
      if (kind === "own") {
        fx.consume(lane.update());
        scene = ownScene(lane, p.coreHp);
      } else {
        fx.consume(remote.drainEvents());
        scene = remote.scene(store.matchNow());
      }
      fx.update(dt);

      const scale = canvas.width / BOARD_WIDTH;
      const off = fx.shakeOffset(settings.get().reducedMotion);
      ctx.setTransform(scale, 0, 0, scale, off.x * scale, off.y * scale);
      drawBoard(ctx, scene, t, {
        interactive: kind === "own",
        hover: p.pendingCell || hoverRef.current,
        ghostType: p.ghostType,
        ghostOk: p.ghostOk,
        selectedTowerId: p.selectedTowerId,
      });
      fx.draw(ctx);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(bg);
      offSpell();
      offSettings();
    };
  }, [handle, kind]);

  const cellAt = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const gx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID_COLS);
    const gy = Math.floor(((e.clientY - rect.top) / rect.height) * GRID_ROWS);
    return gx >= 0 && gx < GRID_COLS && gy >= 0 && gy < GRID_ROWS ? { x: gx, y: gy } : null;
  };

  const interactive = kind === "own";
  const onPointerMove = (e) => {
    if (!interactive || e.pointerType !== "mouse") return;
    const cell = cellAt(e);
    const prev = hoverRef.current;
    if (prev?.x === cell?.x && prev?.y === cell?.y) return;
    hoverRef.current = cell;
    props.current.onCellHover?.(cell);
  };
  const onPointerLeave = () => {
    hoverRef.current = null;
    props.current.onCellHover?.(null);
  };
  const onPointerUp = (e) => {
    if (!interactive) return;
    const cell = cellAt(e);
    if (cell) props.current.onCellTap?.(cell, e.pointerType);
  };

  return (
    <div ref={wrapRef} className={`board-canvas-wrap ${className}`}>
      <canvas
        ref={canvasRef}
        className={`game-canvas ${interactive ? "canvas-interactive" : "canvas-spectator"}`}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerUp={onPointerUp}
        aria-label={interactive ? "Your battlefield" : "Enemy battlefield"}
        role="img"
      />
      {children}
    </div>
  );
}
