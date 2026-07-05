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
  const [manager, setManager] = useState<FieldManagerSession | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadSession();
  }, []);

  async function loadSession() {
    setIsLoading(true);
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

      setManager(payload.manager);
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
      <section className={styles.assetsShell}>
        <header className={styles.assetsHeader}>
          <div>
            <span>Aim4price</span>
            <h1>Field Manager</h1>
            <p>{manager ? `Signed in as ${manager.displayName}` : 'Mobile manager access'}</p>
          </div>
          <button type="button" className={styles.logoutButton} onClick={() => void handleLogout()}>
            Logout
          </button>
        </header>

        {notice ? <div className={styles.errorNotice}>{notice}</div> : null}
        {isLoading ? <p className={styles.mobileEmpty}>Opening Field Manager…</p> : null}

        {!isLoading && manager ? (
          <section className={styles.homeCard} aria-label="Field Manager actions">
            <div className={styles.loginHeader}>
              <span>Mobile home</span>
              <h2>Choose what to update</h2>
              <p>Use Manage for equipment updates, or Diesel for fuel storage and fuel issue updates.</p>
            </div>

            <div className={styles.homeActionGrid}>
              <button
                type="button"
                className={styles.homeActionCard}
                onClick={() => window.location.assign('/field-manager/assets')}
              >
                <span>Equipment</span>
                <strong>Manage</strong>
                <small>Open the asset list and update equipment from the saved manager login.</small>
              </button>

              <button
                type="button"
                className={styles.homeActionCard}
                onClick={() => window.location.assign('/field-manager/diesel')}
              >
                <span>Fuel storage</span>
                <strong>Diesel</strong>
                <small>Open diesel tanks and capture fuel updates without entering a fuel PIN.</small>
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
