'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './owner-app.module.css';

type OwnerAppNavProps = {
  title?: string;
  backHref?: string;
};

export default function OwnerAppNav({ title = 'Aim4price', backHref }: OwnerAppNavProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);

    await fetch('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => undefined);

    window.location.replace('/app/login');
  }

  return (
    <nav className={styles.appNav} aria-label="Aim4price App navigation">
      {backHref ? (
        <Link href={backHref} className={styles.navButton} replace>
          <span aria-hidden="true">←</span>
          <span>Back</span>
        </Link>
      ) : (
        <span className={styles.navBrand}>{title}</span>
      )}

      {backHref ? (
        <Link href="/app" className={styles.navButton} replace>
          Home
        </Link>
      ) : (
        <button type="button" className={styles.signOutButton} onClick={() => void signOut()} disabled={isSigningOut}>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </button>
      )}
    </nav>
  );
}
