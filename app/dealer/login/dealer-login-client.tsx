'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import AppLoginWelcome from '../../../components/AppLoginWelcome';
import { clearCachedHeaderSession } from '../../../lib/header-session-cache';
import styles from '../dealer.module.css';

type InstallPlatform = 'ios' | 'other';
type InstallView = 'checking' | 'install' | 'login';
type InstallOutcome = 'idle' | 'instructions';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

type StandaloneNavigator = Navigator & {
  standalone?: boolean;
};

type LoginWelcome = {
  displayName: string;
  companyName: string;
  logoUrl: string;
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function detectPlatform(): InstallPlatform {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isIPadOs ? 'ios' : 'other';
}

function isStandaloneMode(): boolean {
  const navigatorWithStandalone = window.navigator as StandaloneNavigator;
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

export default function DealerLoginClient({ hasAccountSession = false }: { hasAccountSession?: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountSessionActive, setAccountSessionActive] = useState(hasAccountSession);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [welcome, setWelcome] = useState<LoginWelcome | null>(null);

  const [installView, setInstallView] = useState<InstallView>('checking');
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>('other');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome>('idle');
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    setInstallPlatform(detectPlatform());
    setInstallView(isStandaloneMode() ? 'login' : 'install');

    if ('serviceWorker' in window.navigator) {
      void window.navigator.serviceWorker
        .register('/dealer-sw.js', {
          scope: '/dealer',
          updateViaCache: 'none',
        })
        .catch(() => {
          // Installation instructions remain available even if registration fails.
        });
    }

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallOutcome('idle');
    }

    function handleAppInstalled() {
      setInstallPrompt(null);
      setInstallOutcome('idle');
      setInstallView('login');
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  async function requestInstall() {
    if (installBusy) return;

    if (!installPrompt) {
      setInstallOutcome('instructions');
      return;
    }

    setInstallBusy(true);

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallView('login');
    } catch {
      setInstallOutcome('instructions');
    } finally {
      setInstallBusy(false);
    }
  }

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

      clearCachedHeaderSession();
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
        welcome?: LoginWelcome;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'Unable to sign in.');
      }

      const redirectTo = payload.redirectTo || '/dealer';
      setWelcome({
        displayName: payload.welcome?.displayName || cleanUsername,
        companyName: payload.welcome?.companyName || 'Aim4price',
        logoUrl: payload.welcome?.logoUrl || '/icon.png',
      });
      window.setTimeout(() => window.location.replace(redirectTo), 1400);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
      setBusy(false);
    }
  }

  if (welcome) {
    return <main className={styles.loginPage}><AppLoginWelcome {...welcome} /></main>;
  }

  if (installView === 'checking') {
    return (
      <main className={styles.loginPage}>
        <section className={styles.installLoadingCard} aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <strong>Opening Dealer App…</strong>
        </section>
      </main>
    );
  }

  if (installView === 'install') {
    const showInstructions = installOutcome === 'instructions';

    return (
      <main className={styles.loginPage}>
        <section className={styles.installCard} aria-labelledby="dealer-install-title">
          <header className={styles.installHeader}>
            <Image
              className={styles.installLogo}
              src="/icon.png"
              alt="Aim4price Dealer App"
              width={92}
              height={92}
              priority
            />
            <span className={styles.loginEyebrow}>Aim4price Dealer App</span>
            <h1 id="dealer-install-title">Do you have the app?</h1>
          </header>

          <div className={styles.installActions}>
            <button
              type="button"
              className={styles.installSecondary}
              onClick={() => setInstallView('login')}
            >
              Yes — Continue to login
            </button>

            <button
              type="button"
              className={styles.installPrimary}
              onClick={() => void requestInstall()}
              disabled={installBusy}
            >
              {installBusy ? 'Opening installer…' : 'No — Download app'}
            </button>
          </div>

          {showInstructions ? (
            <section className={styles.installInstructions} aria-live="polite">
              <p>
                {installPlatform === 'ios'
                  ? 'Tap Share, then Add to Home Screen.'
                  : 'Open the browser menu and select Install app.'}
              </p>
              <button
                type="button"
                className={styles.installContinue}
                onClick={() => setInstallView('login')}
              >
                Continue to login
              </button>
            </section>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="dealer-login-title">
        <header className={styles.loginHeader}>
          <Image
            className={styles.loginLogo}
            src="/icon.png"
            alt="Aim4price Dealer App"
            width={76}
            height={76}
            priority
          />
          <span className={styles.loginEyebrow}>Aim4price Dealer App</span>
          <h1 id="dealer-login-title">Sign In</h1>
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
              <label className={styles.fieldLabel} htmlFor="dealer-staff-username">App username</label>
              <input
                id="dealer-staff-username"
                name="username"
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                placeholder="kuyler@vasbyt"
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

      </section>
    </main>
  );
}
