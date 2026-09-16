'use client';

import { useSyncExternalStore } from 'react';
import { BACKGROUND_PREFERENCE_KEY } from '../lib/background-preference';

const CHANGE_EVENT = 'aim4price-background-change';
function isDark() { return document.documentElement.dataset.background === 'dark'; }
function subscribe(onChange: () => void) {
  function storage(event: StorageEvent) {
    if (event.key !== BACKGROUND_PREFERENCE_KEY && event.key !== null) return;
    document.documentElement.dataset.background = event.newValue === 'dark' ? 'dark' : 'light';
    onChange();
  }
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', storage);
  };
}

export default function BackgroundToggle({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  function toggle() {
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.background = next;
    try { localStorage.setItem(BACKGROUND_PREFERENCE_KEY, next); } catch { /* The toggle still works without storage. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
  return (
    <button type="button" className={className} onClick={toggle} aria-label="Dark mode" aria-pressed={dark} title={dark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <svg className={iconClassName} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z" />}
      </svg>
    </button>
  );
}
