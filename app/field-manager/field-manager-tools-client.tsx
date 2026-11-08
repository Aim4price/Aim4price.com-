'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import OwnerIcon from '../owner-app/owner-icon';
import FieldManagerSettings from './field-manager-settings';
import FieldManagerNavLink from './field-manager-nav-link';
import styles from './page.module.css';
import mobile from './mobile.module.css';

export default function FieldManagerToolsClient({ view }: { view: 'work' | 'more' }) {
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/api/field-manager/session', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { window.location.replace('/field-manager/login'); return; }
        const payload = await response.json();
        if (!response.ok || !payload?.ok || !payload.manager) throw new Error('Unable to open Field Manager. Please retry.');
        if (!controller.signal.aborted) setName(payload.manager.displayName);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to open Field Manager. Please retry.'); });
    return () => controller.abort();
  }, [attempt]);
  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await fetch('/api/field-manager/login', { method: 'DELETE', credentials: 'include', cache: 'no-store' }).catch(() => undefined);
    if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('aim4price-field-session'); channel.postMessage('lock'); channel.close(); }
    clearCachedHeaderSession();
    window.location.replace('/field-manager/login');
  }
  const tools = view === 'work' ? [
    { title: 'Add fuel', detail: 'Tank or petrol station.', icon: 'fuel', href: '/field-manager/diesel' },
    { title: 'Record work', detail: 'Checks, services and repairs.', icon: 'record', href: '/field-manager/assets' },
    { title: 'Report problem', detail: 'Log an issue with an asset.', icon: 'problem', href: '/field-manager/report-problem' },
    { title: 'Upcoming work', detail: 'View due and upcoming work.', icon: 'calendar', href: '/field-manager/overview' },
  ] : [
    { title: 'Offline work', detail: 'Save work for offline use.', icon: 'offline', href: '/field-manager/offline.html' },
    { title: 'Notifications', detail: 'Updates for your assigned work.', icon: 'notifications', href: '/field-manager/notifications' },
  ];
  return <main className={styles.mobilePage}><section className={`${styles.assetsShell} ${styles.dashboardShell}`}>
    <header className={styles.assetsHeader} aria-label="Field Manager account controls">
      {view === 'more' ? <FieldManagerSettings /> : <FieldManagerNavLink href="/field-manager" label="Home" />}
      {view === 'more' && name !== null ? <button type="button" className={styles.logoutButton} disabled={signingOut} onClick={() => void signOut()}>{signingOut ? 'Signing out…' : 'Sign out'}</button> : null}
    </header>
    {error ? <div className={styles.errorNotice} role="alert">{error}<button type="button" className={styles.mobilePrimaryButton} onClick={() => setAttempt(value => value + 1)}>Retry</button></div> : name === null ? <p className={styles.mobileEmpty}>Opening Field Manager…</p> : <div className={styles.dashboardBody}>
      <section className={mobile.intro}><h1>{view === 'work' ? 'Work' : 'More'}</h1><p>{view === 'work' ? 'Keep your assets running.' : name}</p></section>
      <nav className={mobile.rows} aria-label={view === 'work' ? 'Field work tools' : 'More Field Manager tools'}>
        {tools.map(tool => <Link className={mobile.row} key={tool.href} href={tool.href} prefetch={false}><OwnerIcon name={tool.icon} /><span><strong>{tool.title}</strong><small>{tool.detail}</small></span></Link>)}
      </nav>
    </div>}
  </section></main>;
}
