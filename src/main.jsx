import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// NOTE: <React.StrictMode> is intentionally omitted. App.jsx updates state inside
// other state updaters (robot stepping / studio undo stack), which StrictMode
// double-invokes in dev and would create duplicate ledger rows.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
