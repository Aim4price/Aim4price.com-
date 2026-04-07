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
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const syncModeFromHash = () => {
      setMode(getModeFromHash(window.location.hash));
      setNotice(null);
    };

    syncModeFromHash();
    window.addEventListener('hashchange', syncModeFromHash);

    return () => {
      window.removeEventListener('hashchange', syncModeFromHash);
    };
  }, []);

  const heading = useMemo(
    () =>
      mode === 'signup'
        ? {
            kicker: 'Create your account',
            title: 'Join Aim4price.',
            text: 'Save valuations, build your asset register, and unlock member-only marketplace contact details.',
          }
        : {
            kicker: 'Welcome back',
            title: 'Log in to Aim4price.',
            text: 'Pick up your saved valuations, asset register, and marketplace activity from one secure account.',
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
      setNotice({
        type: 'error',
        text: 'Complete all required fields before continuing.',
      });
      return;
    }

    if (!signupForm.termsAccepted) {
      setNotice({
        type: 'error',
        text: 'Accept the terms before creating an account.',
      });
      return;
    }

    setNotice({
      type: 'success',
      text: 'Design stage only. This screen is ready for Better Auth + PostgreSQL wiring next.',
    });
  };

  const handleLoginSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!loginForm.email || !loginForm.password) {
      setNotice({
        type: 'error',
        text: 'Enter both email and password before logging in.',
      });
      return;
    }

    setNotice({
      type: 'success',
      text: 'Design stage only. This login form is ready for Better Auth + PostgreSQL wiring next.',
    });
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topBar}>
          <Link href="/" className={styles.brandLink} aria-label="Go to Aim4price home">
            <Image
              src="/brand/aim4price-mark-black.png"
              alt="Aim4price"
              width={40}
              height={32}
              className={styles.brandMark}
              priority
            />

            <span className={styles.brandTextWrap}>
              <span className={styles.brandText}>Aim4price</span>
              <span className={styles.brandSubtext}>Value, register, market</span>
            </span>
          </Link>

          <div className={styles.topActions}>
            <Link href="/valuation" className={styles.topGhostButton}>
              Start Free Valuation
            </Link>
            <Link href="/marketplace" className={styles.topGhostButton}>
              Browse Marketplace
            </Link>
          </div>
        </div>

        <section className={styles.panel}>
          <div className={styles.intro}>
            <div className={styles.introInner}>
              <div>
                <span className={styles.badge}>Member account access</span>
                <h1 className={styles.title}>Value. Save. Move faster.</h1>
                <p className={styles.text}>
                  Aim4price accounts are built for farmers, dealers, brokers, and machinery buyers
                  who need one clean place to manage values, asset records, and next actions.
                </p>
              </div>

              <div className={styles.featureGrid}>
                <div className={styles.feature}>
                  <span className={styles.featureLabel}>Saved valuations</span>
                  <span className={styles.featureValue}>1 place</span>
                  <p className={styles.featureText}>
                    Keep valuation history tied to the right machine and refresh it when needed.
                  </p>
                </div>

                <div className={styles.feature}>
                  <span className={styles.featureLabel}>Asset register</span>
                  <span className={styles.featureValue}>Live records</span>
                  <p className={styles.featureText}>
                    Build an equipment register ready for internal review, insurance, or finance.
                  </p>
                </div>

                <div className={styles.feature}>
                  <span className={styles.featureLabel}>Marketplace access</span>
                  <span className={styles.featureValue}>Member unlock</span>
                  <p className={styles.featureText}>
                    Signed-in members can access seller contact details and manage listings faster.
                  </p>
                </div>

                <div className={styles.feature}>
                  <span className={styles.featureLabel}>Built to scale</span>
                  <span className={styles.featureValue}>Farmer to institution</span>
                  <p className={styles.featureText}>
                    Clean account structure now, with room for dealer, broker, and admin roles later.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardInner}>
              <div className={styles.switcher} aria-label="Auth mode switcher">
                <button
                  type="button"
                  onClick={() => updateHashAndMode('signup')}
                  className={`${styles.switchButton} ${
                    mode === 'signup' ? styles.switchButtonActive : ''
                  }`}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => updateHashAndMode('login')}
                  className={`${styles.switchButton} ${
                    mode === 'login' ? styles.switchButtonActive : ''
                  }`}
                >
                  Login
                </button>
              </div>

              <div className={styles.header}>
                <span className={styles.kicker}>{heading.kicker}</span>
                <h2 className={styles.heading}>{heading.title}</h2>
                <p className={styles.subheading}>{heading.text}</p>
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
                        className={styles.input}
                        type="text"
                        placeholder="Kuyler"
                        value={signupForm.firstName}
                        onChange={(event) =>
                          setSignupForm((current) => ({
                            ...current,
                            firstName: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <label className={styles.field}>
                      <span className={styles.label}>Last name</span>
                      <input
                        className={styles.input}
                        type="text"
                        placeholder="Geldenhuys"
                        value={signupForm.lastName}
                        onChange={(event) =>
                          setSignupForm((current) => ({
                            ...current,
                            lastName: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>

                  <label className={styles.field}>
                    <span className={styles.label}>Email address</span>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="name@example.com"
                      value={signupForm.email}
                      onChange={(event) =>
                        setSignupForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Password</span>
                    <div className={styles.passwordWrap}>
                      <input
                        className={`${styles.input} ${styles.passwordInput}`}
                        type={showSignupPassword ? 'text' : 'password'}
                        placeholder="Create a strong password"
                        value={signupForm.password}
                        onChange={(event) =>
                          setSignupForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowSignupPassword((current) => !current)}
                        aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                      >
                        {showSignupPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <span className={styles.hint}>
                      Use 8+ characters. Email verification and password reset can be wired next.
                    </span>
                  </label>

                  <div className={styles.metaRow}>
                    <label className={styles.checkboxRow}>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={signupForm.termsAccepted}
                        onChange={(event) =>
                          setSignupForm((current) => ({
                            ...current,
                            termsAccepted: event.target.checked,
                          }))
                        }
                      />
                      <span>
                        I agree to the <a href="#" className={styles.inlineLink}>terms</a> and{' '}
                        <a href="#" className={styles.inlineLink}>privacy policy</a>.
                      </span>
                    </label>
                  </div>

                  <div className={styles.actionsRow}>
                    <button type="submit" className={styles.submitButton}>
                      Create account
                    </button>
                  </div>

                  <div className={styles.divider}>
                    <span>Future provider options</span>
                  </div>

                  <div className={styles.actionsRow}>
                    <button type="button" className={styles.socialButton}>
                      Continue with Google
                    </button>
                  </div>
                </form>
              ) : (
                <form className={styles.form} onSubmit={handleLoginSubmit} noValidate>
                  <label className={styles.field}>
                    <span className={styles.label}>Email address</span>
                    <input
                      className={styles.input}
                      type="email"
                      placeholder="name@example.com"
                      value={loginForm.email}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label className={styles.field}>
                    <span className={styles.label}>Password</span>
                    <div className={styles.passwordWrap}>
                      <input
                        className={`${styles.input} ${styles.passwordInput}`}
                        type={showLoginPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        value={loginForm.password}
                        onChange={(event) =>
                          setLoginForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowLoginPassword((current) => !current)}
                        aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                      >
                        {showLoginPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </label>

                  <div className={styles.metaRow}>
                    <label className={styles.checkboxRow}>
                      <input
                        className={styles.checkbox}
                        type="checkbox"
                        checked={loginForm.rememberMe}
                        onChange={(event) =>
                          setLoginForm((current) => ({
                            ...current,
                            rememberMe: event.target.checked,
                          }))
                        }
                      />
                      <span>Keep me signed in on this device</span>
                    </label>

                    <a href="#" className={styles.forgotLink}>
                      Forgot password?
                    </a>
                  </div>

                  <div className={styles.actionsRow}>
                    <button type="submit" className={styles.submitButton}>
                      Login
                    </button>
                  </div>

                  <div className={styles.divider}>
                    <span>Future provider options</span>
                  </div>

                  <div className={styles.actionsRow}>
                    <button type="button" className={styles.socialButton}>
                      Continue with Google
                    </button>
                  </div>
                </form>
              )}

              <div className={styles.trustGrid}>
                <div className={styles.trustItem}>
                  <span className={styles.trustLabel}>Account purpose</span>
                  <span className={styles.trustValue}>Valuation + register</span>
                  <p className={styles.trustText}>
                    Built for secure member access around saved machinery records.
                  </p>
                </div>

                <div className={styles.trustItem}>
                  <span className={styles.trustLabel}>Next auth step</span>
                  <span className={styles.trustValue}>Better Auth</span>
                  <p className={styles.trustText}>
                    This UI is designed to connect cleanly to PostgreSQL on Railway.
                  </p>
                </div>

                <div className={styles.trustItem}>
                  <span className={styles.trustLabel}>Future roles</span>
                  <span className={styles.trustValue}>User / dealer / broker</span>
                  <p className={styles.trustText}>
                    Ready for role-aware permissions once the backend is connected.
                  </p>
                </div>
              </div>

              <div className={styles.footer}>
                <p className={styles.footerText}>
                  {mode === 'signup' ? 'Already have an account?' : 'Need a new account?'}{' '}
                  <button
                    type="button"
                    className={styles.footerTextButton}
                    onClick={() => updateHashAndMode(mode === 'signup' ? 'login' : 'signup')}
                  >
                    {mode === 'signup' ? 'Log in here' : 'Create one here'}
                  </button>
                  .
                </p>
                <p className={styles.footerText}>
                  This page is intentionally front-end only so you can approve the look and feel
                  before we connect Better Auth, sessions, and PostgreSQL.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
