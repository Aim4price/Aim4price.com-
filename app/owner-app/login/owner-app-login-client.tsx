'use client';

import Image from 'next/image';
import { useEffect, useState, type FormEvent } from 'react';
import AppLoginWelcome from '../../../components/AppLoginWelcome';
import { clearCachedHeaderSession } from '../../../lib/header-session-cache';
import styles from '../../dealer/dealer.module.css';

type InstallView = 'checking' | 'install' | 'login';
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
type StandaloneNavigator = Navigator & { standalone?: boolean };
type LoginWelcome = { displayName: string; companyName: string; logoUrl: string };

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

function isIos() {
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as StandaloneNavigator).standalone === true;
}

export default function OwnerAppLoginClient({ hasAccountSession = false }: { hasAccountSession?: boolean }) {
  const [view, setView] = useState<InstallView>('checking');
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accountSessionActive, setAccountSessionActive] = useState(hasAccountSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [welcome, setWelcome] = useState<LoginWelcome | null>(null);

  useEffect(() => {
    setView(isStandalone() ? 'login' : 'install');
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/owner-app-sw.js', { scope: '/owner-app', updateViaCache: 'none' }).catch(() => undefined);
    }
    function beforeInstall(event: Event) { event.preventDefault(); setPrompt(event as BeforeInstallPromptEvent); setShowInstructions(false); }
    function installed() { setPrompt(null); setShowInstructions(false); setView('login'); }
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  async function requestInstall() {
    if (!prompt) { setShowInstructions(true); return; }
    setInstallBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); setView('login'); }
    catch { setShowInstructions(true); }
    finally { setInstallBusy(false); }
  }

  async function switchToOwnerLogin() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!response.ok) throw new Error('The current Aim4price account could not be signed out. Please try again.');
      clearCachedHeaderSession();
      setAccountSessionActive(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to switch sign in.'); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const cleanUsername = normalizeUsername(username);
    if (cleanUsername.length < 3 || !password) { setError('Enter your Owner App username and passcode.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/owner-app/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const payload = await response.json().catch(() => null) as { ok?: boolean; redirectTo?: string; welcome?: LoginWelcome; error?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Unable to sign in.');
      const redirectTo = payload.redirectTo || '/owner-app';
      setWelcome({
        displayName: payload.welcome?.displayName || cleanUsername,
        companyName: payload.welcome?.companyName || 'Aim4price',
        logoUrl: payload.welcome?.logoUrl || '/icon.png',
      });
      window.setTimeout(() => window.location.replace(redirectTo), 1400);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to sign in.'); setBusy(false); }
  }

  if (welcome) return <main className={styles.loginPage}><AppLoginWelcome {...welcome} /></main>;

  if (view === 'checking') return <main className={styles.loginPage}><section className={styles.installLoadingCard}><span className={styles.loadingSpinner} /><strong>Opening Aim4price Owner…</strong></section></main>;

  if (view === 'install') return (
    <main className={styles.loginPage}>
      <section className={styles.installCard} aria-labelledby="owner-install-title">
        <header className={styles.installHeader}>
          <Image className={styles.installLogo} src="/icon.png" alt="Aim4price Owner" width={92} height={92} priority />
          <span className={styles.loginEyebrow}>Aim4price Owner</span>
          <h1 id="owner-install-title">Do you have the app?</h1>
        </header>
        <div className={styles.installActions}>
          <button type="button" className={styles.installSecondary} onClick={() => setView('login')}>Yes — Continue to login</button>
          <button type="button" className={styles.installPrimary} onClick={() => void requestInstall()} disabled={installBusy}>{installBusy ? 'Opening installer…' : 'No — Download app'}</button>
        </div>
        {showInstructions ? (
          <section className={styles.installInstructions}>
            <p>{isIos() ? 'Tap Share, then Add to Home Screen.' : 'Open the browser menu and select Install app.'}</p>
            <button type="button" className={styles.installContinue} onClick={() => setView('login')}>Continue to login</button>
          </section>
        ) : null}
      </section>
    </main>
  );

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard} aria-labelledby="owner-login-title">
        <header className={styles.loginHeader}>
          <Image className={styles.loginLogo} src="/icon.png" alt="Aim4price Owner" width={76} height={76} priority />
          <span className={styles.loginEyebrow}>Aim4price Owner</span>
          <h1 id="owner-login-title">Sign In</h1>
          <p className={styles.loginIntro}>Use the Owner App username and passcode supplied by the account owner.</p>
        </header>
        {accountSessionActive ? (
          <div className={styles.loginForm}>
            <p className={styles.sessionNotice}>An Aim4price account is already open in this browser. Switch deliberately before entering an Owner App username.</p>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="button" className={styles.primary} onClick={() => void switchToOwnerLogin()} disabled={busy}>{busy ? 'Signing out current account…' : 'Sign out and use Owner App login'}</button>
          </div>
        ) : (
          <form className={styles.loginForm} onSubmit={submit}>
            <div className={styles.field}><label className={styles.fieldLabel} htmlFor="owner-app-username">App username</label><input id="owner-app-username" value={username} onChange={(event) => setUsername(normalizeUsername(event.target.value))} placeholder="kuyler@vasbyt" autoComplete="username" autoCapitalize="none" disabled={busy} required /></div>
            <div className={styles.field}><label className={styles.fieldLabel} htmlFor="owner-app-password">Passcode</label><span className={styles.inputWrap}><input id="owner-app-password" className={styles.passwordInput} type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value.slice(0, 64))} placeholder="Enter passcode" minLength={4} maxLength={64} autoComplete="current-password" disabled={busy} required /><button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((current) => !current)} disabled={busy}>{showPassword ? 'Hide' : 'Show'}</button></span></div>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.primary} disabled={busy}>{busy ? 'Opening Aim4price Owner…' : 'Sign in'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
