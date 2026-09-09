'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import AppLoginWelcome from '../../components/AppLoginWelcome';
import styles from './page.module.css';

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

type LoginApiResponse = {
  ok: boolean;
  redirectTo?: string;
  welcome?: LoginWelcome;
  error?: string;
};

type LoginWelcome = {
  displayName: string;
  companyName: string;
  logoUrl: string;
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function extractError(payload: LoginApiResponse | null, fallback: string): string {
  return payload?.error?.trim() || fallback;
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

export default function FieldManagerLoginClient() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        .register('/field-manager-sw.js', {
          scope: '/field-manager',
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

      const redirectTo = payload.redirectTo || '/field-manager';
      setWelcome({
        displayName: payload.welcome?.displayName || cleanUsername,
        companyName: payload.welcome?.companyName || 'Aim4price',
        logoUrl: payload.welcome?.logoUrl || '/icon.png',
      });
      window.setTimeout(() => window.location.replace(redirectTo), 1400);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Field Manager login failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (welcome) {
    return (
      <main className={`${styles.mobilePage} ${styles.installPage}`}>
        <AppLoginWelcome {...welcome} />
      </main>
    );
  }

  if (installView === 'checking') {
    return (
      <main className={`${styles.mobilePage} ${styles.installPage}`}>
        <section className={styles.installLoadingCard} aria-live="polite">
          <span className={styles.loadingSpinner} aria-hidden="true" />
          <strong>Opening Farm Manager App…</strong>
        </section>
      </main>
    );
  }

  if (installView === 'install') {
    const showInstructions = installOutcome === 'instructions';

    return (
      <main className={`${styles.mobilePage} ${styles.installPage}`}>
        <section className={styles.installCard} aria-labelledby="field-manager-install-title">
          <header className={styles.installHeader}>
            <Image
              className={styles.installLogo}
              src="/icon.png"
              alt="Aim4price Farm Manager App"
              width={92}
              height={92}
              priority
            />
            <span className={styles.loginEyebrow}>Aim4price Farm Manager App</span>
            <h1 id="field-manager-install-title">Do you have the app?</h1>
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
    <main className={styles.mobilePage}>
      <section className={styles.loginShell}>
        <section className={styles.loginCard}>
          <div className={`${styles.loginHeader} ${styles.loginHeaderCompact}`}>
            <Image
              className={styles.loginLogo}
              src="/icon.png"
              alt="Aim4price Farm Manager App"
              width={76}
              height={76}
              priority
            />
            <span className={styles.loginEyebrow}>Aim4price Farm Manager App</span>
            <h2>Sign in</h2>
            <p className={styles.loginSubheading}>
              Manage assets, maintenance and fuel in one place.
            </p>
          </div>

          {notice ? <div className={styles.errorNotice}>{notice}</div> : null}

          <form className={styles.loginForm} onSubmit={handleSubmit}>
            <label className={styles.mobileField}>
              <span>App username</span>
              <input
                value={username}
                onChange={(event) => setUsername(normalizeUsername(event.target.value))}
                placeholder="kuyler@vasbyt"
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
