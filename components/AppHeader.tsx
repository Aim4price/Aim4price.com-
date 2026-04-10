'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'marketplace';

type AppHeaderProps = {
  active: ActivePage;
  signupHref?: string;
  loginHref?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

const navItems: Array<{ key: ActivePage; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Valuation' },
  { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
];

type SmartLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
};

function SmartLink({ href, className, children }: SmartLinkProps) {
  const isAnchorLike =
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:');

  if (isAnchorLike) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export default function AppHeader({
  active,
  signupHref = '/auth#signup',
  loginHref = '/auth#login',
  ctaHref,
  ctaLabel = 'Create Account',
}: AppHeaderProps) {
  const primaryHref = ctaHref ?? signupHref;
  const router = useRouter();
  const pathname = usePathname();

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        setIsLoadingSession(true);

        const response = await fetch('/api/me', {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = (await response.json()) as SessionResponse;

        if (!mounted) return;
        setIsSignedIn(Boolean(data?.signedIn));
      } catch {
        if (!mounted) return;
        setIsSignedIn(false);
      } finally {
        if (mounted) {
          setIsLoadingSession(false);
        }
      }
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      });

      setIsSignedIn(false);
      router.refresh();
      router.push('/');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Go to Aim4price home">
          <span className={styles.brandTitle}>Aim4price</span>
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.navRail}>
            {navItems.map((item) => {
              const isActive = active === item.key;

              return (
                <Link
                  key={item.key}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className={styles.actions}>
          <div className={styles.actionsRail}>
            {isLoadingSession ? null : isSignedIn ? (
              <button
                type="button"
                className={styles.signupButton}
                onClick={handleSignOut}
                disabled={isSigningOut}
              >
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            ) : (
              <>
                <SmartLink href={loginHref} className={styles.loginButton}>
                  Login
                </SmartLink>

                <span className={styles.actionDivider} aria-hidden="true">
                  |
                </span>

                <SmartLink href={primaryHref} className={styles.signupButton}>
                  {ctaLabel}
                </SmartLink>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
