'use client';

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { APP_THEME_EVENT, appThemeRoot, setAppTheme } from '../lib/app-theme';
import styles from './AppSettings.module.css';

function subscribe(onChange: () => void) {
  window.addEventListener(APP_THEME_EVENT, onChange);
  return () => window.removeEventListener(APP_THEME_EVENT, onChange);
}
function isDark() { return document.documentElement.dataset.appTheme === 'dark'; }

export default function AppSettings({ offlineHref }: { offlineHref?: string }) {
  const pathname = usePathname();
  const root = appThemeRoot(pathname || '/');
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const title = useId();
  const description = useId();
  if (!root) return null;

  return <>
    <button ref={trigger} type="button" className={styles.gear} disabled={!ready} aria-label="App settings" title="App settings" aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m9.7 3-.5 2.1-1.5.9-2.1-.6-2.3 4 1.6 1.5v2.2l-1.6 1.5 2.3 4 2.1-.6 1.5.9.5 2.1h4.6l.5-2.1 1.5-.9 2.1.6 2.3-4-1.6-1.5v-2.2l1.6-1.5-2.3-4-2.1.6-1.5-.9-.5-2.1z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
    {open ? createPortal(
      <dialog ref={node => { dialog.current = node; if (node && !node.open) node.showModal(); }} className={styles.dialog} aria-labelledby={title}
        onClose={() => { setOpen(false); trigger.current?.focus(); }}
        onClick={event => {
          if (event.target !== dialog.current || !dialog.current) return;
          const rect = dialog.current.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current.close();
        }}>
        <header className={styles.heading}>
          <h2 id={title}>App settings</h2>
          <button type="button" className={styles.close} aria-label="Close app settings" onClick={() => dialog.current?.close()}>×</button>
        </header>
        <p className={styles.intro}>Make this app comfortable to use.</p>
        <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode" aria-describedby={description} className={styles.themeRow}
          onClick={() => setAppTheme(root, dark ? 'light' : 'dark')}>
          <span className={styles.copy}><strong>Dark mode</strong><span id={description}>Remembered for this app on this device.</span></span>
          <span className={styles.switch} aria-hidden="true"><span /></span>
        </button>
        {offlineHref ? <a className={styles.offline} href={offlineHref}><strong>Offline work</strong><span>Saved assets and updates</span><b aria-hidden="true">›</b></a> : null}
        <button type="button" className={styles.done} onClick={() => dialog.current?.close()}>Done</button>
      </dialog>, document.body) : null}
  </>;
}
