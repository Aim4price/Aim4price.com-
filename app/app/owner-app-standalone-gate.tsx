'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import styles from './owner-app.module.css';

type StandaloneNavigator = Navigator & { standalone?: boolean };

function isStandalone(): boolean {
  const standaloneNavigator = window.navigator as StandaloneNavigator;
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
}

export default function OwnerAppStandaloneGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/app';
  const isLoginPage = pathname === '/app/login';
  const [ready, setReady] = useState(isLoginPage);

  useEffect(() => {
    if (isLoginPage) {
      setReady(true);
      return;
    }

    if (isStandalone()) {
      setReady(true);
      return;
    }

    window.location.replace('/app/login');
  }, [isLoginPage]);

  if (!ready) {
    return (
      <main className={styles.loginPage}>
        <span className={styles.spinner} aria-label="Opening Aim4price App" />
      </main>
    );
  }

  return children;
}
