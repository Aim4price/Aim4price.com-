"use client";
import { useCallback, useEffect, useState } from 'react';
import type { AssetChecklistItem } from './asset-checklist';

export function useAssetChecklistItems(assetId?: string) {
  const [state, setState] = useState<{ assetId?: string; items: AssetChecklistItem[]; loading: boolean; error: string }>({ items: [], loading: !!assetId, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!assetId) { setState({ items: [], loading: false, error: '' }); return; }
    const controller = new AbortController();
    setState({ assetId, items: [], loading: true, error: '' });
    fetch(`/api/maintenance/checklist?assetId=${encodeURIComponent(assetId)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then(data => { if (!controller.signal.aborted) setState({ assetId, items: data.items, loading: false, error: '' }); })
      .catch(error => { if (!controller.signal.aborted) setState({ assetId, items: [], loading: false, error: error.message || 'Could not load your saved items.' }); });
    return () => controller.abort();
  }, [assetId, revision]);
  const reload = useCallback(() => setRevision(value => value + 1), []);
  const setItems = useCallback((items: AssetChecklistItem[]) => setState({ assetId, items, loading: false, error: '' }), [assetId]);
  return { ...(state.assetId === assetId ? state : { items: [], loading: !!assetId, error: '' }), reload, setItems };
}
