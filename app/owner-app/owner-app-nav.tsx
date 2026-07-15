'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './owner-app.module.css';

export default function OwnerAppNav({ showBack = true, backHref = '/owner-app', backLabel = 'Home' }: {
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
}) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    await Promise.allSettled([
      fetch('/api/owner-app/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }),
    ]);
    window.location.replace('/owner-app/login');
  }

  return (
    <nav className={`${styles.nav} ${showBack ? '' : styles.homeNav}`} aria-label="Aim4price Owner navigation">
      {showBack ? <Link className={styles.navButton} href={backHref} prefetch={false}>← {backLabel}</Link> : <span aria-hidden="true" />}
      <button type="button" className={styles.signOut} onClick={() => void signOut()} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
    </nav>
  );
}
