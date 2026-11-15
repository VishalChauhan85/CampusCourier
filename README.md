# CampusCourier Twin 🚚

**A Digital Twin-Based Autonomous Campus Delivery & Navigation System**

CampusCourier Twin is a browser-based 2D autonomous robotics simulation that demonstrates intelligent campus navigation using the **A* (A-Star) pathfinding algorithm**.

The system simulates a campus environment using an occupancy grid where a virtual delivery robot can navigate between locations, respond to dynamically introduced obstacles, and automatically replan its route.

## ✨ Key Features

### 1. Operations Control
- Interactive autonomous delivery simulation.
- Live robot movement and route visualization.
- Dynamic obstacle insertion.
- Automatic route recalculation when the planned path gets blocked.
- Real-time mission monitoring.

### 2. Topology Studio
- Interactive grid-based campus map editor.
- Create and customize navigation layouts.
- Node and edge editing.
- Corridor carving and grid configuration.
- Support for weighted paths and topology validation.

### 3. Mission Ledger
- Centralized mission tracking.
- View delivery mission records.
- Monitor mission execution and navigation information.

### 4. A* Pathfinding Engine
- Grid-based pathfinding using the A* algorithm.
- Efficient route calculation.
- Obstacle-aware navigation.
- Dynamic route replanning.

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React 18 | Frontend UI |
| Vite 5 | Development and build tooling |
| Tailwind CSS 3 | Styling and responsive UI |
| lucide-react | Icons |
| JavaScript | Simulation logic |
| A* Algorithm | Pathfinding and navigation |
| Browser localStorage | Local map persistence |

## 📁 Project Structure

```text
CampusCourier-Twin/
│
├── src/
│   ├── main.jsx
│   │   └── Application entry point
│   │
│   ├── index.css
│   │   └── Tailwind CSS directives
│   │
│   ├── App.jsx
│   │   └── Login, Operations Control,
│   │       Topology Studio and Mission Ledger
│   │
│   └── utils/
│       ├── grid.js
│       │   └── Grid helpers, corridor carving
│       │       and path weights
│       │
│       ├── maps.js
│       │   └── Default campus maps (SEC-01, SEC-02)
│       │
│       └── astar.js
│           └── A* pathfinding engine
│               and topology validation
│
├── package.json
├── index.html
└── README.md
```

## 🚀 Getting Started

Follow these steps to run CampusCourier Twin locally.

### Prerequisites
- Node.js
- npm
- Git (optional)

### 1. Clone the Repository

```bash
git clone https://github.com/<your-username>/campuscourier-twin.git

cd campuscourier-twin
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

Open the application at:

```text
http://localhost:5173
```

### 4. Build for Production

```bash
npm run build
```

The production-ready files will be generated inside the `dist/` directory.

### 5. Preview Production Build

```bash
npm run preview
```

## 🔐 Demo Login

The current login system is frontend-only and intended for demonstration purposes.

- **User ID:** Any ID containing at least 3 characters.
- **Password:** Any password containing at least 4 characters.

No backend authentication is configured in this version.

## 💾 Data Storage

Campus maps are stored locally in the browser using `localStorage`.

**Storage Key:**

```text
cc_grid_maps_v4
```

Maps saved in one browser are not automatically synchronized with other devices or browsers.

## 🌐 Deployment

### Deploy on Vercel

1. Visit [Vercel](https://vercel.com/).
2. Select **Add New → Project**.
3. Import your GitHub repository.
4. Select **Vite** as the framework preset.
5. Configure the following:

```text
Build Command: npm run build
Output Directory: dist
```

6. Click **Deploy**.

### Deploy on Render

1. Visit [Render](https://render.com/).
2. Select **New → Static Site**.
3. Connect your GitHub repository.
4. Configure:

```text
Build Command: npm install && npm run build
Publish Directory: dist
```

5. Optionally configure a rewrite rule:

```text
Source: /*
Destination: /index.html
Action: Rewrite
```

A `render.yaml` Blueprint is included for deployment configuration.

## 📤 Push Project to GitHub

If you haven't initialized Git yet, run:

```bash
git init
git add .
git commit -m "Initial commit: CampusCourier Twin"
git branch -M main

git remote add origin https://github.com/<your-username>/campuscourier-twin.git

git push -u origin main
```

## 🔮 Future Scope

Potential enhancements for future versions include:

- Multi-robot coordination and scheduling.
- Crowd-aware navigation.
- Battery-aware route optimization.
- Integration with real campus maps.
- Physical autonomous robot integration.
- Sensor-based obstacle detection.

## 🎯 Project Objective

CampusCourier Twin aims to demonstrate how digital twin environments and intelligent pathfinding can be used to simulate autonomous delivery systems.

By combining grid-based campus modeling, A* pathfinding and dynamic route replanning, the project provides a foundation for exploring adaptive autonomous navigation in controlled virtual environments.

---

**CampusCourier Twin**

*Simulate Smarter. Navigate Better. Deliver Autonomously.*

**RoboForge 2026 | Open Innovation Hackathon**

