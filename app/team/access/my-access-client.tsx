'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TEAM_PERMISSIONS, type TeamPermissions } from '../../../lib/team-access-policy';
import shared from '../../../components/team/team.module.css';
import styles from './my-access.module.css';

type Access = {
  id: string; name: string; displayName: string; status: 'pending' | 'active';
  available: boolean; permissions: TeamPermissions; expiresAt: string | null;
  scope: 'all' | 'selected'; registerCount: number; assetCount: number; documentCount: number;
};
const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;
export default function MyAccessClient({ email, name, managed }: { email: string; name: string; managed: boolean }) {
  const [access, setAccess] = useState<Access[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => {
    let controller: AbortController | undefined;
    const refresh = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch('/api/team-workspaces', { cache: 'no-store', signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load your access.');
        setAccess(body.workspaces); setError('');
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return;
        setAccess([]); setExpanded(null); setError(e instanceof Error ? e.message : 'Unable to load your access.');
      } finally { setLoading(false); }
    };
    const visible = () => {
      if (document.hidden) { controller?.abort(); setAccess([]); setExpanded(null); setLoading(true); }
      else void refresh();
    };
    const focus = () => { if (!document.hidden) void refresh(); };
    void refresh();
    const timer = setInterval(focus, 30000);
    window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visible);
    return () => { controller?.abort(); clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible); };
  }, []);
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/team-login', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to sign out. Please try again.');
      window.location.assign('/team');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to sign out.'); setBusy(false); }
  }
  return <main className={`${shared.page} ${styles.page}`}>
    <header className={styles.header}>
      <div><h1>My access</h1><p>Signed in as {name || email || 'Desktop user'}</p></div>
      <div className={shared.actions}>{!managed && <Link className={shared.button} href="/account">My account</Link>}
        {managed && <button className={shared.button} disabled={busy} onClick={() => void signOut()}>{busy ? 'Signing out…' : 'Sign out'}</button>}
      </div>
    </header>
    {error && <p className={shared.error} role="alert">{error} <Link href="/team">Return to desktop sign-in</Link></p>}
    {loading && <p role="status">Loading your access…</p>}
    {!loading && !error && !access.length && <section className={`${shared.card} ${styles.card}`}><h2>No desktop access yet</h2><p>Ask your account holder to add you, or use the business sign-in link they shared.</p><Link className={shared.button} href="/team">Desktop sign-in</Link></section>}
    <div className={styles.list}>{access.map(item => <section key={item.id} className={`${shared.card} ${styles.card}`}>
      <div className={styles.cardHeader}><h2>{item.name}</h2><strong className={item.available && item.status === 'active' ? styles.active : styles.status}>{!item.available ? 'Workspace unavailable' : item.status === 'active' ? 'Active' : 'Invitation pending'}</strong></div>
      <p className={styles.summary}>{item.scope === 'all' ? 'All assets' : [item.registerCount ? count(item.registerCount, 'register') : '', item.assetCount ? count(item.assetCount, 'asset') : ''].filter(Boolean).join(' and ') || 'No assets selected'} · Asset values {item.permissions.viewValues ? 'visible' : 'hidden'}</p>
      <div className={styles.footer}>
        <button className={shared.button} aria-expanded={expanded === item.id} aria-controls={`permissions-${item.id}`} onClick={() => setExpanded(expanded === item.id ? null : item.id)}>{expanded === item.id ? 'Hide permissions' : 'View permissions'}</button>
        {item.available && <Link className={shared.primary} href={item.status === 'active' ? `/team?workspace=${encodeURIComponent(item.id)}` : '/team'}>{item.status === 'active' ? 'Open workspace' : 'Review invitation'}</Link>}
      </div>
      <div id={`permissions-${item.id}`} hidden={expanded !== item.id} className={styles.disclosure}>
      <h3>Permissions for {item.name}</h3>
      <dl className={styles.details}>
        <div><dt>Asset access</dt><dd>{item.scope === 'all' ? 'All current and future assets' : [item.registerCount ? count(item.registerCount, 'register') + ' (including future assets)' : '', item.assetCount ? count(item.assetCount, 'individual asset') : ''].filter(Boolean).join(' and ') || 'No assets selected'}</dd></div>
        <div><dt>Documents</dt><dd>{item.documentCount ? `${count(item.documentCount, 'approved document')} — available while linked assets remain in scope` : 'No documents approved'}</dd></div>
        <div><dt>Access expires</dt><dd>{item.expiresAt ? new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' }).format(new Date(item.expiresAt)) + ' (South Africa)' : 'No expiry set'}</dd></div>
      </dl>
      <h3>What you can do</h3>
      <ul className={styles.permissions}><li>View permitted asset details</li>{TEAM_PERMISSIONS.filter(p => item.permissions[p.key]).map(p => <li key={p.key}>{p.label}</li>)}</ul>
      <p className={styles.note}>{item.permissions.viewValues ? 'Asset values are visible. Finance balances and costs are excluded.' : 'Asset values are hidden.'} Approved documents and photos may contain prices.</p>
      <p className={styles.note}>Your account holder manages these permissions{managed ? ' and your desktop password' : ''}.</p>
      </div>
    </section>)}</div>
    <p className={styles.help}>Need help? Contact your account holder.</p>
  </main>;
}
