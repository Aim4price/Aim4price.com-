'use client';
import { useEffect, useRef } from 'react';
import styles from './field-manager-settings.module.css';
export default function FieldManagerSettings() {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false; };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <details ref={menu} className={styles.settings} onKeyDown={event => {
    if (event.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
  }}>
    <summary aria-label="App settings" title="App settings" className={styles.gear}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9.7 3-.5 2.1-1.5.9-2.1-.6-2.3 4 1.6 1.5v2.2l-1.6 1.5 2.3 4 2.1-.6 1.5.9.5 2.1h4.6l.5-2.1 1.5-.9 2.1.6 2.3-4-1.6-1.5v-2.2l1.6-1.5-2.3-4-2.1.6-1.5-.9-.5-2.1z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </summary>
    <nav className={styles.panel} aria-label="App settings">
      <a href="/field-manager/offline.html"><strong>Offline work</strong><span>Saved assets and updates</span></a>
    </nav>
  </details>;
}
