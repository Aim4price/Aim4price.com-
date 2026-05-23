'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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

type NavItem = {
  key: ActivePage;
  href: string;
  label: string;
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

type HeaderNotificationCategory = 'partner_note' | 'lead' | 'qr_scan' | 'fuel' | 'account';

type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
};

type NotificationsResponse = {
  ok: boolean;
  notifications?: HeaderNotificationItem[];
  error?: string;
};

type SmartLinkProps = {
  href: string;
  className: string;
  children: ReactNode;
};


const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Get Estimate' },
];

function buildNavItems(accountType: AccountType | null): NavItem[] {
  const resolvedType = accountType ?? 'owner';

  if (resolvedType === 'finance' || resolvedType === 'insurance') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'Leads' },
    ];
  }

  if (resolvedType === 'dealer') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'Leads' },
      { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
    ];
  }

  return [
    ...BASE_NAV_ITEMS,
    { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
    { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
  ];
}

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

function getNotificationSeenStorageKey(userId: string): string {
  return `aim4price-header-notifications-seen-${userId}`;
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNotificationTime(value: string): string {
  const time = parseTime(value);
  if (!time) return '';

  const diffMs = Date.now() - time;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) return 'Just now';
  if (diffMs < hourMs) return `${Math.max(1, Math.round(diffMs / minuteMs))} min ago`;
  if (diffMs < dayMs) return `${Math.max(1, Math.round(diffMs / hourMs))} hr ago`;
  if (diffMs < 7 * dayMs) return `${Math.max(1, Math.round(diffMs / dayMs))} days ago`;

  return new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short' }).format(new Date(time));
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
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const hasLoadedSessionOnceRef = useRef(false);

  const [session, setSession] = useState<SessionResponse['user']>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotificationItem[]>([]);
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null);

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
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;

      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setMenuOpen(false);
      }

      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setNotificationOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setNotificationOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!session?.id || typeof window === 'undefined') {
      setNotificationsSeenAt(null);
      return;
    }

    setNotificationsSeenAt(window.localStorage.getItem(getNotificationSeenStorageKey(session.id)));
  }, [session?.id]);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      if (!session?.id) {
        setNotifications([]);
        setNotificationOpen(false);
        return;
      }

      try {
        setIsLoadingNotifications(true);
        const response = await fetch('/api/notifications', {
          credentials: 'include',
          cache: 'no-store',
        });

        const data = (await response.json()) as NotificationsResponse;

        if (!mounted) return;
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      } catch {
        if (!mounted) return;
        setNotifications([]);
      } finally {
        if (mounted) {
          setIsLoadingNotifications(false);
        }
      }
    }

    void loadNotifications();

    return () => {
      mounted = false;
    };
  }, [session?.id, pathname]);

  const accountName = useMemo(() => session?.name?.trim() || 'Aim4price User', [session]);
  const accountInitials = useMemo(() => getInitials(accountName), [accountName]);
  const accountType = session?.accountType ?? 'owner';
  const isOwnerAccount = accountType === 'owner';
  const navItems = useMemo(() => buildNavItems(session?.accountType ?? null), [session?.accountType]);
  const latestNotificationTime = useMemo(
    () => notifications.reduce((latest, item) => Math.max(latest, parseTime(item.createdAtIso)), 0),
    [notifications],
  );
  const unreadNotificationCount = useMemo(() => {
    const seenTime = parseTime(notificationsSeenAt);
    return notifications.filter((item) => parseTime(item.createdAtIso) > seenTime).length;
  }, [notifications, notificationsSeenAt]);
  const notificationBadgeText = unreadNotificationCount > 9 ? '9+' : String(unreadNotificationCount);

  function markNotificationsSeen() {
    if (!session?.id || typeof window === 'undefined') return;

    const nextSeenAt = latestNotificationTime ? new Date(latestNotificationTime).toISOString() : new Date().toISOString();
    window.localStorage.setItem(getNotificationSeenStorageKey(session.id), nextSeenAt);
    setNotificationsSeenAt(nextSeenAt);
  }

  function handleNotificationToggle() {
    setNotificationOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        setMenuOpen(false);
        markNotificationsSeen();
      }
      return nextOpen;
    });
  }

  function handleNotificationLinkClick() {
    markNotificationsSeen();
    setNotificationOpen(false);
  }

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
      setNotificationOpen(false);
      setNotifications([]);
      setIsSigningOut(false);
      router.refresh();
      window.location.href = '/';
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand} aria-label="Go to Aim4price home">
          <Image
            src="/brand/Aim4price_Home_Logo.png"
            alt="Aim4price"
            width={900}
            height={240}
            className={styles.brandLogo}
            priority
          />
        </Link>

        <nav className={styles.nav} aria-label="Primary navigation">
          <div className={styles.navRail}>
            {navItems.map((item) => {
              const isActive = active === item.key;

              return (
                <Link
                  key={`${item.key}-${item.href}`}
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
              <>
                <div className={styles.notificationMenu} ref={notificationMenuRef}>
                  <button
                    type="button"
                    className={`${styles.notificationButton} ${unreadNotificationCount ? styles.notificationButtonActive : ''}`}
                    aria-expanded={notificationOpen}
                    aria-haspopup="menu"
                    aria-label={
                      unreadNotificationCount
                        ? `Notifications, ${unreadNotificationCount} new`
                        : 'Notifications'
                    }
                    onClick={handleNotificationToggle}
                  >
                    <svg className={styles.notificationIcon} viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 22a2.6 2.6 0 0 0 2.42-1.65H9.58A2.6 2.6 0 0 0 12 22Zm7.18-5.32-1.14-1.62a3.9 3.9 0 0 1-.72-2.25V9.7a5.35 5.35 0 0 0-4.05-5.18V3.9a1.27 1.27 0 1 0-2.54 0v.62A5.35 5.35 0 0 0 6.68 9.7v3.11c0 .81-.25 1.59-.72 2.25l-1.14 1.62a1.05 1.05 0 0 0 .86 1.66h12.64a1.05 1.05 0 0 0 .86-1.66Z"
                        fill="currentColor"
                      />
                    </svg>
                    {unreadNotificationCount ? (
                      <span className={styles.notificationBadge}>{notificationBadgeText}</span>
                    ) : null}
                  </button>

                  {notificationOpen ? (
                    <div className={styles.notificationPopover} role="menu">
                      <div className={styles.notificationHeaderRow}>
                        <div>
                          <strong className={styles.notificationTitle}>Notifications</strong>
                          <span className={styles.notificationSubtitle}>
                            {isOwnerAccount
                              ? 'Messages, notes, QR scans and fuel updates.'
                              : 'New lead opportunities and account requests.'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={styles.notificationClearButton}
                          onClick={markNotificationsSeen}
                        >
                          Mark checked
                        </button>
                      </div>

                      <div className={styles.notificationList}>
                        {isLoadingNotifications ? (
                          <div className={styles.notificationEmpty}>Loading notifications...</div>
                        ) : notifications.length ? (
                          notifications.map((notification) => (
                            <Link
                              key={notification.id}
                              href={notification.href}
                              className={`${styles.notificationItem} ${styles[`notificationTone${notification.tone.charAt(0).toUpperCase()}${notification.tone.slice(1)}`]}`}
                              onClick={handleNotificationLinkClick}
                            >
                              <span className={styles.notificationDot} aria-hidden="true" />
                              <span className={styles.notificationCopy}>
                                <strong>{notification.title}</strong>
                                <span>{notification.body}</span>
                                <small>{formatNotificationTime(notification.createdAtIso)}</small>
                              </span>
                            </Link>
                          ))
                        ) : (
                          <div className={styles.notificationEmpty}>
                            No new messages, notes or lead updates yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className={styles.accountMenu} ref={accountMenuRef}>
                  <button
                    type="button"
                    className={styles.accountButton}
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      setNotificationOpen(false);
                      setMenuOpen((current) => !current);
                    }}
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
                        </div>
                      </div>

                      <Link href="/account" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                        Account details
                      </Link>
                      {isOwnerAccount ? (
                        <>
                          <Link href="/asset-map" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
                            Asset map
                          </Link>

                          <Link href="/fuel" className={styles.menuLink} onClick={() => setMenuOpen(false)}>
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
                        {isSigningOut ? 'Signing out...' : 'Sign out'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
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
