// ── Performance API polyfill ─────────────────────────────────────────────────
// WebView2 (Tauri on Windows) may lack some performance methods that libraries
// such as @tauri-apps/api internals or VS Code tooling expect.
// Patching them here prevents "mgt.clearMarks is not a function" errors.
if (typeof performance !== 'undefined') {
  const noop = () => undefined;
  if (typeof performance.clearMarks    !== 'function') (performance as any).clearMarks    = noop;
  if (typeof performance.clearMeasures !== 'function') (performance as any).clearMeasures = noop;
  if (typeof performance.clearResourceTimings !== 'function') (performance as any).clearResourceTimings = noop;
}
// ─────────────────────────────────────────────────────────────────────────────

import '@/i18n';
import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
