'use client';

import { useEffect, useMemo, useRef, useState, type MouseEventHandler, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './AppHeader.module.css';

type ActivePage =
  | 'home'
  | 'valuation'
  | 'asset-register'
  | 'asset-map'
  | 'cost'
  | 'fuel'
  | 'account'
  | 'asset-discovery'
  | 'leads'
  | 'users'
  | 'marketplace'
  | 'none';

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

type SessionUser = AccountLogoFields & {
  id: string;
  name: string;
  email: string;
  accountType: AccountType;
  account?: AccountLogoFields | null;
  company?: AccountLogoFields | null;
  business?: AccountLogoFields | null;
  profile?: AccountLogoFields | null;
  organization?: AccountLogoFields | null;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: SessionUser | null;
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

type HeaderNotificationCategory = 'partner_note' | 'lead' | 'qr_scan' | 'fuel' | 'contact_request' | 'asset_discovery' | 'account';

type HeaderNotificationTone = 'neutral' | 'success' | 'warning' | 'info';

type HeaderNotificationItem = {
  id: string;
  category: HeaderNotificationCategory;
  tone: HeaderNotificationTone;
  title: string;
  body: string;
  href: string;
  createdAtIso: string;
  contactRequestId?: string;
  assetDiscoveryEnquiryId?: string;
  messageId?: string;
  messageType?: 'message' | 'ad';
};

type ContactRequestStatus = 'pending' | 'approved' | 'temporarily_denied' | 'permanently_denied';
type ContactDecisionStatus = 'approved' | 'denied';
type AssetDiscoveryDecisionStatus = 'approved' | 'denied';

type ContactDetailRequest = {
  id: string;
  ownerUserId: string;
  requesterUserId: string;
  status: ContactRequestStatus;
  requesterAccountType: string;
  requesterDisplayName: string;
  requesterBusinessName: string;
  requesterPhone: string;
  requesterEmail: string;
  requesterLocation: string;
  ownerCompanyName: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerContactLocation: string;
  createdAtIso: string;
  lastRequestedAtIso: string | null;
  approvedAtIso: string | null;
  deniedAtIso: string | null;
  updatedAtIso: string;
  deniedCount: number;
  lastDeniedAtIso: string | null;
  requestAgainAtIso: string | null;
  permanentlyDeniedAtIso: string | null;
  popiaAcknowledgedAtIso: string | null;
};


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
  dealerMessage: string;
  dealerContact: AssetDiscoveryContactDetails | null;
  ownerContact: AssetDiscoveryContactDetails | null;
};

type AssetDiscoveryEnquiryResponse = {
  ok?: boolean;
  enquiry?: AssetDiscoveryEnquiry;
  error?: string;
};

type UserMessage = {
  id: string;
  ownerUserId: string;
  senderUserId: string;
  messageType: 'message' | 'ad';
  messageText: string;
  adCaption: string;
  senderAccountType: string;
  senderDisplayName: string;
  senderBusinessName: string;
  senderPhone: string;
  senderEmail: string;
  senderLocation: string;
  imageFileName: string;
  imageMimeType: string;
  imageSizeBytes: number;
  imageUrl: string;
  hasImage: boolean;
  documentFileName: string;
  documentMimeType: string;
  documentSizeBytes: number;
  documentUrl: string;
  hasDocument: boolean;
  readAtIso: string | null;
  createdAtIso: string;
  updatedAtIso: string;
};

type UserMessageAttachmentPreview = {
  id: string;
  kind: 'image' | 'document';
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

type NotificationsResponse = {
  ok: boolean;
  notifications?: HeaderNotificationItem[];
  error?: string;
};

type ContactRequestResponse = {
  ok?: boolean;
  contactRequest?: ContactDetailRequest;
  error?: string;
};

type UserMessageResponse = {
  ok?: boolean;
  message?: UserMessage;
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
  { key: 'fuel', href: '/fuel', label: 'Fuel Ledger' },
  { key: 'account', href: '/account', label: 'Account' },
];

const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: '/account', label: 'Account' },
  { href: '/users', label: 'Users', accountTypes: ['dealer'] },
  { href: '/asset-map', label: 'Asset Map', accountTypes: ['owner'] },
  { href: '/my-invoices', label: 'Cost Ledger', accountTypes: ['owner'] },
  { href: '/fuel', label: 'Fuel Ledger', accountTypes: ['owner'] },
];

function isAccountMenuItemVisible(item: AccountMenuItem, accountType: AccountType | undefined): boolean {
  if (!item.accountTypes?.length) {
    return true;
  }

  return Boolean(accountType && item.accountTypes.includes(accountType));
}

function buildNavItems(accountType: AccountType | 'public' | null): NavItem[] {
  if (accountType === null) {
    return BASE_NAV_ITEMS;
  }

  if (accountType === 'finance' || accountType === 'insurance') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'My Leads' },
      { key: 'users', href: '/users', label: 'Users' },
    ];
  }

  if (accountType === 'dealer') {
    return [
      ...BASE_NAV_ITEMS,
      { key: 'leads', href: '/leads', label: 'My Leads' },
      { key: 'asset-discovery', href: '/asset-discovery', label: 'Discovery' },
      { key: 'marketplace', href: '/marketplace', label: 'Marketplace' },
    ];
  }

  if (accountType === 'owner') {
    return OWNER_NAV_ITEMS;
  }

  return DEFAULT_NAV_ITEMS;
}

function buildMobileNavItems(accountType: AccountType): NavItem[] {
  const items = buildNavItems(accountType);

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

  const pathMatchedItem = items.find((item) => isPathMatchingHref(normalizedPath, item.href));

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

function formatAccountTypeLabel(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();

  if (normalized === 'finance') return 'Finance';
  if (normalized === 'insurance') return 'Insurance';
  if (normalized === 'dealer') return 'Dealer';
  if (normalized === 'owner') return 'Owner';

  return 'Aim4price';
}

function contactRequesterName(request: ContactDetailRequest): string {
  return request.requesterBusinessName || request.requesterDisplayName || 'Aim4price user';
}

function messageSenderName(message: UserMessage): string {
  return message.senderBusinessName || message.senderDisplayName || 'Aim4price user';
}

function byteSizeLabel(value: number): string {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function fileNameHasExtension(fileName: string, extensions: string[]): boolean {
  const extension = fileName.split('.').pop()?.trim().toLowerCase() ?? '';
  return extensions.includes(extension);
}

function isImageAttachment(mimeType: string | undefined, fileName: string): boolean {
  const normalizedMimeType = String(mimeType ?? '').trim().toLowerCase();
  return normalizedMimeType.startsWith('image/') || fileNameHasExtension(fileName, ['jpg', 'jpeg', 'png', 'webp']);
}

function isPdfAttachment(mimeType: string | undefined, fileName: string): boolean {
  const normalizedMimeType = String(mimeType ?? '').trim().toLowerCase();
  return normalizedMimeType === 'application/pdf' || fileNameHasExtension(fileName, ['pdf']);
}

function buildUserMessageAttachments(message: UserMessage): UserMessageAttachmentPreview[] {
  const attachments: UserMessageAttachmentPreview[] = [];

  if (message.hasImage && message.imageUrl) {
    attachments.push({
      id: `${message.id}:image`,
      kind: 'image',
      label: message.messageType === 'ad' ? 'Ad photo' : 'Photo',
      fileName: message.imageFileName || 'aim4price-photo',
      mimeType: message.imageMimeType,
      sizeBytes: message.imageSizeBytes,
      url: message.imageUrl,
    });
  }

  if (message.hasDocument && message.documentUrl) {
    const documentIsImage = isImageAttachment(message.documentMimeType, message.documentFileName);

    attachments.push({
      id: `${message.id}:document`,
      kind: documentIsImage ? 'image' : 'document',
      label: documentIsImage ? 'Attached photo' : 'Attached document',
      fileName: message.documentFileName || 'aim4price-document',
      mimeType: message.documentMimeType,
      sizeBytes: message.documentSizeBytes,
      url: message.documentUrl,
    });
  }

  return attachments;
}

function requestStatusText(request: ContactDetailRequest): string {
  if (request.status === 'approved') return 'Contact details shared.';
  if (request.status === 'permanently_denied') return 'This request has been permanently denied.';
  if (request.status === 'temporarily_denied') {
    const retryDate = formatDateTime(request.requestAgainAtIso);
    return retryDate ? `This request has been temporarily denied. Try again after ${retryDate}.` : 'This request has been temporarily denied.';
  }

  return 'This account is requesting access to your saved owner contact details.';
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
  const notificationDialogRef = useRef<HTMLElement | null>(null);
  const hasLoadedSessionOnceRef = useRef(false);

  const [session, setSession] = useState<SessionResponse['user']>(null);
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
  const [processingContactRequestIds, setProcessingContactRequestIds] = useState<Set<string>>(() => new Set());
  const [processingAssetDiscoveryEnquiryIds, setProcessingAssetDiscoveryEnquiryIds] = useState<Set<string>>(() => new Set());
  const [activeContactRequest, setActiveContactRequest] = useState<ContactDetailRequest | null>(null);
  const [activeAssetDiscoveryEnquiry, setActiveAssetDiscoveryEnquiry] = useState<AssetDiscoveryEnquiry | null>(null);
  const [activeUserMessage, setActiveUserMessage] = useState<UserMessage | null>(null);
  const [activeMessageAttachmentIndex, setActiveMessageAttachmentIndex] = useState(0);
  const [notificationDetailError, setNotificationDetailError] = useState<string | null>(null);
  const [loadingNotificationActionId, setLoadingNotificationActionId] = useState<string | null>(null);
  const [canUseNotificationPortal, setCanUseNotificationPortal] = useState(false);

  useEffect(() => {
    setCanUseNotificationPortal(true);
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
        setActiveContactRequest(null);
        setActiveAssetDiscoveryEnquiry(null);
        setActiveUserMessage(null);
        setActiveMessageAttachmentIndex(0);
        setNotificationDetailError(null);
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
    mobileMenuOpen || notificationOpen || Boolean(activeContactRequest) || Boolean(activeAssetDiscoveryEnquiry) || Boolean(activeUserMessage) || Boolean(notificationDetailError);

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
    setActiveMessageAttachmentIndex(0);
  }, [activeUserMessage?.id]);

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
  const sessionAccountLogoUrl = useMemo(() => pickAccountLogoUrl(session), [session]);
  const accountLogoUrl = accountProfileLogoState.loaded
    ? accountProfileLogoState.logoUrl
    : sessionAccountLogoUrl;
  const isOwnerAccount = session?.accountType === 'owner';
  const navAccountType = isLoadingSession ? null : (session?.accountType ?? 'public');
  const navItems = useMemo(() => buildNavItems(navAccountType), [navAccountType]);
  const mobileNavItems = useMemo(
    () => (session?.accountType ? buildMobileNavItems(session.accountType) : navItems),
    [navItems, session?.accountType],
  );
  const activeNavKey = useMemo(() => resolveActiveNavKey(pathname, navItems, active), [active, navItems, pathname]);
  const [navWindowStart, setNavWindowStart] = useState(0);
  const navMaxWindowStart = Math.max(0, navItems.length - NAV_WINDOW_SIZE);
  const showNavWindowControls = navItems.length > NAV_WINDOW_SIZE;
  const visibleNavItems = useMemo(
    () => navItems.slice(navWindowStart, navWindowStart + NAV_WINDOW_SIZE),
    [navItems, navWindowStart],
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
      if (activeIndex >= current && activeIndex < current + NAV_WINDOW_SIZE) {
        return Math.min(current, navMaxWindowStart);
      }

      return Math.min(navMaxWindowStart, Math.max(0, activeIndex - NAV_WINDOW_SIZE + 1));
    });
  }, [activeNavKey, navItems, navMaxWindowStart, showNavWindowControls]);

  function moveNavWindow(direction: -1 | 1) {
    setNavWindowStart((current) => Math.min(navMaxWindowStart, Math.max(0, current + direction)));
  }

  useEffect(() => {
    if (!session?.id) {
      setAccountProfileLogoState({ loaded: false, logoUrl: null });
      return;
    }

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
    setActiveContactRequest(null);
    setActiveAssetDiscoveryEnquiry(null);
    setActiveUserMessage(null);
    setActiveMessageAttachmentIndex(0);
    setNotificationDetailError(null);
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
        closeNotificationDetailModal();
      }

      return nextOpen;
    });
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  async function handleOpenContactRequestNotification(contactRequestId: string) {
    setNotificationOpen(false);
    setNotificationDetailError(null);
    setLoadingNotificationActionId(`contact:${contactRequestId}`);

    try {
      const response = await fetch(`/api/users/contact-requests/${encodeURIComponent(contactRequestId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const data = (await response.json()) as ContactRequestResponse;

      if (!response.ok || !data.ok || !data.contactRequest) {
        throw new Error(data.error || 'Failed to load contact request.');
      }

      setActiveUserMessage(null);
      setActiveAssetDiscoveryEnquiry(null);
      setActiveContactRequest(data.contactRequest);
      markNotificationsSeen();
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to load contact request.');
    } finally {
      setLoadingNotificationActionId(null);
    }
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

      setActiveContactRequest(null);
      setActiveUserMessage(null);
      setActiveMessageAttachmentIndex(0);
      setActiveAssetDiscoveryEnquiry(data.enquiry);
      markNotificationsSeen();
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to load Discovery enquiry.');
    } finally {
      setLoadingNotificationActionId(null);
    }
  }

  async function handleOpenUserMessageNotification(messageId: string) {
    setNotificationOpen(false);
    setNotificationDetailError(null);
    setLoadingNotificationActionId(`message:${messageId}`);

    try {
      const response = await fetch(`/api/users/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = (await response.json()) as UserMessageResponse;

      if (!response.ok || !data.ok || !data.message) {
        throw new Error(data.error || 'Failed to load message.');
      }

      setActiveContactRequest(null);
      setActiveAssetDiscoveryEnquiry(null);
      setActiveMessageAttachmentIndex(0);
      setActiveUserMessage(data.message);
      setNotifications((current) => current.filter((item) => item.messageId !== messageId));
      markNotificationsSeen();
    } catch (error) {
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to load message.');
    } finally {
      setLoadingNotificationActionId(null);
    }
  }

  async function handleContactRequestDecision(contactRequestId: string, status: ContactDecisionStatus) {
    setProcessingContactRequestIds((current) => new Set(current).add(contactRequestId));
    setNotificationDetailError(null);

    try {
      const response = await fetch(`/api/users/contact-requests/${encodeURIComponent(contactRequestId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as ContactRequestResponse;

      if (!response.ok || !data.ok || !data.contactRequest) {
        throw new Error(data.error || 'Failed to update contact request.');
      }

      setActiveContactRequest(data.contactRequest);
      setNotifications((current) => current.filter((item) => item.contactRequestId !== contactRequestId));
      markNotificationsSeen();
    } catch (error) {
      console.error('Failed to update contact request notification', error);
      setNotificationDetailError(error instanceof Error ? error.message : 'Failed to update contact request.');
    } finally {
      setProcessingContactRequestIds((current) => {
        const next = new Set(current);
        next.delete(contactRequestId);
        return next;
      });
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

      setActiveAssetDiscoveryEnquiry(data.enquiry);
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
      setSession(null);
      setMenuOpen(false);
      setMobileMenuOpen(false);
      setNotificationOpen(false);
      setNotifications([]);
      setIsSigningOut(false);
      router.refresh();
      window.location.href = '/';
    }
  }

  function renderNotificationCopy(notification: HeaderNotificationItem, actionLabel?: string) {
    return (
      <>
        <span className={styles.notificationDot} aria-hidden="true" />
        <span className={styles.notificationCopy}>
          <strong>{notification.title}</strong>
          <span>{notification.body}</span>
          <small>{formatNotificationTime(notification.createdAtIso)}</small>
          {actionLabel ? <span className={styles.notificationOpenHint}>{actionLabel}</span> : null}
        </span>
      </>
    );
  }

  function isNotificationNew(notification: HeaderNotificationItem): boolean {
    return parseTime(notification.createdAtIso) > notificationsSeenTime;
  }

  function renderNotificationItem(notification: HeaderNotificationItem) {
    const toneClass = styles[`notificationTone${notification.tone.charAt(0).toUpperCase()}${notification.tone.slice(1)}`];
    const messageClass = notification.messageId ? styles.notificationItemMessage : '';
    const newClass = isNotificationNew(notification) ? styles.notificationItemNew : '';
    const baseClassName = `${styles.notificationItem} ${toneClass} ${messageClass} ${newClass}`;

    if (notification.contactRequestId) {
      const loading = loadingNotificationActionId === `contact:${notification.contactRequestId}`;

      return (
        <button
          type="button"
          key={notification.id}
          className={`${baseClassName} ${styles.notificationItemButton}`}
          onClick={() => handleOpenContactRequestNotification(notification.contactRequestId as string)}
          disabled={loading}
        >
          {renderNotificationCopy(notification, loading ? 'Opening request...' : 'Open request')}
        </button>
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

    if (notification.messageId) {
      const loading = loadingNotificationActionId === `message:${notification.messageId}`;
      const actionLabel = notification.messageType === 'ad' ? 'Open ad' : 'Open message';

      return (
        <button
          type="button"
          key={notification.id}
          className={`${baseClassName} ${styles.notificationItemButton}`}
          onClick={() => handleOpenUserMessageNotification(notification.messageId as string)}
          disabled={loading}
        >
          {renderNotificationCopy(notification, loading ? 'Opening...' : actionLabel)}
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

  function renderContactRequestDetailModal(request: ContactDetailRequest) {
    const requesterName = contactRequesterName(request);
    const isProcessing = processingContactRequestIds.has(request.id);
    const isPending = request.status === 'pending';

    return (
      <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="notification-contact-title">
        <div className={styles.notificationDetailHeader}>
          <div className={styles.notificationDetailHeaderText}>
            <h2 id="notification-contact-title">{requesterName}</h2>
            <p>{formatAccountTypeLabel(request.requesterAccountType)} account requesting access to your saved owner contact details.</p>
          </div>
          <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label="Close contact request">
            ×
          </button>
        </div>

        <div className={styles.notificationDetailBody}>
          <div className={styles.notificationDetailMetaGrid}>
            <div className={styles.notificationDetailMetaCard}>
              <span>Business / account</span>
              <strong>{request.requesterBusinessName || request.requesterDisplayName || 'Not supplied'}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Account type</span>
              <strong>{formatAccountTypeLabel(request.requesterAccountType)}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Requested</span>
              <strong>{formatDateTime(request.createdAtIso) || 'Just now'}</strong>
            </div>
            <div className={styles.notificationDetailMetaCard}>
              <span>Requester location</span>
              <strong>{request.requesterLocation || 'Not supplied'}</strong>
            </div>
          </div>

          <div className={styles.notificationDetailMessageBox}>
            <strong>What they are requesting</strong>
            <p>
              This account wants permission to view your saved phone and email contact details inside Aim4price so that messages/ads/documents can be sent via the Aim4price platform. Accept only if you are comfortable sharing those details with this account.
            </p>
          </div>

          {!isPending ? (
            <div className={styles.notificationDetailStatusBox}>
              <strong>Decision saved</strong>
              <p>{requestStatusText(request)}</p>
            </div>
          ) : null}
        </div>

        {isPending ? (
          <div className={styles.notificationDetailActions}>
            <button
              type="button"
              className={styles.notificationSoftDangerButton}
              onClick={() => handleContactRequestDecision(request.id, 'denied')}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving...' : 'Deny request'}
            </button>
            <button
              type="button"
              className={styles.notificationPrimaryButton}
              onClick={() => handleContactRequestDecision(request.id, 'approved')}
              disabled={isProcessing}
            >
              {isProcessing ? 'Saving...' : 'Accept request'}
            </button>
          </div>
        ) : (
          <div className={styles.notificationDetailActions}>
            <button type="button" className={styles.notificationSecondaryButton} onClick={closeNotificationDetailModal}>
              Close
            </button>
          </div>
        )}
      </section>
    );
  }

  function renderAssetDiscoveryDetailModal(enquiry: AssetDiscoveryEnquiry) {
    const isProcessing = processingAssetDiscoveryEnquiryIds.has(enquiry.id);
    const isPending = enquiry.status === 'pending';
    const isApproved = enquiry.status === 'approved';
    const retryDate = formatDateTime(enquiry.requestAgainAtIso);
    const contact = enquiry.dealerContact || enquiry.ownerContact;

    return (
      <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="notification-asset-discovery-title">
        <div className={styles.notificationDetailHeader}>
          <div className={styles.notificationDetailHeaderText}>
            <h2 id="notification-asset-discovery-title">Discovery enquiry</h2>
            <p>{isPending ? 'A dealer is interested in this machine. Are you interested in selling?' : 'Asset-specific enquiry status.'}</p>
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

          {isPending ? (
            <div className={styles.notificationDetailMessageBox}>
              <strong>Owner decision required</strong>
              <p>A dealer is interested in this machine. The dealer message and contact details are hidden until you choose Yes.</p>
            </div>
          ) : null}

          {!isPending ? (
            <div className={styles.notificationDetailStatusBox}>
              <strong>Decision saved</strong>
              <p>{isApproved ? 'Approved. Contact details and the dealer message are now visible.' : retryDate ? `Temporarily denied. The dealer can enquire again after ${retryDate}.` : 'Temporarily denied.'}</p>
            </div>
          ) : null}

          {isApproved && enquiry.dealerMessage ? (
            <div className={styles.notificationDetailMessageBox}>
              <strong>Dealer message</strong>
              <p>{enquiry.dealerMessage}</p>
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
          </div>
        )}
      </section>
    );
  }

  function renderUserMessageDetailModal(message: UserMessage) {
    const senderName = messageSenderName(message);
    const isAd = message.messageType === 'ad';
    const messageCopy = isAd ? message.adCaption || message.messageText : message.messageText;
    const attachments = buildUserMessageAttachments(message);
    const boundedAttachmentIndex = attachments.length
      ? Math.min(activeMessageAttachmentIndex, attachments.length - 1)
      : 0;
    const activeAttachment = attachments[boundedAttachmentIndex] ?? null;
    const hasMultipleAttachments = attachments.length > 1;
    const activeAttachmentIsImage = activeAttachment
      ? activeAttachment.kind === 'image' || isImageAttachment(activeAttachment.mimeType, activeAttachment.fileName)
      : false;
    const activeAttachmentIsPdf = activeAttachment
      ? isPdfAttachment(activeAttachment.mimeType, activeAttachment.fileName)
      : false;

    return (
      <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="notification-message-title">
        <div className={styles.notificationDetailHeader}>
          <div className={styles.notificationDetailHeaderText}>
            <h2 id="notification-message-title">{isAd ? `Ad from ${senderName}` : `Message from ${senderName}`}</h2>
            <p>{formatDateTime(message.createdAtIso) || 'Just now'}</p>
          </div>
          <button type="button" className={styles.notificationDetailCloseButton} onClick={closeNotificationDetailModal} aria-label="Close message">
            ×
          </button>
        </div>

        <div className={styles.notificationDetailBody}>
          {activeAttachment ? (
            <div className={styles.notificationMediaViewer}>
              <div className={styles.notificationMediaStage}>
                {hasMultipleAttachments ? (
                  <button
                    type="button"
                    className={`${styles.notificationMediaNavButton} ${styles.notificationMediaNavPrevious}`}
                    onClick={() => setActiveMessageAttachmentIndex((current) => (current <= 0 ? attachments.length - 1 : current - 1))}
                    aria-label="Previous attachment"
                  >
                    &lt;
                  </button>
                ) : null}

                <div className={styles.notificationMediaContent}>
                  {activeAttachmentIsImage ? (
                    <img
                      src={activeAttachment.url}
                      alt={activeAttachment.fileName || activeAttachment.label}
                      className={styles.notificationDetailImage}
                    />
                  ) : activeAttachmentIsPdf ? (
                    <iframe
                      src={activeAttachment.url}
                      title={activeAttachment.fileName || activeAttachment.label}
                      className={styles.notificationDocumentFrame}
                    />
                  ) : (
                    <div className={styles.notificationDocumentPlaceholder}>
                      <strong>{activeAttachment.label}</strong>
                      <span>{activeAttachment.fileName || 'Open attached file'}</span>
                      <small>Preview may open in a new tab for this file type.</small>
                    </div>
                  )}
                </div>

                {hasMultipleAttachments ? (
                  <button
                    type="button"
                    className={`${styles.notificationMediaNavButton} ${styles.notificationMediaNavNext}`}
                    onClick={() => setActiveMessageAttachmentIndex((current) => (current >= attachments.length - 1 ? 0 : current + 1))}
                    aria-label="Next attachment"
                  >
                    &gt;
                  </button>
                ) : null}
              </div>

              <div className={styles.notificationMediaToolbar}>
                <div className={styles.notificationMediaMeta}>
                  <strong>{activeAttachment.label}</strong>
                  <span>
                    {activeAttachment.fileName || 'Attached file'}
                    {activeAttachment.sizeBytes ? ` · ${byteSizeLabel(activeAttachment.sizeBytes)}` : ''}
                  </span>
                  {hasMultipleAttachments ? <small>{boundedAttachmentIndex + 1} of {attachments.length}</small> : null}
                </div>

                <div className={styles.notificationMediaActions}>
                  <a href={activeAttachment.url} className={styles.notificationMediaActionButton} target="_blank" rel="noreferrer">
                    Open
                  </a>
                  <a
                    href={activeAttachment.url}
                    className={styles.notificationMediaActionButton}
                    download={activeAttachment.fileName || undefined}
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <div className={styles.notificationDetailMessageBox}>
            <strong>{isAd ? 'Caption / note' : 'Message'}</strong>
            <p>{messageCopy || (isAd ? 'No caption supplied.' : 'No message text supplied.')}</p>
          </div>
        </div>

        <div className={styles.notificationDetailActions}>
          <button type="button" className={styles.notificationSecondaryButton} onClick={closeNotificationDetailModal}>
            Close
          </button>
        </div>
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
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? 'Signing out...' : 'Sign out'}
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
                    className={`${styles.notificationClearButton} ${unreadNotificationCount ? styles.notificationClearButtonNew : ''}`}
                    onClick={markNotificationsSeen}
                    aria-label={unreadNotificationCount ? `Mark ${unreadNotificationCount} new notifications checked` : 'Mark all notifications checked'}
                  >
                    Mark checked
                  </button>
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
                <strong>
                  {unreadNotificationCount
                    ? `${unreadNotificationCount} new`
                    : notifications.length
                      ? 'All checked'
                      : 'Clear'}
                </strong>
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
    canUseNotificationPortal && (activeContactRequest || activeAssetDiscoveryEnquiry || activeUserMessage || notificationDetailError)
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
            {activeContactRequest ? renderContactRequestDetailModal(activeContactRequest) : null}
            {activeAssetDiscoveryEnquiry ? renderAssetDiscoveryDetailModal(activeAssetDiscoveryEnquiry) : null}
            {activeUserMessage ? renderUserMessageDetailModal(activeUserMessage) : null}
            {!activeContactRequest && !activeAssetDiscoveryEnquiry && !activeUserMessage && notificationDetailError ? (
              <section className={styles.notificationDetailModal} role="dialog" aria-modal="true" aria-labelledby="notification-error-title">
                <div className={styles.notificationDetailHeader}>
                  <div className={styles.notificationDetailHeaderText}>
                    <span className={styles.notificationDetailKicker}>Notification</span>
                    <h2 id="notification-error-title">Could not open this notification</h2>
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
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
                  <div className={styles.notificationMenu} ref={notificationMenuRef}>
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
                  </div>

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
    </>
  );
}
