'use client';
import { useCallback, useEffect, useState } from 'react';

type Listing = {
  name: string; email: string; status: string; logo_data: string;
  details: { town?: string; serviceArea?: string; website?: string; phone?: string; services?: string[] };
};

export function useAccountDirectoryListing(enabled: boolean, verified: boolean, userId?: string) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setListing(null);
    setError('');
    setLoading(enabled && verified);
    if (enabled && verified) {
      (async () => {
        try {
          const response = await fetch('/api/account-directory', {cache:'no-store', signal:controller.signal});
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Unable to load listing.');
          if (!controller.signal.aborted) setListing(data.listing);
        } catch (cause) {
          if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to load listing.');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
    }
    return () => controller.abort();
  }, [enabled, verified, userId, attempt]);
  const save = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch('/api/account-directory', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save listing.');
    setListing(data.listing);
  }, []);
  const status = loading ? 'Loading…' : error ? 'Unavailable' : listing?.status === 'active' ? 'Visible' : listing?.status === 'invited' ? 'Pending review' : 'Hidden';
  return {listing, loading, error, status, save, retry: () => setAttempt(value => value + 1)};
}
