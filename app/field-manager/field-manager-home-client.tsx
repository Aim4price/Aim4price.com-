'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

type FieldManagerSession = {
  id: string;
  displayName: string;
  username: string;
};

type SessionApiResponse = {
  ok: boolean;
  manager?: FieldManagerSession;
  error?: string;
};

function extractError(payload: { error?: string } | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

export default function FieldManagerHomeClient() {
  const [hasManagerAccess, setHasManagerAccess] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    setIsLoading(true);
    setHasManagerAccess(false);
    setNotice(null);

    try {
      const response = await fetch('/api/field-manager/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as SessionApiResponse | null;

      if (response.status === 401) {
        window.location.replace('/field-manager/login');
        return;
      }

      if (!response.ok || !payload?.ok || !payload.manager) {
        throw new Error(extractError(payload, 'Field Manager login is required.'));
      }

      setHasManagerAccess(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Field Manager login is required.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/field-manager/login', {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
    }).catch(() => undefined);
    window.location.replace('/field-manager/login');
  }

  return (
    <main className={styles.mobilePage}>
      <section className={`${styles.assetsShell} ${styles.homeShell}`}>
        <header className={styles.assetsHeader} aria-label="Field Manager account controls">
          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            Sign out
          </button>
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}
        {isLoading ? <p className={styles.mobileEmpty}>Opening Field Manager…</p> : null}

        {!isLoading && hasManagerAccess ? (
          <section className={styles.homeCard} aria-label="Field Manager actions">
            <div className={styles.homeActionGrid}>
              <button
                type="button"
                className={styles.homeActionCard}
                onClick={() => window.location.assign('/field-manager/assets')}
              >
                <strong>Manage</strong>
              </button>

              <button
                type="button"
                className={styles.homeActionCard}
                onClick={() => window.location.assign('/field-manager/diesel')}
              >
                <strong>Fuel</strong>
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
