'use client';
import { useCallback, useEffect, useState } from 'react';
export function useCaptureAllowance(active: boolean, endpoint: string) {
  const [state, setState] = useState<{ endpoint: string; blocked: boolean; used: number; bypass: boolean } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!active) { setState(null); setError(''); return; }
    const controller = new AbortController();
    let resetTimer: ReturnType<typeof setTimeout> | undefined;
    setState(null); setError('');
    fetch(endpoint, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'The allowance could not be checked.');
        if (!controller.signal.aborted) {
          setState({ endpoint, blocked: data.blocked, used: data.used, bypass: data.bypass });
          const resetDelay = new Date(data.resetsAt).getTime() - Date.now();
          if (Number.isFinite(resetDelay)) resetTimer = setTimeout(() => setRetry(value => value + 1), Math.max(1000, resetDelay + 250));
        }
      }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => { controller.abort(); if (resetTimer) clearTimeout(resetTimer); };
  }, [active, endpoint, retry]);
  const current = state?.endpoint === endpoint ? state : null;
  const blocked = active && !!current?.blocked;
  const markBlocked = useCallback(() => setState({ endpoint, blocked: true, used: 10, bypass: false }), [endpoint]);
  return { blocked, ready: active && !!current && !blocked, error, markBlocked,
    retry: () => setRetry(value => value + 1),
    label: current?.bypass ? 'Admin capture · no daily limit' : current ? `${current.used} of 10 captures used today · resets at midnight (South Africa)` : 'Checking daily allowance…' };
}
