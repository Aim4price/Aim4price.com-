'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './page.module.css';

type Mode = 'signup' | 'login';

type SignupFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

type LoginFormState = {
  email: string;
  password: string;
  rememberMe: boolean;
};

const initialSignupState: SignupFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  termsAccepted: false,
};

const initialLoginState: LoginFormState = {
  email: '',
  password: '',
  rememberMe: true,
};

function getModeFromHash(hash: string): Mode {
  return hash.replace('#', '').toLowerCase() === 'login' ? 'login' : 'signup';
}

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signup');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [signupForm, setSignupForm] = useState<SignupFormState>(initialSignupState);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginState);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
            title: 'Create your account',
            text: 'Save valuations, manage records, and access member-only marketplace features.',
            action: 'Create account',
            footer: 'Already have an account?',
            footerCta: 'Log in',
          }
        : {
            title: 'Welcome back',
            text: 'Log in to open your saved machinery records, valuations, and listings.',
            action: 'Log in',
            footer: 'New to Aim4price?',
            footerCta: 'Create account',
          },
    [mode],
  );

  const updateHashAndMode = (nextMode: Mode) => {
    setMode(nextMode);
    setNotice(null);

    if (typeof window !== 'undefined') {
      const nextHash = `#${nextMode}`;
      if (window.location.hash !== nextHash) {
        window.history.replaceState(null, '', nextHash);
      }
    }
  };

  const handleSignupSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!signupForm.firstName || !signupForm.lastName || !signupForm.email || !signupForm.password) {
      setNotice({ type: 'error', text: 'Complete all required fields before continuing.' });
      return;
    }

    if (!signupForm.termsAccepted) {
      setNotice({ type: 'error', text: 'Accept the terms before creating an account.' });
      return;
    }

    setNotice({
      type: 'success',
      text: 'UI complete. Next step is connecting Better Auth and PostgreSQL.',
    });
  };

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginForm.email || !loginForm.password) {
      setNotice({ type: 'error', text: 'Enter both email and password before logging in.' });
      return;
    }

    setNotice({
      type: 'success',
      text: 'UI complete. Next step is connecting Better Auth and PostgreSQL.',
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topRow}>
          <Link href="/" className={styles.homeLink}>
            Back to home
          </Link>
        </div>

        <section className={styles.card} aria-labelledby="auth-heading">
          <Link href="/" className={styles.brand} aria-label="Go to Aim4price home">
            <Image
              src="/brand/aim4price-mark-black.png"
              alt="Aim4price"
              width={42}
              height={34}
              className={styles.brandMark}
              priority
            />
            <div className={styles.brandTextWrap}>
              <span className={styles.brandText}>Aim4price</span>
              <span className={styles.brandSubtext}>Agricultural & Industrial Machinery</span>
            </div>
          </Link>

          <div className={styles.switcher} aria-label="Auth mode switcher">
            <button
              type="button"
              onClick={() => updateHashAndMode('signup')}
              className={`${styles.switchButton} ${mode === 'signup' ? styles.switchButtonActive : ''}`}
            >
              Sign up
            </button>
            <button
              type="button"
              onClick={() => updateHashAndMode('login')}
              className={`${styles.switchButton} ${mode === 'login' ? styles.switchButtonActive : ''}`}
            >
              Login
            </button>
          </div>

          <div className={styles.header}>
            <h1 id="auth-heading" className={styles.title}>
              {copy.title}
            </h1>
            <p className={styles.text}>{copy.text}</p>
          </div>

          <button type="button" className={styles.googleButton}>
            <span className={styles.googleMark} aria-hidden="true">
              G
            </span>
            Continue with Google
          </button>

          <div className={styles.divider}>
            <span>or continue with email</span>
          </div>

          {notice ? (
            <div
              className={`${styles.notice} ${
                notice.type === 'success' ? styles.noticeSuccess : styles.noticeError
              }`}
            >
              {notice.text}
            </div>
          ) : null}

          {mode === 'signup' ? (
            <form className={styles.form} onSubmit={handleSignupSubmit} noValidate>
              <div className={styles.nameRow}>
                <label className={styles.field}>
                  <span className={styles.label}>First name</span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    placeholder="Kuyler"
                    className={styles.input}
                    value={signupForm.firstName}
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, firstName: event.target.value }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span className={styles.label}>Last name</span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    placeholder="Geldenhuys"
                    className={styles.input}
                    value={signupForm.lastName}
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, lastName: event.target.value }))
                    }
                  />
                </label>
              </div>

              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  className={styles.input}
                  value={signupForm.email}
                  onChange={(event) =>
                    setSignupForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>

              <label className={styles.field}>
                <span className={styles.label}>Password</span>
                <div className={styles.passwordWrap}>
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    autoComplete="new-password"
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

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={signupForm.termsAccepted}
                  onChange={(event) =>
                    setSignupForm((current) => ({
                      ...current,
                      termsAccepted: event.target.checked,
                    }))
                  }
                />
                <span>
                  I agree to the{' '}
                  <a href="#" className={styles.inlineLink}>
                    Terms
                  </a>{' '}
                  and{' '}
                  <a href="#" className={styles.inlineLink}>
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <button type="submit" className={styles.primaryButton}>
                {copy.action}
              </button>
            </form>
          ) : (
            <form className={styles.form} onSubmit={handleLoginSubmit} noValidate>
              <label className={styles.field}>
                <span className={styles.label}>Email</span>
                <input
                  type="email"
                  autoComplete="email"
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

              <div className={styles.metaRow}>
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
                  <span>Remember me</span>
                </label>

                <a href="#" className={styles.inlineLink}>
                  Forgot password?
                </a>
              </div>

              <button type="submit" className={styles.primaryButton}>
                {copy.action}
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
              {copy.footerCta}
            </button>
          </p>
        </section>
      </div>
    </main>
  );
}
