# CampusCourier Twin

2D occupancy-grid **A\*** pathfinding console for an autonomous campus delivery robot.
Includes Operations Control (live dynamic re-planning), Topology Studio (grid + node/edge editor) and a Mission Ledger.

**Stack:** React 18 · Vite 5 · Tailwind CSS 3 · lucide-react

## Project structure

```
src/
├── main.jsx                      # entry point
├── index.css                     # Tailwind directives
├── App.jsx                       # login, operations, studio, ledger views
└── utils/
    ├── grid.js                   # grid helpers (empty grid, corridor carving, weights)
    ├── maps.js                   # default campus maps (SEC-01, SEC-02)
    └── astar.js                  # A* engine + topology validation
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # outputs to dist/
npm run preview
```

Login is a front-end demo only: any ID (3+ chars) and password (4+ chars) works.
Maps are saved in the browser's `localStorage` (`cc_grid_maps_v4`).

## Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit: CampusCourier Twin"
git branch -M main
git remote add origin https://github.com/<your-username>/campuscourier-twin.git
git push -u origin main
```

## Deploy on Vercel

1. vercel.com → **Add New → Project** → import the GitHub repo.
2. Framework preset: **Vite** (auto-detected). Build: `npm run build`, Output: `dist`.
3. Click **Deploy**.

## Deploy on Render (Static Site)

1. render.com → **New → Static Site** → connect the repo.
2. Build command: `npm install && npm run build`
3. Publish directory: `dist`
4. (Optional) Add a rewrite rule `/*` → `/index.html`. A `render.yaml` Blueprint is included.
