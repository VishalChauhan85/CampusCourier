// 0 = Walkable Corridor, 1 = Building/Wall, 2 = Obstacle, 3 = Restricted (2.5x cost)

export function createEmptyGrid(width, height, fill = 0) {
  return Array.from({ length: height }, () => Array(width).fill(fill));
}

export function carveCorridorLine(grid, x0, y0, x1, y1, width, height) {
  let cx = Math.max(0, Math.min(width - 1, Math.round(x0)));
  let cy = Math.max(0, Math.min(height - 1, Math.round(y0)));
  const tx = Math.max(0, Math.min(width - 1, Math.round(x1)));
  const ty = Math.max(0, Math.min(height - 1, Math.round(y1)));

  // Carve L-shaped orthogonal walkable corridor so 4-directional A* can always traverse
  while (cx !== tx) {
    if (grid[cy] && grid[cy][cx] === 1) grid[cy][cx] = 0;
    cx += cx < tx ? 1 : -1;
  }
  while (cy !== ty) {
    if (grid[cy] && grid[cy][cx] === 1) grid[cy][cx] = 0;
    cy += cy < ty ? 1 : -1;
  }
  if (grid[ty] && grid[ty][tx] === 1) grid[ty][tx] = 0;
}

export function computeEuclideanWeight(n1, n2, cellSize = 1.0) {
  return +((Math.abs(n1.x - n2.x) + Math.abs(n1.y - n2.y)) * cellSize).toFixed(1);
}
