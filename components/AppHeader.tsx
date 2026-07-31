'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  clearCachedHeaderSession,
  readCachedHeaderSession,
  refreshCachedHeaderSession,
  writeCachedHeaderSession,
  type HeaderSessionUser,
} from '../lib/header-session-cache';
import DealerCostDecisionModal from './DealerCostDecisionModal';
import styles from './AppHeader.module.css';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ActivePage =
  | 'home'
  | 'valuation'
  | 'asset-register'
  | 'asset-map'
  | 'cost'
  | 'maintenance'
  | 'fuel'
  | 'account'
  | 'asset-discovery'
  | 'leads'
  | 'tracking'
  | 'shared-registers'
  | 'marketplace'
  | 'none';

type AppHeaderProps = {
  active: ActivePage;
  signupHref?: string;
  loginHref?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

type AccountType = HeaderSessionUser['accountType'];

type NavItem = {
  key: ActivePage;
  href: string;
  label: string;
};

type AccountMenuItem = {
  href: string;
  label: string;
  mobileOnly?: boolean;
  accountTypes?: AccountType[];
};

type AccountLogoFields = {
  logo?: string | null;
  logoUrl?: string | null;
  accountLogo?: string | null;
  accountLogoUrl?: string | null;
  companyLogo?: string | null;
  companyLogoUrl?: string | null;
  businessLogo?: string | null;
  businessLogoUrl?: string | null;
  profileLogo?: string | null;
  profileLogoUrl?: string | null;
  imageUrl?: string | null;
  avatarUrl?: string | null;
};

type SessionUser = HeaderSessionUser & AccountLogoFields & {
  account?: AccountLogoFields | null;
  company?: AccountLogoFields | null;
  business?: AccountLogoFields | null;
  profile?: AccountLogoFields | null;
  organization?: AccountLogoFields | null;
};

type AccountProfileLogo = AccountLogoFields & {
  name?: string | null;
  displayName?: string | null;
  businessName?: string | null;
  email?: string | null;
};

type AccountProfileResponse = {
  ok?: boolean;
  profile?: AccountProfileLogo | null;
  error?: string;
};

type AccountProfileLogoState = {
  loaded: boolean;
  logoUrl: string | null;
};

type HeaderNotificationCategory = 'partner_note' | 'lead' | 'qr_scan' | 'fuel' | 'maintenance' | 'dealer_schedule' | 'dealer_cost' | 'dealer_correction' | 'asset_discovery';

type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  assetDiscoveryEnquiryId?: string;
  dealerAssetCorrectionId?: string;
  dealerAssetCorrectionAction?: 'decision' | 'retry' | 'pending';
  dealerMaintenanceScheduleProposalId?: string;
  dealerCostInvoiceId?: string;
  dealerCostAction?: 'store' | 'delete';
  priority?: boolean;
};

type AssetDiscoveryDecisionStatus = 'approved' | 'denied';

type AssetDiscoverySafeSummary = {
  type: string;
  brand: string;
  model: string;
  year: string;
  usage: string;
  condition: string;
  province: string;
};

type AssetDiscoveryContactDetails = {
  name: string;
  businessName: string;
  phone: string;
  email: string;
  location: string;
};

type AssetDiscoveryEnquiry = {
  id: string;
  assetId: string;
  status: 'pending' | 'approved' | 'temporarily_denied';
  createdAtIso: string;
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  requestAgainAtIso: string | null;
  asset: AssetDiscoverySafeSummary;
  requesterAccountType: 'owner' | 'dealer';
  requesterMessage: string;
  requesterContact: AssetDiscoveryContactDetails | null;
  dealerContact: AssetDiscoveryContactDetails | null;
  ownerContact: AssetDiscoveryContactDetails | null;
};

type AssetDiscoveryEnquiryResponse = {
  ok?: boolean;
  enquiry?: AssetDiscoveryEnquiry;
  error?: string;
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
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

const NOTIFICATIONS_PER_PAGE = 4;
const NAV_WINDOW_SIZE = 4;
const MOBILE_MENU_ID = 'app-header-mobile-menu';

const BASE_NAV_ITEMS: NavItem[] = [
  { key: 'home', href: '/', label: 'Home' },
  { key: 'valuation', href: '/valuation', label: 'Get Estimate' },
];

const DEFAULT_NAV_ITEMS: NavItem[] = [
  ...BASE_NAV_ITEMS,
  { key: 'asset-register', href: '/asset-register', label: 'Asset Register' },
  { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
];

const OWNER_NAV_ITEMS: NavItem[] = [
  ...DEFAULT_NAV_ITEMS,
  { key: 'asset-map', href: '/asset-map', label: 'Asset Map' },
  { key: 'cost', href: '/my-invoices', label: 'Cost Ledger' },
  { key: 'maintenance', href: '/maintenance', label: 'Maintenance' },
  { key: 'fuel', href: '/fuel', label: 'Fuel Ledger' },
  { key: 'account', href: '/account', label: 'Account' },
];

const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: '/account', label: 'Account' },
  { href: '/asset-map', label: 'Asset Map', accountTypes: ['owner'] },
  { href: '/asset-register', label: 'Asset Register', accountTypes: ['owner'] },
  { href: '/my-invoices', label: 'Cost Ledger', accountTypes: ['owner'] },
  { href: '/tracking', label: 'Tracking', accountTypes: ['dealer'] },
  { href: '/fuel', label: 'Fuel Ledger', accountTypes: ['owner'] },
  { href: '/valuation', label: 'Get Estimate', accountTypes: ['dealer'] },
  { href: '/maintenance', label: 'Maintenance', accountTypes: ['owner'] },
  { href: '/marketplace', label: 'Marketplace', accountTypes: ['owner', 'dealer'] },
  { href: '/leads', label: 'My Leads', accountTypes: ['dealer'] },
  { href: '/dealer-costs', label: 'Client Costs', accountTypes: ['dealer'] },
  { href: '/shared-registers', label: 'Shared Registers', accountTypes: ['insurance'] },
];

function isAccountMenuItemVisible(item: AccountMenuItem, accountType: AccountType | undefined): boolean {
  if (!item.accountTypes?.length) {
    return true;
  }

  return Boolean(accountType && item.accountTypes.includes(accountType));
}

function buildNavItems(
  accountType: AccountType | 'public' | null,
  accountSubtype?: string | null,
  accountantWorkspaceShareId?: string | null,
): NavItem[] {
  if (accountType === null) {
    return BASE_NAV_ITEMS;
  }

  if (accountType === 'finance' && accountSubtype === 'accountant' && accountantWorkspaceShareId) {
    const workspaceRoot = `/accountant/registers/${encodeURIComponent(accountantWorkspaceShareId)}`;
    return [
      { key: 'asset-register', href: workspaceRoot, label: 'Asset Register' },
      { key: 'fuel', href: `${workspaceRoot}/fuel`, label: 'Fuel Ledger' },
      { key: 'cost', href: `${workspaceRoot}/costs`, label: 'Cost Ledger' },
    ];
  }

  if (accountType === 'finance' || accountType === 'insurance') {
    const partnerItems: NavItem[] = [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'My Leads' },
    ];

    if (accountType === 'insurance') {
      partnerItems.push({ key: 'shared-registers', href: '/shared-registers', label: 'Shared Registers' });
    }

    return partnerItems;
  }

  if (accountType === 'dealer') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'My Leads' },
      { key: 'tracking', href: '/tracking', label: 'Tracking' },
      { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
    ];
  }

  if (accountType === 'owner') {
    return OWNER_NAV_ITEMS;
  }

  return DEFAULT_NAV_ITEMS;
}

function buildMobileNavItems(
  accountType: AccountType,
  accountSubtype?: string | null,
  accountantWorkspaceShareId?: string | null,
): NavItem[] {
  const items = buildNavItems(accountType, accountSubtype, accountantWorkspaceShareId);

  if (accountType === 'finance' && accountSubtype === 'accountant' && accountantWorkspaceShareId) {
    return items;
  }

  if (items.some((item) => item.key === 'account')) {
    return items;
  }

  return [...items, { key: 'account', href: '/account', label: 'Account' }];
}

function isPathMatchingHref(pathname: string, href: string): boolean {
  if (href === '/') {
    return pathname === '/';
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveActiveNavKey(pathname: string, items: NavItem[], active: ActivePage): ActivePage {
  const normalizedPath = pathname || '/';

  if (normalizedPath === '/asset-registers' || normalizedPath.startsWith('/asset-registers/')) {
    return 'asset-register';
  }

  const pathMatchedItem = items.find((item) => normalizedPath === item.href)
    ?? [...items]
      .sort((left, right) => right.href.length - left.href.length)
      .find((item) => isPathMatchingHref(normalizedPath, item.href));

  if (pathMatchedItem) {
    return pathMatchedItem.key;
  }

  if (active !== 'none' && items.some((item) => item.key === active)) {
    return active;
  }

  return 'none';
}

function SmartLink({ href, className, children, onClick }: SmartLinkProps) {
  const isAnchorLike =
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:');

  if (isAnchorLike) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

const ACCOUNT_LOGO_FIELD_KEYS: (keyof AccountLogoFields)[] = [
  'accountLogoUrl',
  'companyLogoUrl',
  'businessLogoUrl',
  'profileLogoUrl',
  'logoUrl',
  'accountLogo',
  'companyLogo',
  'businessLogo',
  'profileLogo',
  'logo',
  'imageUrl',
  'avatarUrl',
];

type AccountProfileIconProps = {
  className: string;
  logoUrl?: string | null;
  fallbackLabel?: string | null;
};

function normalizeAccountLogoUrl(value: string | null | undefined): string | null {
  const rawValue = String(value ?? '').trim();

  if (!rawValue) return null;

  const lowerValue = rawValue.toLowerCase();
  const isAim4priceBrandAsset =
    lowerValue.includes('/brand/aim4price') ||
    lowerValue.includes('aim4price_home_logo') ||
    lowerValue.includes('aim4price-mark-black');

  if (isAim4priceBrandAsset) return null;

  if (/^(https?:\/\/|\/|blob:|data:image\/)/i.test(rawValue)) {
    return rawValue;
  }

  return `/${rawValue.replace(/^public\//i, '')}`;
}

function pickLogoUrlFromSource(source: AccountLogoFields | null | undefined): string | null {
  if (!source) return null;

  for (const key of ACCOUNT_LOGO_FIELD_KEYS) {
    const logoUrl = normalizeAccountLogoUrl(source[key]);

    if (logoUrl) return logoUrl;
  }

  return null;
}

function pickAccountLogoUrl(user: SessionUser | null | undefined): string | null {
  if (!user) return null;

  return (
    pickLogoUrlFromSource(user) ??
    pickLogoUrlFromSource(user.company) ??
    pickLogoUrlFromSource(user.account) ??
    pickLogoUrlFromSource(user.business) ??
    pickLogoUrlFromSource(user.profile) ??
    pickLogoUrlFromSource(user.organization)
  );
}

function pickAccountLogoUrlFromProfileResponse(data: AccountProfileResponse | null | undefined): string | null {
  return normalizeAccountLogoUrl(data?.profile?.logoUrl);
}

function buildAccountInitials(value: string | null | undefined): string {
  const cleanedValue = String(value ?? '').replace(/[^a-zA-Z0-9\s@._-]/g, ' ').trim();

  if (!cleanedValue) return 'A';

  const namePart = cleanedValue.includes('@') ? cleanedValue.split('@')[0] : cleanedValue;
  const words = namePart
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length >= 2) {
    const firstInitial = words[0]?.[0] ?? '';
    const secondInitial = words[1]?.[0] ?? '';

    return `${firstInitial}${secondInitial}`.toUpperCase();
  }

  return (words[0] ?? 'A').slice(0, 2).toUpperCase();
}

function AccountProfileIcon({ className, logoUrl, fallbackLabel }: AccountProfileIconProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [logoUrl]);

  const shouldRenderLogo = Boolean(logoUrl) && !imageFailed;
  const initials = buildAccountInitials(fallbackLabel);

  return (
    <span className={className} aria-hidden="true">
      {shouldRenderLogo ? (
        <img
          src={logoUrl as string}
          alt=""
          loading="lazy"
          decoding="async"
          className={styles.accountAvatarLogo}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className={styles.accountAvatarInitials}>{initials}</span>
      )}
    </span>
  );
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

function formatDateTime(value: string | null | undefined): string {
  const time = parseTime(value);
  if (!time) return '';

  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

export default function AppHeader({
  active,
  signupHref = '/auth#signup',
  loginHref = '/auth#login',
  ctaHref,
  ctaLabel = 'Create Account',
}: AppHeaderProps) {
  const primaryHref = ctaHref ?? signupHref;
  const pathname = usePathname();
  const accountantWorkspaceShareId = useMemo(() => {
    const match = /^\/accountant\/registers\/([^/]+)(?:\/|$)/.exec(pathname || '');
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }, [pathname]);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationDialogRef = useRef<HTMLElement | null>(null);

  const [session, setSession] = useState<SessionUser | null>(null);
  const [accountProfileLogoState, setAccountProfileLogoState] = useState<AccountProfileLogoState>({
    loaded: false,
    logoUrl: null,
  });
  const [accountProfileLogoRefreshKey, setAccountProfileLogoRefreshKey] = useState(0);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotificationItem[]>([]);
  const [notificationsSeenAt, setNotificationsSeenAt] = useState<string | null>(null);
  const [notificationPage, setNotificationPage] = useState(1);
  const [processingAssetDiscoveryEnquiryIds, setProcessingAssetDiscoveryEnquiryIds] = useState<Set<string>>(() => new Set());
  const [processingDealerCorrectionIds, setProcessingDealerCorrectionIds] = useState<Set<string>>(() => new Set());
  const [processingMaintenanceScheduleProposalIds, setProcessingMaintenanceScheduleProposalIds] = useState<Set<string>>(() => new Set());
  const [activeDealerCostInvoiceId, setActiveDealerCostInvoiceId] = useState<string | null>(null);
  const [activeAssetDiscoveryEnquiry, setActiveAssetDiscoveryEnquiry] = useState<AssetDiscoveryEnquiry | null>(null);
  const [notificationDetailError, setNotificationDetailError] = useState<string | null>(null);
  const [notificationDetailOutcome, setNotificationDetailOutcome] = useState<{
    tone: 'success' | 'warning';
    title: string;
    message: string;
  } | null>(null);
  const [loadingNotificationActionId, setLoadingNotificationActionId] = useState<string | null>(null);
  const [canUseNotificationPortal, setCanUseNotificationPortal] = useState(false);
  const [leaveAccountOpen, setLeaveAccountOpen] = useState(false);

  useEffect(() => {
    setCanUseNotificationPortal(true);
  }, []);

  useBrowserLayoutEffect(() => {
    const cachedSession = readCachedHeaderSession();

    if (cachedSession !== undefined) {
      setSession(cachedSession);
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    function requestAccountProfileLogoRefresh() {
      setAccountProfileLogoRefreshKey((current) => current + 1);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        requestAccountProfileLogoRefresh();
      }
    }

    window.addEventListener('focus', requestAccountProfileLogoRefresh);
    window.addEventListener('aim4price-account-profile-updated', requestAccountProfileLogoRefresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', requestAccountProfileLogoRefresh);
      window.removeEventListener('aim4price-account-profile-updated', requestAccountProfileLogoRefresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const nextSession = await refreshCachedHeaderSession();
        if (!mounted) return;
        setSession(nextSession);
      } catch {
        // Keep a recent cached header visible if the background refresh is interrupted.
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
  }, []);

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      const target = event.target as Node;

      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setMenuOpen(false);
      }

      const clickedInsideNotificationButton = notificationMenuRef.current?.contains(target) ?? false;
      const clickedInsideNotificationDialog = notificationDialogRef.current?.contains(target) ?? false;

      if (!clickedInsideNotificationButton && !clickedInsideNotificationDialog) {
        setNotificationOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setMobileMenuOpen(false);
        setNotificationOpen(false);
        setActiveAssetDiscoveryEnquiry(null);
        setNotificationDetailError(null);
        setNotificationDetailOutcome(null);
        setLeaveAccountOpen(false);
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
    setMobileMenuOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const hasBlockingModal =
    mobileMenuOpen
    || notificationOpen
    || Boolean(activeAssetDiscoveryEnquiry)
    || Boolean(notificationDetailError)
    || Boolean(notificationDetailOutcome)
    || leaveAccountOpen;

  useEffect(() => {
    if (!hasBlockingModal || typeof document === 'undefined') return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [hasBlockingModal]);

  useEffect(() => {
    if (notificationOpen) {
      setNotificationPage(1);
    }
  }, [notificationOpen]);

  useEffect(() => {
    if (!session?.id || typeof window === 'undefined') {
      setNotificationsSeenAt(null);
      return;
    }

    setNotificationsSeenAt(window.localStorage.getItem(getNotificationSeenStorageKey(session.id)));
  }, [session?.id]);

  useEffect(() => {
    setNotificationPage((current) =>
      Math.min(current, Math.max(1, Math.ceil(notifications.length / NOTIFICATIONS_PER_PAGE))),
    );
  }, [notifications.length]);

  useEffect(() => {
    let mounted = true;

    async function loadNotifications() {
      const isSharedAccountantWorkspace = Boolean(
        accountantWorkspaceShareId
        && session?.accountType === 'finance'
        && session.accountSubtype === 'accountant',
      );

      if (!session?.id || isSharedAccountantWorkspace) {
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
  }, [accountantWorkspaceShareId, session?.id, session?.accountType, session?.accountSubtype, pathname]);

  useEffect(() => {
    function handleDealerCorrectionResolved(event: Event) {
      const correctionId = String(
        (event as CustomEvent<{ correctionId?: string }>).detail?.correctionId ?? '',
      ).trim();
      if (!correctionId) return;

      setNotifications((current) => current.filter(
        (item) => item.dealerAssetCorrectionId !== correctionId,
      ));
    }

    window.addEventListener('aim4price:dealer-correction-resolved', handleDealerCorrectionResolved);
    return () => {
      window.removeEventListener('aim4price:dealer-correction-resolved', handleDealerCorrectionResolved);
    };
  }, []);

  const accountName = useMemo(() => session?.name?.trim() || 'Aim4price User', [session]);
  const sessionAccountLogoUrl = useMemo(() => pickAccountLogoUrl(session), [session]);
  const accountLogoUrl = accountProfileLogoState.loaded
    ? accountProfileLogoState.logoUrl
    : sessionAccountLogoUrl;
  const isOwnerAccount = session?.accountType === 'owner';
  const isDealerAccount = session?.accountType === 'dealer';
  const isAccountantAccount = session?.accountType === 'finance' && session.accountSubtype === 'accountant';
  const isAccountantWorkspace = isAccountantAccount && Boolean(accountantWorkspaceShareId);
  const navAccountType = isLoadingSession ? null : (session?.accountType ?? 'public');
  const navItems = useMemo(
    () => buildNavItems(navAccountType, session?.accountSubtype, accountantWorkspaceShareId),
    [accountantWorkspaceShareId, navAccountType, session?.accountSubtype],
  );
  const mobileNavItems = useMemo(
    () => (session?.accountType
      ? buildMobileNavItems(session.accountType, session.accountSubtype, accountantWorkspaceShareId)
      : navItems),
    [accountantWorkspaceShareId, navItems, session?.accountType, session?.accountSubtype],
  );
  const activeNavKey = useMemo(
    () => resolveActiveNavKey(pathname, mobileNavItems, active),
    [active, mobileNavItems, pathname],
  );
  const navWindowSize = isDealerAccount || isAccountantWorkspace ? navItems.length : NAV_WINDOW_SIZE;
  const [navWindowStart, setNavWindowStart] = useState(0);
  const navMaxWindowStart = Math.max(0, navItems.length - navWindowSize);
  const showNavWindowControls = navItems.length > navWindowSize;
  const visibleNavItems = useMemo(
    () => navItems.slice(navWindowStart, navWindowStart + navWindowSize),
    [navItems, navWindowSize, navWindowStart],
  );
  const latestNotificationTime = useMemo(
    () => notifications.reduce((latest, item) => Math.max(latest, parseTime(item.createdAtIso)), 0),
    [notifications],
  );
  const notificationsSeenTime = useMemo(() => parseTime(notificationsSeenAt), [notificationsSeenAt]);
  const unreadNotificationCount = useMemo(
    () => notifications.filter((item) => parseTime(item.createdAtIso) > notificationsSeenTime).length,
    [notifications, notificationsSeenTime],
  );
  const notificationBadgeText = unreadNotificationCount > 9 ? '9+' : String(unreadNotificationCount);
  const notificationPageCount = Math.max(1, Math.ceil(notifications.length / NOTIFICATIONS_PER_PAGE));
  const activeNotificationPage = Math.min(notificationPage, notificationPageCount);
  const visibleNotifications = useMemo(() => {
    const startIndex = (activeNotificationPage - 1) * NOTIFICATIONS_PER_PAGE;
    return notifications.slice(startIndex, startIndex + NOTIFICATIONS_PER_PAGE);
  }, [activeNotificationPage, notifications]);
  const notificationRangeStart = notifications.length
    ? (activeNotificationPage - 1) * NOTIFICATIONS_PER_PAGE + 1
    : 0;
  const notificationRangeEnd = notifications.length
    ? Math.min(activeNotificationPage * NOTIFICATIONS_PER_PAGE, notifications.length)
    : 0;
  const hasNotificationPages = notifications.length > NOTIFICATIONS_PER_PAGE;

  useEffect(() => {
    if (!showNavWindowControls) {
      setNavWindowStart(0);
      return;
    }

    const activeIndex = navItems.findIndex((item) => item.key === activeNavKey);

    if (activeIndex < 0) {
      setNavWindowStart((current) => Math.min(current, navMaxWindowStart));
      return;
    }

    setNavWindowStart((current) => {
      if (activeIndex >= current && activeIndex < current + navWindowSize) {
        return Math.min(current, navMaxWindowStart);
      }

      return Math.min(navMaxWindowStart, Math.max(0, activeIndex - navWindowSize + 1));
    });
  }, [activeNavKey, navItems, navMaxWindowStart, navWindowSize, showNavWindowControls]);

  function moveNavWindow(direction: -1 | 1) {
    setNavWindowStart((current) => Math.min(navMaxWindowStart, Math.max(0, current + direction)));
  }

  useEffect(() => {
    const activeSession = session;

    if (!activeSession?.id) {
      setAccountProfileLogoState({ loaded: false, logoUrl: null });
      return;
    }

    const cacheSession: HeaderSessionUser = {
      id: activeSession.id,
      name: activeSession.name,
      email: activeSession.email,
      accountType: activeSession.accountType,
      accountSubtype: activeSession.accountSubtype,
      logoUrl: activeSession.logoUrl,
    };
    let mounted = true;

    async function loadAccountLogoFromProfile() {
      try {
        const response = await fetch('/api/account-profile', {
          credentials: 'include',
          cache: 'no-store',
        });

        if (!response.ok) {
          if (mounted) setAccountProfileLogoState({ loaded: false, logoUrl: null });
          return;
        }

        const data = (await response.json()) as AccountProfileResponse;
        const nextLogoUrl = pickAccountLogoUrlFromProfileResponse(data);

        if (mounted) {
          setAccountProfileLogoState({
            loaded: Boolean(data?.ok && data?.profile),
            logoUrl: nextLogoUrl,
          });
          writeCachedHeaderSession({
            ...cacheSession,
            logoUrl: nextLogoUrl,
          });
        }
      } catch {
        if (mounted) setAccountProfileLogoState({ loaded: false, logoUrl: null });
      }
    }

    void loadAccountLogoFromProfile();

    return () => {
      mounted = false;
    };
  }, [session?.id, pathname, accountProfileLogoRefreshKey]);

  function markNotificationsSeen() {
    if (!session?.id || typeof window === 'undefined') return;

    const nextSeenAt = latestNotificationTime ? new Date(latestNotificationTime).toISOString() : new Date().toISOString();
    window.localStorage.setItem(getNotificationSeenStorageKey(session.id), nextSeenAt);
    setNotificationsSeenAt(nextSeenAt);
  }

  function closeNotificationDetailModal() {
    setActiveAssetDiscoveryEnquiry(null);
    setNotificationDetailError(null);
    setNotificationDetailOutcome(null);
  }

  function closeDealerCostDecisionModal() {
    setActiveDealerCostInvoiceId(null);
  }

  function closeAccountMenu() {
    setMenuOpen(false);
  }

  function handleAccountMenuToggle() {
    if (isAccountantWorkspace) {
      setMenuOpen(false);
      setLeaveAccountOpen(true);
      return;
    }

    setMenuOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setMobileMenuOpen(false);
        setNotificationOpen(false);
        closeDealerCostDecisionModal();
        closeNotificationDetailModal();
      }

      return nextOpen;
    });
  }

  function isAccountMenuLinkActive(href: string): boolean {
    if (href === '/') {
      return pathname === '/';
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleNotificationToggle() {
    setNotificationOpen((current) => {
      const nextOpen = !current;
      if (nextOpen) {
        setMenuOpen(false);
        setMobileMenuOpen(false);
        closeDealerCostDecisionModal();
        closeNotificationDetailModal();
      }
      return nextOpen;
    });
  }

  function handleNotificationLinkClick() {
    markNotificationsSeen();
    setNotificationOpen(false);
  }

  function handleMobileMenuToggle() {
    setMobileMenuOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        setMenuOpen(false);
        setNotificationOpen(false);
        closeDealerCostDecisionModal();
        closeNotificationDetailModal();
      }

      return nextOpen;
    });
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  function requestLeaveAccount() {
    setMobileMenuOpen(false);
    setMenuOpen(false);
    setLeaveAccountOpen(true);
  }

  async function handleOpenAssetDiscoveryNotification(enquiryId: string) {
    setNotificationOpen(false);
    setNotificationDetailError(null);
    setLoadingNotificationActionId(`asset-discovery:${enquiryId}`);

    try {
      const response = await fetch(`/api/asset-discovery/enquiries/${encodeURIComponent(enquiryId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as AssetDiscoveryEnquiryResponse;

      if (!response.ok || !data.ok || !data.enquiry) {
        throw new Error(data.error || 'Failed to load Discovery enquiry.');
      }

      setActiveAssetDiscoveryEnquiry(data.enquiry);
      markNotificationsSeen();
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to load Discovery enquiry.');
    } finally {
      setLoadingNotificationActionId(null);
    }
  }

  async function handleAssetDiscoveryDecision(enquiryId: string, status: AssetDiscoveryDecisionStatus) {
    setProcessingAssetDiscoveryEnquiryIds((current) => new Set(current).add(enquiryId));
    setNotificationDetailError(null);

    try {
      const response = await fetch(`/api/asset-discovery/enquiries/${encodeURIComponent(enquiryId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: status === 'approved' ? 'yes' : 'no' }),
      });
      const data = (await response.json()) as AssetDiscoveryEnquiryResponse;

      if (!response.ok || !data.ok || !data.enquiry) {
        throw new Error(data.error || 'Failed to update Discovery enquiry.');
      }

      closeNotificationDetailModal();
      setNotifications((current) => current.filter((item) => item.assetDiscoveryEnquiryId !== enquiryId));
      markNotificationsSeen();
    } catch (error) {
      console.error('Failed to update Discovery enquiry notification', error);
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to update Discovery enquiry.');
    } finally {
      setProcessingAssetDiscoveryEnquiryIds((current) => {
        const next = new Set(current);
        next.delete(enquiryId);
        return next;
      });
    }
  }

  async function handleDealerCorrectionDecision(correctionId: string, decision: 'accept' | 'reject') {
    setProcessingDealerCorrectionIds((current) => new Set(current).add(correctionId));
    setNotificationDetailError(null);

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correctionId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        outcome?: string;
        message?: string;
        error?: string;
      } | null;

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to save the dealer correction decision.');
      }

      const revaluationNeedsAttention =
        data.outcome === 'accepted_revaluation_failed'
        || data.outcome === 'accepted_revaluation_pending';
      setNotifications((current) => revaluationNeedsAttention
        ? current.map((item) => item.dealerAssetCorrectionId === correctionId
          ? {
              ...item,
              id: `${item.id}:${data.outcome}`,
              title: data.outcome === 'accepted_revaluation_failed'
                ? 'Aim4price recalculation needs attention'
                : 'Aim4price recalculation pending',
              body: data.message || 'The replacement price was saved, but recalculation still needs attention.',
              dealerAssetCorrectionAction: data.outcome === 'accepted_revaluation_failed' ? 'retry' : 'pending',
            }
          : item)
        : current.filter((item) => item.dealerAssetCorrectionId !== correctionId));
      markNotificationsSeen();
      window.dispatchEvent(new Event('aim4price:asset-register-updated'));
      setNotificationDetailOutcome({
        tone: revaluationNeedsAttention ? 'warning' : 'success',
        title: revaluationNeedsAttention ? 'Replacement price saved' : 'Asset Register updated',
        message: data.message || (
          decision === 'reject'
            ? 'Dealer correction declined.'
            : 'Dealer update accepted and saved.'
        ),
      });
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to save the dealer correction decision.');
    } finally {
      setProcessingDealerCorrectionIds((current) => {
        const next = new Set(current);
        next.delete(correctionId);
        return next;
      });
    }
  }

  async function handleMaintenanceScheduleDecision(proposalId: string, decision: 'approve' | 'decline') {
    setProcessingMaintenanceScheduleProposalIds((current) => new Set(current).add(proposalId));
    setNotificationDetailError(null);
    setNotificationDetailOutcome(null);
    try {
      const response = await fetch(`/api/dealer-maintenance-schedule-proposals/${encodeURIComponent(proposalId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      const data = await response.json().catch(() => null) as {
        ok?: boolean;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to save the maintenance schedule decision.');
      }
      setNotifications((current) => current.filter(
        (item) => item.dealerMaintenanceScheduleProposalId !== proposalId,
      ));
      markNotificationsSeen();
      window.dispatchEvent(new Event('aim4price:asset-register-updated'));
      setNotificationDetailOutcome({
        tone: 'success',
        title: decision === 'approve' ? 'Maintenance schedule approved' : 'Maintenance schedule disapproved',
        message: data.message || (
          decision === 'approve'
            ? 'The schedule was added to your Asset Register.'
            : 'The schedule is no longer visible on your side.'
        ),
      });
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to save the maintenance schedule decision.');
    } finally {
      setProcessingMaintenanceScheduleProposalIds((current) => {
        const next = new Set(current);
        next.delete(proposalId);
        return next;
      });
    }
  }

  function handleOpenDealerCost(invoiceId: string) {
    setNotificationOpen(false);
    closeNotificationDetailModal();
    setActiveDealerCostInvoiceId(invoiceId);
    markNotificationsSeen();
  }

  function handleDealerCostResolved(
    invoiceId: string,
    action: 'store' | 'delete',
    decision: 'approve' | 'decline' | 'keep' | 'delete',
    message: string,
  ) {
    setNotifications((current) => current.filter(
      (item) => item.dealerCostInvoiceId !== invoiceId,
    ));
    setActiveDealerCostInvoiceId(null);
    markNotificationsSeen();
    window.dispatchEvent(new Event('aim4price:cost-ledger-updated'));
    setNotificationDetailOutcome({
      tone: action === 'delete' && decision === 'delete' ? 'warning' : 'success',
      title: action === 'delete'
        ? decision === 'keep'
          ? 'Cost kept in your ledger'
          : 'Cost permanently deleted'
        : decision === 'approve'
          ? 'Cost added to your ledger'
          : 'Cost kept dealer-only',
      message,
    });
  }

  async function handleDealerCorrectionRetry(correctionId: string) {
    setProcessingDealerCorrectionIds((current) => new Set(current).add(correctionId));
    setNotificationDetailError(null);
    setNotificationDetailOutcome(null);

    try {
      const response = await fetch(`/api/asset-corrections/${encodeURIComponent(correctionId)}/retry`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean;
        outcome?: string;
        message?: string;
        error?: string;
      } | null;
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || 'Aim4price could not retry this valuation.');
      }

      const succeeded = data.outcome === 'accepted_revalued';
      setNotifications((current) => succeeded
        ? current.filter((item) => item.dealerAssetCorrectionId !== correctionId)
        : current.map((item) => item.dealerAssetCorrectionId === correctionId
          ? {
              ...item,
              body: data.message || item.body,
              dealerAssetCorrectionAction: data.outcome === 'accepted_revaluation_failed' ? 'retry' : 'pending',
            }
          : item));
      window.dispatchEvent(new Event('aim4price:asset-register-updated'));
      setNotificationDetailOutcome({
        tone: succeeded ? 'success' : 'warning',
        title: succeeded ? 'Valuation updated' : 'Recalculation still needs attention',
        message: data.message || (
          succeeded
            ? 'Aim4price recalculated the asset and saved the latest estimate.'
            : 'Aim4price could not complete the recalculation.'
        ),
      });
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Aim4price could not retry this valuation.');
    } finally {
      setProcessingDealerCorrectionIds((current) => {
        const next = new Set(current);
        next.delete(correctionId);
        return next;
      });
    }
  }

  async function handleSignOut() {
    try {
      setIsSigningOut(true);

      await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'close_account' }),
      }).catch(() => null);

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
      clearCachedHeaderSession();
      setSession(null);
      setMenuOpen(false);
      setMobileMenuOpen(false);
      setNotificationOpen(false);
      setNotifications([]);
      setIsSigningOut(false);
      window.location.replace('/auth#login');
    }
  }

  function handleLeaveSharedAccount() {
    setLeaveAccountOpen(false);
    setMenuOpen(false);
    setMobileMenuOpen(false);
    window.location.assign('/leads');
  }

  function renderNotificationCopy(notification: HeaderNotificationItem, actionLabel?: string) {
    return (
      <>
        <span className={styles.notificationDot} aria-hidden="true" />
        <span className={styles.notificationCopy}>
          <strong>{notification.title}</strong>
          <span>{notification.body}</span>
          <span className={styles.notificationMetaRow}>
            <small>{formatNotificationTime(notification.createdAtIso)}</small>
            {actionLabel ? (
              <span className={styles.notificationOpenHint}>
                <span>{actionLabel}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : null}
          </span>
        </span>
      </>
    );
  }

  function isNotificationNew(notification: HeaderNotificationItem): boolean {
    return parseTime(notification.createdAtIso) > notificationsSeenTime;
  }

  function renderNotificationItem(notification: HeaderNotificationItem) {
    const toneClass = styles[`notificationTone${notification.tone.charAt(0).toUpperCase()}${notification.tone.slice(1)}`];
    const newClass = isNotificationNew(notification) ? styles.notificationItemNew : '';
    const priorityClass = notification.priority ? styles.notificationItemPriority : '';
    const baseClassName = `${styles.notificationItem} ${toneClass} ${newClass} ${priorityClass}`;

    if (notification.dealerCostInvoiceId) {
      const invoiceId = notification.dealerCostInvoiceId;
      return (
        <div key={notification.id} className={`${baseClassName} ${styles.notificationItemActionable}`}>
          <span className={styles.notificationDot} aria-hidden="true" />
          <span className={styles.notificationCopy}>
            <strong>{notification.title}</strong>
            <span>{notification.body}</span>
            <span className={styles.notificationMetaRow}>
              <small>{formatNotificationTime(notification.createdAtIso)}</small>
            </span>
            <span className={styles.notificationActionRow}>
              <button
                type="button"
                className={styles.notificationApproveButton}
                onClick={() => handleOpenDealerCost(invoiceId)}
              >
                {notification.dealerCostAction === 'delete' ? 'Review deletion' : 'View cost'}
              </button>
            </span>
          </span>
        </div>
      );
    }

    if (notification.dealerMaintenanceScheduleProposalId) {
      const proposalId = notification.dealerMaintenanceScheduleProposalId;
      const processing = processingMaintenanceScheduleProposalIds.has(proposalId);
      return (
        <div key={notification.id} className={`${baseClassName} ${styles.notificationItemActionable}`}>
          <span className={styles.notificationDot} aria-hidden="true" />
          <span className={styles.notificationCopy}>
            <strong>{notification.title}</strong>
            <span>{notification.body}</span>
            <span className={styles.notificationMetaRow}>
              <small>{formatNotificationTime(notification.createdAtIso)}</small>
            </span>
            <span className={styles.notificationActionRow}>
              <button
                type="button"
                className={styles.notificationDenyButton}
                onClick={() => void handleMaintenanceScheduleDecision(proposalId, 'decline')}
                disabled={processing}
              >
                {processing ? 'Saving...' : 'Disapprove'}
              </button>
              <button
                type="button"
                className={styles.notificationApproveButton}
                onClick={() => void handleMaintenanceScheduleDecision(proposalId, 'approve')}
                disabled={processing}
              >
                {processing ? 'Saving...' : 'Approve'}
              </button>
            </span>
          </span>
        </div>
      );
    }

    if (notification.dealerAssetCorrectionId) {
      const correctionId = notification.dealerAssetCorrectionId;
      const processing = processingDealerCorrectionIds.has(correctionId);
      const correctionAction = notification.dealerAssetCorrectionAction ?? 'decision';

      return (
        <div key={notification.id} className={`${baseClassName} ${styles.notificationItemActionable}`}>
          <span className={styles.notificationDot} aria-hidden="true" />
          <span className={styles.notificationCopy}>
            <strong>{notification.title}</strong>
            <span>{notification.body}</span>
            <span className={styles.notificationMetaRow}>
              <small>{formatNotificationTime(notification.createdAtIso)}</small>
            </span>
            {correctionAction === 'decision' ? (
              <span className={styles.notificationActionRow}>
                <button
                  type="button"
                  className={styles.notificationDenyButton}
                  onClick={() => void handleDealerCorrectionDecision(correctionId, 'reject')}
                  disabled={processing}
                >
                  {processing ? 'Saving...' : 'Decline'}
                </button>
                <button
                  type="button"
                  className={styles.notificationApproveButton}
                  onClick={() => void handleDealerCorrectionDecision(correctionId, 'accept')}
                  disabled={processing}
                >
                  {processing ? 'Saving...' : 'Approve'}
                </button>
              </span>
            ) : correctionAction === 'retry' ? (
              <span className={styles.notificationActionRow}>
                <button
                  type="button"
                  className={styles.notificationApproveButton}
                  onClick={() => void handleDealerCorrectionRetry(correctionId)}
                  disabled={processing}
                >
                  {processing ? 'Retrying...' : 'Retry valuation'}
                </button>
              </span>
            ) : (
              <span className={styles.notificationActionRow}>
                <button type="button" className={styles.notificationDenyButton} disabled>
                  Recalculation pending
                </button>
              </span>
            )}
          </span>
        </div>
      );
    }

    if (notification.assetDiscoveryEnquiryId) {
      const loading = loadingNotificationActionId === `asset-discovery:${notification.assetDiscoveryEnquiryId}`;

      return (
        <button
          type="button"
          key={notification.id}
          className={`${baseClassName} ${styles.notificationItemButton}`}
          onClick={() => handleOpenAssetDiscoveryNotification(notification.assetDiscoveryEnquiryId as string)}
          disabled={loading}
        >
          {renderNotificationCopy(notification, loading ? 'Opening enquiry...' : 'Open enquiry')}
        </button>
      );
    }

    if (notification.href) {
      return (
        <Link
          key={notification.id}
          href={notification.href}
          className={baseClassName}
          onClick={handleNotificationLinkClick}
        >
          {renderNotificationCopy(notification)}
        </Link>
      );
    }

    return (
      <div key={notification.id} className={baseClassName}>
        {renderNotificationCopy(notification)}
      </div>
    );
  }

  function renderAssetDiscoveryDetailModal(enquiry: AssetDiscoveryEnquiry) {
    const isProcessing = processingAssetDiscoveryEnquiryIds.has(enquiry.id);
    const isPending = enquiry.status === 'pending';
    const isApproved = enquiry.status === 'approved';
    const canOpenDiscoveryAsset = isApproved && Boolean(enquiry.ownerContact);
    const retryDate = formatDateTime(enquiry.requestAgainAtIso);
    const contact = enquiry.requesterContact || enquiry.ownerContact || enquiry.dealerContact;
    const requesterLabel = enquiry.requesterAccountType === 'owner' ? 'owner' : 'dealer';

    return (
      <section
        className={`${styles.notificationDetailModal} ${styles.notificationDiscoveryDetailModal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-asset-discovery-title"
      >
        <div className={styles.notificationDetailHeader}>
          <div className={styles.notificationDetailHeaderText}>
            <h2 id="notification-asset-discovery-title">Discovery enquiry</h2>
            <p>{isPending ? `${requesterLabel === 'owner' ? 'An' : 'A'} ${requesterLabel} is looking for a machine like this. Interested in making contact?` : 'Asset-specific enquiry status.'}</p>
          </div>
          <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label="Close Discovery enquiry">
            ×
          </button>
        </div>

        <div className={styles.notificationDetailBody}>
          <div className={styles.notificationDetailMetaGrid}>
            <div className={styles.notificationDetailMetaCard}>
              <span>Type</span>
              <strong>{enquiry.asset.type}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Brand / model</span>
              <strong>{[enquiry.asset.brand, enquiry.asset.model].filter(Boolean).join(' ')}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Year / usage</span>
              <strong>{enquiry.asset.year} · {enquiry.asset.usage}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Province</span>
              <strong>{enquiry.asset.province}</strong>
            </div>
          </div>

          {!isPending ? (
            <div className={styles.notificationDetailStatusBox}>
              <strong>Decision saved</strong>
              <p>{isApproved ? 'Approved. Your contact details are now visible to the interested user for three months.' : retryDate ? `Not interested right now. This asset is hidden from Discovery until ${retryDate}.` : 'Not interested right now. This asset is hidden from Discovery for 90 days.'}</p>
            </div>
          ) : null}

          {isApproved && enquiry.requesterMessage ? (
            <div className={styles.notificationDetailMessageBox}>
              <strong>{enquiry.requesterAccountType === 'dealer' ? 'Dealer' : 'Owner'} message</strong>
              <p>{enquiry.requesterMessage}</p>
            </div>
          ) : null}

          {isApproved && contact ? (
            <div className={styles.notificationDetailMetaGrid}>
              <div className={styles.notificationDetailMetaCard}>
                <span>Business / account</span>
                <strong>{contact.businessName || contact.name || 'Not supplied'}</strong>
              </div>
              <div className={styles.notificationDetailMetaCard}>
                <span>Phone</span>
                <strong>{contact.phone || 'Not supplied'}</strong>
              </div>
              <div className={styles.notificationDetailMetaCard}>
                <span>Email</span>
                <strong>{contact.email || 'Not supplied'}</strong>
              </div>
              <div className={styles.notificationDetailMetaCard}>
                <span>Location</span>
                <strong>{contact.location || 'Not supplied'}</strong>
              </div>
            </div>
          ) : null}
        </div>

        {isPending ? (
          <div className={styles.notificationDetailActions}>
            <button
              type="button"
              className={styles.notificationSoftDangerButton}
              onClick={() => handleAssetDiscoveryDecision(enquiry.id, 'denied')}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving...' : 'No'}
            </button>
            <button
              type="button"
              className={styles.notificationPrimaryButton}
              onClick={() => handleAssetDiscoveryDecision(enquiry.id, 'approved')}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving...' : 'Yes'}
            </button>
          </div>
        ) : (
          <div className={styles.notificationDetailActions}>
            <button type="button" className={styles.notificationSecondaryButton} onClick={closeNotificationDetailModal}>
              Close
            </button>
            {canOpenDiscoveryAsset ? (
              <a
                className={styles.notificationPrimaryButton}
                href={`/asset-discovery?openAsset=${encodeURIComponent(enquiry.assetId)}`}
                onClick={markNotificationsSeen}
              >
                Open
              </a>
            ) : null}
          </div>
        )}
      </section>
    );
  }

  function renderMobileMenuPanel() {
    return (
      <section
        id={MOBILE_MENU_ID}
        className={styles.mobileMenuPanel}
        role="dialog"
        aria-modal="true"
        aria-label="Mobile menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className={styles.mobileMenuHeader}>
          <div className={styles.mobileMenuHeaderCopy}>
            <span className={styles.mobileMenuKicker}>{session ? 'Account navigation' : 'Navigation'}</span>
            <strong className={styles.mobileMenuTitle}>Menu</strong>
            {session ? <span className={styles.mobileMenuAccountName}>{accountName}</span> : null}
          </div>
          <button
            type="button"
            className={styles.mobileMenuCloseButton}
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
          >
            ×
          </button>
        </div>

        <nav className={styles.mobileMenuNav} aria-label={session ? 'Account mobile navigation' : 'Mobile navigation'}>
          {(session ? mobileNavItems : navItems).map((item) => {
            const isActive = activeNavKey === item.key;

            return (
              <Link
                key={`mobile-${session ? 'account-' : ''}${item.key}-${item.href}`}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`${styles.mobileMenuNavLink} ${isActive ? styles.mobileMenuNavLinkActive : ''}`}
                onClick={closeMobileMenu}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {session ? (
          <div className={styles.mobileMenuAccountActions}>
            <button
              type="button"
              className={styles.mobileMenuDangerButton}
              onClick={isAccountantWorkspace ? requestLeaveAccount : handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : isAccountantWorkspace ? 'Leave account' : 'Sign out'}
            </button>
          </div>
        ) : (
          <div className={styles.mobileMenuAuthActions}>
            <SmartLink href={loginHref} className={styles.mobileMenuAuthLink} onClick={closeMobileMenu}>
              Login
            </SmartLink>
            <SmartLink href={primaryHref} className={`${styles.mobileMenuAuthLink} ${styles.mobileMenuAuthLinkPrimary}`} onClick={closeMobileMenu}>
              {ctaLabel}
            </SmartLink>
          </div>
        )}
      </section>
    );
  }

  const mobileMenuPortal =
    mobileMenuOpen && canUseNotificationPortal
      ? createPortal(
          <div
            className={styles.mobileMenuBackdrop}
            role="presentation"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) {
                closeMobileMenu();
              }
            }}
          >
            {renderMobileMenuPanel()}
          </div>,
          document.body,
        )
      : null;

  const notificationPortal =
    notificationOpen && canUseNotificationPortal
      ? createPortal(
          <div
            className={styles.notificationModalBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setNotificationOpen(false);
              }
            }}
          >
            <section
              id="header-notifications-modal"
              ref={notificationDialogRef}
              className={styles.notificationModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="header-notifications-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className={styles.notificationHeaderRow}>
                <div className={styles.notificationHeaderText}>
                  <strong id="header-notifications-title" className={styles.notificationTitle}>
                    Notifications
                  </strong>
                  <span className={styles.notificationSubtitle}>
                    {isOwnerAccount
                      ? 'Messages, ads, contact requests, notes, QR scans and fuel updates.'
                      : 'New lead opportunities and account request results.'}
                  </span>
                </div>

                <div className={styles.notificationHeaderActions}>
                  <button
                    type="button"
                    className={styles.notificationCloseButton}
                    aria-label="Close notifications"
                    onClick={() => setNotificationOpen(false)}
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className={styles.notificationListHeader} aria-live="polite">
                <span>
                  {isLoadingNotifications
                    ? 'Checking activity'
                    : notifications.length
                      ? hasNotificationPages
                        ? `${notificationRangeStart}-${notificationRangeEnd} of ${notifications.length} notifications`
                        : `${notifications.length} ${notifications.length === 1 ? 'notification' : 'notifications'}`
                      : 'No notifications'}
                </span>
                <div className={styles.notificationListHeaderActions}>
                  <strong>
                    {unreadNotificationCount
                      ? `${unreadNotificationCount} new`
                      : notifications.length
                        ? 'All checked'
                        : 'Clear'}
                  </strong>
                  <button
                    type="button"
                    className={`${styles.notificationClearButton} ${unreadNotificationCount ? styles.notificationClearButtonNew : ''}`}
                    onClick={markNotificationsSeen}
                    disabled={!unreadNotificationCount}
                    aria-label={unreadNotificationCount ? `Mark ${unreadNotificationCount} new notifications checked` : 'All notifications are checked'}
                  >
                    {unreadNotificationCount ? 'Mark checked' : 'All checked'}
                  </button>
                </div>
              </div>

              <div className={styles.notificationList}>
                {isLoadingNotifications ? (
                  <div className={styles.notificationEmpty}>Loading notifications...</div>
                ) : notifications.length ? (
                  visibleNotifications.map((notification) => renderNotificationItem(notification))
                ) : (
                  <div className={styles.notificationEmpty}>No new messages, ads, notes or lead updates yet.</div>
                )}
              </div>

              {!isLoadingNotifications && hasNotificationPages ? (
                <div className={styles.notificationPagination} role="navigation" aria-label="Notification pages">
                  <button
                    type="button"
                    className={styles.notificationPaginationButton}
                    onClick={() => setNotificationPage((current) => Math.max(1, current - 1))}
                    disabled={activeNotificationPage <= 1}
                  >
                    Previous
                  </button>
                  <span className={styles.notificationPaginationText}>
                    Page {activeNotificationPage} of {notificationPageCount}
                  </span>
                  <button
                    type="button"
                    className={styles.notificationPaginationButton}
                    onClick={() => setNotificationPage((current) => Math.min(notificationPageCount, current + 1))}
                    disabled={activeNotificationPage >= notificationPageCount}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </section>
          </div>,
          document.body,
        )
      : null;

  const notificationDetailPortal =
    canUseNotificationPortal && (activeAssetDiscoveryEnquiry || notificationDetailError || notificationDetailOutcome)
      ? createPortal(
          <div
            className={styles.notificationDetailBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                closeNotificationDetailModal();
              }
            }}
          >
            {activeAssetDiscoveryEnquiry ? renderAssetDiscoveryDetailModal(activeAssetDiscoveryEnquiry) : null}
            {!activeAssetDiscoveryEnquiry && notificationDetailError ? (
              <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="notification-error-title">
                <div className={styles.notificationDetailHeader}>
                  <div className={styles.notificationDetailHeaderText}>
                    <span className={styles.notificationDetailErrorIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M12 8v4.5M12 16h.01" />
                        <circle cx="12" cy="12" r="8.5" />
                      </svg>
                    </span>
                    <h2 id="notification-error-title">Could not complete this action</h2>
                    <p>{notificationDetailError}</p>
                  </div>
                  <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label="Close notification error">
                    ×
                  </button>
                </div>
                <div className={styles.notificationDetailActions}>
                  <button type="button" className={styles.notificationSecondaryButton} onClick={closeNotificationDetailModal}>
                    Close
                  </button>
                </div>
              </section>
            ) : null}
            {!activeAssetDiscoveryEnquiry && !notificationDetailError && notificationDetailOutcome ? (
              <section
                className={`${styles.notificationDetailModal} ${styles.notificationOutcomeModal} ${
                  notificationDetailOutcome.tone === 'success'
                    ? styles.notificationDetailOutcomeSuccess
                    : styles.notificationDetailOutcomeWarning
                }`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="notification-outcome-title"
              >
                <div className={styles.notificationDetailHeader}>
                  <div className={styles.notificationDetailHeaderText}>
                    <h2 id="notification-outcome-title">{notificationDetailOutcome.title}</h2>
                    <p>{notificationDetailOutcome.message}</p>
                  </div>
                  <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label="Close notification result">
                    ×
                  </button>
                </div>
                <div className={styles.notificationDetailActions}>
                  <button type="button" className={styles.notificationPrimaryButton} onClick={closeNotificationDetailModal}>
                    Done
                  </button>
                </div>
              </section>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  const leaveAccountPortal =
    leaveAccountOpen && canUseNotificationPortal
      ? createPortal(
          <div
            className={styles.notificationDetailBackdrop}
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setLeaveAccountOpen(false);
            }}
          >
            <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="leave-account-title">
              <div className={styles.notificationDetailHeader}>
                <div className={styles.notificationDetailHeaderText}>
                  <h2 id="leave-account-title">Leave this account?</h2>
                  <p>Are you sure you want to leave this account? You will return to My Leads.</p>
                </div>
                <button type="button" className={styles.notificationDetailCloseButton} onClick={() => setLeaveAccountOpen(false)} aria-label="Cancel leaving account">
                  ×
                </button>
              </div>
              <div className={styles.notificationDetailActions}>
                <button type="button" className={styles.notificationSecondaryButton} onClick={() => setLeaveAccountOpen(false)} disabled={isSigningOut}>
                  Cancel
                </button>
                <button type="button" className={styles.notificationSoftDangerButton} onClick={handleLeaveSharedAccount}>
                  Leave account
                </button>
              </div>
            </section>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <header className={styles.header}>
        <div className={`${styles.inner} ${isDealerAccount ? styles.innerDealer : ''}`}>
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
            {showNavWindowControls ? (
              <button
                type="button"
                className={`${styles.navWindowButton} ${styles.navWindowButtonPrevious}`}
                onClick={() => moveNavWindow(-1)}
                disabled={navWindowStart <= 0}
                aria-label="Show previous navigation items"
              >
                <span aria-hidden="true">‹</span>
              </button>
            ) : null}

            <div className={styles.navRail}>
              {visibleNavItems.map((item) => {
                const isActive = activeNavKey === item.key;

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

            {showNavWindowControls ? (
              <button
                type="button"
                className={`${styles.navWindowButton} ${styles.navWindowButtonNext}`}
                onClick={() => moveNavWindow(1)}
                disabled={navWindowStart >= navMaxWindowStart}
                aria-label="Show next navigation items"
              >
                <span aria-hidden="true">›</span>
              </button>
            ) : null}
          </nav>

          <div className={styles.actions}>
            <div className={styles.actionsRail}>
              {isLoadingSession ? null : session ? (
                <>
                  {!isAccountantWorkspace ? <div className={styles.notificationMenu} ref={notificationMenuRef}>
                    <button
                      type="button"
                      className={`${styles.notificationButton} ${unreadNotificationCount ? styles.notificationButtonActive : ''}`}
                      aria-expanded={notificationOpen}
                      aria-haspopup="dialog"
                      aria-controls={notificationOpen ? 'header-notifications-modal' : undefined}
                      aria-label={unreadNotificationCount ? `Notifications, ${unreadNotificationCount} new` : 'Notifications'}
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
                  </div> : null}

                  <div className={styles.accountMenu} ref={accountMenuRef}>
                    <button
                      type="button"
                      className={`${styles.accountButton} ${menuOpen ? styles.accountButtonActive : ''}`}
                      aria-expanded={menuOpen}
                      aria-haspopup="menu"
                      aria-controls={menuOpen ? 'header-account-menu' : undefined}
                      aria-label="Open manage menu"
                      onClick={handleAccountMenuToggle}
                    >
                      <AccountProfileIcon
                        className={styles.accountAvatar}
                        logoUrl={accountLogoUrl}
                        fallbackLabel={accountName}
                      />
                      <span className={styles.accountButtonText}>
                        <span className={styles.accountButtonTextFull}>Manage</span>
                        <span className={styles.accountButtonTextCompact}>Manage</span>
                      </span>
                      <span className={styles.accountButtonMenuMark} aria-hidden="true">
                        <span className={styles.accountButtonMenuIcon}>
                          <span className={styles.accountButtonMenuIconLine} />
                        </span>
                      </span>
                    </button>

                    {menuOpen ? (
                      <div id="header-account-menu" className={styles.accountPopover} role="menu">
                        {ACCOUNT_MENU_ITEMS.filter((item) => isAccountMenuItemVisible(item, session?.accountType)).map((item) => {
                          const isActive = isAccountMenuLinkActive(item.href);
                          const menuLinkClassName = [
                            styles.menuLink,
                            isActive ? styles.menuLinkActive : '',
                            item.mobileOnly ? styles.menuLinkMobileOnly : '',
                          ]
                            .filter(Boolean)
                            .join(' ');

                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              aria-current={isActive ? 'page' : undefined}
                              className={menuLinkClassName}
                              onClick={closeAccountMenu}
                            >
                              <span>{item.label}</span>
                            </Link>
                          );
                        })}

                        <button
                          type="button"
                          role="menuitem"
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

              {!isLoadingSession ? (
                <button
                  type="button"
                  className={`${styles.mobileMenuButton} ${mobileMenuOpen ? styles.mobileMenuButtonActive : ''}`}
                  aria-expanded={mobileMenuOpen}
                  aria-haspopup="dialog"
                  aria-controls={MOBILE_MENU_ID}
                  aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                  onClick={handleMobileMenuToggle}
                >
                  <span className={styles.mobileMenuIcon} aria-hidden="true">
                    <span className={styles.mobileMenuIconLine} />
                  </span>
                  <span className={styles.mobileMenuButtonText}>Menu</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      {mobileMenuPortal}
      {notificationPortal}
      {notificationDetailPortal}
      {leaveAccountPortal}
      <DealerCostDecisionModal
        invoiceId={activeDealerCostInvoiceId}
        onClose={closeDealerCostDecisionModal}
        onResolved={(action, decision, message) => {
          if (!activeDealerCostInvoiceId) return;
          handleDealerCostResolved(activeDealerCostInvoiceId, action, decision, message);
        }}
      />
    </>
  );
}
