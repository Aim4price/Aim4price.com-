'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import styles from './OwnerMobileAppGate.module.css';

const BLOCKED_OWNER_PATHS = [
  '/asset-register',
  '/asset-registers',
  '/asset-map',
  '/companies',
  '/maintenance',
  '/fuel',
  '/my-invoices',
  '/account',
];

function pathIsBlocked(pathname: string): boolean {
  return BLOCKED_OWNER_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export default function OwnerMobileAppGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/';
  const blockedRoute = useMemo(() => pathIsBlocked(pathname), [pathname]);
  const [phoneLike, setPhoneLike] = useState<boolean | null>(null);
  const [ownerShouldUseApp, setOwnerShouldUseApp] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (!blockedRoute) {
      setPhoneLike(false);
      setOwnerShouldUseApp(false);
      setProfileChecked(true);
      return;
    }

    const media = window.matchMedia(
      '(pointer: coarse) and (max-width: 760px), (pointer: coarse) and (max-height: 520px)',
    );
    const update = () => setPhoneLike(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [blockedRoute]);

  useEffect(() => {
    if (!blockedRoute || phoneLike !== true) {
      setOwnerShouldUseApp(false);
      setProfileChecked(true);
      return;
    }

    let active = true;
    setProfileChecked(false);

    fetch('/api/account-profile', { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as {
          profile?: { accountType?: string; accountStatus?: string };
        } | null;
        if (!active) return;
        setOwnerShouldUseApp(
          response.ok &&
          payload?.profile?.accountType === 'owner' &&
          payload.profile.accountStatus === 'active',
        );
      })
      .catch(() => { if (active) setOwnerShouldUseApp(false); })
      .finally(() => { if (active) setProfileChecked(true); });

    return () => { active = false; };
  }, [blockedRoute, phoneLike]);

  if (blockedRoute && (phoneLike === null || (phoneLike && !profileChecked))) {
    return <div className={styles.loadingPage} aria-label="Opening Aim4price" />;
  }

  if (ownerShouldUseApp) {
    return (
      <main className={styles.gatePage}>
        <section className={styles.gateCard} aria-labelledby="aim4price-mobile-app-title">
          <Image className={styles.logo} src="/icon.png" alt="Aim4price App" width={92} height={92} priority />
          <span className={styles.eyebrow}>Aim4price App</span>
          <h1 id="aim4price-mobile-app-title">Your asset information belongs in your pocket.</h1>
          <p>Open the Aim4price App to view assets, schedule maintenance and download reports.</p>
          <Link className={styles.primaryButton} href="/app/login">Open Aim4price App</Link>
          <p className={styles.desktopNote}>Use the desktop dashboard for detailed account work.</p>
        </section>
      </main>
    );
  }

  return children;
}
