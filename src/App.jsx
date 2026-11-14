import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot,
  Play,
  Pause,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Save,
  ArrowLeftRight,
  AlertTriangle,
  StepForward,
  Download,
  LayoutGrid,
  XCircle,
  RefreshCw,
  Search,
  BarChart3,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Maximize2,
  MousePointer,
  GitCommit,
  Share2,
  Eraser,
  Undo2,
  Redo2,
  Sliders,
  X,
  Edit3,
  FolderPlus,
  Scaling,
  Building2,
  MapPin
} from 'lucide-react';

import { createEmptyGrid, carveCorridorLine, computeEuclideanWeight } from './utils/grid.js';
import { buildDefaultMaps } from './utils/maps.js';
import { runGridAStar, validateTopologyAndGrid } from './utils/astar.js';

const STORAGE_KEY = 'cc_grid_maps_v4';

export default function App() {
  // --------------------------------------------------------------------------
  // AUTHENTICATION STATE
  // --------------------------------------------------------------------------
  const [currentUser, setCurrentUser] = useState(null);
  const [loginRole, setLoginRole] = useState('Fleet Operator');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // PRIMARY NAVIGATION: 'OPERATIONS' | 'STUDIO' | 'LEDGER'
  const [activeView, setActiveView] = useState('OPERATIONS');

  // --------------------------------------------------------------------------
  // CAMPUS TOPOLOGIES STATE
  // --------------------------------------------------------------------------
  const [maps, setMaps] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].grid) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore storage errors
    }
    return buildDefaultMaps();
  });

  const [activeMapId, setActiveMapId] = useState('map-sec-01');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(maps));
    } catch (e) {
      // ignore
    }
  }, [maps]);

  const activeMap = useMemo(
    () => maps.find((m) => m.id === activeMapId) || maps[0],
    [maps, activeMapId]
  );

  const passableNodes = useMemo(
    () => (activeMap.nodes || []).filter((n) => n.type !== 'obstacle'),
    [activeMap]
  );

  // --------------------------------------------------------------------------
  // OPERATIONS CONTROL SIMULATION & 2D CELL-BY-CELL A* STATE
  // --------------------------------------------------------------------------
  const [originNodeId, setOriginNodeId] = useState('N-LIB');
  const [destNodeId, setDestNodeId] = useState('N-LAB');
  const [dynamicObstacles, setDynamicObstacles] = useState([]);

  const [robotPos, setRobotPos] = useState({ x: 3, y: 4 });
  const [unitStatus, setUnitStatus] = useState('IDLE'); // 'IDLE' | 'MOVING' | 'REROUTED' | 'DELIVERED' | 'BLOCKED'
  const [isRunning, setIsRunning] = useState(false);
  const [tickRateMs, setTickRateMs] = useState(210);

  const [activePath, setActivePath] = useState([]);
  const [traveledPath, setTraveledPath] = useState([]);
  const [exploredCells, setExploredCells] = useState([]);
  const [heuristicsMap, setHeuristicsMap] = useState(new Map());

  const [baselineSteps, setBaselineSteps] = useState(0);
  const [activeRemainingSteps, setActiveRemainingSteps] = useState(0);
  const [rerouteCount, setRerouteCount] = useState(0);
  const [isDetourActive, setIsDetourActive] = useState(false);
  const [solverTimeMs, setSolverTimeMs] = useState(0.16);
  const [showFrontier, setShowFrontier] = useState(false);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Mission Ledger State
  const [missionLedger, setMissionLedger] = useState(() => [
    {
      id: 'MSN-304',
      mapCode: 'SEC-01',
      origin: 'Central Library (03,04)',
      destination: 'AI & Computer Lab (18,04)',
      baselineCells: 17,
      actualCells: 23,
      reroutes: 1,
      obstacles: 1,
      solverMs: '0.18ms',
      status: 'DELIVERED',
      timestamp: '09:42:11'
    },
    {
      id: 'MSN-303',
      mapCode: 'SEC-01',
      origin: 'Main Security Gate (03,10)',
      destination: 'Campus Canteen (18,10)',
      baselineCells: 15,
      actualCells: 15,
      reroutes: 0,
      obstacles: 0,
      solverMs: '0.14ms',
      status: 'DELIVERED',
      timestamp: '09:18:04'
    },
    {
      id: 'MSN-302',
      mapCode: 'SEC-02',
      origin: 'Data Archive (04,05)',
      destination: 'Cleanroom Facility (17,05)',
      baselineCells: 17,
      actualCells: 21,
      reroutes: 1,
      obstacles: 1,
      solverMs: '0.19ms',
      status: 'DELIVERED',
      timestamp: '08:55:30'
    }
  ]);
  const [ledgerFilter, setLedgerFilter] = useState('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');

  // --------------------------------------------------------------------------
  // INITIALIZE / COMPUTE 2D CELL-BY-CELL ROUTE
  // --------------------------------------------------------------------------
  const computeInitialRoute = useCallback((targetMap, startId, goalId, dynObs = []) => {
    if (!targetMap) return;
    const sNode = targetMap.nodes.find((n) => n.id === startId) || targetMap.nodes[0];
    const gNode =
      targetMap.nodes.find((n) => n.id === goalId) ||
      targetMap.nodes[targetMap.nodes.length - 1];
    if (!sNode || !gNode) return;

    const startCoord = { x: sNode.x, y: sNode.y };
    const goalCoord = { x: gNode.x, y: gNode.y };

    const res = runGridAStar(targetMap, startCoord, goalCoord, dynObs);
    setRobotPos(startCoord);
    setTraveledPath([startCoord]);
    setExploredCells(res.explored);
    setHeuristicsMap(res.heuristics);
    setSolverTimeMs(res.executionTimeMs);
    setRerouteCount(0);
    setIsDetourActive(false);

    if (res.found) {
      setActivePath(res.path);
      setBaselineSteps(res.totalSteps);
      setActiveRemainingSteps(res.totalSteps);
      setUnitStatus('IDLE');
    } else {
      setActivePath([]);
      setBaselineSteps(0);
      setActiveRemainingSteps(0);
      setUnitStatus('BLOCKED');
    }
  }, []);

  useEffect(() => {
    const valid = (activeMap.nodes || []).filter((n) => n.type !== 'obstacle');
    const st =
      valid.find((n) => n.id === originNodeId) ||
      valid.find((n) => n.type === 'start') ||
      valid[0];
    const dst =
      valid.find((n) => n.id === destNodeId && n.id !== st?.id) ||
      valid.find((n) => n.type === 'destination' && n.id !== st?.id) ||
      valid[valid.length - 1];

    const sId = st ? st.id : '';
    const dId = dst ? dst.id : '';
    setOriginNodeId(sId);
    setDestNodeId(dId);
    setDynamicObstacles([]);
    setIsRunning(false);
    if (sId && dId) {
      computeInitialRoute(activeMap, sId, dId, []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMapId, activeMap, computeInitialRoute]);

  const handleEndpointChange = (newOrigId, newDestId) => {
    if (newOrigId === newDestId) return;
    setIsRunning(false);
    setOriginNodeId(newOrigId);
    setDestNodeId(newDestId);
    computeInitialRoute(activeMap, newOrigId, newDestId, dynamicObstacles);
  };

  const handleSwapEndpoints = () => {
    setIsRunning(false);
    const nextOrig = destNodeId;
    const nextDest = originNodeId;
    setOriginNodeId(nextOrig);
    setDestNodeId(nextDest);
    computeInitialRoute(activeMap, nextOrig, nextDest, dynamicObstacles);
  };

  // --------------------------------------------------------------------------
  // CLICK ANY GRID CELL TO TOGGLE OBSTACLE & TRIGGER INSTANT A* REPLANNING
  // --------------------------------------------------------------------------
  const recalculateFromRobot = useCallback(
    (nextObstacles) => {
      const destNode = activeMap.nodes.find((n) => n.id === destNodeId);
      if (!destNode) return;

      const res = runGridAStar(
        activeMap,
        robotPos,
        { x: destNode.x, y: destNode.y },
        nextObstacles
      );
      setExploredCells(res.explored);
      setHeuristicsMap(res.heuristics);
      setSolverTimeMs(res.executionTimeMs);

      if (res.found) {
        setActivePath(res.path);
        setActiveRemainingSteps(res.totalSteps);
        setIsDetourActive(true);
        setRerouteCount((c) => c + 1);
        setUnitStatus('REROUTED');
      } else {
        setActivePath([]);
        setActiveRemainingSteps(0);
        setIsRunning(false);
        setUnitStatus('BLOCKED');
      }
    },
    [activeMap, destNodeId, robotPos]
  );

  const handleCellClickInOps = (cx, cy) => {
    // Do not place obstacle on walls, current robot cell, or origin/destination dock cells
    if (activeMap.grid[cy][cx] === 1) return;
    if (robotPos.x === cx && robotPos.y === cy) return;

    const origNode = activeMap.nodes.find((n) => n.id === originNodeId);
    const destNode = activeMap.nodes.find((n) => n.id === destNodeId);
    if (origNode && origNode.x === cx && origNode.y === cy) return;
    if (destNode && destNode.x === cx && destNode.y === cy) return;

    const exists = dynamicObstacles.some((o) => o.x === cx && o.y === cy);
    const nextObstacles = exists
      ? dynamicObstacles.filter((o) => !(o.x === cx && o.y === cy))
      : [...dynamicObstacles, { x: cx, y: cy }];

    setDynamicObstacles(nextObstacles);

    if (!exists) {
      // Check if newly added obstacle lies on the robot's remaining path
      const blocksActivePath = activePath.some(
        (pt, idx) => idx > 0 && pt.x === cx && pt.y === cy
      );
      if (blocksActivePath) {
        recalculateFromRobot(nextObstacles);
      }
    } else if (unitStatus === 'BLOCKED') {
      // If previously blocked and user cleared an obstacle, re-evaluate
      recalculateFromRobot(nextObstacles);
    }
  };

  // Single-click "Drop Obstacle Ahead (+2 Cells)" button for live demonstrations
  const handleDropObstacleAhead = () => {
    if (activePath.length < 2) return;
    const destNode = activeMap.nodes.find((n) => n.id === destNodeId);

    // Choose 2 cells ahead of robot (or 1 cell ahead if only 2 steps left before goal)
    const targetIdx = activePath.length > 3 ? 2 : 1;
    const targetCell = activePath[targetIdx];
    if (!targetCell) return;
    if (destNode && targetCell.x === destNode.x && targetCell.y === destNode.y) return;

    const alreadyBlocked = dynamicObstacles.some(
      (o) => o.x === targetCell.x && o.y === targetCell.y
    );
    if (alreadyBlocked) return;

    const nextObstacles = [...dynamicObstacles, { x: targetCell.x, y: targetCell.y }];
    setDynamicObstacles(nextObstacles);
    recalculateFromRobot(nextObstacles);
  };

  // --------------------------------------------------------------------------
  // CELL-BY-CELL SIMULATION STEPPER
  // --------------------------------------------------------------------------
  const stepRobotOneCell = useCallback(() => {
    setActivePath((currPath) => {
      if (currPath.length <= 1) {
        setIsRunning(false);
        return currPath;
      }

      const nextCell = currPath[1];
      const remainingPath = currPath.slice(1);

      setRobotPos(nextCell);
      setActiveRemainingSteps(Math.max(0, remainingPath.length - 1));
      setUnitStatus((prev) =>
        prev === 'REROUTED' || isDetourActive ? 'REROUTED' : 'MOVING'
      );

      setTraveledPath((prevTrav) => {
        const updatedTrav = [...prevTrav, nextCell];
        const destNode = activeMap.nodes.find((n) => n.id === destNodeId);
        const origNode = activeMap.nodes.find((n) => n.id === originNodeId);

        if (destNode && nextCell.x === destNode.x && nextCell.y === destNode.y) {
          setIsRunning(false);
          setUnitStatus('DELIVERED');

          setMissionLedger((prevLed) => [
            {
              id: `MSN-${305 + prevLed.length}`,
              mapCode: activeMap.code,
              origin: `${origNode?.label || originNodeId} (${String(origNode?.x ?? 0).padStart(2, '0')},${String(origNode?.y ?? 0).padStart(2, '0')})`,
              destination: `${destNode.label} (${String(destNode.x).padStart(2, '0')},${String(destNode.y).padStart(2, '0')})`,
              baselineCells: baselineSteps,
              actualCells: updatedTrav.length - 1,
              reroutes: rerouteCount,
              obstacles: dynamicObstacles.length,
              solverMs: `${solverTimeMs}ms`,
              status: 'DELIVERED',
              timestamp: new Date().toTimeString().split(' ')[0]
            },
            ...prevLed
          ]);
        }
        return updatedTrav;
      });

      return remainingPath;
    });
  }, [
    activeMap,
    destNodeId,
    originNodeId,
    isDetourActive,
    baselineSteps,
    rerouteCount,
    dynamicObstacles.length,
    solverTimeMs
  ]);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(stepRobotOneCell, tickRateMs);
    return () => clearInterval(timer);
  }, [isRunning, tickRateMs, stepRobotOneCell]);

  const handleStartOrResume = () => {
    if (unitStatus === 'DELIVERED') {
      computeInitialRoute(activeMap, originNodeId, destNodeId, dynamicObstacles);
      setIsRunning(true);
      setUnitStatus('MOVING');
      return;
    }
    if (activePath.length <= 1) {
      const destNode = activeMap.nodes.find((n) => n.id === destNodeId);
      if (!destNode) return;
      const res = runGridAStar(
        activeMap,
        robotPos,
        { x: destNode.x, y: destNode.y },
        dynamicObstacles
      );
      if (!res.found) {
        setUnitStatus('BLOCKED');
        return;
      }
      setActivePath(res.path);
    }
    setIsRunning(true);
    setUnitStatus(isDetourActive ? 'REROUTED' : 'MOVING');
  };

  // Fast lookup sets for rendering the 2D Occupancy Grid in Operations Control
  const activePathSet = useMemo(
    () => new Set(activePath.map((p) => `${p.x},${p.y}`)),
    [activePath]
  );
  const traveledSet = useMemo(
    () => new Set(traveledPath.map((p) => `${p.x},${p.y}`)),
    [traveledPath]
  );
  const exploredSet = useMemo(
    () => new Set(exploredCells.map((p) => `${p.x},${p.y}`)),
    [exploredCells]
  );
  const dynObstacleSet = useMemo(
    () => new Set(dynamicObstacles.map((o) => `${o.x},${o.y}`)),
    [dynamicObstacles]
  );

  const opsBuildingCellMap = useMemo(() => {
    const m = new Map();
    (activeMap.buildings || []).forEach((b) => {
      for (let r = b.y; r < b.y + b.h; r++) {
        for (let c = b.x; c < b.x + b.w; c++) {
          m.set(`${c},${r}`, { ...b, isAnchor: c === b.x && r === b.y });
        }
      }
    });
    return m;
  }, [activeMap.buildings]);

  const opsNodeCellMap = useMemo(() => {
    const m = new Map();
    (activeMap.nodes || []).forEach((nd) => {
      m.set(`${nd.x},${nd.y}`, nd);
    });
    return m;
  }, [activeMap.nodes]);

  // ==========================================================================
  // TOPOLOGY STUDIO STATE (2D GRID PAINTING + NODE/EDGE AUTHORING)
  // ==========================================================================
  const [studioMap, setStudioMap] = useState(() => structuredClone(activeMap));
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Tools: 'SELECT' | 'CORRIDOR' | 'WALL' | 'OBSTACLE' | 'RESTRICTED' | 'ADD_NODE' | 'REMOVE_NODE' | 'CONNECT'
  const [studioTool, setStudioTool] = useState('SELECT');
  const [isPaintingGrid, setIsPaintingGrid] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [connectSourceId, setConnectSourceId] = useState(null);
  const [connectDirected] = useState(false);
  const [studioZoom, setStudioZoom] = useState(1);

  const [showNewMapModal, setShowNewMapModal] = useState(false);
  const [newMapForm, setNewMapForm] = useState({
    name: 'Autonomous Logistics Sector',
    code: 'SEC-03',
    preset: '22x15',
    width: 22,
    height: 15,
    cellSize: 1.5
  });

  const [showResizeModal, setShowResizeModal] = useState(false);
  const [resizeForm, setResizeForm] = useState({
    width: activeMap.width,
    height: activeMap.height,
    cellSize: activeMap.cellSize
  });
  const [resizeOutNodes, setResizeOutNodes] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [validationReport, setValidationReport] = useState(() =>
    validateTopologyAndGrid(activeMap)
  );
  const [studioSaveBanner, setStudioSaveBanner] = useState('');

  const loadMapIntoStudio = useCallback((target) => {
    const cloned = structuredClone(target);
    setStudioMap(cloned);
    setUndoStack([]);
    setRedoStack([]);
    setSelectedNodeId(cloned.nodes[0]?.id || null);
    setConnectSourceId(null);
    setStudioZoom(1);
    setValidationReport(validateTopologyAndGrid(cloned));
  }, []);

  const mutateStudioMap = useCallback((updaterFn) => {
    setStudioMap((prev) => {
      const snapshot = structuredClone(prev);
      const next = updaterFn(structuredClone(prev));
      setUndoStack((u) => [...u.slice(-29), snapshot]);
      setRedoStack([]);
      setValidationReport(validateTopologyAndGrid(next));
      return next;
    });
  }, []);

  const handleStudioUndo = useCallback(() => {
    setUndoStack((u) => {
      if (u.length === 0) return u;
      const previous = u[u.length - 1];
      setStudioMap((curr) => {
        setRedoStack((r) => [...r, structuredClone(curr)]);
        setValidationReport(validateTopologyAndGrid(previous));
        return previous;
      });
      return u.slice(0, -1);
    });
  }, []);

  const handleStudioRedo = useCallback(() => {
    setRedoStack((r) => {
      if (r.length === 0) return r;
      const nextState = r[r.length - 1];
      setStudioMap((curr) => {
        setUndoStack((u) => [...u, structuredClone(curr)]);
        setValidationReport(validateTopologyAndGrid(nextState));
        return nextState;
      });
      return r.slice(0, -1);
    });
  }, []);

  const handleDeleteStudioNode = useCallback(
    (nodeId) => {
      if (!nodeId) return;
      mutateStudioMap((draft) => {
        draft.nodes = draft.nodes.filter((n) => n.id !== nodeId);
        draft.edges = draft.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
        return draft;
      });
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      if (connectSourceId === nodeId) setConnectSourceId(null);
    },
    [selectedNodeId, connectSourceId, mutateStudioMap]
  );

  // Handle clicking or painting a 2D cell in Topology Studio
  const handleStudioCellAction = (cx, cy, isDrag = false) => {
    const existingNode = studioMap.nodes.find((n) => n.x === cx && n.y === cy);

    if (studioTool === 'CORRIDOR') {
      mutateStudioMap((draft) => {
        draft.grid[cy][cx] = 0;
        return draft;
      });
      return;
    }
    if (studioTool === 'WALL') {
      if (existingNode) return; // keep node cells passable
      mutateStudioMap((draft) => {
        draft.grid[cy][cx] = 1;
        return draft;
      });
      return;
    }
    if (studioTool === 'OBSTACLE') {
      mutateStudioMap((draft) => {
        draft.grid[cy][cx] = draft.grid[cy][cx] === 2 ? 0 : 2;
        return draft;
      });
      return;
    }
    if (studioTool === 'RESTRICTED') {
      mutateStudioMap((draft) => {
        draft.grid[cy][cx] = draft.grid[cy][cx] === 3 ? 0 : 3;
        return draft;
      });
      return;
    }

    if (isDrag) return;

    if (studioTool === 'SELECT') {
      if (existingNode) {
        setSelectedNodeId(existingNode.id);
      }
    } else if (studioTool === 'ADD_NODE') {
      if (existingNode) {
        setSelectedNodeId(existingNode.id);
        return;
      }
      let idx = studioMap.nodes.length + 1;
      let newId = `N-${String(idx).padStart(2, '0')}`;
      const idSet = new Set(studioMap.nodes.map((n) => n.id));
      while (idSet.has(newId)) {
        idx += 1;
        newId = `N-${String(idx).padStart(2, '0')}`;
      }
      mutateStudioMap((draft) => {
        // Ensure cell is walkable
        draft.grid[cy][cx] = 0;
        draft.nodes.push({
          id: newId,
          code: newId,
          label: `Station ${newId}`,
          x: cx,
          y: cy,
          type: 'dock'
        });
        return draft;
      });
      setSelectedNodeId(newId);
    } else if (studioTool === 'REMOVE_NODE') {
      if (existingNode) {
        handleDeleteStudioNode(existingNode.id);
      }
    } else if (studioTool === 'CONNECT') {
      if (!existingNode) return;
      if (!connectSourceId) {
        setConnectSourceId(existingNode.id);
        setSelectedNodeId(existingNode.id);
      } else if (connectSourceId === existingNode.id) {
        setConnectSourceId(null);
      } else {
        mutateStudioMap((draft) => {
          const u = draft.nodes.find((n) => n.id === connectSourceId);
          const v = draft.nodes.find((n) => n.id === existingNode.id);
          if (!u || !v) return draft;
          const dup = draft.edges.some(
            (e) =>
              (e.from === u.id && e.to === v.id) ||
              (!connectDirected && e.from === v.id && e.to === u.id)
          );
          if (!dup) {
            draft.edges.push({
              id: `E-${Date.now().toString().slice(-4)}`,
              from: u.id,
              to: v.id,
              directed: connectDirected,
              weight: computeEuclideanWeight(u, v, draft.cellSize || 1.0)
            });
            // Automatically carve walkable 2D corridor along the edge so 2D A* can traverse it
            carveCorridorLine(draft.grid, u.x, u.y, v.x, v.y, draft.width, draft.height);
          }
          return draft;
        });
        setConnectSourceId(existingNode.id);
        setSelectedNodeId(existingNode.id);
      }
    }
  };

  // Create New Map Modal Submit
  const handleCreateNewMapConfirm = (e) => {
    e.preventDefault();
    const w = Math.max(8, Math.min(50, Number(newMapForm.width) || 22));
    const h = Math.max(8, Math.min(40, Number(newMapForm.height) || 15));
    const cs = Math.max(0.5, Number(newMapForm.cellSize) || 1.5);

    const g = createEmptyGrid(w, h, 0);
    for (let x = 0; x < w; x++) {
      g[0][x] = 1;
      g[h - 1][x] = 1;
    }
    for (let y = 0; y < h; y++) {
      g[y][0] = 1;
      g[y][w - 1] = 1;
    }

    const nStart = { id: 'N-LIB', code: 'LIB', label: 'Origin Station', x: 2, y: 2, type: 'start' };
    const nDest = {
      id: 'N-LAB',
      code: 'LAB',
      label: 'Destination Station',
      x: w - 3,
      y: h - 3,
      type: 'destination'
    };

    const created = {
      id: `map-${Date.now()}`,
      code: newMapForm.code.trim().toUpperCase() || `SEC-0${maps.length + 1}`,
      name: newMapForm.name.trim() || `Custom Sector ${w}x${h}`,
      description: 'Custom 2D occupancy grid and node topology.',
      width: w,
      height: h,
      cellSize: cs,
      grid: g,
      buildings: [],
      nodes: [nStart, nDest],
      edges: [
        {
          id: 'E-1',
          from: 'N-LIB',
          to: 'N-LAB',
          directed: false,
          weight: computeEuclideanWeight(nStart, nDest, cs)
        }
      ]
    };

    loadMapIntoStudio(created);
    setShowNewMapModal(false);
  };

  // Resize Map Modal Handlers
  const openResizeModal = () => {
    setResizeForm({
      width: studioMap.width,
      height: studioMap.height,
      cellSize: studioMap.cellSize
    });
    setResizeOutNodes([]);
    setShowResizeModal(true);
  };

  const handleResizeFormChange = (field, value) => {
    const next = { ...resizeForm, [field]: value };
    setResizeForm(next);
    const nw = Number(next.width) || studioMap.width;
    const nh = Number(next.height) || studioMap.height;
    setResizeOutNodes(studioMap.nodes.filter((n) => n.x >= nw || n.y >= nh));
  };

  const handleConfirmResize = (e) => {
    e.preventDefault();
    const nw = Math.max(8, Math.min(50, Number(resizeForm.width) || studioMap.width));
    const nh = Math.max(8, Math.min(40, Number(resizeForm.height) || studioMap.height));
    const ncs = Math.max(0.5, Number(resizeForm.cellSize) || studioMap.cellSize);

    mutateStudioMap((draft) => {
      const newGrid = createEmptyGrid(nw, nh, 0);
      for (let r = 0; r < Math.min(nh, draft.height); r++) {
        for (let c = 0; c < Math.min(nw, draft.width); c++) {
          newGrid[r][c] = draft.grid[r][c];
        }
      }
      draft.width = nw;
      draft.height = nh;
      draft.cellSize = ncs;
      draft.grid = newGrid;

      const validIds = new Set();
      draft.nodes = draft.nodes.filter((n) => {
        const inside = n.x < nw && n.y < nh;
        if (inside) validIds.add(n.id);
        return inside;
      });
      draft.edges = draft.edges.filter((ed) => validIds.has(ed.from) && validIds.has(ed.to));
      draft.buildings = (draft.buildings || []).filter(
        (b) => b.x + b.w <= nw && b.y + b.h <= nh
      );
      return draft;
    });
    setShowResizeModal(false);
  };

  const handleSaveStudioMap = () => {
    const rep = validateTopologyAndGrid(studioMap);
    setValidationReport(rep);
    if (!rep.valid) return;

    const toSave = structuredClone(studioMap);
    setMaps((prev) => {
      const idx = prev.findIndex((m) => m.id === toSave.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = toSave;
        return copy;
      }
      return [...prev, toSave];
    });
    setActiveMapId(toSave.id);
    setStudioSaveBanner(`Saved & Deployed ${toSave.code} (${toSave.width}×${toSave.height})`);
    setTimeout(() => setStudioSaveBanner(''), 3200);
  };

  const selectedStudioNode = useMemo(
    () => studioMap.nodes.find((n) => n.id === selectedNodeId) || null,
    [studioMap.nodes, selectedNodeId]
  );

  const selectedNodeEdges = useMemo(() => {
    if (!selectedStudioNode) return [];
    return studioMap.edges.filter(
      (e) => e.from === selectedStudioNode.id || e.to === selectedStudioNode.id
    );
  }, [studioMap.edges, selectedStudioNode]);

  // ==========================================================================
  // LOGIN HANDLER
  // ==========================================================================
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    const idTrim = loginIdentifier.trim();
    const passTrim = loginPassword.trim();
    if (!idTrim || idTrim.length < 3) {
      setLoginError('Enter a valid email or ID.');
      return;
    }
    if (!passTrim || passTrim.length < 4) {
      setLoginError('Password must be at least 4 characters.');
      return;
    }
    setLoginError('');
    setCurrentUser({
      name: idTrim.includes('@') ? idTrim.split('@')[0].toUpperCase() : idTrim.toUpperCase(),
      identifier: idTrim,
      role: loginRole
    });
  };

  // ==========================================================================
  // VIEW 0: FULL-SCREEN SPLIT-PANEL LOGIN PAGE
  // ==========================================================================
  if (!currentUser) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#0b0e13] text-slate-100 font-sans antialiased px-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-base font-semibold text-white">CampusCourier</span>
          </div>

          <h1 className="text-2xl font-semibold text-white">Sign in</h1>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            Welcome back. Enter your details to continue.
          </p>

          <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 rounded-md bg-[#11161f] p-1 text-sm">
              {['Fleet Operator', 'System Administrator'].map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setLoginRole(role)}
                  className={`py-1.5 rounded transition-colors cursor-pointer ${
                    loginRole === role
                      ? 'bg-[#1e2631] text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {role === 'System Administrator' ? 'Admin' : 'Operator'}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Email or ID</label>
              <input
                type="text"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                autoComplete="username"
                className="w-full rounded-md bg-[#11161f] border border-[#1e2631] px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-md bg-[#11161f] border border-[#1e2631] pl-3 pr-10 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && <p className="text-sm text-red-400">{loginError}</p>}

            <button
              type="submit"
              className="w-full rounded-md py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-medium text-sm transition-colors cursor-pointer"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // AUTHENTICATED APPLICATION SHELL
  // ==========================================================================
  const statusBadgeStyle =
    unitStatus === 'MOVING'
      ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
      : unitStatus === 'REROUTED'
      ? 'text-amber-400 border-amber-500/40 bg-amber-500/10'
      : unitStatus === 'BLOCKED'
      ? 'text-red-400 border-red-500/40 bg-red-500/10'
      : unitStatus === 'DELIVERED'
      ? 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10'
      : 'text-slate-300 border-[#1e2631] bg-[#161c26]';

  const inspectedKey = hoveredCell
    ? `${hoveredCell.x},${hoveredCell.y}`
    : `${robotPos.x},${robotPos.y}`;
  const inspectedH = heuristicsMap.get(inspectedKey);

  const totalMissionCells = Math.max(1, traveledPath.length - 1 + activeRemainingSteps);
  const progressPct =
    unitStatus === 'DELIVERED'
      ? 100
      : Math.min(100, Math.round(((traveledPath.length - 1) / totalMissionCells) * 100));

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0b0e13] text-slate-200 font-sans antialiased select-none">
      {/* TOP NAVIGATION BAR */}
      <header className="h-11 shrink-0 bg-[#11161f] border-b border-[#1e2631] px-3 flex items-center justify-between">
        <div className="flex items-center h-full">
          <div className="flex items-center gap-2.5 pr-4 border-r border-[#1e2631] h-full">
            <div className="w-6 h-6 bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <span className="text-xs font-semibold tracking-tight text-white">
              CampusCourier
            </span>
          </div>

          <nav className="flex items-center h-full">
            {[
              { id: 'OPERATIONS', label: 'Operations Control', icon: LayoutGrid },
              { id: 'STUDIO', label: 'Topology Studio', icon: Share2 },
              { id: 'LEDGER', label: 'Mission Ledger', icon: BarChart3 }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === 'STUDIO') loadMapIntoStudio(activeMap);
                    setActiveView(tab.id);
                  }}
                  className={`h-full px-4 border-r border-[#1e2631] text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0b0e13] text-cyan-400 border-b-2 border-b-cyan-400'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-[#161c26]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">SECTOR:</span>
            <select
              value={activeMapId}
              onChange={(e) => {
                setIsRunning(false);
                setActiveMapId(e.target.value);
                const found = maps.find((m) => m.id === e.target.value);
                if (found && activeView === 'STUDIO') loadMapIntoStudio(found);
              }}
              className="bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            >
              {maps.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.code} — {m.name} ({m.width}×{m.height})
                </option>
              ))}
            </select>
          </div>

          <span className={`px-2 py-0.5 border text-[11px] font-semibold ${statusBadgeStyle}`}>
            {unitStatus}
          </span>

          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#1e2631] text-[11px] text-slate-400">
            <span>{currentUser.name}</span>
            <button
              onClick={() => {
                setIsRunning(false);
                setCurrentUser(null);
              }}
              title="Sign Out"
              className="p-1 hover:bg-[#161c26] text-slate-400 hover:text-red-400 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* VIEW 1: OPERATIONS CONTROL */}
      {activeView === 'OPERATIONS' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Telemetry Strip */}
          <div className="h-12 shrink-0 grid grid-cols-6 bg-[#11161f] border-b border-[#1e2631] divide-x divide-[#1e2631] font-mono">
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">ROBOT STATUS</span>
              <span className="text-xs font-semibold text-white tabular-nums">
                Robot: {unitStatus}
              </span>
            </div>
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">CURRENT GRID CELL</span>
              <span className="text-xs font-semibold text-cyan-400 tabular-nums">
                COL {String(robotPos.x).padStart(2, '0')} , ROW {String(robotPos.y).padStart(2, '0')}
              </span>
            </div>
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">REMAINING DISTANCE</span>
              <span className="text-xs font-semibold text-emerald-400 tabular-nums">
                {activeRemainingSteps} CELLS ({+(activeRemainingSteps * activeMap.cellSize).toFixed(1)}m)
              </span>
            </div>
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">ACTIVE OBSTACLES</span>
              <span className="text-xs font-semibold text-red-400 tabular-nums">
                {dynamicObstacles.length} BLOCKED CELLS
              </span>
            </div>
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">DYNAMIC REROUTES</span>
              <span className="text-xs font-semibold text-amber-400 tabular-nums">
                {rerouteCount} reroutes
              </span>
            </div>
            <div className="px-3.5 flex flex-col justify-center">
              <span className="text-[10px] text-slate-500 uppercase">A* SOLVER LATENCY</span>
              <span className="text-xs font-semibold text-slate-200 tabular-nums">
                {solverTimeMs} ms
              </span>
            </div>
          </div>

          {/* Main Split Workspace */}
          <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
            {/* LEFT: 2D OCCUPANCY GRID MAP */}
            <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 border-r border-[#1e2631] bg-[#0b0e13]">
              <div className="h-9 shrink-0 px-3 bg-[#11161f] border-b border-[#1e2631] flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-[11px] font-semibold text-slate-200">
                    {activeMap.code}: {activeMap.name.toUpperCase()} ({activeMap.width}×{activeMap.height})
                  </span>
                  <div className="hidden xl:flex items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-emerald-500/40 border border-emerald-400 inline-block" />
                      Nominal Route
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-amber-500/40 border border-amber-400 inline-block" />
                      Detour Route
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-red-600 inline-block" />
                      Obstacle (Click Any Cell)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <button
                    onClick={() => setShowFrontier((f) => !f)}
                    className={`px-2 py-0.5 border cursor-pointer ${
                      showFrontier
                        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                        : 'bg-[#0b0e13] border-[#1e2631] text-slate-400'
                    }`}
                  >
                    A* FRONTIER: {showFrontier ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => {
                      setDynamicObstacles([]);
                      computeInitialRoute(activeMap, originNodeId, destNodeId, []);
                    }}
                    disabled={dynamicObstacles.length === 0}
                    className="px-2 py-0.5 bg-[#0b0e13] hover:bg-[#161c26] disabled:opacity-40 border border-[#1e2631] text-slate-300 cursor-pointer"
                  >
                    CLEAR OBSTACLES ({dynamicObstacles.length})
                  </button>
                </div>
              </div>

              {/* Grid Viewport */}
              <div className="flex-1 min-h-0 flex items-center justify-center p-2.5 bg-[#080b10] overflow-auto">
                <div className="w-full max-w-[920px] bg-[#0b0e13] border border-[#1e2631] p-2">
                  <div
                    className="grid gap-[1px] mb-[1px]"
                    style={{
                      gridTemplateColumns: `26px repeat(${activeMap.width}, minmax(0, 1fr))`
                    }}
                  >
                    <div className="text-[9px] font-mono text-slate-600 text-center">XY</div>
                    {Array.from({ length: activeMap.width }).map((_, cx) => (
                      <div
                        key={cx}
                        className="text-[9px] font-mono text-slate-500 text-center tabular-nums"
                      >
                        {String(cx).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-[1px] bg-[#161e29] border border-[#1e2631]">
                    {activeMap.grid.map((row, ry) => (
                      <div
                        key={ry}
                        className="grid gap-[1px]"
                        style={{
                          gridTemplateColumns: `26px repeat(${activeMap.width}, minmax(0, 1fr))`
                        }}
                      >
                        <div className="bg-[#0b0e13] text-[9px] font-mono text-slate-500 flex items-center justify-center tabular-nums">
                          {String(ry).padStart(2, '0')}
                        </div>

                        {row.map((cellVal, cx) => {
                          const key = `${cx},${ry}`;
                          const bInfo = opsBuildingCellMap.get(key);
                          const nodeAtCell = opsNodeCellMap.get(key);
                          const isRobot = robotPos.x === cx && robotPos.y === ry;
                          const isDynObs =
                            dynObstacleSet.has(key) ||
                            cellVal === 2 ||
                            nodeAtCell?.type === 'obstacle';
                          const isOrig = nodeAtCell && nodeAtCell.id === originNodeId;
                          const isDest = nodeAtCell && nodeAtCell.id === destNodeId;
                          const isOnActivePath = activePathSet.has(key);
                          const isTraveled = traveledSet.has(key);
                          const isExplored = showFrontier && exploredSet.has(key);

                          let bgClass = 'bg-[#0d131c] hover:bg-[#16202e] cursor-pointer';
                          if (cellVal === 1) bgClass = 'bg-[#161f2c] cursor-not-allowed';
                          if (bInfo) bgClass = 'bg-[#1b2636] cursor-not-allowed';
                          if (cellVal === 3) bgClass = 'bg-amber-950/30 hover:bg-amber-900/40 cursor-pointer';
                          if (isExplored && cellVal === 0) {
                            bgClass = 'bg-cyan-950/35 hover:bg-cyan-900/40 cursor-pointer';
                          }
                          if (isTraveled && !isOnActivePath) bgClass = 'bg-slate-800/70 cursor-pointer';
                          if (isOnActivePath) {
                            bgClass = isDetourActive
                              ? 'bg-amber-500/25 ring-1 ring-inset ring-amber-500/40 cursor-pointer'
                              : 'bg-emerald-500/25 ring-1 ring-inset ring-emerald-500/40 cursor-pointer';
                          }
                          if (isOrig) bgClass = 'bg-emerald-500/30 ring-1 ring-inset ring-emerald-400';
                          if (isDest) bgClass = 'bg-cyan-500/30 ring-1 ring-inset ring-cyan-400';
                          if (isDynObs) bgClass = 'bg-red-600/90 ring-1 ring-inset ring-red-400 cursor-pointer';

                          return (
                            <div
                              key={cx}
                              onClick={() => handleCellClickInOps(cx, ry)}
                              onMouseEnter={() => setHoveredCell({ x: cx, y: ry })}
                              onMouseLeave={() => setHoveredCell(null)}
                              className={`h-[26px] xl:h-[29px] relative flex items-center justify-center transition-colors ${bgClass}`}
                            >
                              {bInfo?.isAnchor && (
                                <span className="absolute left-1 top-0.5 z-10 px-1 bg-[#0b0e13]/95 border border-slate-700 text-[8.5px] font-mono font-semibold text-slate-200 whitespace-nowrap pointer-events-none">
                                  {bInfo.code} · {bInfo.name}
                                </span>
                              )}

                              {nodeAtCell && !isRobot && !isDynObs && (
                                <span
                                  className={`px-1 text-[8px] font-mono font-bold tracking-tighter ${
                                    isOrig
                                      ? 'text-emerald-300'
                                      : isDest
                                      ? 'text-cyan-300'
                                      : 'text-slate-400'
                                  }`}
                                >
                                  {isOrig ? 'START' : isDest ? 'GOAL' : nodeAtCell.code || nodeAtCell.id}
                                </span>
                              )}

                              {isOnActivePath && !isRobot && !nodeAtCell && !isDynObs && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    isDetourActive ? 'bg-amber-400' : 'bg-emerald-400'
                                  }`}
                                />
                              )}

                              {isDynObs && <X className="w-3.5 h-3.5 text-white stroke-[2.5]" />}

                              {isRobot && (
                                <div
                                  className={`w-5 h-5 rounded-sm flex items-center justify-center shadow-md z-20 ${
                                    unitStatus === 'BLOCKED'
                                      ? 'bg-red-500 text-white'
                                      : isDetourActive
                                      ? 'bg-amber-400 text-slate-950'
                                      : 'bg-cyan-400 text-slate-950'
                                  }`}
                                >
                                  <Bot className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Heuristic Inspector Footer */}
              <div className="h-8 shrink-0 px-3 bg-[#11161f] border-t border-[#1e2631] flex items-center justify-between font-mono text-[11px] text-slate-400">
                <div className="flex items-center gap-4">
                  <span>
                    CELL:{' '}
                    <strong className="text-white">
                      ({String(hoveredCell?.x ?? robotPos.x).padStart(2, '0')},{' '}
                      {String(hoveredCell?.y ?? robotPos.y).padStart(2, '0')})
                    </strong>
                  </span>
                  <span className="hidden sm:inline text-slate-500">
                    CLICK ANY CORRIDOR CELL TO PLACE OR REMOVE OBSTACLE
                  </span>
                </div>

                <div className="flex items-center gap-4 tabular-nums">
                  <span>
                    g(n): <strong className="text-slate-200">{inspectedH ? inspectedH.g : '--'}</strong>
                  </span>
                  <span>
                    h(n): <strong className="text-cyan-400">{inspectedH ? inspectedH.h : '--'}</strong>
                  </span>
                  <span>
                    f(n) = g+h:{' '}
                    <strong className="text-emerald-400">{inspectedH ? inspectedH.f : '--'}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT: DISPATCH, OBSTACLES, TELEMETRY, DOCKS */}
            <div className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-[#11161f] divide-y divide-[#1e2631] overflow-y-auto">
              {/* 1. Mission Dispatch */}
              <div className="p-3.5 space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mission Dispatch</span>
                  </span>
                  <button
                    onClick={handleSwapEndpoints}
                    className="px-2 py-0.5 bg-[#0b0e13] hover:bg-[#161c26] border border-[#1e2631] text-[11px] font-mono text-slate-300 flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3 text-cyan-400" />
                    <span>SWAP</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Pickup Point (Start)
                    </label>
                    <select
                      value={originNodeId}
                      onChange={(e) => handleEndpointChange(e.target.value, destNodeId)}
                      className="w-full bg-[#0b0e13] border border-[#1e2631] px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    >
                      {passableNodes.map((n) => (
                        <option key={n.id} value={n.id} disabled={n.id === destNodeId}>
                          {n.label} ({n.x},{n.y})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Destination (Goal)
                    </label>
                    <select
                      value={destNodeId}
                      onChange={(e) => handleEndpointChange(originNodeId, e.target.value)}
                      className="w-full bg-[#0b0e13] border border-[#1e2631] px-2 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-500"
                    >
                      {passableNodes.map((n) => (
                        <option key={n.id} value={n.id} disabled={n.id === originNodeId}>
                          {n.label} ({n.x},{n.y})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5">
                  {!isRunning ? (
                    <button
                      onClick={handleStartOrResume}
                      className="col-span-2 py-2 px-3 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{unitStatus === 'DELIVERED' ? 'Relaunch' : 'Start Simulation'}</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsRunning(false)}
                      className="col-span-2 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </button>
                  )}

                  <button
                    onClick={stepRobotOneCell}
                    disabled={isRunning || activePath.length <= 1}
                    className="py-2 px-2 bg-[#0b0e13] hover:bg-[#161c26] disabled:opacity-40 border border-[#1e2631] text-xs font-mono text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <StepForward className="w-3.5 h-3.5 text-cyan-400" />
                    <span>+1 Cell</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsRunning(false);
                      setDynamicObstacles([]);
                      computeInitialRoute(activeMap, originNodeId, destNodeId, []);
                    }}
                    className="py-2 px-2 bg-[#0b0e13] hover:bg-[#161c26] border border-[#1e2631] text-xs font-mono text-slate-200 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset</span>
                  </button>
                </div>

                <div className="flex items-center justify-between bg-[#0b0e13] border border-[#1e2631] p-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 pl-2">
                    SIMULATION SPEED
                  </span>
                  <div className="flex items-center gap-1">
                    {[
                      { label: '1x', ms: 320 },
                      { label: '1.5x', ms: 210 },
                      { label: '2x', ms: 115 }
                    ].map((sp) => (
                      <button
                        key={sp.ms}
                        onClick={() => setTickRateMs(sp.ms)}
                        className={`px-2.5 py-0.5 text-[11px] font-mono cursor-pointer ${
                          tickRateMs === sp.ms
                            ? 'bg-[#161c26] text-cyan-400 border border-cyan-500/40 font-semibold'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 2. Dynamic Obstacle Control */}
              <div className="p-3.5 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Dynamic Obstacle Control
                  </span>
                  <span className="font-mono text-[11px] text-red-400">
                    {dynamicObstacles.length} ACTIVE
                  </span>
                </div>

                <div className="grid grid-cols-12 gap-1.5">
                  <button
                    onClick={handleDropObstacleAhead}
                    disabled={activePath.length < 2}
                    className="col-span-8 py-2 px-3 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Drop Obstacle Ahead (+2 Cells)</span>
                  </button>

                  <button
                    onClick={() => {
                      setDynamicObstacles([]);
                      recalculateFromRobot([]);
                    }}
                    disabled={dynamicObstacles.length === 0}
                    className="col-span-4 py-2 px-2 bg-[#0b0e13] hover:bg-[#161c26] disabled:opacity-40 border border-[#1e2631] text-xs font-mono text-slate-300 cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* 3. Live Trajectory Telemetry */}
              <div className="p-3.5 space-y-2.5 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Live Trajectory Telemetry
                  </span>
                  <span className="font-mono text-xs text-cyan-400 tabular-nums">
                    {progressPct}% COMPLETE
                  </span>
                </div>

                <div className="w-full h-2 bg-[#0b0e13] border border-[#1e2631] overflow-hidden">
                  <div
                    className={`h-full transition-all duration-200 ${
                      unitStatus === 'DELIVERED'
                        ? 'bg-cyan-400'
                        : isDetourActive
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-2 bg-[#0b0e13] border border-[#1e2631] flex justify-between">
                    <span className="text-slate-500">BASELINE:</span>
                    <span className="text-slate-200 font-semibold">{baselineSteps} cells</span>
                  </div>
                  <div className="p-2 bg-[#0b0e13] border border-[#1e2631] flex justify-between">
                    <span className="text-slate-500">REMAINING:</span>
                    <span className="text-emerald-400 font-semibold">{activeRemainingSteps} cells</span>
                  </div>
                  <div className="p-2 bg-[#0b0e13] border border-[#1e2631] flex justify-between">
                    <span className="text-slate-500">TRAVELED:</span>
                    <span className="text-cyan-400 font-semibold">
                      {Math.max(0, traveledPath.length - 1)} cells
                    </span>
                  </div>
                  <div className="p-2 bg-[#0b0e13] border border-[#1e2631] flex justify-between">
                    <span className="text-slate-500">FRONTIER:</span>
                    <span className="text-slate-200 font-semibold">{exploredCells.length} cells</span>
                  </div>
                </div>
              </div>

              {/* 4. Facility Dock Quick-Assign */}
              <div className="p-3.5 flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Campus Facility Docks ({passableNodes.length})
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">QUICK ASSIGN</span>
                </div>

                <div className="flex-1 overflow-y-auto border border-[#1e2631] bg-[#0b0e13]">
                  <table className="w-full text-left border-collapse font-mono text-[11px]">
                    <thead>
                      <tr className="border-b border-[#1e2631] bg-[#11161f] text-[10px] text-slate-400">
                        <th className="py-1.5 px-2.5">FACILITY</th>
                        <th className="py-1.5 px-2">CELL</th>
                        <th className="py-1.5 px-2.5 text-right">ROUTE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1e2631]/60">
                      {passableNodes.map((nd) => {
                        const isStart = nd.id === originNodeId;
                        const isGoal = nd.id === destNodeId;
                        return (
                          <tr key={nd.id} className="hover:bg-[#161c26]/60">
                            <td className="py-1.5 px-2.5">
                              <span className="text-cyan-400 font-semibold mr-1.5">
                                {nd.code || nd.id}
                              </span>
                              <span className="text-slate-300 font-sans">{nd.label}</span>
                            </td>
                            <td className="py-1.5 px-2 text-slate-400 tabular-nums">
                              ({String(nd.x).padStart(2, '0')},{String(nd.y).padStart(2, '0')})
                            </td>
                            <td className="py-1.5 px-2.5 text-right space-x-1">
                              <button
                                onClick={() => handleEndpointChange(nd.id, destNodeId)}
                                disabled={isGoal}
                                className={`px-1.5 py-0.5 border text-[9px] cursor-pointer ${
                                  isStart
                                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 font-bold'
                                    : 'bg-[#11161f] border-[#1e2631] text-slate-400 hover:text-white disabled:opacity-30'
                                }`}
                              >
                                START
                              </button>
                              <button
                                onClick={() => handleEndpointChange(originNodeId, nd.id)}
                                disabled={isStart}
                                className={`px-1.5 py-0.5 border text-[9px] cursor-pointer ${
                                  isGoal
                                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                                    : 'bg-[#11161f] border-[#1e2631] text-slate-400 hover:text-white disabled:opacity-30'
                                }`}
                              >
                                GOAL
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TOPOLOGY STUDIO */}
      {activeView === 'STUDIO' && (
        <div
          className="flex-1 min-h-0 flex flex-col overflow-hidden"
          onMouseUp={() => setIsPaintingGrid(false)}
        >
          {/* Studio Top Management Bar */}
          <div className="h-11 shrink-0 bg-[#11161f] border-b border-[#1e2631] px-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNewMapModal(true)}
                className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>New Map</span>
              </button>

              <button
                onClick={openResizeModal}
                className="px-2.5 py-1 bg-[#0b0e13] hover:bg-[#161c26] border border-[#1e2631] text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <Scaling className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Resize ({studioMap.width}×{studioMap.height}, {studioMap.cellSize}m)
                </span>
              </button>

              <div className="flex items-center bg-[#0b0e13] border border-[#1e2631] px-2 py-0.5">
                <Edit3 className="w-3 h-3 text-slate-500 mr-1.5" />
                <input
                  type="text"
                  value={studioMap.name}
                  onChange={(e) => setStudioMap((prev) => ({ ...prev, name: e.target.value }))}
                  className="bg-transparent text-xs text-white focus:outline-none w-44"
                  aria-label="Map Name"
                />
              </div>

              {maps.length > 1 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-2 py-1 bg-[#0b0e13] hover:bg-red-950/60 border border-[#1e2631] text-xs text-red-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {studioSaveBanner && (
                <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[11px]">
                  {studioSaveBanner}
                </span>
              )}

              <button
                onClick={() => setValidationReport(validateTopologyAndGrid(studioMap))}
                className="px-2.5 py-1 bg-[#0b0e13] hover:bg-[#161c26] border border-[#1e2631] text-xs font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                <span>Validate A*</span>
              </button>

              <button
                onClick={handleSaveStudioMap}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save &amp; Deploy</span>
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(studioMap, null, 2)], {
                    type: 'application/json'
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${studioMap.code.toLowerCase()}-topology.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                title="Export JSON"
                className="p-1.5 bg-[#0b0e13] hover:bg-[#161c26] border border-[#1e2631] text-slate-300 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Studio Tool Strip */}
          <div className="h-10 shrink-0 bg-[#0b0e13] border-b border-[#1e2631] px-3 flex items-center justify-between overflow-x-auto">
            <div className="flex items-center gap-1">
              {[
                { id: 'SELECT', label: 'Select Node', icon: MousePointer },
                { id: 'CORRIDOR', label: 'Corridor (0)', icon: Eraser },
                { id: 'WALL', label: 'Building/Wall (1)', icon: Building2 },
                { id: 'OBSTACLE', label: 'Obstacle (2)', icon: ShieldAlert },
                { id: 'RESTRICTED', label: 'Restricted (3)', icon: AlertTriangle },
                { id: 'ADD_NODE', label: 'Add Node', icon: MapPin },
                { id: 'REMOVE_NODE', label: 'Remove Node', icon: Trash2 },
                { id: 'CONNECT', label: 'Connect Nodes', icon: GitCommit }
              ].map((t) => {
                const Icon = t.icon;
                const active = studioTool === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setStudioTool(t.id);
                      if (t.id !== 'CONNECT') setConnectSourceId(null);
                    }}
                    className={`px-2.5 py-1 text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                      active
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                        : 'bg-[#11161f] border-[#1e2631] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1 font-mono text-xs">
              <button
                onClick={handleStudioUndo}
                disabled={undoStack.length === 0}
                className="px-2 py-1 bg-[#11161f] hover:bg-[#161c26] disabled:opacity-30 border border-[#1e2631] text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo ({undoStack.length})</span>
              </button>
              <button
                onClick={handleStudioRedo}
                disabled={redoStack.length === 0}
                className="px-2 py-1 bg-[#11161f] hover:bg-[#161c26] disabled:opacity-30 border border-[#1e2631] text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Redo</span>
              </button>
              <div className="h-4 w-[1px] bg-[#1e2631] mx-1" />
              <button
                onClick={() => setStudioZoom((z) => Math.min(1.6, +(z + 0.15).toFixed(2)))}
                className="p-1 bg-[#11161f] border border-[#1e2631] text-slate-300 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <span className="px-1.5 text-[11px] text-slate-400">{Math.round(studioZoom * 100)}%</span>
              <button
                onClick={() => setStudioZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
                className="p-1 bg-[#11161f] border border-[#1e2631] text-slate-300 cursor-pointer"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setStudioZoom(1)}
                className="px-2 py-1 bg-[#11161f] border border-[#1e2631] text-[11px] text-slate-300 cursor-pointer"
              >
                <Maximize2 className="w-3 h-3 text-cyan-400" />
              </button>
            </div>
          </div>

          {/* Studio Workspace */}
          <div className="flex-1 min-h-0 grid grid-cols-12 overflow-hidden">
            {/* LEFT: 2D GRID + NODE OVERLAY CANVAS */}
            <div className="col-span-12 lg:col-span-8 flex flex-col min-h-0 border-r border-[#1e2631] bg-[#080b10]">
              <div className="flex-1 min-h-0 flex items-center justify-center p-3 overflow-auto">
                <div
                  style={{ transform: `scale(${studioZoom})`, transformOrigin: 'center center' }}
                  className="w-full max-w-[900px] bg-[#0b0e13] border border-[#1e2631] p-2"
                >
                  <div
                    className="grid gap-[1px] mb-[1px]"
                    style={{
                      gridTemplateColumns: `26px repeat(${studioMap.width}, minmax(0, 1fr))`
                    }}
                  >
                    <div className="text-[9px] font-mono text-slate-600 text-center">XY</div>
                    {Array.from({ length: studioMap.width }).map((_, cx) => (
                      <div
                        key={cx}
                        className="text-[9px] font-mono text-slate-500 text-center tabular-nums"
                      >
                        {String(cx).padStart(2, '0')}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-[1px] bg-[#161e29] border border-[#1e2631]">
                    {studioMap.grid.map((row, ry) => (
                      <div
                        key={ry}
                        className="grid gap-[1px]"
                        style={{
                          gridTemplateColumns: `26px repeat(${studioMap.width}, minmax(0, 1fr))`
                        }}
                      >
                        <div className="bg-[#0b0e13] text-[9px] font-mono text-slate-500 flex items-center justify-center tabular-nums">
                          {String(ry).padStart(2, '0')}
                        </div>
                        {row.map((cellVal, cx) => {
                          const nodeHere = studioMap.nodes.find((n) => n.x === cx && n.y === ry);
                          const isSelected = nodeHere && nodeHere.id === selectedNodeId;
                          const isConnectSrc = nodeHere && nodeHere.id === connectSourceId;

                          let bg = 'bg-[#0d131c] hover:bg-[#16202e]';
                          if (cellVal === 1) bg = 'bg-[#1b2534] hover:bg-[#243144]';
                          if (cellVal === 2) bg = 'bg-red-600/80';
                          if (cellVal === 3) bg = 'bg-amber-700/40';
                          if (nodeHere) {
                            bg =
                              nodeHere.type === 'start'
                                ? 'bg-emerald-500/35 ring-1 ring-inset ring-emerald-400'
                                : nodeHere.type === 'destination'
                                ? 'bg-cyan-500/35 ring-1 ring-inset ring-cyan-400'
                                : nodeHere.type === 'obstacle'
                                ? 'bg-red-600 ring-1 ring-inset ring-white'
                                : 'bg-cyan-950/80 ring-1 ring-inset ring-cyan-400/70';
                          }
                          if (isSelected || isConnectSrc) {
                            bg += ' ring-2 ring-inset ring-amber-400';
                          }

                          return (
                            <div
                              key={cx}
                              onMouseDown={() => {
                                setIsPaintingGrid(true);
                                handleStudioCellAction(cx, ry, false);
                              }}
                              onMouseEnter={() => {
                                if (isPaintingGrid) handleStudioCellAction(cx, ry, true);
                              }}
                              className={`h-[25px] relative flex items-center justify-center cursor-pointer ${bg}`}
                            >
                              {cellVal === 2 && !nodeHere && <X className="w-3 h-3 text-white" />}
                              {nodeHere && (
                                <span className="text-[8px] font-mono font-bold text-white truncate px-0.5">
                                  {nodeHere.code || nodeHere.id}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="h-8 shrink-0 px-3 bg-[#11161f] border-t border-[#1e2631] flex items-center justify-between font-mono text-[11px] text-slate-400">
                <div className="flex items-center gap-4">
                  <span>
                    GRID: <strong className="text-white">{studioMap.width}×{studioMap.height}</strong>
                  </span>
                  <span>
                    NODES: <strong className="text-cyan-400">{studioMap.nodes.length}</strong>
                  </span>
                  <span>
                    EDGES: <strong className="text-cyan-400">{studioMap.edges.length}</strong>
                  </span>
                </div>
                <div>
                  {connectSourceId ? (
                    <span className="text-amber-400">
                      CONNECTING FROM {connectSourceId} — CLICK SECOND NODE TO CARVE CORRIDOR &amp; LINK
                    </span>
                  ) : (
                    <span>ACTIVE TOOL: {studioTool}</span>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT: NODE INSPECTOR & VALIDATION */}
            <div className="col-span-12 lg:col-span-4 flex flex-col min-h-0 bg-[#11161f] divide-y divide-[#1e2631] overflow-y-auto">
              <div className="p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    Node Properties Inspector
                  </span>
                  {selectedStudioNode && (
                    <button
                      onClick={() => handleDeleteStudioNode(selectedStudioNode.id)}
                      className="px-2 py-0.5 bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>

                {selectedStudioNode ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Node ID / Code
                        </label>
                        <input
                          type="text"
                          value={selectedStudioNode.code || selectedStudioNode.id}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            mutateStudioMap((draft) => {
                              const t = draft.nodes.find((n) => n.id === selectedStudioNode.id);
                              if (t) t.code = val;
                              return draft;
                            });
                          }}
                          className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-cyan-400"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Facility Label
                        </label>
                        <input
                          type="text"
                          value={selectedStudioNode.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            mutateStudioMap((draft) => {
                              const t = draft.nodes.find((n) => n.id === selectedStudioNode.id);
                              if (t) t.label = val;
                              return draft;
                            });
                          }}
                          className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 text-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Col X
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={studioMap.width - 1}
                          value={selectedStudioNode.x}
                          onChange={(e) => {
                            const nx = Math.max(
                              0,
                              Math.min(studioMap.width - 1, Number(e.target.value) || 0)
                            );
                            mutateStudioMap((draft) => {
                              const t = draft.nodes.find((n) => n.id === selectedStudioNode.id);
                              if (t) {
                                t.x = nx;
                                draft.grid[t.y][nx] = 0;
                              }
                              return draft;
                            });
                          }}
                          className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Row Y
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={studioMap.height - 1}
                          value={selectedStudioNode.y}
                          onChange={(e) => {
                            const ny = Math.max(
                              0,
                              Math.min(studioMap.height - 1, Number(e.target.value) || 0)
                            );
                            mutateStudioMap((draft) => {
                              const t = draft.nodes.find((n) => n.id === selectedStudioNode.id);
                              if (t) {
                                t.y = ny;
                                draft.grid[ny][t.x] = 0;
                              }
                              return draft;
                            });
                          }}
                          className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                          Role
                        </label>
                        <select
                          value={selectedStudioNode.type}
                          onChange={(e) => {
                            const nt = e.target.value;
                            mutateStudioMap((draft) => {
                              const t = draft.nodes.find((n) => n.id === selectedStudioNode.id);
                              if (t) t.type = nt;
                              return draft;
                            });
                          }}
                          className="w-full bg-[#0b0e13] border border-[#1e2631] px-2 py-1.5 font-mono text-white"
                        >
                          <option value="dock">dock</option>
                          <option value="start">start</option>
                          <option value="destination">destination</option>
                          <option value="waypoint">waypoint</option>
                          <option value="obstacle">obstacle</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Connected Graph Edges ({selectedNodeEdges.length})
                      </div>
                      <div className="space-y-1 max-h-36 overflow-y-auto">
                        {selectedNodeEdges.map((ed) => (
                          <div
                            key={ed.id}
                            className="px-2 py-1 bg-[#0b0e13] border border-[#1e2631] flex items-center justify-between font-mono text-[11px]"
                          >
                            <span>
                              {ed.from} &lt;-&gt; {ed.to} ({ed.weight}m)
                            </span>
                            <button
                              onClick={() =>
                                mutateStudioMap((draft) => {
                                  draft.edges = draft.edges.filter((x) => x.id !== ed.id);
                                  return draft;
                                })
                              }
                              className="text-red-400 hover:text-red-300 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 py-4">
                    Click any facility or waypoint node on the 2D grid to edit its coordinates or connections.
                  </div>
                )}
              </div>

              {/* Validation Report */}
              <div className="p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                    2D Grid &amp; A* Reachability Check
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-semibold border ${
                      validationReport.valid
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-red-500/15 border-red-500/40 text-red-300'
                    }`}
                  >
                    {validationReport.valid ? 'VALIDATED' : 'ISSUES DETECTED'}
                  </span>
                </div>

                <div className="p-2.5 bg-[#0b0e13] border border-[#1e2631] font-mono text-[11px] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">FACILITY / WAYPOINT NODES:</span>
                    <span className="text-slate-200">{validationReport.nodeCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      2D A* ({validationReport.startNodeId} -&gt; {validationReport.destNodeId}):
                    </span>
                    <span
                      className={
                        validationReport.reachabilityOk
                          ? 'text-emerald-400 font-semibold'
                          : 'text-red-400 font-semibold'
                      }
                    >
                      {validationReport.reachabilityOk
                        ? `PASSABLE (${validationReport.sampleSteps} cells)`
                        : 'BLOCKED'}
                    </span>
                  </div>
                </div>

                {validationReport.issues.length > 0 && (
                  <div className="p-2.5 bg-red-950/40 border border-red-500/40 text-red-200 font-mono text-[11px] space-y-1">
                    {validationReport.issues.map((iss, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span>{iss}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Create New Map Modal */}
          {showNewMapModal && (
            <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[#11161f] border border-[#1e2631] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1e2631] pb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                    Create New 2D Campus Map
                  </h2>
                  <button
                    onClick={() => setShowNewMapModal(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleCreateNewMapConfirm} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Map Name
                      </label>
                      <input
                        type="text"
                        required
                        value={newMapForm.name}
                        onChange={(e) => setNewMapForm({ ...newMapForm, name: e.target.value })}
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Code
                      </label>
                      <input
                        type="text"
                        required
                        value={newMapForm.code}
                        onChange={(e) => setNewMapForm({ ...newMapForm, code: e.target.value })}
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                      Grid Dimension Presets
                    </label>
                    <div className="grid grid-cols-4 gap-1.5 font-mono">
                      {[
                        { label: '14×10', w: 14, h: 10 },
                        { label: '18×12', w: 18, h: 12 },
                        { label: '22×15', w: 22, h: 15 },
                        { label: '28×18', w: 28, h: 18 }
                      ].map((p) => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() =>
                            setNewMapForm({
                              ...newMapForm,
                              preset: p.label,
                              width: p.w,
                              height: p.h
                            })
                          }
                          className={`py-1.5 border text-[11px] cursor-pointer ${
                            newMapForm.preset === p.label
                              ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300'
                              : 'bg-[#0b0e13] border-[#1e2631] text-slate-400'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Width (Cols)
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={50}
                        value={newMapForm.width}
                        onChange={(e) =>
                          setNewMapForm({
                            ...newMapForm,
                            preset: 'Custom',
                            width: Number(e.target.value)
                          })
                        }
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Height (Rows)
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={40}
                        value={newMapForm.height}
                        onChange={(e) =>
                          setNewMapForm({
                            ...newMapForm,
                            preset: 'Custom',
                            height: Number(e.target.value)
                          })
                        }
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Cell Size (m)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        max={10}
                        value={newMapForm.cellSize}
                        onChange={(e) =>
                          setNewMapForm({ ...newMapForm, cellSize: Number(e.target.value) })
                        }
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowNewMapModal(false)}
                      className="px-3 py-1.5 bg-[#0b0e13] border border-[#1e2631] text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
                    >
                      Create 2D Map
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Resize Map Modal */}
          {showResizeModal && (
            <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-[#11161f] border border-[#1e2631] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-[#1e2631] pb-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                    Resize 2D Occupancy Grid
                  </h2>
                  <button
                    onClick={() => setShowResizeModal(false)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleConfirmResize} className="space-y-3.5 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        New Width
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={50}
                        value={resizeForm.width}
                        onChange={(e) => handleResizeFormChange('width', e.target.value)}
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        New Height
                      </label>
                      <input
                        type="number"
                        min={8}
                        max={40}
                        value={resizeForm.height}
                        onChange={(e) => handleResizeFormChange('height', e.target.value)}
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase text-slate-400 mb-1">
                        Cell Size (m)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min={0.5}
                        max={10}
                        value={resizeForm.cellSize}
                        onChange={(e) => handleResizeFormChange('cellSize', e.target.value)}
                        className="w-full bg-[#0b0e13] border border-[#1e2631] px-2.5 py-1.5 font-mono text-white"
                      />
                    </div>
                  </div>

                  {resizeOutNodes.length > 0 && (
                    <div className="p-3 bg-amber-950/50 border border-amber-500/50 text-amber-200 font-mono text-[11px]">
                      Warning: {resizeOutNodes.length} node(s) lie outside the new bounds and will be removed:{' '}
                      {resizeOutNodes.map((n) => `${n.id}(${n.x},${n.y})`).join(', ')}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowResizeModal(false)}
                      className="px-3 py-1.5 bg-[#0b0e13] border border-[#1e2631] text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-semibold cursor-pointer"
                    >
                      Apply Resize
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
              <div className="w-full max-w-sm bg-[#11161f] border border-[#1e2631] p-5 space-y-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-white">
                  Delete Campus Map
                </h2>
                <p className="text-xs text-slate-300">
                  Permanently delete <strong>{studioMap.name}</strong> ({studioMap.code})?
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 bg-[#0b0e13] border border-[#1e2631] text-xs text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (maps.length <= 1) return;
                      const rem = maps.filter((m) => m.id !== studioMap.id);
                      setMaps(rem);
                      setActiveMapId(rem[0].id);
                      loadMapIntoStudio(rem[0]);
                      setShowDeleteConfirm(false);
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-xs text-white font-semibold cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MISSION LEDGER */}
      {activeView === 'LEDGER' && (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="h-11 shrink-0 bg-[#11161f] border-b border-[#1e2631] px-4 flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono text-xs">
              {['ALL', 'NOMINAL', 'REROUTED'].map((f) => (
                <button
                  key={f}
                  onClick={() => setLedgerFilter(f)}
                  className={`px-3 py-1 border cursor-pointer ${
                    ledgerFilter === f
                      ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                      : 'bg-[#0b0e13] border-[#1e2631] text-slate-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search mission ID, facility..."
                className="bg-[#0b0e13] border border-[#1e2631] pl-8 pr-3 py-1 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead className="sticky top-0 bg-[#11161f] border-b border-[#1e2631] text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-4">Mission ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Sector</th>
                  <th className="py-2.5 px-4">Origin -&gt; Destination</th>
                  <th className="py-2.5 px-4">Baseline Cells</th>
                  <th className="py-2.5 px-4">Actual Cells</th>
                  <th className="py-2.5 px-4">Reroutes</th>
                  <th className="py-2.5 px-4">Solver Latency</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2631]">
                {missionLedger
                  .filter((m) => {
                    if (ledgerFilter === 'NOMINAL' && m.reroutes > 0) return false;
                    if (ledgerFilter === 'REROUTED' && m.reroutes === 0) return false;
                    if (ledgerSearch.trim()) {
                      const q = ledgerSearch.toLowerCase();
                      return (
                        m.id.toLowerCase().includes(q) ||
                        m.origin.toLowerCase().includes(q) ||
                        m.destination.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((m) => (
                    <tr key={m.id} className="hover:bg-[#11161f]/60">
                      <td className="py-2.5 px-4 font-semibold text-white">{m.id}</td>
                      <td className="py-2.5 px-4 text-slate-400">{m.timestamp}</td>
                      <td className="py-2.5 px-4 text-cyan-400">{m.mapCode}</td>
                      <td className="py-2.5 px-4 font-sans text-slate-200">
                        {m.origin} -&gt; {m.destination}
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{m.baselineCells} cells</td>
                      <td className="py-2.5 px-4 text-white">{m.actualCells} cells</td>
                      <td className="py-2.5 px-4 text-amber-400">{m.reroutes}</td>
                      <td className="py-2.5 px-4 text-slate-400">{m.solverMs}</td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 text-[10px] border border-emerald-500/40 bg-emerald-500/10 text-emerald-300">
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
