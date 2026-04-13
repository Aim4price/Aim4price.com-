'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'marketplace' | 'none';

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

type SmartLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
};

const navItems: Array<{ key: ActivePage; href: string; label: string }> = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Valuation' },
  { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
];

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

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'A';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function clearLegacyPrototypeStorage() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('aim4price-tractors-kit-register');
  window.localStorage.removeItem('aim4price-tractors-kit-marketplace');
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
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [session, setSession] = useState<SessionResponse['user']>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
        setSession(data?.signedIn ? data.user : null);
      } catch {
        if (!mounted) return;
        setSession(null);
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

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const accountName = useMemo(() => session?.name?.trim() || 'Aim4price User', [session]);
  const accountInitials = useMemo(() => getInitials(accountName), [accountName]);

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
    } finally {
      clearLegacyPrototypeStorage();
      setSession(null);
      setMenuOpen(false);
      setIsSigningOut(false);
      router.refresh();
      window.location.href = '/';
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
            {isLoadingSession ? null : session ? (
              <div className={styles.accountMenu} ref={menuRef}>
                <button
                  type="button"
                  className={styles.accountButton}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  <span className={styles.accountAvatar} aria-hidden="true">
                    {accountInitials}
                  </span>
                  <span className={styles.accountButtonText}>Account</span>
                </button>

                {menuOpen ? (
                  <div className={styles.accountPopover} role="menu">
                    <div className={styles.accountSummary}>
                      <div className={styles.accountAvatarLarge}>{accountInitials}</div>
                      <div>
                        <strong className={styles.accountName}>{accountName}</strong>
                        <p className={styles.accountEmail}>{session.email}</p>
                      </div>
                    </div>
                    <Link href="/account" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                      Account details
                    </Link>

                    <button
                      type="button"
                      className={styles.menuDangerButton}
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                ) : null}
              </div>
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
