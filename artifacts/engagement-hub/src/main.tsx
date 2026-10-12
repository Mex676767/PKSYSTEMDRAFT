import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// A deployment can remove the old hashed route chunks while an already-open
// tab still has the previous app shell in memory. Let Vite report the import
// error, then reload once to pick up the current deployment. The cooldown
// prevents a persistent outage from causing a reload loop.
const CHUNK_RELOAD_STORAGE_KEY = 'engagement-hub:last-chunk-reload';
const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

window.addEventListener('vite:preloadError', (event) => {
  const now = Date.now();

  try {
    const lastReload = Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY));
    if (Number.isFinite(lastReload) && now - lastReload < CHUNK_RELOAD_COOLDOWN_MS) {
      return;
    }

    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // If session storage is unavailable, let the normal error boundary handle
    // the failed route instead of risking an unbounded reload loop.
    return;
  }

  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
