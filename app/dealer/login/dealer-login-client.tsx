'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import styles from '../dealer.module.css';

type InstallPlatform = 'android' | 'ios' | 'desktop' | 'other';
type InstallView = 'checking' | 'install' | 'login';
type InstallOutcome = 'idle' | 'instructions' | 'installed' | 'dismissed';

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

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

function detectPlatform(): InstallPlatform {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;

  if (/iphone|ipad|ipod/.test(userAgent) || isIPadOs) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  if (!/mobile/.test(userAgent)) return 'desktop';
  return 'other';
}

function isStandaloneMode(): boolean {
  const navigatorWithStandalone = window.navigator as StandaloneNavigator;
  return window.matchMedia('(display-mode: standalone)').matches || navigatorWithStandalone.standalone === true;
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2h14v-2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V4m0 0L8 8m4-4 4 4M5 12v7h14v-7" />
    </svg>
  );
}

function HomeScreenIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20H4v-9.5ZM9 20v-6h6v6" />
    </svg>
  );
}

export default function DealerLoginClient({ hasAccountSession = false }: { hasAccountSession?: boolean }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [accountSessionActive, setAccountSessionActive] = useState(hasAccountSession);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
          scope: '/dealer/',
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
      setInstallOutcome('installed');
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
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      setInstallOutcome(choice.outcome === 'accepted' ? 'installed' : 'dismissed');
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
    const isInstalled = installOutcome === 'installed';
    const showInstructions = installOutcome === 'instructions';

    return (
      <main className={styles.loginPage}>
        <section className={styles.installCard} aria-labelledby="dealer-install-title">
          <header className={styles.installHeader}>
            <span className={styles.installAppIcon} aria-hidden="true">
              <Image src="/icon.png" alt="" width={88} height={88} priority />
            </span>
            <span className={styles.loginEyebrow}>Aim4price Dealer App</span>
            <h1 id="dealer-install-title">Install the app first</h1>
            <p className={styles.installIntro}>
              Add the Dealer App to this phone for a cleaner, full-screen experience and faster access from the Home screen.
            </p>
          </header>

          <div className={styles.installBenefits} aria-label="Dealer App benefits">
            <span><HomeScreenIcon />Home-screen access</span>
            <span><DownloadIcon />Full-screen app view</span>
          </div>

          {isInstalled ? (
            <div className={styles.installSuccess} role="status">
              <strong>Dealer App installed</strong>
              <span>Open it from your phone’s Home screen. You may also continue to staff sign in here.</span>
            </div>
          ) : null}

          {installOutcome === 'dismissed' ? (
            <p className={styles.installNotice} role="status">
              Installation was cancelled. Tap the download button whenever you are ready, or continue to sign in below.
            </p>
          ) : null}

          {showInstructions ? (
            <section className={styles.installInstructions} aria-live="polite">
              <h2>{installPlatform === 'ios' ? 'Install on iPhone or iPad' : 'Install from your browser'}</h2>
              {installPlatform === 'ios' ? (
                <ol>
                  <li><span className={styles.instructionIcon}><ShareIcon /></span><span>Tap the <strong>Share</strong> button in Safari.</span></li>
                  <li><span className={styles.instructionNumber}>2</span><span>Choose <strong>Add to Home Screen</strong>.</span></li>
                  <li><span className={styles.instructionNumber}>3</span><span>Tap <strong>Add</strong>, then open Dealer from the Home screen.</span></li>
                </ol>
              ) : (
                <ol>
                  <li><span className={styles.instructionNumber}>1</span><span>Open this page in Chrome or your main browser.</span></li>
                  <li><span className={styles.instructionNumber}>2</span><span>Open the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span></li>
                  <li><span className={styles.instructionNumber}>3</span><span>Confirm the installation, then open Dealer from your apps or Home screen.</span></li>
                </ol>
              )}
            </section>
          ) : null}

          <div className={styles.installActions}>
            <button
              type="button"
              className={styles.installPrimary}
              onClick={() => void requestInstall()}
              disabled={installBusy}
            >
              <DownloadIcon />
              {installBusy ? 'Preparing download…' : isInstalled ? 'Download again' : 'Download Dealer App'}
            </button>

            <button
              type="button"
              className={styles.installSecondary}
              onClick={() => setInstallView('login')}
            >
              {isInstalled ? 'Continue to staff sign in' : 'Already installed? Continue to sign in'}
            </button>
          </div>

          <p className={styles.installFootnote}>
            No app-store account is required. The Dealer App installs directly from Aim4price.
          </p>
        </section>
      </main>
    );
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
