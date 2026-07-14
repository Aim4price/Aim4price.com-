'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import styles from '../owner-app.module.css';

type InstallPlatform = 'ios' | 'other';
type InstallView = 'checking' | 'install' | 'login';
type InstallOutcome = 'idle' | 'instructions' | 'installed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

type StandaloneNavigator = Navigator & { standalone?: boolean };

function isStandaloneMode(): boolean {
  const standaloneNavigator = window.navigator as StandaloneNavigator;
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
}

function detectPlatform(): InstallPlatform {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIPadOs = window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isIPadOs ? 'ios' : 'other';
}

function errorText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return 'Unable to sign in. Please try again.';
  const record = payload as Record<string, unknown>;
  const nested = record.error && typeof record.error === 'object' ? record.error as Record<string, unknown> : null;
  const candidates = [record.message, record.error, nested?.message, nested?.error];
  const match = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return typeof match === 'string' ? match : 'Unable to sign in. Please try again.';
}

export default function OwnerAppLoginClient({ hasActiveOwnerSession = false }: { hasActiveOwnerSession?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [installView, setInstallView] = useState<InstallView>('checking');
  const [installPlatform, setInstallPlatform] = useState<InstallPlatform>('other');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installOutcome, setInstallOutcome] = useState<InstallOutcome>('idle');
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    setInstallPlatform(detectPlatform());
    const standalone = isStandaloneMode();

    if (standalone && hasActiveOwnerSession) {
      window.location.replace('/app');
    } else {
      setInstallView(standalone ? 'login' : 'install');
    }

    if ('serviceWorker' in window.navigator) {
      void window.navigator.serviceWorker.register('/aim4price-app-sw.js', {
        scope: '/app',
        updateViaCache: 'none',
      }).catch(() => undefined);
    }

    function beforeInstall(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallOutcome('idle');
    }

    function installed() {
      setInstallPrompt(null);
      setInstallOutcome('installed');
    }

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, [hasActiveOwnerSession]);

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
      setInstallOutcome(choice.outcome === 'accepted' ? 'installed' : 'instructions');
    } catch {
      setInstallOutcome('instructions');
    } finally {
      setInstallBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setNotice('Enter your email and password.');
      return;
    }

    setBusy(true);
    setNotice('');

    try {
      const response = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          rememberMe: true,
          callbackURL: new URL('/app', window.location.origin).toString(),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) throw new Error(errorText(payload));
      window.location.replace('/app');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
      setBusy(false);
    }
  }

  if (installView === 'checking') {
    return (
      <main className={styles.loginPage}>
        <span className={styles.spinner} aria-label="Opening Aim4price App" />
      </main>
    );
  }

  if (installView === 'install') {
    return (
      <main className={styles.loginPage}>
        <section className={styles.installCard} aria-labelledby="owner-app-install-title">
          <header className={styles.installHeader}>
            <Image className={styles.installLogo} src="/icon.png" alt="Aim4price App" width={92} height={92} priority />
            <span className={styles.loginEyebrow}>Aim4price App</span>
            <h1 id="owner-app-install-title">Keep your assets in your pocket.</h1>
            <p className={styles.loginIntro}>Install the app to open your assets, maintenance and reports.</p>
          </header>

          <div className={styles.installActions}>
            <button type="button" className={styles.primaryButton} onClick={() => void requestInstall()} disabled={installBusy}>
              {installBusy ? 'Opening installer…' : 'Download Aim4price App'}
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => setInstallOutcome('instructions')}>
              I already have the app
            </button>
          </div>

          {installOutcome !== 'idle' ? (
            <div className={styles.installInstructions} role="status">
              {installOutcome === 'installed'
                ? 'The app is installed. Open Aim4price from your home screen.'
                : installPlatform === 'ios'
                  ? 'In Safari, tap Share and then Add to Home Screen. Open Aim4price from the new icon.'
                  : 'Open the browser menu, choose Install app, and then open Aim4price from your home screen.'}
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="owner-app-login-title">
        <header className={styles.loginHeader}>
          <Image className={styles.loginLogo} src="/icon.png" alt="Aim4price App" width={76} height={76} priority />
          <span className={styles.loginEyebrow}>Aim4price App</span>
          <h1 id="owner-app-login-title">Sign in</h1>
          <p className={styles.loginIntro}>Your assets, values, maintenance and reports in one place.</p>
        </header>

        <form className={styles.loginForm} onSubmit={submit}>
          <label className={styles.field}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              required
            />
          </label>

          <div className={styles.field}>
            <label htmlFor="owner-app-password">Password</label>
            <span className={styles.passwordWrap}>
              <input
                id="owner-app-password"
                type={passwordVisible ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className={styles.passwordToggle} onClick={() => setPasswordVisible((current) => !current)}>
                {passwordVisible ? 'Hide' : 'Show'}
              </button>
            </span>
          </div>

          {notice ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert">{notice}</div> : null}

          <button type="submit" className={styles.primaryButton} disabled={busy}>
            {busy ? 'Opening…' : 'Open Aim4price'}
          </button>
        </form>

        <Link className={styles.loginLink} href="/auth#forgot">Forgot password?</Link>
      </section>
    </main>
  );
}
