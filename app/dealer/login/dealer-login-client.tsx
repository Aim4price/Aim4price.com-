'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import styles from '../dealer.module.css';

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

export default function DealerLoginClient({ hasAccountSession = false }: { hasAccountSession?: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountSessionActive, setAccountSessionActive] = useState(hasAccountSession);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function switchToStaffLogin() {
    if (busy || !accountSessionActive) return;

    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('The current Aim4price account could not be signed out. Please try again.');
      }

      setAccountSessionActive(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch to staff sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    if (accountSessionActive) {
      setError('Sign out of the current Aim4price account before using a staff login.');
      return;
    }

    const cleanUsername = normalizeUsername(username);
    if (cleanUsername.length < 3 || !password) {
      setError('Enter your Dealer App username and password.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch('/api/dealer/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        redirectTo?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to sign in.');
      }

      window.location.replace(payload.redirectTo || '/dealer');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
      setBusy(false);
    }
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="dealer-login-title">
        <header className={styles.loginHeader}>
          <span className={styles.loginEyebrow}>Aim4price Dealer App</span>
          <h1 id="dealer-login-title">Staff sign in</h1>
          <p className={styles.loginIntro}>
            Use the username and password supplied by your dealership.
          </p>
        </header>

        {accountSessionActive ? (
          <div className={styles.loginForm} aria-busy={busy}>
            <p className={styles.sessionNotice} role="status">
              An Aim4price account is already open in this browser. Switch deliberately before entering a Dealer App staff login.
            </p>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <button type="button" className={styles.primary} onClick={() => void switchToStaffLogin()} disabled={busy}>
              {busy ? 'Signing out current account…' : 'Sign out and use staff login'}
            </button>
          </div>
        ) : (
          <form className={styles.loginForm} onSubmit={submit} aria-busy={busy}>
            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="dealer-staff-username">Username</label>
              <input
                id="dealer-staff-username"
                name="username"
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                placeholder="dealer.user"
                autoComplete="username"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                disabled={busy}
                required
              />
            </div>

            <div className={styles.field}>
              <label className={styles.fieldLabel} htmlFor="dealer-staff-password">Password</label>
              <span className={styles.inputWrap}>
                <input
                  id="dealer-staff-password"
                  name="password"
                  className={styles.passwordInput}
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  disabled={busy}
                  required
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  disabled={busy}
                  aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? 'Hide' : 'Show'}
                </button>
              </span>
            </div>

            {error ? <p className={styles.error} role="alert">{error}</p> : null}

            <button type="submit" className={styles.primary} disabled={busy}>
              {busy ? 'Opening Dealer App…' : 'Sign in'}
            </button>
          </form>
        )}

        <div className={styles.accountArea}>
          {accountSessionActive ? (
            <>
              <span className={styles.accountLabel}>Want to keep using the account already open?</span>
              <Link className={styles.accountLink} href="/auth" prefetch={false}>
                Return to current Aim4price account
              </Link>
            </>
          ) : (
            <>
              <span className={styles.accountLabel}>Dealer account holder?</span>
              <Link className={styles.accountLink} href="/auth?returnTo=%2Fdealer#login" prefetch={false}>
                Sign in with main dealer account
              </Link>
              <span className={styles.helpText}>
                Forgot a staff password? Ask the dealer account holder to reset it.
              </span>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
