'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  clearCachedHeaderSession,
  readCachedHeaderSession,
  refreshCachedHeaderSession,
  writeCachedHeaderSession,
  type HeaderSessionUser,
} from '../lib/header-session-cache';
import { isMiddlemanAccountSubtype } from '../lib/middleman-account';
import { isViewportScrollbarInteraction } from '../lib/viewport-scrollbar';
import DealerCostDecisionModal from './DealerCostDecisionModal';
import styles from './AppHeader.module.css';

const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

type ActivePage =
  | 'home'
  | 'valuation'
  | 'asset-register'
  | 'documents'
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
  | 'ad-studio'
  | 'showroom'
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

type HeaderNotificationCategory = 'admin_message' | 'partner_note' | 'lead' | 'qr_scan' | 'fuel' | 'maintenance' | 'dealer_schedule' | 'dealer_cost' | 'cost_budget' | 'capture' | 'dealer_correction' | 'asset_discovery';

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
  captureRequestId?: string;
  priority?: boolean;
  state: 'needs_action' | 'new' | 'history';
  actionRequired: boolean;
  isRead: boolean;
  isArchived: boolean;
  readAtIso: string | null;
  archivedAtIso: string | null;
  resolvedAtIso: string | null;
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
  renewalWindow?: string;
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
  requesterAccountType: 'owner' | 'dealer' | 'licensing';
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
  { href: '/valuation', label: 'Get Estimate' },
  { href: '/account', label: 'Account' },
  { href: '/asset-map', label: 'Asset Map', accountTypes: ['owner'] },
  { href: '/asset-register', label: 'Asset Register', accountTypes: ['owner'] },
  { href: '/documents', label: 'Documents', accountTypes: ['owner'] },
  { href: '/my-invoices', label: 'Cost Ledger', accountTypes: ['owner'] },
  { href: '/tracking', label: 'Maintenance', accountTypes: ['dealer'] },
  { href: '/fuel', label: 'Fuel Ledger', accountTypes: ['owner'] },
  { href: '/maintenance', label: 'Maintenance', accountTypes: ['owner'] },
  { href: '/marketplace', label: 'Marketplace', accountTypes: ['owner', 'dealer'] },
  { href: '/ad-studio', label: 'Ad Studio', accountTypes: ['dealer'] },
  { href: '/my-showroom', label: 'My Showroom', accountTypes: ['dealer'] },
  { href: '/leads', label: 'Leads', accountTypes: ['dealer', 'finance', 'insurance', 'licensing'] },
  { href: '/asset-discovery', label: 'Discovery', accountTypes: ['licensing'] },
  { href: '/dealer-costs', label: 'Client Costs', accountTypes: ['dealer'] },
  { href: '/shared-registers', label: 'Shared Registers', accountTypes: ['insurance'] },
];

const ACCOUNTANT_ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: '/account', label: 'Account' },
  { href: '/valuation', label: 'Get Estimate' },
  { href: '/leads', label: 'My Clients' },
];

const LICENSING_ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: '/leads', label: 'My Leads' },
  { href: '/asset-discovery', label: 'Discovery' },
  { href: '/account', label: 'Account' },
];

const MIDDLEMAN_ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: '/valuation', label: 'Get Estimate' },
  { href: '/ad-studio', label: 'Ad Studio' },
  { href: '/my-showroom', label: 'My Showroom' },
  { href: '/marketplace', label: 'Marketplace' },
  { href: '/account', label: 'Account' },
];

const ACCOUNT_MENU_COLLATOR = new Intl.Collator('en-ZA', {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true,
});

function sortAccountMenuItems<T extends { href: string; label: string }>(items: readonly T[]): T[] {
  return [...items].sort((left, right) =>
    ACCOUNT_MENU_COLLATOR.compare(left.label, right.label)
      || ACCOUNT_MENU_COLLATOR.compare(left.href, right.href),
  );
}

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
  accountantWorkspaceRegisterId?: string | null,
): NavItem[] {
  if (accountType === null) {
    return BASE_NAV_ITEMS;
  }

  if (accountType === 'finance' && accountSubtype === 'accountant' && accountantWorkspaceShareId) {
    const workspaceRoot = `/accountant/registers/${encodeURIComponent(accountantWorkspaceShareId)}`;
    const registerQuery = accountantWorkspaceRegisterId
      ? `?registerId=${encodeURIComponent(accountantWorkspaceRegisterId)}`
      : '';
    const valuationQuery = new URLSearchParams({ accountantShareId: accountantWorkspaceShareId });
    if (accountantWorkspaceRegisterId) valuationQuery.set('registerId', accountantWorkspaceRegisterId);
    return [
      { key: 'valuation', href: `/valuation?${valuationQuery.toString()}`, label: 'Get Estimate' },
      { key: 'asset-register', href: `${workspaceRoot}${registerQuery}`, label: 'Asset Register' },
      { key: 'fuel', href: `${workspaceRoot}/fuel${registerQuery}`, label: 'Fuel Ledger' },
      { key: 'cost', href: `${workspaceRoot}/costs${registerQuery}`, label: 'Cost Ledger' },
    ];
  }

  if (accountType === 'finance' || accountType === 'insurance') {
    const isAccountant = accountType === 'finance' && accountSubtype === 'accountant';
    const partnerItems: NavItem[] = [
      ...BASE_NAV_ITEMS,
      {
        key: 'leads',
        href: '/leads',
        label: isAccountant ? 'My Clients' : 'My Leads',
      },
    ];

    if (isAccountant) {
      partnerItems.push({ key: 'account', href: '/account', label: 'Account' });
    }

    if (accountType === 'insurance') {
      partnerItems.push({ key: 'shared-registers', href: '/shared-registers', label: 'Shared Registers' });
    }

    return partnerItems;
  }

  if (accountType === 'dealer') {
    if (isMiddlemanAccountSubtype(accountSubtype)) {
      return [
        { key: 'valuation', href: '/valuation', label: 'Get Estimate' },
        { key: 'ad-studio', href: '/ad-studio', label: 'Ad Studio' },
        { key: 'showroom', href: '/my-showroom', label: 'My Showroom' },
        { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
      ];
    }
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'Leads' },
      { key: 'tracking', href: '/tracking', label: 'Maintenance' },
      { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
      { key: 'ad-studio', href: '/ad-studio', label: 'Ad Studio' },
      { key: 'showroom', href: '/my-showroom', label: 'My Showroom' },
      { key: 'cost', href: '/dealer-costs', label: 'Client Costs' },
    ];
  }

  if (accountType === 'licensing') {
    return [
      { key: 'home', href: '/', label: 'Home' },
      { key: 'leads', href: '/leads', label: 'My Leads' },
      { key: 'asset-discovery', href: '/asset-discovery', label: 'Discovery' },
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
  accountantWorkspaceRegisterId?: string | null,
): NavItem[] {
  const items = buildNavItems(accountType, accountSubtype, accountantWorkspaceShareId, accountantWorkspaceRegisterId);

  if (accountType === 'licensing') {
    return items;
  }

  if (accountType === 'finance' && accountSubtype === 'accountant' && accountantWorkspaceShareId) {
    return items;
  }

  if (items.some((item) => item.key === 'account')) {
    return items;
  }

  return [...items, { key: 'account', href: '/account', label: 'Account' }];
}

function isPathMatchingHref(pathname: string, href: string): boolean {
  const hrefPath = href.split(/[?#]/, 1)[0] || '/';
  if (hrefPath === '/') {
    return pathname === '/';
  }

  return pathname === hrefPath || pathname.startsWith(`${hrefPath}/`);
}

function resolveActiveNavKey(pathname: string, items: NavItem[], active: ActivePage): ActivePage {
  const normalizedPath = pathname || '/';

  if (normalizedPath === '/asset-registers' || normalizedPath.startsWith('/asset-registers/')) {
    return 'asset-register';
  }

  const pathMatchedItem = items.find((item) => normalizedPath === (item.href.split(/[?#]/, 1)[0] || '/'))
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

function MobileNavIcon({ page }: { page: ActivePage }) {
  let icon: ReactNode;

  switch (page) {
    case 'home':
      icon = (
        <>
          <path d="m3.5 10.2 8.5-7 8.5 7" />
          <path d="M5.8 9.2v10.1h12.4V9.2" />
          <path d="M9.6 19.3v-5.7h4.8v5.7" />
        </>
      );
      break;
    case 'valuation':
      icon = (
        <>
          <circle cx="12" cy="12" r="7.7" />
          <circle cx="12" cy="12" r="3.2" />
          <path d="m14.4 9.6 5.2-5.2" />
          <path d="M16.8 4.4h2.8v2.8" />
        </>
      );
      break;
    case 'asset-register':
      icon = (
        <>
          <path d="M4.3 5.4h5l1.7 2h8.7v11.2H4.3z" />
          <path d="M8 11h8M8 14.4h6" />
        </>
      );
      break;
    case 'documents':
      icon = (
        <>
          <path d="M6.2 3.8h8.1l3.5 3.5v12.9H6.2z" />
          <path d="M14.3 3.8v3.6h3.5M9 11h6M9 14.4h6M9 17.8h4.1" />
        </>
      );
      break;
    case 'marketplace':
    case 'asset-discovery':
      icon = (
        <>
          <path d="M4 9.2h16l-1.2-4.4H5.2z" />
          <path d="M5.2 9.2v9.5h13.6V9.2" />
          <path d="M9.1 18.7v-5.3h5.8v5.3" />
        </>
      );
      break;
    case 'account':
      icon = (
        <>
          <circle cx="12" cy="8.1" r="3.2" />
          <path d="M5.7 19.1c.8-3.1 3-4.8 6.3-4.8s5.5 1.7 6.3 4.8" />
        </>
      );
      break;
    case 'asset-map':
    case 'tracking':
      icon = (
        <>
          <path d="M12 20.2s6-5.9 6-11a6 6 0 1 0-12 0c0 5.1 6 11 6 11Z" />
          <circle cx="12" cy="9.2" r="2" />
        </>
      );
      break;
    case 'cost':
      icon = (
        <>
          <path d="M6.2 3.8h11.6v16.4l-2-1.3-1.9 1.3-1.9-1.3-1.9 1.3-1.9-1.3-2 1.3z" />
          <path d="M9 8h6M9 11.5h6M9 15h3.7" />
        </>
      );
      break;
    case 'maintenance':
      icon = (
        <>
          <path d="m14.2 5.1 4.7 4.7" />
          <path d="m12.8 6.5 2.8-2.8 4.7 4.7-2.8 2.8" />
          <path d="m13.6 10.4-8.1 8.1-2-2 8.1-8.1" />
        </>
      );
      break;
    case 'fuel':
      icon = <path d="M12 3.5s5.4 6.1 5.4 10.6a5.4 5.4 0 1 1-10.8 0C6.6 9.6 12 3.5 12 3.5Z" />;
      break;
    case 'leads':
    case 'shared-registers':
      icon = (
        <>
          <circle cx="9" cy="8.6" r="2.8" />
          <circle cx="16.4" cy="9.5" r="2.2" />
          <path d="M3.9 19c.6-3.4 2.3-5.1 5.1-5.1s4.5 1.7 5.1 5.1" />
          <path d="M14 14.3c3.4-.7 5.4.9 6.1 3.9" />
        </>
      );
      break;
    default:
      icon = (
        <>
          <rect x="4.5" y="4.5" width="5.5" height="5.5" rx="1" />
          <rect x="14" y="4.5" width="5.5" height="5.5" rx="1" />
          <rect x="4.5" y="14" width="5.5" height="5.5" rx="1" />
          <rect x="14" y="14" width="5.5" height="5.5" rx="1" />
        </>
      );
  }

  return (
    <span className={styles.mobileMenuNavIcon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
    </span>
  );
}

function clearLegacyPrototypeStorage() {
  if (typeof window === 'undefined') return;

  window.localStorage.removeItem('aim4price-tractors-kit-register');
  window.localStorage.removeItem('aim4price-tractors-kit-marketplace');
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
  const searchParams = useSearchParams();
  const accountantWorkspaceShareId = useMemo(() => {
    const match = /^\/accountant\/registers\/([^/]+)(?:\/|$)/.exec(pathname || '');
    const encodedShareId = match?.[1] || (pathname === '/valuation' ? searchParams.get('accountantShareId') : '');
    if (!encodedShareId) return null;
    try {
      return decodeURIComponent(encodedShareId);
    } catch {
      return encodedShareId;
    }
  }, [pathname, searchParams]);
  const accountantWorkspaceRegisterId = accountantWorkspaceShareId
    ? String(searchParams.get('registerId') ?? '').trim() || null
    : null;
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
  const [notificationPage, setNotificationPage] = useState(1);
  const [notificationView, setNotificationView] = useState<'active' | 'history'>('active');
  const [notificationSearchQuery, setNotificationSearchQuery] = useState('');
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
      if (isViewportScrollbarInteraction(event)) {
        return;
      }

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
    function refreshCostLedgerNotifications() {
      const isSharedAccountantWorkspace = Boolean(
        accountantWorkspaceShareId
        && session?.accountType === 'finance'
        && session.accountSubtype === 'accountant',
      );
      if (!session?.id || isSharedAccountantWorkspace) return;

      void fetch('/api/notifications', {
        credentials: 'include',
        cache: 'no-store',
      })
        .then((response) => response.json())
        .then((data: NotificationsResponse) => {
          if (data.ok && Array.isArray(data.notifications)) setNotifications(data.notifications);
        })
        .catch((error) => {
          console.error('Failed to refresh Cost Ledger notifications', error);
        });
    }

    window.addEventListener('aim4price:cost-ledger-updated', refreshCostLedgerNotifications);
    return () => {
      window.removeEventListener('aim4price:cost-ledger-updated', refreshCostLedgerNotifications);
    };
  }, [accountantWorkspaceShareId, session?.id, session?.accountType, session?.accountSubtype]);

  useEffect(() => {
    function handleDealerCorrectionResolved(event: Event) {
      const correctionId = String(
        (event as CustomEvent<{ correctionId?: string }>).detail?.correctionId ?? '',
      ).trim();
      if (!correctionId) return;

      void fetch('/api/notifications', {
        credentials: 'include',
        cache: 'no-store',
      })
        .then((response) => response.json())
        .then((data: NotificationsResponse) => {
          if (data.ok && Array.isArray(data.notifications)) setNotifications(data.notifications);
        })
        .catch((error) => {
          console.error('Failed to refresh resolved dealer correction notification', error);
        });
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
  const isMiddlemanAccount = isDealerAccount && isMiddlemanAccountSubtype(session?.accountSubtype);
  const isAccountantAccount = session?.accountType === 'finance' && session.accountSubtype === 'accountant';
  const isAccountantWorkspace = isAccountantAccount && Boolean(accountantWorkspaceShareId);
  const navAccountType = isLoadingSession ? null : (session?.accountType ?? 'public');
  const navItems = useMemo(
    () => buildNavItems(navAccountType, session?.accountSubtype, accountantWorkspaceShareId, accountantWorkspaceRegisterId),
    [accountantWorkspaceRegisterId, accountantWorkspaceShareId, navAccountType, session?.accountSubtype],
  );
  const mobileNavItems = useMemo(
    () => (session?.accountType
      ? buildMobileNavItems(session.accountType, session.accountSubtype, accountantWorkspaceShareId, accountantWorkspaceRegisterId)
      : navItems),
    [accountantWorkspaceRegisterId, accountantWorkspaceShareId, navItems, session?.accountType, session?.accountSubtype],
  );
  const activeNavKey = useMemo(
    () => resolveActiveNavKey(pathname, mobileNavItems, active),
    [active, mobileNavItems, pathname],
  );
  const [usesCompactHeader, setUsesCompactHeader] = useState(false);
  const navWindowSize = usesCompactHeader
    ? navItems.length
    : isAccountantWorkspace
      ? navItems.length
      : NAV_WINDOW_SIZE;
  const [navWindowStart, setNavWindowStart] = useState(0);
  const navMaxWindowStart = Math.max(0, navItems.length - navWindowSize);
  const showNavWindowControls = navItems.length > navWindowSize;
  const visibleNavItems = useMemo(
    () => navItems.slice(navWindowStart, navWindowStart + navWindowSize),
    [navItems, navWindowSize, navWindowStart],
  );
  const activeNotifications = useMemo(
    () => notifications.filter((item) => item.state !== 'history'),
    [notifications],
  );
  const historyNotifications = useMemo(
    () => notifications.filter((item) => item.state === 'history'),
    [notifications],
  );
  const unreadNotificationCount = useMemo(
    () => activeNotifications.filter((item) => item.state === 'new').length,
    [activeNotifications],
  );
  const needsActionCount = useMemo(
    () => activeNotifications.filter((item) => item.state === 'needs_action').length,
    [activeNotifications],
  );
  const activeNotificationCount = activeNotifications.length;
  const notificationBadgeText = activeNotificationCount > 9 ? '9+' : String(activeNotificationCount);
  const filteredHeaderNotifications = useMemo(() => {
    const source = notificationView === 'active' ? activeNotifications : historyNotifications;
    const query = notificationSearchQuery.trim().toLowerCase();
    if (!query) return source;
    return source.filter((item) =>
      [item.title, item.body, item.category].join(' ').toLowerCase().includes(query),
    );
  }, [activeNotifications, historyNotifications, notificationSearchQuery, notificationView]);
  const displayNotificationCount = filteredHeaderNotifications.length;
  const notificationPageCount = Math.max(1, Math.ceil(displayNotificationCount / NOTIFICATIONS_PER_PAGE));
  const activeNotificationPage = Math.min(notificationPage, notificationPageCount);
  const visibleNotifications = useMemo(() => {
    const startIndex = (activeNotificationPage - 1) * NOTIFICATIONS_PER_PAGE;
    return filteredHeaderNotifications.slice(startIndex, startIndex + NOTIFICATIONS_PER_PAGE);
  }, [activeNotificationPage, filteredHeaderNotifications]);
  const notificationRangeStart = displayNotificationCount
    ? (activeNotificationPage - 1) * NOTIFICATIONS_PER_PAGE + 1
    : 0;
  const notificationRangeEnd = displayNotificationCount
    ? Math.min(activeNotificationPage * NOTIFICATIONS_PER_PAGE, displayNotificationCount)
    : 0;
  const hasNotificationPages = displayNotificationCount > NOTIFICATIONS_PER_PAGE;

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      '(max-width: 760px), (hover: none) and (pointer: coarse) and (max-device-width: 900px)',
    );
    const syncCompactHeader = () => setUsesCompactHeader(mediaQuery.matches);

    syncCompactHeader();
    mediaQuery.addEventListener('change', syncCompactHeader);
    return () => mediaQuery.removeEventListener('change', syncCompactHeader);
  }, []);

  useEffect(() => {
    setNotificationPage((current) => Math.min(current, notificationPageCount));
  }, [notificationPageCount]);

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
    const notificationIds = notifications
      .filter((item) => item.state === 'new')
      .map((item) => item.id);
    if (!notificationIds.length) return;

    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) =>
      notificationIds.includes(item.id)
        ? { ...item, state: 'history', isRead: true, readAtIso: item.readAtIso || now }
        : item,
    ));

    void fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', notificationIds }),
    }).then((response) => {
      if (!response.ok) throw new Error('Failed to mark notifications checked.');
    }).catch((error) => {
      console.error('Failed to persist notification state', error);
    });
  }

  function markNotificationOpened(notificationId: string) {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification || notification.state === 'history') return;

    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) =>
      item.id === notificationId
        ? { ...item, state: 'history', isRead: true, readAtIso: item.readAtIso || now }
        : item,
    ));

    void fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_read', notificationIds: [notificationId] }),
    }).then((response) => {
      if (!response.ok) throw new Error('Failed to move the notification to history.');
    }).catch((error) => {
      console.error('Failed to persist opened notification state', error);
    });
  }

  function resolveNotifications(predicate: (item: HeaderNotificationItem) => boolean) {
    const notificationIds = notifications
      .filter((item) => item.actionRequired && !item.resolvedAtIso && predicate(item))
      .map((item) => item.id);
    if (!notificationIds.length) return;

    const now = new Date().toISOString();
    setNotifications((current) => current.map((item) =>
      notificationIds.includes(item.id)
        ? {
            ...item,
            state: 'history',
            isRead: true,
            readAtIso: item.readAtIso || now,
            resolvedAtIso: item.resolvedAtIso || now,
          }
        : item,
    ));

    void fetch('/api/notifications', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', notificationIds }),
    }).then((response) => {
      if (!response.ok) throw new Error('Failed to resolve notifications.');
    }).catch((error) => {
      console.error('Failed to persist resolved notification state', error);
    });
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

  function handleNotificationLinkClick(notificationId: string) {
    markNotificationOpened(notificationId);
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

  function handleChangeAccountantRegister() {
    setMobileMenuOpen(false);
    setMenuOpen(false);
    if (!accountantWorkspaceShareId) return;

    const workspaceRoot = `/accountant/registers/${encodeURIComponent(accountantWorkspaceShareId)}`;
    const registerQuery = accountantWorkspaceRegisterId
      ? `registerId=${encodeURIComponent(accountantWorkspaceRegisterId)}&`
      : '';

    if (pathname === workspaceRoot) {
      window.dispatchEvent(new CustomEvent('aim4price:open-register-change'));
      return;
    }

    window.location.assign(`${workspaceRoot}?${registerQuery}changeRegister=1`);
  }

  async function handleOpenAssetDiscoveryNotification(enquiryId: string, notificationId: string) {
    markNotificationOpened(notificationId);
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
      resolveNotifications((item) => item.assetDiscoveryEnquiryId === enquiryId);
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
      if (revaluationNeedsAttention) {
        const followUpNotifications = notifications
          .filter((item) => item.state === 'needs_action' && item.dealerAssetCorrectionId === correctionId)
          .map((item) => ({
            ...item,
            id: `${item.id}:${data.outcome}`,
            title: data.outcome === 'accepted_revaluation_failed'
              ? 'Aim4price recalculation needs attention'
              : 'Aim4price recalculation pending',
            body: data.message || 'The replacement price was saved, but recalculation still needs attention.',
            dealerAssetCorrectionAction: data.outcome === 'accepted_revaluation_failed' ? 'retry' as const : 'pending' as const,
            state: 'needs_action' as const,
            isRead: false,
            readAtIso: null,
            resolvedAtIso: null,
          }));
        resolveNotifications((item) => item.dealerAssetCorrectionId === correctionId);
        setNotifications((current) => [...current, ...followUpNotifications]);
      } else {
        resolveNotifications((item) => item.dealerAssetCorrectionId === correctionId);
      }
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
      resolveNotifications((item) => item.dealerMaintenanceScheduleProposalId === proposalId);
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

  function handleOpenDealerCost(invoiceId: string, notificationId: string) {
    markNotificationOpened(notificationId);
    setNotificationOpen(false);
    closeNotificationDetailModal();
    setActiveDealerCostInvoiceId(invoiceId);
  }

  function handleDealerCostResolved(
    invoiceId: string,
    action: 'store' | 'delete',
    decision: 'approve' | 'decline' | 'keep' | 'delete',
    message: string,
  ) {
    resolveNotifications((item) => item.dealerCostInvoiceId === invoiceId);
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
      if (succeeded) {
        resolveNotifications((item) => item.dealerAssetCorrectionId === correctionId);
      } else {
        setNotifications((current) => current.map((item) => item.dealerAssetCorrectionId === correctionId
          ? {
              ...item,
              body: data.message || item.body,
              dealerAssetCorrectionAction: data.outcome === 'accepted_revaluation_failed' ? 'retry' : 'pending',
            }
          : item));
      }
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
    return notification.state === 'new' || notification.state === 'needs_action';
  }

  function renderNotificationItem(notification: HeaderNotificationItem) {
    const toneClass = styles[`notificationTone${notification.tone.charAt(0).toUpperCase()}${notification.tone.slice(1)}`];
    const newClass = isNotificationNew(notification) ? styles.notificationItemNew : '';
    const priorityClass = notification.priority ? styles.notificationItemPriority : '';
    const baseClassName = `${styles.notificationItem} ${toneClass} ${newClass} ${priorityClass}`;

    if (notification.actionRequired && !notification.resolvedAtIso && notification.dealerCostInvoiceId) {
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
                onClick={() => handleOpenDealerCost(invoiceId, notification.id)}
              >
                {notification.dealerCostAction === 'delete' ? 'Review deletion' : 'View cost'}
              </button>
            </span>
          </span>
        </div>
      );
    }

    if (notification.actionRequired && !notification.resolvedAtIso && notification.dealerMaintenanceScheduleProposalId) {
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

    if (notification.actionRequired && !notification.resolvedAtIso && notification.dealerAssetCorrectionId) {
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

    if (notification.actionRequired && !notification.resolvedAtIso && notification.assetDiscoveryEnquiryId) {
      const loading = loadingNotificationActionId === `asset-discovery:${notification.assetDiscoveryEnquiryId}`;

      return (
        <button
          type="button"
          key={notification.id}
          className={`${baseClassName} ${styles.notificationItemButton}`}
          onClick={() => handleOpenAssetDiscoveryNotification(notification.assetDiscoveryEnquiryId as string, notification.id)}
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
          onClick={() => handleNotificationLinkClick(notification.id)}
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
    const isDenied = !isPending && !isApproved;
    const isLicensingExpert = session?.accountType === 'licensing';
    const retryDate = formatDateTime(enquiry.requestAgainAtIso);
    const contact = enquiry.requesterContact || enquiry.ownerContact || enquiry.dealerContact;
    const requesterLabel = enquiry.requesterAccountType === 'owner'
      ? 'owner'
      : enquiry.requesterAccountType === 'licensing'
        ? 'licence renewal expert'
        : 'dealer';
    const isLicensingEnquiry = enquiry.requesterAccountType === 'licensing';
    const detailTitle = isLicensingEnquiry
      ? isPending
        ? 'Renewal help offer'
        : isApproved
          ? 'Renewal help accepted'
          : 'Renewal help declined'
      : 'Discovery enquiry';

    return (
      <section
        className={`${styles.notificationDetailModal} ${styles.notificationDiscoveryDetailModal} ${isLicensingEnquiry ? styles.notificationRenewalDetailModal : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-asset-discovery-title"
      >
        <div className={styles.notificationDetailHeader}>
          <div className={styles.notificationDetailHeaderText}>
            {isLicensingEnquiry ? <span className={styles.notificationRenewalEyebrow}>Licence renewal</span> : null}
            <h2 id="notification-asset-discovery-title">{detailTitle}</h2>
            <p>{isPending
              ? isLicensingEnquiry
                ? 'An expert offered to manage this renewal. Review the asset, then accept or decline.'
                : `${requesterLabel === 'owner' ? 'An' : 'A'} ${requesterLabel} is looking for a machine like this. Interested in making contact?`
              : isLicensingEnquiry
                ? isApproved
                  ? 'The owner accepted this renewal request.'
                  : 'The owner declined this renewal request.'
                : 'Asset-specific enquiry status.'}</p>
          </div>
          <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label={`Close ${isLicensingEnquiry ? 'renewal help offer' : 'Discovery enquiry'}`}>
            ×
          </button>
        </div>

        <div className={styles.notificationDetailBody}>
          <div className={styles.notificationDetailMetaGrid}>
            <div className={styles.notificationDetailMetaCard}>
              <span>{isLicensingEnquiry ? 'Asset' : 'Type'}</span>
              <strong>{isLicensingEnquiry ? [enquiry.asset.brand, enquiry.asset.model].filter(Boolean).join(' ') : enquiry.asset.type}</strong>
            </div>
            <div className={`${styles.notificationDetailMetaCard} ${isLicensingEnquiry ? styles.notificationRenewalDateCard : ''}`}>
              <span>{isLicensingEnquiry ? 'Renewal due' : 'Brand / model'}</span>
              <strong>{isLicensingEnquiry ? enquiry.asset.renewalWindow || 'Not saved' : [enquiry.asset.brand, enquiry.asset.model].filter(Boolean).join(' ')}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>{isLicensingEnquiry ? 'Year' : 'Year / usage'}</span>
              <strong>{isLicensingEnquiry ? enquiry.asset.year : `${enquiry.asset.year} · ${enquiry.asset.usage}`}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Province</span>
              <strong>{enquiry.asset.province}</strong>
            </div>
          </div>

          {isPending && isLicensingEnquiry ? (
            <div className={styles.notificationRenewalShareNote}>
              <strong>What approval shares</strong>
              <p>Basic asset details, renewal date, photos and licence documents. Accepted offers are marked Won in the expert&apos;s Discovery.</p>
            </div>
          ) : null}

          {!isPending ? (
            <div className={`${styles.notificationDetailStatusBox} ${isDenied ? styles.notificationDetailStatusBoxDenied : ''}`}>
              <strong>{isApproved ? 'Access approved' : 'Request declined'}</strong>
              <p>{isApproved
                ? isLicensingEnquiry
                  ? 'Accepted. This offer is now marked Won in the licence expert’s Discovery.'
                  : 'Approved. Your contact details are now visible to the interested user for three months.'
                : isLicensingEnquiry
                  ? isLicensingExpert
                    ? 'Not accepted. You cannot offer renewal help for this asset again.'
                    : 'Declined. This expert cannot offer renewal help for this asset again.'
                  : retryDate
                    ? `Not interested right now. This asset is hidden from Discovery until ${retryDate}.`
                    : 'Not interested right now. This asset is hidden from Discovery for 90 days.'}</p>
            </div>
          ) : null}

          {isApproved && enquiry.requesterMessage ? (
            <div className={styles.notificationDetailMessageBox}>
              <strong>{enquiry.requesterAccountType === 'dealer' ? 'Dealer' : enquiry.requesterAccountType === 'licensing' ? 'Licence renewal expert' : 'Owner'} message</strong>
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
              {isProcessing ? 'Saving...' : isLicensingEnquiry ? 'Decline' : 'No'}
            </button>
            <button
              type="button"
              className={styles.notificationPrimaryButton}
              onClick={() => handleAssetDiscoveryDecision(enquiry.id, 'approved')}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving...' : isLicensingEnquiry ? 'Accept help' : 'Yes'}
            </button>
          </div>
        ) : (
          <div className={styles.notificationDetailActions}>
            <button type="button" className={styles.notificationSecondaryButton} onClick={closeNotificationDetailModal}>
              Close
            </button>
            {isApproved && isLicensingEnquiry && isLicensingExpert ? (
              <a
                className={styles.notificationPrimaryButton}
                href="/leads"
                onClick={markNotificationsSeen}
              >
                Open lead
              </a>
            ) : isApproved && Boolean(enquiry.ownerContact) ? (
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
            <span className={styles.mobileMenuKicker}>{session ? 'Your workspace' : 'Aim4price navigation'}</span>
            <strong className={styles.mobileMenuTitle}>{session ? 'Account menu' : 'Explore Aim4price'}</strong>
            {session ? <span className={styles.mobileMenuAccountName}>{accountName}</span> : null}
          </div>
          <button
            type="button"
            className={styles.mobileMenuCloseButton}
            aria-label="Close navigation menu"
            onClick={closeMobileMenu}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" />
            </svg>
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
                <MobileNavIcon page={item.key} />
                <span className={styles.mobileMenuNavLabel}>{item.label}</span>
                <span className={styles.mobileMenuNavArrow} aria-hidden="true">
                  <svg viewBox="0 0 20 20">
                    <path d="m7.5 4.8 5.2 5.2-5.2 5.2" />
                  </svg>
                </span>
              </Link>
            );
          })}
        </nav>

        {session ? (
          <div className={styles.mobileMenuAccountActions}>
            {isAccountantWorkspace ? (
              <button type="button" className={styles.mobileMenuActionButton} onClick={handleChangeAccountantRegister}>
                Change
              </button>
            ) : null}
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
            <SmartLink href={primaryHref} className={`${styles.mobileMenuAuthLink} ${styles.mobileMenuAuthLinkPrimary}`} onClick={closeMobileMenu}>
              {ctaLabel}
            </SmartLink>
            <SmartLink href={loginHref} className={styles.mobileMenuAuthLink} onClick={closeMobileMenu}>
              Login
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

              <div className={styles.notificationInboxControls}>
                <label className={styles.notificationSearchBox}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16 16 4 4" />
                  </svg>
                  <input
                    type="search"
                    value={notificationSearchQuery}
                    onChange={(event) => {
                      setNotificationSearchQuery(event.target.value);
                      setNotificationPage(1);
                    }}
                    placeholder="Search notifications…"
                    aria-label="Search notifications"
                  />
                  {notificationSearchQuery ? (
                    <button type="button" onClick={() => setNotificationSearchQuery('')} aria-label="Clear notification search">×</button>
                  ) : null}
                </label>
                <div className={styles.notificationViewTabs} role="tablist" aria-label="Notification sections">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={notificationView === 'active'}
                    className={notificationView === 'active' ? styles.notificationViewTabActive : ''}
                    onClick={() => {
                      setNotificationView('active');
                      setNotificationPage(1);
                    }}
                  >
                    Active <span>{activeNotificationCount}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={notificationView === 'history'}
                    className={notificationView === 'history' ? styles.notificationViewTabActive : ''}
                    onClick={() => {
                      setNotificationView('history');
                      setNotificationPage(1);
                    }}
                  >
                    History <span>{historyNotifications.length}</span>
                  </button>
                </div>
              </div>

              <div className={styles.notificationListHeader} aria-live="polite">
                <span>
                  {isLoadingNotifications
                    ? 'Checking activity'
                    : displayNotificationCount
                      ? hasNotificationPages
                        ? `${notificationRangeStart}-${notificationRangeEnd} of ${displayNotificationCount} notifications`
                        : `${displayNotificationCount} ${displayNotificationCount === 1 ? 'notification' : 'notifications'}`
                      : notificationSearchQuery
                        ? 'No matching notifications'
                        : notificationView === 'history'
                          ? 'No notification history'
                          : 'No active notifications'}
                </span>
                <div className={styles.notificationListHeaderActions}>
                  <strong>
                    {notificationView === 'history'
                      ? 'Searchable history'
                      : needsActionCount
                        ? `${needsActionCount} need action`
                        : unreadNotificationCount
                          ? `${unreadNotificationCount} new`
                          : 'All checked'}
                  </strong>
                  {notificationView === 'active' ? (
                    <button
                      type="button"
                      className={`${styles.notificationClearButton} ${unreadNotificationCount ? styles.notificationClearButtonNew : ''}`}
                      onClick={markNotificationsSeen}
                      disabled={!unreadNotificationCount}
                      aria-label={unreadNotificationCount ? `Mark ${unreadNotificationCount} new notifications checked` : 'All notifications are checked'}
                    >
                      {unreadNotificationCount ? 'Mark checked' : 'All checked'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className={styles.notificationList}>
                {isLoadingNotifications ? (
                  <div className={styles.notificationEmpty}>Loading notifications...</div>
                ) : displayNotificationCount ? (
                  visibleNotifications.map((notification) => renderNotificationItem(notification))
                ) : (
                  <div className={styles.notificationEmpty}>
                    {notificationSearchQuery
                      ? 'No notifications match your search.'
                      : notificationView === 'history'
                        ? 'Checked notifications will appear here.'
                        : 'You’re all caught up. Checked notifications remain in History.'}
                  </div>
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
            <section className={`${styles.notificationDetailModal} ${styles.leaveAccountModal}`} role="dialog" aria-modal="true" aria-labelledby="leave-account-title">
              <div className={`${styles.notificationDetailHeader} ${styles.leaveAccountHeader}`}>
                <div className={`${styles.notificationDetailHeaderText} ${styles.leaveAccountHeaderText}`}>
                  <h2 id="leave-account-title">Leave this account?</h2>
                  <p>{isAccountantWorkspace
                    ? 'Are you sure you want to leave this account? You will return to My Clients.'
                    : 'Are you sure you want to leave this account? You will return to My Leads.'}</p>
                </div>
                <button type="button" className={styles.notificationDetailCloseButton} onClick={() => setLeaveAccountOpen(false)} aria-label="Cancel leaving account">
                  ×
                </button>
              </div>
              <div className={`${styles.notificationDetailActions} ${styles.leaveAccountActions}`}>
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
        <div
          className={`${styles.inner} ${isDealerAccount ? styles.innerDealer : ''} ${!isLoadingSession && !session ? styles.innerPublic : ''} ${usesCompactHeader ? styles.innerCompact : ''}`}
        >
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

          <nav
            className={`${styles.nav} ${usesCompactHeader ? styles.navCompact : ''}`}
            aria-label="Primary navigation"
          >
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
                      className={`${styles.notificationButton} ${activeNotificationCount ? styles.notificationButtonActive : ''}`}
                      aria-expanded={notificationOpen}
                      aria-haspopup="dialog"
                      aria-controls={notificationOpen ? 'header-notifications-modal' : undefined}
                      aria-label={activeNotificationCount ? `Notifications, ${activeNotificationCount} active` : 'Notifications'}
                      onClick={handleNotificationToggle}
                    >
                      <svg className={styles.notificationIcon} viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M12 22a2.6 2.6 0 0 0 2.42-1.65H9.58A2.6 2.6 0 0 0 12 22Zm7.18-5.32-1.14-1.62a3.9 3.9 0 0 1-.72-2.25V9.7a5.35 5.35 0 0 0-4.05-5.18V3.9a1.27 1.27 0 1 0-2.54 0v.62A5.35 5.35 0 0 0 6.68 9.7v3.11c0 .81-.25 1.59-.72 2.25l-1.14 1.62a1.05 1.05 0 0 0 .86 1.66h12.64a1.05 1.05 0 0 0 .86-1.66Z"
                          fill="currentColor"
                        />
                      </svg>
                      {activeNotificationCount ? (
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
                        {isAccountantWorkspace ? (
                          <>
                            {usesCompactHeader
                              ? sortAccountMenuItems(navItems.filter((item) => item.href !== '/')).map((item) => {
                                  const isActive = activeNavKey === item.key;
                                  return (
                                    <Link
                                      key={`compact-accountant-${item.key}-${item.href}`}
                                      href={item.href}
                                      role="menuitem"
                                      aria-current={isActive ? 'page' : undefined}
                                      className={`${styles.menuLink} ${isActive ? styles.menuLinkActive : ''}`}
                                      onClick={closeAccountMenu}
                                    >
                                      <span>{item.label}</span>
                                    </Link>
                                  );
                                })
                              : null}
                            <button type="button" role="menuitem" className={styles.menuLink} onClick={handleChangeAccountantRegister}>
                              <span>Change</span>
                            </button>
                            <button type="button" role="menuitem" className={styles.menuDangerButton} onClick={requestLeaveAccount}>
                              Leave account
                            </button>
                          </>
                        ) : (
                          <>
                            {sortAccountMenuItems(session?.accountType === 'licensing'
                              ? LICENSING_ACCOUNT_MENU_ITEMS
                              : isAccountantAccount
                                ? ACCOUNTANT_ACCOUNT_MENU_ITEMS
                                : isMiddlemanAccount
                                  ? MIDDLEMAN_ACCOUNT_MENU_ITEMS
                                  : ACCOUNT_MENU_ITEMS.filter((item) => isAccountMenuItemVisible(item, session?.accountType))
                            ).map((item) => {
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
                          </>
                        )}
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
