// 2D cell-by-cell A* (4-directional). f(n) = g(n) + h(n), h(n) = Manhattan distance.

const EMPTY_RESULT = (explored = [], ms = 0.11) => ({
  found: false,
  path: [],
  explored,
  heuristics: new Map(),
  totalSteps: 0,
  totalCost: 0,
  executionTimeMs: ms
});

export function runGridAStar(map, startCoord, goalCoord, dynamicObstacles = []) {
  const t0 = performance.now();
  if (!map || !map.grid || !startCoord || !goalCoord) return EMPTY_RESULT();

  const { width, height, grid } = map;
  const sx = startCoord.x;
  const sy = startCoord.y;
  const gx = goalCoord.x;
  const gy = goalCoord.y;

  if (sx < 0 || sx >= width || sy < 0 || sy >= height || gx < 0 || gx >= width || gy < 0 || gy >= height) {
    return EMPTY_RESULT();
  }

  const dynBlocked = new Set(dynamicObstacles.map((o) => `${o.x},${o.y}`));
  (map.nodes || []).forEach((nd) => {
    if (nd.type === 'obstacle') dynBlocked.add(`${nd.x},${nd.y}`);
  });

  // Goal cannot be blocked or inside a wall
  if (grid[gy][gx] === 1 || grid[gy][gx] === 2 || dynBlocked.has(`${gx},${gy}`)) {
    return EMPTY_RESULT([{ x: sx, y: sy }], +(performance.now() - t0).toFixed(2));
  }

  const hFn = (x, y) => Math.abs(x - gx) + Math.abs(y - gy);
  const startKey = `${sx},${sy}`;
  const goalKey = `${gx},${gy}`;

  const openList = [{ x: sx, y: sy, key: startKey, g: 0, h: hFn(sx, sy), f: hFn(sx, sy) }];
  const gScore = new Map([[startKey, 0]]);
  const cameFrom = new Map();
  const closedSet = new Set();
  const explored = [];
  const heuristics = new Map([[startKey, { g: 0, h: hFn(sx, sy), f: hFn(sx, sy) }]]);

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 }
  ];

  while (openList.length > 0) {
    openList.sort((a, b) => (a.f !== b.f ? a.f - b.f : a.h - b.h));
    const current = openList.shift();

    if (closedSet.has(current.key)) continue;
    closedSet.add(current.key);
    explored.push({ x: current.x, y: current.y });

    if (current.key === goalKey) {
      const path = [];
      let currKey = goalKey;
      while (currKey) {
        const [cx, cy] = currKey.split(',').map(Number);
        path.unshift({ x: cx, y: cy });
        currKey = cameFrom.get(currKey) || null;
      }
      return {
        found: true,
        path,
        explored,
        heuristics,
        totalSteps: Math.max(0, path.length - 1),
        totalCost: +(current.g * (map.cellSize || 1.0)).toFixed(1),
        executionTimeMs: Math.max(0.12, +(performance.now() - t0).toFixed(2))
      };
    }

    for (const d of dirs) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

      const nKey = `${nx},${ny}`;
      if (closedSet.has(nKey)) continue;

      const cellVal = grid[ny][nx];
      if (cellVal === 1 || cellVal === 2 || dynBlocked.has(nKey)) continue;

      // Restricted cell (3) has higher step cost (2.5)
      const stepCost = cellVal === 3 ? 2.5 : 1.0;
      const tentativeG = +(current.g + stepCost).toFixed(2);
      const prevG = gScore.has(nKey) ? gScore.get(nKey) : Infinity;

      if (tentativeG < prevG) {
        cameFrom.set(nKey, current.key);
        gScore.set(nKey, tentativeG);
        const hVal = hFn(nx, ny);
        const fVal = +(tentativeG + hVal).toFixed(2);
        heuristics.set(nKey, { g: tentativeG, h: hVal, f: fVal });
        openList.push({ x: nx, y: ny, key: nKey, g: tentativeG, h: hVal, f: fVal });
      }
    }
  }

  return EMPTY_RESULT(explored, Math.max(0.14, +(performance.now() - t0).toFixed(2)));
}

// Validate map topology & 2D grid A* reachability
export function validateTopologyAndGrid(map) {
  const issues = [];
  if (!map.name || !map.name.trim()) issues.push('Map name is required.');
  if (map.width < 6 || map.width > 60 || map.height < 6 || map.height > 60) {
    issues.push(`Invalid grid dimensions (${map.width}x${map.height}). Valid range: 6..60.`);
  }

  const seenIds = new Set();
  const seenCoords = new Set();

  (map.nodes || []).forEach((n) => {
    if (seenIds.has(n.id)) issues.push(`Duplicate node ID "${n.id}".`);
    seenIds.add(n.id);

    if (n.x < 0 || n.x >= map.width || n.y < 0 || n.y >= map.height) {
      issues.push(`Node ${n.id} (${n.x},${n.y}) is outside map bounds.`);
    } else if (map.grid[n.y] && map.grid[n.y][n.x] === 1) {
      issues.push(`Node ${n.id} (${n.x},${n.y}) is placed on a blocked wall cell.`);
    }

    const cKey = `${n.x},${n.y}`;
    if (seenCoords.has(cKey)) issues.push(`Multiple nodes share cell (${n.x},${n.y}).`);
    seenCoords.add(cKey);
  });

  const passableNodes = (map.nodes || []).filter((n) => n.type !== 'obstacle');
  const startNode = passableNodes.find((n) => n.type === 'start') || passableNodes[0];
  const destNode =
    passableNodes.find((n) => n.type === 'destination' && n.id !== startNode?.id) ||
    passableNodes[passableNodes.length - 1];

  let reachabilityOk = false;
  let sampleSteps = 0;
  if (startNode && destNode && startNode.id !== destNode.id) {
    const res = runGridAStar(map, { x: startNode.x, y: startNode.y }, { x: destNode.x, y: destNode.y }, []);
    reachabilityOk = res.found;
    sampleSteps = res.totalSteps;
    if (!res.found) {
      issues.push(
        `No walkable 2D corridor path between ${startNode.id} (${startNode.x},${startNode.y}) and ${destNode.id} (${destNode.x},${destNode.y}).`
      );
    }
  } else {
    issues.push('At least 2 passable facility/waypoint nodes are required.');
  }

  return {
    valid: issues.length === 0,
    issues,
    nodeCount: (map.nodes || []).length,
    edgeCount: (map.edges || []).length,
    startNodeId: startNode?.id || '--',
    destNodeId: destNode?.id || '--',
    reachabilityOk,
    sampleSteps
  };
}
