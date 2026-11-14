import React, { useState, useEffect, useMemo } from 'react';
import { Bot, X } from 'lucide-react';

// Precomputed detour path around an obstacle at (13, 5)
const DETOUR_CELLS = [
  { x: 3, y: 4 }, { x: 4, y: 4 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 6, y: 5 },
  { x: 7, y: 5 }, { x: 8, y: 5 }, { x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 },
  { x: 11, y: 6 }, { x: 11, y: 7 }, { x: 11, y: 8 }, { x: 11, y: 9 }, { x: 12, y: 9 },
  { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 }, { x: 16, y: 9 }, { x: 17, y: 9 },
  { x: 17, y: 8 }, { x: 17, y: 7 }, { x: 17, y: 6 }, { x: 17, y: 5 }, { x: 17, y: 4 },
  { x: 18, y: 4 }
];
const DETOUR_SET = new Set(DETOUR_CELLS.map((c) => `${c.x},${c.y}`));
const BLOCKED_NOMINAL_SET = new Set(['12,5', '13,5', '14,5', '15,5', '16,5']);

export default function LoginGridPreview({ map }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStepIdx((prev) => (prev + 1) % DETOUR_CELLS.length);
    }, 260);
    return () => clearInterval(timer);
  }, []);

  const robotCell = DETOUR_CELLS[stepIdx];

  const buildingCellMap = useMemo(() => {
    const m = new Map();
    (map.buildings || []).forEach((b) => {
      for (let r = b.y; r < b.y + b.h; r++) {
        for (let c = b.x; c < b.x + b.w; c++) {
          m.set(`${c},${r}`, { ...b, isAnchor: c === b.x && r === b.y });
        }
      }
    });
    return m;
  }, [map.buildings]);

  return (
    <div className="w-full h-full bg-[#080b10] flex flex-col justify-between p-6 select-none overflow-hidden">
      {/* Top Status Strip */}
      <div className="flex items-center justify-between border-b border-[#1e2631] pb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-wider text-slate-200">
            2D CAMPUS OCCUPANCY GRID // LIVE AUTONOMOUS REPLANNING
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-xs text-slate-400 tabular-nums">
          <span>CELL: [{String(robotCell.x).padStart(2, '0')}, {String(robotCell.y).padStart(2, '0')}]</span>
          <span className="text-amber-400">DETOUR ROUTE ACTIVE</span>
        </div>
      </div>

      {/* Center 2D Occupancy Grid Preview */}
      <div className="my-auto py-4 flex flex-col items-center justify-center">
        <div className="bg-[#0b0e13] border border-[#1e2631] p-3 w-full max-w-[680px]">
          <div
            className="grid gap-[1px] mb-[1px]"
            style={{ gridTemplateColumns: `24px repeat(${map.width}, minmax(0, 1fr))` }}
          >
            <div className="text-[9px] font-mono text-slate-600 text-center">XY</div>
            {Array.from({ length: map.width }).map((_, cx) => (
              <div key={cx} className="text-[9px] font-mono text-slate-500 text-center tabular-nums">
                {String(cx).padStart(2, '0')}
              </div>
            ))}
          </div>

          <div className="space-y-[1px] bg-[#161e29] border border-[#1e2631]">
            {map.grid.map((row, ry) => (
              <div
                key={ry}
                className="grid gap-[1px]"
                style={{ gridTemplateColumns: `24px repeat(${map.width}, minmax(0, 1fr))` }}
              >
                <div className="bg-[#0b0e13] text-[9px] font-mono text-slate-500 flex items-center justify-center tabular-nums">
                  {String(ry).padStart(2, '0')}
                </div>
                {row.map((cell, cx) => {
                  const key = `${cx},${ry}`;
                  const bInfo = buildingCellMap.get(key);
                  const isRobot = robotCell.x === cx && robotCell.y === ry;
                  const isObstacle = cx === 13 && ry === 5;
                  const isDetour = DETOUR_SET.has(key);
                  const isBlockedNominal = BLOCKED_NOMINAL_SET.has(key);
                  const isStart = cx === 3 && ry === 4;
                  const isGoal = cx === 18 && ry === 4;

                  let cellClass = 'bg-[#0d1219]';
                  if (cell === 1) cellClass = 'bg-[#161f2c]';
                  if (bInfo) cellClass = 'bg-[#1a2433]';
                  if (isBlockedNominal) cellClass = 'bg-emerald-950/40';
                  if (isDetour) cellClass = 'bg-amber-500/25';
                  if (isStart) cellClass = 'bg-emerald-500/30 ring-1 ring-inset ring-emerald-400';
                  if (isGoal) cellClass = 'bg-cyan-500/30 ring-1 ring-inset ring-cyan-400';
                  if (isObstacle) cellClass = 'bg-red-600 text-white';

                  return (
                    <div key={cx} className={`h-[22px] relative flex items-center justify-center ${cellClass}`}>
                      {bInfo?.isAnchor && (
                        <span className="absolute left-1 top-0.5 z-10 text-[8px] font-mono font-semibold text-cyan-300 whitespace-nowrap bg-[#0b0e13]/90 px-1 border border-[#1e2631] pointer-events-none">
                          {bInfo.code}
                        </span>
                      )}
                      {isObstacle && <X className="w-3 h-3 text-white stroke-[2.5]" />}
                      {!isRobot && isDetour && !isStart && !isGoal && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                      {isRobot && (
                        <div className="w-4 h-4 rounded-sm bg-cyan-400 text-slate-950 flex items-center justify-center shadow">
                          <Bot className="w-3 h-3 stroke-[2.5]" />
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

      {/* Bottom Legend Strip */}
      <div className="pt-4 border-t border-[#1e2631] flex flex-wrap items-center justify-between gap-4 font-mono text-[11px] text-slate-400">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500/40 border border-emerald-400 inline-block" />
            Origin / Nominal
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500/40 border border-amber-400 inline-block" />
            Recalculated A* Detour
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-red-600 inline-block" />
            Dynamic Obstacle (Cell 13,05)
          </span>
        </div>
        <span className="text-cyan-400">f(n) = g(n) + h(n)</span>
      </div>
    </div>
  );
}
