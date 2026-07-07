'use client';

import { useState, type FormEvent } from 'react';
import styles from './page.module.css';

type LoginApiResponse = {
  ok: boolean;
  redirectTo?: string;
  error?: string;
};

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

function extractError(payload: LoginApiResponse | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
}

export default function FieldManagerLoginClient() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);

    const cleanUsername = normalizeUsername(username);

    if (cleanUsername.length < 3) {
      setNotice('Enter your Field Manager username.');
      return;
    }

    if (!password) {
      setNotice('Enter your Field Manager password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/field-manager/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const payload = (await response.json().catch(() => null)) as LoginApiResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(extractError(payload, 'Field Manager login failed.'));
      }

      window.location.replace(payload.redirectTo || '/field-manager');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Field Manager login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.mobilePage}>
      <section className={styles.loginShell}>
        <section className={styles.loginCard}>
          <div className={`${styles.loginHeader} ${styles.loginHeaderCompact}`}>
            <h2>Sign in</h2>
          </div>

          {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <label className={styles.mobileField}>
              <span>Username</span>
              <input
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                placeholder="field.manager"
                autoComplete="username"
                inputMode="text"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </label>

            <div className={styles.mobileField}>
              <label htmlFor="field-manager-login-password">Password</label>
              <div className={styles.mobilePasswordInputWrap}>
                <input
                  id="field-manager-login-password"
                  type={isPasswordVisible ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={styles.mobilePasswordToggleButton}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  aria-label={isPasswordVisible ? 'Hide Field Manager password' : 'Show Field Manager password'}
                  aria-pressed={isPasswordVisible}
                >
                  {isPasswordVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className={styles.mobilePrimaryButton} disabled={isSubmitting}>
              {isSubmitting ? 'Opening…' : 'Login to Field Manager'}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}
