'use client';

import { useSyncExternalStore } from 'react';
import type { WorkspaceRole } from './workspace-navigation';

const changed = 'aim4price:workspace-visibility';
const sessionValues = new Map<string, string>();

function subscribe(callback: () => void) {
  window.addEventListener(changed, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(changed, callback);
    window.removeEventListener('storage', callback);
  };
}

export function useWorkspaceVisibility(userId: string | undefined, role: WorkspaceRole | null) {
  const key = userId && role ? 'aim4price.workspace.hidden.' + userId + '.' + role : null;
  function read() {
    if (!key) return '';
    if (sessionValues.has(key)) return sessionValues.get(key)!;
    try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
  }
  const raw = useSyncExternalStore(subscribe, read, () => '');
  let hidden: string[] = [];
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) hidden = parsed.filter((value): value is string => typeof value === 'string');
    } catch { /* Ignore invalid saved settings. */ }
  }
  function save(keys: string[]) {
    if (!key) return;
    const value = JSON.stringify(keys);
    try {
      window.localStorage.setItem(key, value);
      sessionValues.delete(key);
    } catch { sessionValues.set(key, value); }
    window.dispatchEvent(new Event(changed));
  }
  return { hidden, save };
}
