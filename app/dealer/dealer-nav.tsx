'use client';

import Link from 'next/link';
import AppSettings from '../../components/AppSettings';
import NotificationSettingsModal from '../../components/NotificationSettingsModal';
import { useDealerAppRoot } from '../../lib/use-dealer-app-root';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import styles from './dealer.module.css';

type DealerNavProps = {
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
};

export default function DealerNav({
  backHref,
  backLabel = 'Back',
  onBack,
  backDisabled = false,
}: DealerNavProps) {
  const appRoot = useDealerAppRoot();
  const realPathname = usePathname();
  const pathname = realPathname.replace(/^\/middleman(?=\/|$)/, '/dealer');
  const appHref = (href: string) => href.replace(/^\/dealer(?=\/|$)/, appRoot);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const isLeadsPage = pathname.startsWith('/dealer/leads');
  const isMaintenancePage = pathname.startsWith('/dealer/maintenance');
  const workspaceSurfaceClass = isLeadsPage || isMaintenancePage ? `${styles.navLeadsSurface} ${styles.navUnifiedSurface}` : '';
  const isHome = pathname === '/dealer';
  const appName = appRoot === '/middleman' ? 'Middleman' : 'Dealer';
  const fallbackHref = pathname.startsWith('/dealer/maintenance/') ? '/dealer/maintenance'
    : pathname.startsWith('/dealer/inventory/') ? '/dealer/inventory' : '/dealer';
  function goBack() {
    if (backDisabled) return;
    if (onBack) { onBack(); return; }
    if (backHref) { router.push(appHref(backHref)); return; }
    if (window.history.length > 1) router.back();
    else router.replace(appHref(fallbackHref));
  }
  if (pathname === '/dealer/login' || (pathname === '/dealer/valuation' && !onBack)) return null;

  async function signOut() {
    if (isSigningOut) return;
    if ('BroadcastChannel' in window) { const channel = new BroadcastChannel('aim4price-' + (appRoot === '/middleman' ? 'middleman' : 'dealer') + '-session'); channel.postMessage('lock'); channel.close(); }
    setIsSigningOut(true);

    await fetch(`/api${appRoot}/logout`, { method: 'POST', credentials: 'include' });

    clearCachedHeaderSession();
    window.location.replace(`${appRoot}/login`);
  }

  return (
    <header className={`${styles.nav} ${styles.navPair} ${workspaceSurfaceClass} ${onBack ? styles.estimateNav : ''}`} aria-label={`${appName} App navigation`}>
      <nav className={styles.topNavigation} aria-label="Page navigation">
        <button type="button" className={styles.navButton} onClick={goBack} disabled={backDisabled} aria-label="Back" title={backLabel === 'Back' ? undefined : backLabel}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7" /></svg>
          <span>Back</span>
        </button>
        <Link className={`${styles.navButton} ${styles.homeButton}`} href={appRoot} prefetch={false} aria-label={appRoot === '/middleman' ? 'Middleman App home' : 'Dealer App home'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z" /></svg>
          <span>Home</span>
        </Link>
      </nav>
      {isHome ? <div className={styles.topUtilities}>
        <AppSettings offlineHref={`${appRoot}/offline.html`} />
        <button type="button" className={styles.signOut} onClick={() => void signOut()} disabled={isSigningOut}>{isSigningOut ? 'Signing out…' : 'Sign out'}</button>
      </div> : null}
      {pathname === '/dealer/notifications' ? <div className={styles.topUtilities}><NotificationSettingsModal app={appRoot === '/middleman' ? 'middleman' : 'dealer'} /></div> : null}
    </header>
  );
}
