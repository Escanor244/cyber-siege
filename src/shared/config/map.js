// Battlefield geometry shared by the server, the lane simulation and the renderer.
// World units are canvas pixels on a 520 x 416 board; screens scale this up or down.

export const GRID_COLS = 10;
export const GRID_ROWS = 8;
export const TILE_SIZE = 52;
export const BOARD_WIDTH = GRID_COLS * TILE_SIZE; // 520
export const BOARD_HEIGHT = GRID_ROWS * TILE_SIZE; // 416

// Path waypoints (col, row), identical on both players' boards
export const PATH_WAYPOINTS = Object.freeze([
  { x: 0, y: 1 }, // Portal spawn
  { x: 7, y: 1 },
  { x: 7, y: 3 },
  { x: 2, y: 3 },
  { x: 2, y: 6 },
  { x: 9, y: 6 }, // Base energy core
]);

export const PIXEL_PATH = Object.freeze(
  PATH_WAYPOINTS.map((wp) =>
    Object.freeze({
      x: wp.x * TILE_SIZE + TILE_SIZE / 2,
      y: wp.y * TILE_SIZE + TILE_SIZE / 2,
    })
  )
);

export const PATH_LENGTH_PX = PIXEL_PATH.reduce((sum, pt, i) => {
  if (i === 0) return 0;
  const prev = PIXEL_PATH[i - 1];
  return sum + Math.hypot(pt.x - prev.x, pt.y - prev.y);
}, 0);

const pathCells = new Set();
for (let i = 0; i < PATH_WAYPOINTS.length - 1; i++) {
  const a = PATH_WAYPOINTS[i];
  const b = PATH_WAYPOINTS[i + 1];
  for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
      pathCells.add(`${x},${y}`);
    }
  }
}
export const PATH_CELLS = pathCells;

export function isInBounds(gx, gy) {
  return (
    Number.isInteger(gx) &&
    Number.isInteger(gy) &&
    gx >= 0 &&
    gx < GRID_COLS &&
    gy >= 0 &&
    gy < GRID_ROWS
  );
}

export function isPathCell(gx, gy) {
  return PATH_CELLS.has(`${gx},${gy}`);
}

export function cellCenter(gx, gy) {
  return { x: gx * TILE_SIZE + TILE_SIZE / 2, y: gy * TILE_SIZE + TILE_SIZE / 2 };
}
