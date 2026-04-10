'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

type Mode = 'signup' | 'login';
type NoticeTone = 'success' | 'error' | 'info';

type AuthNotice = {
  tone: NoticeTone;
  title: string;
  text: string;
} | null;

type SignupFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const AUTH_BASE_PATH = '/api/auth';
const POST_LOGIN_REDIRECT = '/asset-register';

const showcaseCards = [
  {
    label: 'Valuation',
    title: 'Save each result',
    text: 'Keep important machinery values linked to your account.',
  },
  {
    label: 'Asset register',
    title: 'Organise records',
    text: 'Manage key equipment without rebuilding lists every time.',
  },
  {
    label: 'Marketplace',
    title: 'Move faster later',
    text: 'Bring saved equipment into future sale workflows more easily.',
  },
] as const;

const initialSignupState: SignupFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
};

const initialLoginState: LoginFormState = {
  email: '',
  password: '',
  rememberMe: true,
};

function getModeFromHash(hash: string): Mode {
  return hash.replace('#', '').toLowerCase() === 'login' ? 'login' : 'signup';
}

function getNestedRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

async function readResponsePayload(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }

  const record = getNestedRecord(payload);

  if (!record) {
    return null;
  }

  const errorRecord = getNestedRecord(record.error);
  const dataRecord = getNestedRecord(record.data);

  const candidates = [
    record.message,
    record.error,
    record.reason,
    errorRecord?.message,
    errorRecord?.error,
    dataRecord?.message,
    dataRecord?.error,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function extractRedirectUrl(payload: unknown): string | null {
  const record = getNestedRecord(payload);

  if (!record) {
    return null;
  }

  const dataRecord = getNestedRecord(record.data);
  const candidates = [
    record.url,
    record.redirectTo,
    record.redirectURL,
    record.location,
    dataRecord?.url,
    dataRecord?.redirectTo,
    dataRecord?.redirectURL,
    dataRecord?.location,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return null;
}

function getCallbackUrl() {
  if (typeof window === 'undefined') {
    return POST_LOGIN_REDIRECT;
  }

  return new URL(POST_LOGIN_REDIRECT, window.location.origin).toString();
}

async function postAuth(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${AUTH_BASE_PATH}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(body),
  });

  const payload = await readResponsePayload(response);

  if (response.status === 404) {
    throw new Error(
      'Authentication backend not connected yet. Mount Better Auth at /api/auth and this page is ready.',
    );
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload) ?? 'Authentication request failed. Please try again.');
  }

  return payload;
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signup');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupForm, setSignupForm] = useState<SignupFormState>(initialSignupState);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginState);
  const [notice, setNotice] = useState<AuthNotice>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const syncModeFromHash = () => {
      setMode(getModeFromHash(window.location.hash));
      setNotice(null);
    };

    syncModeFromHash();
    window.addEventListener('hashchange', syncModeFromHash);

    return () => window.removeEventListener('hashchange', syncModeFromHash);
  }, []);

  const copy = useMemo(
    () =>
      mode === 'signup'
        ? {
            title: 'Create your Aim4price account',
            text: 'Save valuations, organise your asset register, and keep your machinery workflow in one place.',
            action: 'Create account',
            footer: 'Already have an account?',
            footerAction: 'Log in',
          }
        : {
            title: 'Log in to your account',
            text: 'Open your saved valuations and machinery records with secure email access.',
            action: 'Log in',
            footer: 'Need an account?',
            footerAction: 'Create one',
          },
    [mode],
  );

  const updateHashAndMode = (nextMode: Mode) => {
    if (isSubmitting) {
      return;
    }

    setMode(nextMode);
    setNotice(null);

    if (typeof window !== 'undefined') {
      const nextHash = `#${nextMode}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }
  };

  const handleSignupSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const name = signupForm.name.trim();
    const email = signupForm.email.trim();

    if (!name || !email || !signupForm.password || !signupForm.confirmPassword) {
      setNotice({
        tone: 'error',
        title: 'Missing information',
        text: 'Complete all required fields before creating your account.',
      });
      return;
    }

    if (signupForm.password.length < 8) {
      setNotice({
        tone: 'error',
        title: 'Password too short',
        text: 'Use at least 8 characters before continuing.',
      });
      return;
    }

    if (signupForm.password !== signupForm.confirmPassword) {
      setNotice({
        tone: 'error',
        title: 'Passwords do not match',
        text: 'Confirm the same password in both password fields.',
      });
      return;
    }

    if (!signupForm.acceptTerms) {
      setNotice({
        tone: 'error',
        title: 'Terms required',
        text: 'Accept the terms and privacy policy before continuing.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await postAuth('/sign-up/email', {
        name,
        email,
        password: signupForm.password,
        callbackURL: getCallbackUrl(),
      });

      const redirectUrl = extractRedirectUrl(payload);

      setSignupForm(initialSignupState);
      setNotice({
        tone: 'success',
        title: 'Account created',
        text: 'Your sign-up request was accepted. If email verification is enabled, finish that step from your inbox before continuing.',
      });

      if (redirectUrl && typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 350);
        return;
      }

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          updateHashAndMode('login');
        }, 900);
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Unable to create account',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    const email = loginForm.email.trim();

    if (!email || !loginForm.password) {
      setNotice({
        tone: 'error',
        title: 'Missing information',
        text: 'Enter both your email and password before logging in.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = await postAuth('/sign-in/email', {
        email,
        password: loginForm.password,
        rememberMe: loginForm.rememberMe,
        callbackURL: getCallbackUrl(),
      });

      const redirectUrl = extractRedirectUrl(payload) ?? POST_LOGIN_REDIRECT;

      setNotice({
        tone: 'success',
        title: 'Login successful',
        text: 'Redirecting to your account area.',
      });

      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          window.location.assign(redirectUrl);
        }, 250);
      }
    } catch (error) {
      setNotice({
        tone: 'error',
        title: 'Unable to log in',
        text: error instanceof Error ? error.message : 'Something went wrong. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.brand} aria-label="Go to Aim4price home">
            <Image
              src="/brand/aim4price-mark-black.png"
              alt="Aim4price"
              width={56}
              height={46}
              className={styles.brandMark}
              priority
            />

            <span className={styles.brandCopy}>
              <span className={styles.brandTitle}>Aim4price</span>
              <span className={styles.brandSubtext}>Agricultural &amp; industrial machinery pricing</span>
            </span>
          </Link>

          <Link href="/" className={styles.homeLink}>
            Back to home
          </Link>
        </div>

        <section className={styles.frame}>
          <aside className={styles.showcase}>
            <div className={styles.showcaseHeader}>
              <span className={styles.eyebrow}>Secure account access</span>
              <h2 className={styles.showcaseTitle}>A cleaner place to manage machinery decisions.</h2>
              <p className={styles.showcaseText}>
                Create an account to keep valuations, asset records, and future sale activity tied to one clean workflow.
              </p>
            </div>

            <div className={styles.visualPanel}>
              <div className={styles.visualBadge}>One clear platform</div>

              <Image
                src="/brand/Home-page.png"
                alt="Aim4price machinery platform preview"
                fill
                priority
                sizes="(max-width: 1080px) 100vw, 48vw"
                className={styles.visualImage}
              />

              <div className={styles.visualShade} aria-hidden="true" />
            </div>

            <div className={styles.signalGrid}>
              {showcaseCards.map((card) => (
                <article key={card.label} className={styles.signalCard}>
                  <span className={styles.signalLabel}>{card.label}</span>
                  <strong className={styles.signalTitle}>{card.title}</strong>
                  <span className={styles.signalText}>{card.text}</span>
                </article>
              ))}
            </div>
          </aside>

          <section className={styles.authCard} aria-labelledby="auth-heading" aria-busy={isSubmitting}>
            <div className={styles.modeRail} aria-label="Authentication mode">
              <button
                type="button"
                onClick={() => updateHashAndMode('signup')}
                className={`${styles.modeButton} ${mode === 'signup' ? styles.modeButtonActive : ''}`}
                aria-pressed={mode === 'signup'}
              >
                Sign up
              </button>

              <button
                type="button"
                onClick={() => updateHashAndMode('login')}
                className={`${styles.modeButton} ${mode === 'login' ? styles.modeButtonActive : ''}`}
                aria-pressed={mode === 'login'}
              >
                Login
              </button>
            </div>

            <div className={styles.authHeader}>
              <p className={styles.authEyebrow}>Email &amp; password access</p>
              <h1 id="auth-heading" className={styles.authTitle}>
                {copy.title}
              </h1>
              <p className={styles.authText}>{copy.text}</p>
            </div>

            {notice ? (
              <div
                className={`${styles.notice} ${
                  notice.tone === 'success'
                    ? styles.noticeSuccess
                    : notice.tone === 'info'
                      ? styles.noticeInfo
                      : styles.noticeError
                }`}
                role={notice.tone === 'error' ? 'alert' : 'status'}
                aria-live="polite"
              >
                <strong className={styles.noticeTitle}>{notice.title}</strong>
                <span className={styles.noticeText}>{notice.text}</span>
              </div>
            ) : null}

            {mode === 'signup' ? (
              <form className={styles.form} onSubmit={handleSignupSubmit} noValidate>
                <label className={styles.field}>
                  <span className={styles.label}>Full name</span>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Kuyler Geldenhuys"
                    className={styles.input}
                    value={signupForm.name}
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    className={styles.input}
                    value={signupForm.email}
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <div className={styles.labelRow}>
                    <span className={styles.label}>Password</span>
                    <span className={styles.helperText}>Minimum 8 characters</span>
                  </div>

                  <div className={styles.passwordWrap}>
                    <input
                      type={showSignupPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="Create a secure password"
                      className={`${styles.input} ${styles.passwordInput}`}
                      value={signupForm.password}
                      onChange={(event) =>
                        setSignupForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />

                    <button
                      type="button"
                      onClick={() => setShowSignupPassword((current) => !current)}
                      className={styles.passwordToggle}
                      aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                    >
                      {showSignupPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Confirm password</span>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    autoComplete="new-password"
                    minLength={8}
                    placeholder="Repeat your password"
                    className={styles.input}
                    value={signupForm.confirmPassword}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        confirmPassword: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={signupForm.acceptTerms}
                    onChange={(event) =>
                      setSignupForm((current) => ({
                        ...current,
                        acceptTerms: event.target.checked,
                      }))
                    }
                  />
                  <span>I agree to the terms and privacy policy.</span>
                </label>

                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? 'Creating account...' : copy.action}
                </button>
              </form>
            ) : (
              <form className={styles.form} onSubmit={handleLoginSubmit} noValidate>
                <label className={styles.field}>
                  <span className={styles.label}>Email address</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder="name@example.com"
                    className={styles.input}
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({ ...current, email: event.target.value }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Password</span>

                  <div className={styles.passwordWrap}>
                    <input
                      type={showLoginPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className={`${styles.input} ${styles.passwordInput}`}
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({ ...current, password: event.target.value }))
                      }
                    />

                    <button
                      type="button"
                      onClick={() => setShowLoginPassword((current) => !current)}
                      className={styles.passwordToggle}
                      aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                    >
                      {showLoginPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </label>

                <label className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={loginForm.rememberMe}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        rememberMe: event.target.checked,
                      }))
                    }
                  />
                  <span>Keep me signed in on this device.</span>
                </label>

                <button type="submit" className={styles.primaryButton} disabled={isSubmitting}>
                  {isSubmitting ? 'Logging in...' : copy.action}
                </button>
              </form>
            )}

            <p className={styles.footerText}>
              {copy.footer}{' '}
              <button
                type="button"
                className={styles.footerButton}
                onClick={() => updateHashAndMode(mode === 'signup' ? 'login' : 'signup')}
              >
                {copy.footerAction}
              </button>
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
