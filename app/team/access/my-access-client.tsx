'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import { DesktopAccount, PermissionsModal, type DesktopAccountAccess } from './desktop-account';
import account from '../../account/page.module.css';
import shared from '../../../components/team/team.module.css';
import styles from './my-access.module.css';

export default function MyAccessClient({ email, name, managed }: { email: string; name: string; managed: boolean }) {
  const [access, setAccess] = useState<DesktopAccountAccess[]>([]);
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
  const selected = access.find(item => item.id === expanded);
  const current = access[0];
  return <main className={account.page}>
    <AppHeader active="account" desktopContext={managed ? {name:current?.name || 'Aim4price', logoUrl:current?.logoUrl, accountType:current?.accountType, accountSubtype:current?.accountSubtype, onSignOut:() => { if (!busy) void signOut(); }} : undefined} />
    {error && <p className={shared.error} role="alert">{error} <Link href="/team">Return to desktop sign-in</Link></p>}
    {loading && <p className={styles.help} role="status">Loading your access…</p>}
    {!loading && !error && !access.length && <section className={account.shell}><section className={account.card}><h1>No desktop access yet</h1><p>Ask your account holder to add you, or use the business sign-in link they shared.</p><Link className={shared.button} href="/team">Desktop sign-in</Link></section></section>}
    {access.map(item => <DesktopAccount key={item.id} item={item} username={name || email || 'Desktop user'} onPermissions={() => setExpanded(item.id)} />)}
    {selected && <PermissionsModal item={selected} onClose={() => setExpanded(null)} />}
  </main>;
}
