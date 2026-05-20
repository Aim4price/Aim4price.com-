'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode, type SVGProps } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { isGlobalLoadingDisabledPath, setGlobalLoading } from '../lib/global-loading';
import styles from './AppHeader.module.css';

type ActivePage = 'home' | 'valuation' | 'asset-register' | 'leads' | 'marketplace' | 'none';

type AppHeaderProps = {
  active: ActivePage;
  signupHref?: string;
  loginHref?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

type AccountType = 'owner' | 'dealer' | 'finance' | 'insurance';

type IconName =
  | 'home'
  | 'estimate'
  | 'assetRegister'
  | 'leads'
  | 'marketplace'
  | 'account'
  | 'assetMap'
  | 'fuel'
  | 'login'
  | 'signup'
  | 'logout';

type NavItem = {
  key: ActivePage;
  href: string;
  label: string;
  icon: IconName;
};

type SidebarUtilityItem = {
  href: string;
  label: string;
  icon: IconName;
  isActive: boolean;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    accountType: AccountType;
  } | null;
};

type SmartLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
};

type IconProps = SVGProps<SVGSVGElement>;

const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'home', href: '/', label: 'Home', icon: 'home' },
  { key: 'valuation', href: '/valuation', label: 'Estimate', icon: 'estimate' },
];

function buildNavItems(accountType: AccountType | null): NavItem[] {
  const resolvedType = accountType ?? 'owner';

  if (resolvedType === 'finance' || resolvedType === 'insurance') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'Leads', icon: 'leads' },
    ];
  }

  if (resolvedType === 'dealer') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'Leads', icon: 'leads' },
      { key: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: 'marketplace' },
    ];
  }

  return [
    ...BASE_NAV_ITEMS,
    { key: 'asset-register', href: '/asset-register', label: 'Asset Register', icon: 'assetRegister' },
    { key: 'marketplace', href: '/marketplace', label: 'Marketplace', icon: 'marketplace' },
  ];
}

function SmartLink({ href, className, children, title, ariaLabel, onClick }: SmartLinkProps) {
  const isAnchorLike =
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:');

  if (isAnchorLike) {
    return (
      <a href={href} className={className} title={title} aria-label={ariaLabel} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} title={title} aria-label={ariaLabel} onClick={onClick}>
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

function getAccountTypeLabel(accountType: AccountType): string {
  if (accountType === 'finance') return 'Finance';
  if (accountType === 'insurance') return 'Insurance';
  if (accountType === 'dealer') return 'Dealer';
  return 'Owner';
}

function clearLegacyPrototypeStorage() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('aim4price-tractors-kit-register');
  window.localStorage.removeItem('aim4price-tractors-kit-marketplace');
}

function isHrefActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function IconHome(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M3.75 10.9 12 4.2l8.25 6.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.7 9.65V20h12.6V9.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.35 20v-6.1h5.3V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconEstimate(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M16.7 6.8c-.9-.9-2.25-1.42-3.85-1.42-2.35 0-4.05 1.15-4.05 2.95 0 1.7 1.25 2.48 3.35 2.95l1.38.3c2.04.45 3.38 1.25 3.38 3.1 0 1.95-1.82 3.15-4.38 3.15-1.93 0-3.62-.64-4.72-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconAssetRegister(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M8.4 4.3h7.2l2.5 2.6v12.8H5.9V6.9l2.5-2.6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.4 4.3v4h7.2v-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.8 12h6.4M8.8 15.2h6.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconLeads(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4.2 6.6h15.6v10.8H4.2V6.6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4.7 7.2 7.3 5.7 7.3-5.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.1 18.8h9.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMarketplace(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M4 7.8h10.6l2.4 4.3h2.2c.96 0 1.75.78 1.75 1.75v3.05h-2.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7.8v9.1h2.15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.2 16.9h4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.15 19.25a2.15 2.15 0 1 0 0-4.3 2.15 2.15 0 0 0 0 4.3ZM17 19.25a2.15 2.15 0 1 0 0-4.3 2.15 2.15 0 0 0 0 4.3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M14.65 7.8V5.4H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAccount(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 12.1a3.95 3.95 0 1 0 0-7.9 3.95 3.95 0 0 0 0 7.9Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4.8 20.05c.7-3.55 3.34-5.55 7.2-5.55s6.5 2 7.2 5.55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconAssetMap(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 21s6.1-5.15 6.1-10.7A6.1 6.1 0 1 0 5.9 10.3C5.9 15.85 12 21 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 12.5a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function IconFuel(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M7.2 20V5.4c0-.78.62-1.4 1.4-1.4h5.2c.78 0 1.4.62 1.4 1.4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.2 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15.2 7.1h1.3l2.4 2.35v7.65c0 1.25.78 2.1 1.8 2.1s1.8-.85 1.8-2.1v-3.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 20h11.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconLogin(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M10.2 7.2 15 12l-4.8 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 12H3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M12.6 4.6h4.6c1.65 0 3 1.35 3 3v8.8c0 1.65-1.35 3-3 3h-4.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSignup(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M11 12.1a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M4.2 19.4c.62-3.15 3-4.95 6.8-4.95 1.05 0 2 .14 2.83.42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M18.2 13.8v5.4M15.5 16.5h5.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconLogout(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M9.8 19.4H6.9c-1.6 0-2.9-1.3-2.9-2.9v-9c0-1.6 1.3-2.9 2.9-2.9h2.9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="m15.2 7.2 4.8 4.8-4.8 4.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12H9.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function NavigationIcon({ name, className }: { name: IconName; className: string }) {
  if (name === 'home') return <IconHome className={className} />;
  if (name === 'estimate') return <IconEstimate className={className} />;
  if (name === 'assetRegister') return <IconAssetRegister className={className} />;
  if (name === 'leads') return <IconLeads className={className} />;
  if (name === 'marketplace') return <IconMarketplace className={className} />;
  if (name === 'assetMap') return <IconAssetMap className={className} />;
  if (name === 'fuel') return <IconFuel className={className} />;
  if (name === 'login') return <IconLogin className={className} />;
  if (name === 'signup') return <IconSignup className={className} />;
  if (name === 'logout') return <IconLogout className={className} />;
  return <IconAccount className={className} />;
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
  const hasLoadedSessionOnceRef = useRef(false);

  const [session, setSession] = useState<SessionResponse['user']>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add('aim4price-has-app-shell');

    return () => {
      document.body.classList.remove('aim4price-has-app-shell');
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const isInitialSessionLoad = !hasLoadedSessionOnceRef.current;

      try {
        if (isInitialSessionLoad) {
          setIsLoadingSession(true);
        }

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
          hasLoadedSessionOnceRef.current = true;
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
    const shouldShowAccountLoader =
      !isGlobalLoadingDisabledPath(pathname) &&
      (isSigningOut || (isLoadingSession && !hasLoadedSessionOnceRef.current));

    setGlobalLoading(shouldShowAccountLoader, 'account-session');

    return () => {
      setGlobalLoading(false, 'account-session');
    };
  }, [isLoadingSession, isSigningOut, pathname]);

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
  const accountType = session?.accountType ?? 'owner';
  const accountTypeLabel = useMemo(() => getAccountTypeLabel(accountType), [accountType]);
  const isOwnerAccount = accountType === 'owner';
  const navItems = useMemo(() => buildNavItems(session?.accountType ?? null), [session?.accountType]);
  const utilityItems = useMemo<SidebarUtilityItem[]>(() => {
    if (!isOwnerAccount) return [];

    return [
      {
        href: '/asset-map',
        label: 'Asset Map',
        icon: 'assetMap',
        isActive: isHrefActive('/asset-map', pathname),
      },
      {
        href: '/fuel',
        label: 'Fuel Ledger',
        icon: 'fuel',
        isActive: isHrefActive('/fuel', pathname),
      },
    ];
  }, [isOwnerAccount, pathname]);

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

  function renderIconNavLink(item: NavItem) {
    const isActive = active === item.key || (active === 'none' && isHrefActive(item.href, pathname));

    return (
      <Link
        key={`${item.key}-${item.href}`}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={item.label}
        title={item.label}
        className={`${styles.iconNavLink} ${isActive ? styles.iconNavLinkActive : ''}`}
      >
        <NavigationIcon name={item.icon} className={styles.iconNavSvg} />
        <span className={styles.iconNavMobileLabel}>{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      <header className={styles.header} data-aim4price-app-shell="true">
        <div className={styles.inner}>
          <div className={styles.headerLeft}>
            <Link href="/" className={styles.markLink} aria-label="Go to Aim4price home" title="Aim4price home">
              <Image
                src="/brand/aim4price-mark-black.png"
                alt=""
                width={160}
                height={160}
                className={styles.markLogo}
                priority
              />
            </Link>
          </div>

          <nav className={styles.iconNav} aria-label="Primary navigation">
            <div className={styles.iconNavRail}>{navItems.map((item) => renderIconNavLink(item))}</div>
          </nav>

          <div className={styles.headerActions}>
            {isLoadingSession ? (
              <span className={styles.headerSkeleton} aria-label="Loading account" />
            ) : session ? (
              <div className={styles.accountMenu} ref={menuRef}>
                <button
                  type="button"
                  className={styles.accountButton}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  title="Account"
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
                      <div className={styles.accountSummaryText}>
                        <strong className={styles.accountName}>{accountName}</strong>
                        <span className={styles.accountType}>{accountTypeLabel}</span>
                      </div>
                    </div>

                    <Link href="/account" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                      <NavigationIcon name="account" className={styles.menuIcon} />
                      Account details
                    </Link>
                    {isOwnerAccount ? (
                      <>
                        <Link href="/asset-map" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                          <NavigationIcon name="assetMap" className={styles.menuIcon} />
                          Asset map
                        </Link>

                        <Link href="/fuel" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                          <NavigationIcon name="fuel" className={styles.menuIcon} />
                          Fuel ledger
                        </Link>
                      </>
                    ) : null}

                    <button
                      type="button"
                      className={styles.menuDangerButton}
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                    >
                      <NavigationIcon name="logout" className={styles.menuIcon} />
                      {isSigningOut ? 'Signing out...' : 'Sign out'}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.authActions}>
                <SmartLink href={loginHref} className={styles.authButton} title="Login" ariaLabel="Login">
                  <NavigationIcon name="login" className={styles.authIcon} />
                  <span className={styles.authButtonText}>Login</span>
                </SmartLink>

                <SmartLink href={primaryHref} className={`${styles.authButton} ${styles.authButtonPrimary}`} title={ctaLabel} ariaLabel={ctaLabel}>
                  <NavigationIcon name="signup" className={styles.authIcon} />
                  <span className={styles.authButtonText}>{ctaLabel}</span>
                </SmartLink>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className={styles.desktopSidebar} data-aim4price-desktop-sidebar="true" aria-label="Desktop navigation">
        <div className={styles.sidebarInner}>
          <Link href="/" className={styles.sidebarBrand} aria-label="Go to Aim4price home">
            <Image
              src="/brand/Aim4price_Home_Logo.png"
              alt="Aim4price"
              width={900}
              height={240}
              className={styles.sidebarBrandLogo}
              priority
            />
          </Link>

          {isLoadingSession ? (
            <div className={styles.sidebarAccountSkeleton} aria-label="Loading account" />
          ) : session ? (
            <div className={styles.sidebarAccountCard}>
              <span className={styles.sidebarAvatar} aria-hidden="true">
                {accountInitials}
              </span>
              <div className={styles.sidebarAccountText}>
                <strong>{accountName}</strong>
                <span>{accountTypeLabel}</span>
              </div>
            </div>
          ) : (
            <div className={styles.sidebarGuestCard}>
              <strong>Aim4price</strong>
              <span>Login or create an account to manage machinery values.</span>
            </div>
          )}

          <nav className={styles.sidebarNav} aria-label="Main navigation">
            <span className={styles.sidebarSectionLabel}>Navigation</span>
            {navItems.map((item) => {
              const isActive = active === item.key || (active === 'none' && isHrefActive(item.href, pathname));

              return (
                <Link
                  key={`sidebar-${item.key}-${item.href}`}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${styles.sidebarNavLink} ${isActive ? styles.sidebarNavLinkActive : ''}`}
                >
                  <span className={styles.sidebarNavIcon} aria-hidden="true">
                    <NavigationIcon name={item.icon} className={styles.sidebarNavSvg} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {utilityItems.length ? (
            <nav className={styles.sidebarNav} aria-label="Owner tools">
              <span className={styles.sidebarSectionLabel}>Owner tools</span>
              {utilityItems.map((item) => (
                <Link
                  key={`sidebar-utility-${item.href}`}
                  href={item.href}
                  aria-current={item.isActive ? 'page' : undefined}
                  className={`${styles.sidebarNavLink} ${item.isActive ? styles.sidebarNavLinkActive : ''}`}
                >
                  <span className={styles.sidebarNavIcon} aria-hidden="true">
                    <NavigationIcon name={item.icon} className={styles.sidebarNavSvg} />
                  </span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
          ) : null}

          <div className={styles.sidebarFooterActions}>
            {session ? (
              <>
                <Link href="/account" className={styles.sidebarAccountLink}>
                  <NavigationIcon name="account" className={styles.sidebarFooterIcon} />
                  <span>Account Details</span>
                </Link>
                <button type="button" className={styles.sidebarSignOutButton} onClick={handleSignOut} disabled={isSigningOut}>
                  <NavigationIcon name="logout" className={styles.sidebarFooterIcon} />
                  <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              </>
            ) : (
              <>
                <SmartLink href={loginHref} className={styles.sidebarAccountLink}>
                  <NavigationIcon name="login" className={styles.sidebarFooterIcon} />
                  <span>Login</span>
                </SmartLink>
                <SmartLink href={primaryHref} className={`${styles.sidebarAccountLink} ${styles.sidebarAccountLinkPrimary}`}>
                  <NavigationIcon name="signup" className={styles.sidebarFooterIcon} />
                  <span>{ctaLabel}</span>
                </SmartLink>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
