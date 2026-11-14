import { createEmptyGrid, computeEuclideanWeight } from './grid.js';

function addPerimeter(grid, w, h) {
  for (let x = 0; x < w; x++) {
    grid[0][x] = 1;
    grid[h - 1][x] = 1;
  }
  for (let y = 0; y < h; y++) {
    grid[y][0] = 1;
    grid[y][w - 1] = 1;
  }
}

function stampBuildings(grid, buildings) {
  buildings.forEach((b) => {
    for (let r = b.y; r < b.y + b.h; r++) {
      for (let c = b.x; c < b.x + b.w; c++) {
        if (grid[r] && grid[r][c] !== undefined) grid[r][c] = 1;
      }
    }
  });
}

export function buildDefaultMaps() {
  // MAP 1: Main Engineering Campus (22 x 15)
  const w1 = 22;
  const h1 = 15;
  const g1 = createEmptyGrid(w1, h1, 0);
  addPerimeter(g1, w1, h1);

  const buildings1 = [
    { id: 'B-LIB', code: 'LIB', name: 'Central Library', x: 2, y: 1, w: 4, h: 3, dockX: 3, dockY: 4 },
    { id: 'B-LAB', code: 'LAB', name: 'AI & Computer Lab', x: 16, y: 1, w: 4, h: 3, dockX: 18, dockY: 4 },
    { id: 'B-ADM', code: 'ADM', name: 'Admin Quad', x: 9, y: 2, w: 4, h: 2, dockX: 10, dockY: 4 },
    { id: 'B-ENG', code: 'ENG', name: 'Robotics Workshop', x: 6, y: 6, w: 4, h: 3, dockX: 5, dockY: 7 },
    { id: 'B-LEC', code: 'LEC', name: 'Lecture Complex', x: 12, y: 6, w: 4, h: 3, dockX: 16, dockY: 7 },
    { id: 'B-GATE', code: 'GATE', name: 'Main Security Gate', x: 2, y: 11, w: 3, h: 3, dockX: 3, dockY: 10 },
    { id: 'B-HOS', code: 'HOS', name: 'Student Hostel', x: 8, y: 11, w: 5, h: 3, dockX: 10, dockY: 10 },
    { id: 'B-CAN', code: 'CAN', name: 'Campus Canteen', x: 16, y: 11, w: 4, h: 3, dockX: 18, dockY: 10 }
  ];
  stampBuildings(g1, buildings1);

  // Restricted zone cells (high pedestrian density)
  g1[9][14] = 3;
  g1[9][15] = 3;

  const nodes1 = [
    { id: 'N-LIB', code: 'LIB', label: 'Central Library', x: 3, y: 4, type: 'start' },
    { id: 'N-LAB', code: 'LAB', label: 'AI & Computer Lab', x: 18, y: 4, type: 'destination' },
    { id: 'N-CAN', code: 'CAN', label: 'Campus Canteen', x: 18, y: 10, type: 'dock' },
    { id: 'N-HOS', code: 'HOS', label: 'Student Hostel', x: 10, y: 10, type: 'dock' },
    { id: 'N-GATE', code: 'GATE', label: 'Main Security Gate', x: 3, y: 10, type: 'dock' },
    { id: 'N-01', code: 'W-JCT', label: 'West Corridor Jct', x: 5, y: 5, type: 'waypoint' },
    { id: 'N-02', code: 'N-SPINE', label: 'North Spine Mid', x: 11, y: 5, type: 'waypoint' },
    { id: 'N-03', code: 'C-PLAZA', label: 'Central Plaza', x: 11, y: 9, type: 'waypoint' },
    { id: 'N-04', code: 'E-JCT', label: 'East Corridor Jct', x: 17, y: 7, type: 'waypoint' }
  ];

  const pairs1 = [
    ['N-LIB', 'N-01'],
    ['N-01', 'N-02'],
    ['N-02', 'N-LAB'],
    ['N-LIB', 'N-GATE'],
    ['N-02', 'N-03'],
    ['N-03', 'N-HOS'],
    ['N-GATE', 'N-HOS'],
    ['N-LAB', 'N-04'],
    ['N-04', 'N-CAN'],
    ['N-HOS', 'N-CAN']
  ];
  const nMap1 = new Map(nodes1.map((n) => [n.id, n]));
  const edges1 = pairs1.map(([u, v], idx) => ({
    id: `E-${idx + 1}`,
    from: u,
    to: v,
    directed: false,
    weight: computeEuclideanWeight(nMap1.get(u), nMap1.get(v), 1.5)
  }));

  // MAP 2: Research & Innovation Park (22 x 15)
  const w2 = 22;
  const h2 = 15;
  const g2 = createEmptyGrid(w2, h2, 0);
  addPerimeter(g2, w2, h2);

  const buildings2 = [
    { id: 'B2-LIB', code: 'LIB', name: 'Data Archive', x: 2, y: 2, w: 4, h: 3, dockX: 4, dockY: 5 },
    { id: 'B2-LAB', code: 'LAB', name: 'Cleanroom Facility', x: 15, y: 2, w: 5, h: 3, dockX: 17, dockY: 5 },
    { id: 'B2-CORE', code: 'CORE', name: 'Reactor Core', x: 9, y: 5, w: 4, h: 4, dockX: 8, dockY: 7 },
    { id: 'B2-HOS', code: 'HOS', name: 'Visiting Suites', x: 2, y: 10, w: 4, h: 3, dockX: 4, dockY: 9 },
    { id: 'B2-GATE', code: 'GATE', name: 'South Checkpoint', x: 9, y: 11, w: 4, h: 3, dockX: 11, dockY: 10 },
    { id: 'B2-CAN', code: 'CAN', name: 'Researcher Cafe', x: 15, y: 10, w: 5, h: 3, dockX: 17, dockY: 9 }
  ];
  stampBuildings(g2, buildings2);

  const nodes2 = [
    { id: 'N-LIB', code: 'LIB', label: 'Data Archive', x: 4, y: 5, type: 'start' },
    { id: 'N-LAB', code: 'LAB', label: 'Cleanroom Facility', x: 17, y: 5, type: 'destination' },
    { id: 'N-CAN', code: 'CAN', label: 'Researcher Cafe', x: 17, y: 9, type: 'dock' },
    { id: 'N-HOS', code: 'HOS', label: 'Visiting Suites', x: 4, y: 9, type: 'dock' },
    { id: 'N-GATE', code: 'GATE', label: 'South Checkpoint', x: 11, y: 10, type: 'dock' },
    { id: 'N-10', code: 'N-BYP', label: 'North Bypass', x: 11, y: 3, type: 'waypoint' }
  ];
  const nMap2 = new Map(nodes2.map((n) => [n.id, n]));
  const edges2 = [
    ['N-LIB', 'N-10'],
    ['N-10', 'N-LAB'],
    ['N-LIB', 'N-HOS'],
    ['N-HOS', 'N-GATE'],
    ['N-GATE', 'N-CAN'],
    ['N-LAB', 'N-CAN']
  ].map(([u, v], idx) => ({
    id: `E2-${idx + 1}`,
    from: u,
    to: v,
    directed: false,
    weight: computeEuclideanWeight(nMap2.get(u), nMap2.get(v), 1.2)
  }));

  return [
    {
      id: 'map-sec-01',
      code: 'SEC-01',
      name: 'Main Engineering Campus',
      description: 'Primary 2D campus occupancy grid with 5 facility docks and redundant corridors.',
      width: w1,
      height: h1,
      cellSize: 1.5,
      grid: g1,
      buildings: buildings1,
      nodes: nodes1,
      edges: edges1
    },
    {
      id: 'map-sec-02',
      code: 'SEC-02',
      name: 'Research & Innovation Park',
      description: 'High-bay cleanroom complex with north and south ring corridors.',
      width: w2,
      height: h2,
      cellSize: 1.2,
      grid: g2,
      buildings: buildings2,
      nodes: nodes2,
      edges: edges2
    }
  ];
}
