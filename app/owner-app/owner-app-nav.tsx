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
    <header className={styles.assetsHeader} aria-label="Aim4price Owner account controls">
      {showBack ? (
        <Link className={styles.navButton} href={backHref} prefetch={false} aria-label={backLabel}>
          <span className={styles.navArrow} aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </Link>
      ) : null}
      <button type="button" className={styles.logoutButton} onClick={() => void signOut()} disabled={signingOut}>
        {signingOut ? 'Signing out…' : 'Sign out'}
      </button>
    </header>
  );
}
