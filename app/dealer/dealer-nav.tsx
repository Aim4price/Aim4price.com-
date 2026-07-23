'use client';

import Link from 'next/link';
import { useState } from 'react';
import { clearCachedHeaderSession } from '../../lib/header-session-cache';
import styles from './dealer.module.css';

type DealerNavProps = {
  backHref?: string;
  backLabel?: string;
  showBack?: boolean;
};

export default function DealerNav({
  backHref = '/dealer',
  backLabel = 'Apps',
  showBack = true,
}: DealerNavProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    await Promise.allSettled([
      fetch('/api/dealer/logout', { method: 'POST', credentials: 'include' }),
      fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    ]);

    clearCachedHeaderSession();
    window.location.replace('/dealer/login');
  }

  return (
    <nav className={styles.nav} aria-label="Dealer App navigation">
      {showBack ? (
        <Link className={styles.navButton} href={backHref} prefetch={false} replace>
          <span className={styles.navArrow} aria-hidden="true">←</span>
          <span>{backLabel}</span>
        </Link>
      ) : (
        <span className={styles.navBrand}>Aim4price Dealer</span>
      )}

      <button
        type="button"
        className={styles.signOut}
        onClick={() => void signOut()}
        disabled={isSigningOut}
      >
        {isSigningOut ? 'Signing out…' : 'Sign out'}
      </button>
    </nav>
  );
}
