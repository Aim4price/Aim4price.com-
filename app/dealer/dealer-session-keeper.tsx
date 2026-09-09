'use client';

import { useDealerAppRoot } from '../../lib/use-dealer-app-root';
import { useEffect } from 'react';

const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MIN_REFRESH_GAP_MS = 5 * 60 * 1000;

export default function DealerSessionKeeper() {
  const appRoot = useDealerAppRoot();
  useEffect(() => {
    let lastRefreshAttempt = 0;
    let refreshInFlight = false;

    async function refreshSession(force = false) {
      const now = Date.now();
      if (
        refreshInFlight
        || (!force && document.visibilityState !== 'visible')
        || (!force && now - lastRefreshAttempt < MIN_REFRESH_GAP_MS)
      ) {
        return;
      }

      lastRefreshAttempt = now;
      refreshInFlight = true;
      try {
        await fetch(`/api${appRoot}/session`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
        });
      } catch {
        // A temporary network failure must never sign the user out.
      } finally {
        refreshInFlight = false;
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshSession();
    }

    void refreshSession(true);
    const interval = window.setInterval(() => void refreshSession(), REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleVisibilityChange);
    };
  }, [appRoot]);

  return null;
}

