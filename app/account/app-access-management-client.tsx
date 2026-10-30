'use client';

import OwnerAccessPicker from './owner-access-picker';
import { AccessSectionIcon } from './owner-login-sections';
import OwnerLoginSections from './owner-login-sections';
import ownerStyles from './owner-login-sections.module.css';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { accountAppUsername } from '../../lib/app-login-name';
import SettingsDetailIcon from '../../components/SettingsDetailIcon';
import AppHeader from '../../components/AppHeader';
import FriendlySelect, { type FriendlySelectOption } from './friendly-select';
import refinementStyles from './access-page-refinements.module.css';
import baseStyles from './dealer-app/page.module.css';
import styles from './app-access-management.module.css';

type DirectoryKind = 'dealer' | 'owner' | 'field';
type AppQrKind = DirectoryKind | 'middleman';
type ActiveFlow = 'new' | 'manage' | null;
type NoticeTone = 'success' | 'error';
type DealerStaffRole = 'owner' | 'sales' | 'parts' | 'technician';
type OwnerAccessRole = 'admin' | 'operations' | 'view_only';

type AccessRecord = {
  id: string;
  displayName: string;
  username: string;
  isActive: boolean;
  lastLoginAtIso: string | null;
  updatedAtIso: string;
  role?: DealerStaffRole;
  accessRole?: OwnerAccessRole;
};

type AccessDraft = {
  displayName: string;
  username: string;
  password: string;
  role: string;
};

type ApiPayload = {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
};

type DirectoryConfig = {
  title: string;
  description: string;
  newDescription: string;
  manageDescription: string;
  loginLinkLabel: string;
  loginPath: string;
  qrApp: AppQrKind;
  shareTitle: string;
  shareText: string;
  listEndpoint: string;
  itemEndpoint: (id: string) => string;
  listKey: string;
  itemKey: string;
  itemLabel: string;
  itemPlural: string;
  displayNameLabel: string;
  displayNamePlaceholder: string;
  usernamePlaceholder: string;
  passwordLabel: string;
  passwordMinimum: number;
  passwordMaximum: number;
  roleField: 'role' | 'accessRole' | null;
  roleLabel: string;
  defaultRole: string;
  roleOptions: Array<FriendlySelectOption<string>>;
  roleValue: (record: AccessRecord) => string;
  roleSummary: (record: AccessRecord) => string;
  createSuccess: string;
  updateSuccess: string;
  updatePasswordSuccess: string;
  activeSuccess: string;
  inactiveSuccess: string;
  deleteSuccess: string;
};

type ManagerAccessSettings = {
  assetScope: 'all' | 'selected';
  fuelScope: 'all' | 'selected';
  canRecordWork: boolean;
  canScheduleMaintenance: boolean;
  canRecordFuel: boolean;
  canRefillFuel: boolean;
  assetIds: string[];
  groupIds: string[];
  fuelStorageIds: string[];
};

type AssetAccessSettings = Pick<ManagerAccessSettings, 'assetScope' | 'assetIds' | 'groupIds'> & { registerIds?: string[] };

type AssetAccessOption = { id: string; title: string; kind: string; registerId?: string | null };
type AssetGroupAccessOption = {
  id: string;
  name: string;
  memberAssetIds: string[];
  memberCount: number;
};

type ManagerAccessResponse = {
  ok?: boolean;
  settings?: ManagerAccessSettings;
  assets?: AssetAccessOption[];
  groups?: AssetGroupAccessOption[];
  storages?: Array<{ id: string; name: string; locationLabel: string }>;
  error?: string;
};

type OwnerAssetAccessResponse = {
  registers?: { id: string; name: string }[];
  ok?: boolean;
  settings?: AssetAccessSettings;
  assets?: AssetAccessOption[];
  groups?: AssetGroupAccessOption[];
  error?: string;
};

const DEALER_ROLE_OPTIONS: Array<FriendlySelectOption<string>> = [
  { value: 'owner', label: 'Owner / Manager', description: 'Full access and problem assignment.' },
  { value: 'sales', label: 'Sales', description: 'Sales tools and approved Parts searches. No Client Costs.' },
  { value: 'parts', label: 'Parts', description: 'Approved Parts searches and uploads, maintenance and Client Costs.' },
  { value: 'technician', label: 'Technician', description: 'Overview and Maintenance only.' },
];

const MIDDLEMAN_ROLE_OPTIONS: Array<FriendlySelectOption<string>> = [
  { value: 'owner', label: 'Owner / Manager', description: 'Full access to the Middleman workspace and login management.' },
  { value: 'sales', label: 'Sales', description: 'Valuations, Advert Studio, Marketplace and the shared showroom.' },
];

const OWNER_ROLE_OPTIONS: Array<FriendlySelectOption<string>> = [
  { value: 'operations', label: 'Operations', description: 'Usage, maintenance, fuel, location, photos and problems.' },
  { value: 'view_only', label: 'View only', description: 'Can view assets and records without changing anything.' },
  { value: 'admin', label: 'Owner / Admin', description: 'Full access, including values, finance, Marketplace and deletion.' },
];

const ASSET_SCOPE_OPTIONS: Array<FriendlySelectOption<ManagerAccessSettings['assetScope']>> = [
  { value: 'all', label: 'All assets', description: 'Includes every current and future asset.' },
  { value: 'selected', label: 'Selected assets only', description: 'Choose the exact assets this manager may use.' },
];

const FUEL_SCOPE_OPTIONS: Array<FriendlySelectOption<ManagerAccessSettings['fuelScope']>> = [
  { value: 'all', label: 'All fuel tanks', description: 'Includes every current and future fuel tank.' },
  { value: 'selected', label: 'Selected tanks only', description: 'Choose the exact tanks this manager may use.' },
];

function dealerRoleLabel(value: unknown): string {
  const role = String(value ?? '').trim();
  return DEALER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Technician';
}

function ownerRoleLabel(value: unknown): string {
  const role = String(value ?? '').trim();
  return OWNER_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? 'Operations';
}

const DIRECTORY_CONFIGS: Record<DirectoryKind, DirectoryConfig> = {
  dealer: {
    title: 'Dealer App Staff',
    description: 'Create team logins and choose what each person can do in the Dealer App.',
    newDescription: 'Create a separate app login.',
    manageDescription: 'Review permissions or deactivate a login.',
    loginLinkLabel: 'Dealer App staff login link',
    loginPath: '/dealer/login',
    qrApp: 'dealer',
    shareTitle: 'Aim4price Dealer App',
    shareText: 'Open the Aim4price Dealer App here:',
    listEndpoint: '/api/dealer/staff',
    itemEndpoint: (id) => `/api/dealer/staff/${encodeURIComponent(id)}`,
    listKey: 'staff',
    itemKey: 'staff',
    itemLabel: 'Dealer App user',
    itemPlural: 'Dealer App users',
    displayNameLabel: 'Display name',
    displayNamePlaceholder: 'Example: Sales Manager',
    usernamePlaceholder: 'example: sales.manager',
    passwordLabel: 'Password',
    passwordMinimum: 8,
    passwordMaximum: 128,
    roleField: 'role',
    roleLabel: 'Role',
    defaultRole: 'technician',
    roleOptions: DEALER_ROLE_OPTIONS,
    roleValue: (record) => record.role ?? 'technician',
    roleSummary: (record) => dealerRoleLabel(record.role),
    createSuccess: 'Dealer App staff login created.',
    updateSuccess: 'Dealer App staff login updated.',
    updatePasswordSuccess: 'Dealer App staff login and password updated.',
    activeSuccess: 'Dealer App staff login activated.',
    inactiveSuccess: 'Dealer App staff login deactivated.',
    deleteSuccess: 'Dealer App staff login deleted.',
  },
  owner: {
    title: 'Owner App Users',
    description: 'Manage your assets from your phone. Create a separate app login and choose its role and asset access.',
    newDescription: 'Create a separate app login.',
    manageDescription: 'Review permissions or deactivate a login.',
    loginLinkLabel: 'Owner App login link',
    loginPath: '/owner-app/login',
    qrApp: 'owner',
    shareTitle: 'Aim4price Owner App',
    shareText: 'Open the Aim4price Owner App here:',
    listEndpoint: '/api/owner-app/users',
    itemEndpoint: (id) => `/api/owner-app/users/${encodeURIComponent(id)}`,
    listKey: 'users',
    itemKey: 'user',
    itemLabel: 'Owner App user',
    itemPlural: 'Owner App users',
    displayNameLabel: 'Display name',
    displayNamePlaceholder: 'Example: Farm owner',
    usernamePlaceholder: 'owner.name',
    passwordLabel: 'Passcode',
    passwordMinimum: 4,
    passwordMaximum: 64,
    roleField: 'accessRole',
    roleLabel: 'Access',
    defaultRole: 'operations',
    roleOptions: OWNER_ROLE_OPTIONS,
    roleValue: (record) => record.accessRole ?? 'operations',
    roleSummary: (record) => ownerRoleLabel(record.accessRole),
    createSuccess: 'Owner App user created.',
    updateSuccess: 'Owner App user updated.',
    updatePasswordSuccess: 'Owner App user updated and existing sessions revoked.',
    activeSuccess: 'Owner App user activated.',
    inactiveSuccess: 'Owner App user deactivated and existing sessions revoked.',
    deleteSuccess: 'Owner App user deleted and existing sessions revoked.',
  },
  field: {
    title: 'Field Manager App',
    description: 'For managers and staff recording fuel, maintenance and problems in the field. You choose the assets, fuel storage and actions each login can access.',
    newDescription: 'Create a separate app login.',
    manageDescription: 'Review permissions or deactivate a login.',
    loginLinkLabel: 'Field Manager login link',
    loginPath: '/field-manager/login',
    qrApp: 'field',
    shareTitle: 'Aim4price Field Manager',
    shareText: 'Open Aim4price Field Manager here:',
    listEndpoint: '/api/field-managers',
    itemEndpoint: (id) => `/api/field-managers/${encodeURIComponent(id)}`,
    listKey: 'managers',
    itemKey: 'manager',
    itemLabel: 'Field Manager',
    itemPlural: 'Field Manager logins',
    displayNameLabel: 'Manager display name',
    displayNamePlaceholder: 'Example: Piet Field Manager',
    usernamePlaceholder: 'example: piet.manager',
    passwordLabel: 'Password',
    passwordMinimum: 6,
    passwordMaximum: 128,
    roleField: null,
    roleLabel: '',
    defaultRole: '',
    roleOptions: [],
    roleValue: () => '',
    roleSummary: () => '',
    createSuccess: 'Field Manager login created.',
    updateSuccess: 'Field Manager login updated.',
    updatePasswordSuccess: 'Field Manager login and password updated.',
    activeSuccess: 'Field Manager login activated.',
    inactiveSuccess: 'Field Manager login deactivated.',
    deleteSuccess: 'Field Manager login deleted.',
  },
};

function LoginDetailIcon({ kind }: { kind: 'person' | 'shield' | 'clock' | 'gear' }) {
  const paths = {
    person: <><circle cx="12" cy="7" r="4" /><path d="M4 21v-2a8 7 0 0 1 16 0v2" /></>,
    shield: <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
    gear: <><path d="m9 3-.6 2.2-1.8 1L4.4 6 2.9 8.6l1.6 1.7v2.1l-1.6 1.7L4.4 17l2.2-.3 1.8 1L9 20h3l.6-2.3 1.8-1 2.2.3 1.5-2.9-1.6-1.7v-2.1l1.6-1.7L16.6 6l-2.2.2-1.8-1L12 3Z" transform="translate(1.5 .5)" /><circle cx="12" cy="12" r="3" /></>,
  };
  return <svg className={styles.loginDetailIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" strokeLinecap="round" />
      <path d="M16 6.5a2.7 2.7 0 0 1 0 5.2M16.5 14.2A4 4 0 0 1 20.5 18v1.5" strokeLinecap="round" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M10.2 13.8a4 4 0 0 0 5.65.05l2.3-2.3a4 4 0 0 0-5.65-5.65l-1.3 1.3" strokeLinecap="round" />
      <path d="M13.8 10.2a4 4 0 0 0-5.65-.05l-2.3 2.3a4 4 0 0 0 5.65 5.65l1.3-1.3" strokeLinecap="round" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="19" r="2.5" />
      <path d="m8.2 10.8 7.6-4.6M8.2 13.2l7.6 4.6" strokeLinecap="round" />
    </svg>
  );
}

function buildAppInstallLink(loginLink: string): string {
  const separator = loginLink.includes('?') ? '&' : '?';
  return `${loginLink}${separator}source=qr&install=1`;
}

function AppInstallQr({ config, loginLink }: { config: DirectoryConfig; loginLink: string }) {
  const [imageFailed, setImageFailed] = useState(false);
  const installLink = buildAppInstallLink(loginLink);

  return (
    <a
      className={styles.qrHandoff}
      href={installLink}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open or install ${config.shareTitle}`}
    >
      <span className={styles.qrImageFrame}>
        {imageFailed ? (
          <span className={styles.qrFallback}>QR unavailable</span>
        ) : (
          <img
            src={`/api/account/app-access-qr?app=${config.qrApp}&v=${encodeURIComponent(config.loginPath)}`}
            alt={`QR code to open or install ${config.shareTitle}`}
            width="132"
            height="132"
            decoding="async"
            draggable={false}
            onError={() => setImageFailed(true)}
          />
        )}
      </span>
      <span className={styles.qrCopy}>
        <strong>Scan to open or install app</strong>
        <small>Use your phone camera. Aim4price will open the correct app and show its install option.</small>
      </span>
    </a>
  );
}

function normalizeUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._@-]/g, '')
    .slice(0, 80);
}

const ACCESS_DIRECTORY_COLLATOR = new Intl.Collator('en-ZA', {
  sensitivity: 'base',
  numeric: true,
  ignorePunctuation: true,
});

function compareAccessDirectoryText(left: unknown, right: unknown): number {
  return ACCESS_DIRECTORY_COLLATOR.compare(String(left ?? '').trim(), String(right ?? '').trim());
}

function sortAccessRecords(records: AccessRecord[]): AccessRecord[] {
  return [...records].sort((left, right) => (
    compareAccessDirectoryText(left.displayName, right.displayName)
    || compareAccessDirectoryText(left.username, right.username)
    || compareAccessDirectoryText(left.id, right.id)
  ));
}

function sortAccessOptions<T>(options: T[], readLabel: (option: T) => unknown): T[] {
  return [...options].sort((left, right) => compareAccessDirectoryText(readLabel(left), readLabel(right)));
}

function readRecordList(payload: ApiPayload | null, key: string): AccessRecord[] {
  const value = payload?.[key];
  return Array.isArray(value) ? value as AccessRecord[] : [];
}

function readRecord(payload: ApiPayload | null, key: string): AccessRecord | null {
  const value = payload?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? value as AccessRecord : null;
}

function extractError(payload: ApiPayload | null, fallback: string): string {
  return typeof payload?.error === 'string' && payload.error.trim() ? payload.error.trim() : fallback;
}

function emptyDraft(config: DirectoryConfig): AccessDraft {
  return {
    displayName: '',
    username: '',
    password: '',
    role: config.defaultRole,
  };
}

function AppAccessModal({
  open,
  title,
  description,
  wide = false,
  notificationStyle = false,
  closeDisabled = false,
  onClose,
  children,
  footer,
  compact = false,
}: {
  open: boolean;
  title: string;
  description: string;
  wide?: boolean;
  notificationStyle?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const closeDisabledRef = useRef(closeDisabled);
  onCloseRef.current = onClose;
  closeDisabledRef.current = closeDisabled;

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]') && !closeDisabledRef.current) onCloseRef.current();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.modalOverlay} data-website-overlay>
      <button
        type="button"
        className={styles.modalBackdrop}
        aria-label="Close dialog"
        onClick={() => { if (!closeDisabled) onClose(); }}
      />
      <section
        className={`${styles.modal} ${wide ? styles.modalWide : ''} ${notificationStyle ? styles.notificationStyle : ''} ${compact ? styles.compactEditorModal : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <header className={styles.modalHeader}>
          <h2 id={titleId}>{title}</h2>
          {description ? <p id={descriptionId}>{description}</p> : null}
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
            data-modal-close="true"
          >
            ×
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
        {footer ? <footer className={styles.editorFooter}>{footer}</footer> : null}
      </section>
    </div>
  );
}

function AccessLauncher({
  config,
  count,
  loading,
  loginLink,
  onNew,
  onManage,
  onCopy,
  onShare,
}: {
  config: DirectoryConfig;
  count: number;
  loading: boolean;
  loginLink: string;
  onNew: () => void;
  onManage: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  const streamlinedLauncher = true;

  return (
    <section className={styles.launcher} aria-labelledby="app-access-title">
      <div className={styles.launcherIntro}>
        <h1 id="app-access-title">{config.title}</h1>
        <p>{config.description}</p>
      </div>

      <div className={styles.actionGrid} aria-label="Choose an access action">
        <button type="button" className={`${styles.actionButton} ${styles.actionButtonNew}`} onClick={onNew}>
          <span className={styles.actionIcon}><PlusIcon /></span>
          <span className={styles.actionCopy}>
            <strong>Add login</strong>
            <small>{config.newDescription}</small>
          </span>
          {streamlinedLauncher ? null : (
            <span className={styles.actionMeta}>
              <span className={styles.actionArrow} aria-hidden="true">›</span>
            </span>
          )}
        </button>

        <button type="button" className={`${styles.actionButton} ${styles.actionButtonManage}`} onClick={onManage}>
          <span className={styles.actionIcon}><UsersIcon /></span>
          <span className={styles.actionCopy}>
            <strong>Manage logins</strong>
            <small>{config.manageDescription}</small>
          </span>
          <span className={styles.actionMeta}>
            <span className={styles.countPill}>{loading ? '…' : count}</span>
            {streamlinedLauncher ? null : (
              <span className={styles.actionArrow} aria-hidden="true">›</span>
            )}
          </span>
        </button>
      </div>

      <div className={`${styles.loginStrip} ${streamlinedLauncher ? styles.loginStripStreamlined : ''}`}>
        <AppInstallQr config={config} loginLink={loginLink} />
        <div className={styles.loginLinkCard}>
          <span className={styles.loginLinkIcon}><LinkIcon /></span>
          <div className={styles.loginCopy}>
            {streamlinedLauncher ? null : (
              <span className={styles.loginLabel}>{config.loginLinkLabel}</span>
            )}
            <a
              className={styles.loginUrl}
              href={loginLink}
              target="_blank"
              rel="noreferrer"
              title={loginLink}
              aria-label={`Open ${config.loginLinkLabel}`}
            >
              <code>{loginLink}</code>
              <span className={styles.loginUrlArrow} aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div
          className={`${styles.loginActions} ${streamlinedLauncher ? styles.loginActionsIconOnly : ''}`}
          aria-label="App login link actions"
        >
          <button
            type="button"
            className={`${styles.linkButton} ${streamlinedLauncher ? styles.linkButtonIconOnly : ''}`}
            onClick={onCopy}
            aria-label={`Copy ${config.loginLinkLabel}`}
            title={streamlinedLauncher ? 'Copy link' : undefined}
          >
            <span className={styles.linkButtonIcon}><CopyIcon /></span>
            {streamlinedLauncher ? null : (
              <span className={styles.linkButtonCopy}><strong>Copy link</strong><small>Clipboard</small></span>
            )}
          </button>
          <button
            type="button"
            className={`${styles.linkButton} ${styles.linkButtonPrimary} ${streamlinedLauncher ? styles.linkButtonIconOnly : ''}`}
            onClick={onShare}
            aria-label={`Share ${config.loginLinkLabel}`}
            title={streamlinedLauncher ? 'Share link' : undefined}
          >
            <span className={styles.linkButtonIcon}><ShareIcon /></span>
            {streamlinedLauncher ? null : (
              <span className={styles.linkButtonCopy}><strong>Share link</strong><small>Send access</small></span>
            )}
          </button>
        </div>
      </div>
    </section>
  );
}

function InlineNotice({ notice }: { notice: { tone: NoticeTone; message: string } | null }) {
  if (!notice) return null;
  return (
    <div className={`${baseStyles.notice} ${notice.tone === 'success' ? baseStyles.noticeSuccess : baseStyles.noticeError} ${styles.noticeInModal}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      {notice.message}
    </div>
  );
}

function AppAccessManagement({ kind, configOverride }: {
  kind: DirectoryKind;
  configOverride?: Partial<DirectoryConfig>;
}) {
  const config = useMemo(
    () => ({ ...DIRECTORY_CONFIGS[kind], ...configOverride }),
    [configOverride, kind],
  );
  const dealerPolish = kind === 'dealer' && config.qrApp === 'dealer';
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [draft, setDraft] = useState<AccessDraft>(() => emptyDraft(config));
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [ownerDirty, setOwnerDirty] = useState(false);
  const [ownerAccessBusy, setOwnerAccessBusy] = useState(false);
  const [businessSettingsOpen, setBusinessSettingsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [createUsernameError, setCreateUsernameError] = useState('');
  const [loginLink, setLoginLink] = useState(config.loginPath);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [accountNameDraft, setAccountNameDraft] = useState('');
  const [namespaceBusy, setNamespaceBusy] = useState(true);
  const [namespaceError, setNamespaceError] = useState('');

  async function loadAccountName() {
    setNamespaceBusy(true);
    setNamespaceError('');
    try {
      const response = await fetch('/api/account/app-login-name', { credentials: 'include', cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not load the business login name.');
      setAccountName(payload.accountName);
      setAccountNameDraft(payload.accountName || payload.suggestedName);
    } catch (error) {
      setNamespaceError(error instanceof Error ? error.message : 'Could not load the business login name.');
    } finally { setNamespaceBusy(false); }
  }

  useEffect(() => { void loadAccountName(); }, []);

  async function confirmAccountName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNamespaceBusy(true);
    setNamespaceError('');
    try {
      const response = await fetch('/api/account/app-login-name', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountName: accountNameDraft }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not confirm the business login name.');
      setAccountName(payload.accountName);
    } catch (error) {
      setNamespaceError(error instanceof Error ? error.message : 'Could not confirm the business login name.');
    } finally { setNamespaceBusy(false); }
  }

  function renderAccountNameSetup() {
    if (accountName) return businessSettingsOpen ? <p className={ownerStyles.info}>Business login ID: <strong>{accountName}</strong><br />Your team signs in using person@{accountName}. This ID is permanent.</p> : null;
    const setup = <section className={`${baseStyles.card} ${styles.surface} ${styles.businessLoginSetup}`}>
      <form className={styles.businessLoginForm} onSubmit={confirmAccountName}>
        <label className={`${baseStyles.field} ${styles.field}`}>
          <span>Business login ID</span>
          <span className={styles.setupInputIcon}><SettingsDetailIcon name="business" /><input value={accountNameDraft} onChange={event => setAccountNameDraft(event.target.value.toLowerCase())}
            autoCapitalize="none" autoComplete="off" minLength={3} maxLength={32} required disabled={namespaceBusy} /></span>
        </label>
        <p className={styles.loginExample} aria-live="polite">App login example: <strong>john@{accountNameDraft.trim() || 'yourbusiness'}</strong></p>
        <p className={styles.loginHint}>A permanent ID shared by all your app logins.</p>
        <details className={styles.loginHelp}>
          <summary>How does this work?</summary>
          <p>Your team uses <strong>person@business</strong> to sign in. This is an app username, not an email address.</p>
          <p>Use 3–32 letters, numbers or hyphens for the business ID, without spaces or @. Existing logins keep working, even if your business name changes.</p>
        </details>
        {namespaceError ? <p role="alert" className={baseStyles.fieldError}>{namespaceError}</p> : null}
        <div className={styles.loginSetupActions}>
          {(activeFlow === 'new' || businessSettingsOpen) ? <button type="button" className={styles.cancelButton} onClick={businessSettingsOpen ? () => setBusinessSettingsOpen(false) : closeFlow} disabled={namespaceBusy}>Cancel</button> : null}
          <button type="submit" className={`${baseStyles.primaryButton} ${styles.primaryButton}`} disabled={namespaceBusy}>
            {namespaceBusy ? 'Loading…' : 'Confirm business ID'}
          </button>
          {namespaceError ? <button type="button" className={styles.emptyAction} onClick={() => void loadAccountName()}>Reload</button> : null}
        </div>
      </form>
    </section>;
    return setup;
  }

  function usernamePreview(value: string) {
    if (!accountName) return 'Confirm your business ID before renaming this login.';
    try { return accountAppUsername(value, accountName); }
    catch { return `Use a name followed by @${accountName}.`; }
  }

  const selectedRecord = useMemo(
    () => records.find((record) => record.id === selectedId) ?? null,
    [records, selectedId],
  );

  useEffect(() => {
    setLoginLink(`${window.location.origin}${config.loginPath}`);
  }, [config.loginPath]);

  useEffect(() => {
    void loadRecords();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function loadRecords() {
    setLoading(true);
    try {
      const response = await fetch(config.listEndpoint, { credentials: 'include', cache: 'no-store' });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok || !payload?.ok) throw new Error(extractError(payload, `Failed to load ${config.itemPlural}.`));
      const nextRecords = sortAccessRecords(readRecordList(payload, config.listKey));
      setRecords(nextRecords);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : `Failed to load ${config.itemPlural}.` });
    } finally {
      setLoading(false);
    }
  }

  function openFlow(flow: Exclude<ActiveFlow, null>) {
    setNotice(null);
    setSelectedId(null);
    setBusinessSettingsOpen(false);
    setOwnerDirty(false);
    setActiveFlow(flow);
  }

  function closeFlow() {
    if (creating || busyId || deletingId || namespaceBusy || ownerAccessBusy) return;
    if (ownerDirty && !window.confirm('Discard unsaved changes?')) return;
    setOwnerDirty(false);
    setBusinessSettingsOpen(false);
    setActiveFlow(null);
    setSelectedId(null);
  }

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let username: string;
    try {
      if (!accountName) throw new Error('Confirm your business login name first.');
      username = accountAppUsername(draft.username, accountName);
    } catch (error) {
      setCreateUsernameError(error instanceof Error ? error.message : 'Enter an app username.');
      return;
    }
    if (!draft.displayName.trim()) {
      setNotice({ tone: 'error', message: `Enter the ${config.displayNameLabel.toLowerCase()}.` });
      return;
    }
    if (username.length < 3) {
      setNotice({ tone: 'error', message: 'Enter a username with at least 3 characters.' });
      return;
    }
    if (draft.password.length < config.passwordMinimum) {
      setNotice({ tone: 'error', message: `Enter a ${config.passwordLabel.toLowerCase()} with at least ${config.passwordMinimum} characters.` });
      return;
    }

    setCreateUsernameError('');
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        displayName: draft.displayName.trim(),
        username,
        password: draft.password,
      };
      if (config.roleField) body[config.roleField] = draft.role;

      const response = await fetch(config.listEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      const created = readRecord(payload, config.itemKey);
      if (!response.ok || !payload?.ok || !created) throw new Error(extractError(payload, `Failed to create ${config.itemLabel}.`));

      setRecords((current) => sortAccessRecords([...current, created]));
      setDraft(emptyDraft(config));
      setShowCreatePassword(false);
      setCreateUsernameError('');
      setActiveFlow(null);
      setNotice({ tone: 'success', message: config.createSuccess });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to create ${config.itemLabel}.`;
      if (/username is already in use/i.test(message)) {
        setCreateUsernameError(message);
        setNotice(null);
      } else {
        setNotice({ tone: 'error', message });
      }
    } finally {
      setCreating(false);
    }
  }

  async function patchRecord(record: AccessRecord, changes: Record<string, unknown>, successMessage: string) {
    setBusyId(record.id);
    try {
      const response = await fetch(config.itemEndpoint(record.id), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      const updated = readRecord(payload, config.itemKey);
      if (!response.ok || !payload?.ok || !updated) throw new Error(extractError(payload, `Failed to update ${config.itemLabel}.`));

      setRecords((current) => sortAccessRecords(current.map((entry) => entry.id === updated.id ? updated : entry)));
      setNotice({ tone: 'success', message: successMessage });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to update ${config.itemLabel}.`;
      setNotice({ tone: 'error', message });
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function toggleRecord(record: AccessRecord) {
    if (record.isActive && !window.confirm(`Deactivate the login for ${record.displayName}? They will no longer be able to sign in with this login.`)) return;
    await patchRecord(record, { isActive: !record.isActive }, record.isActive ? config.inactiveSuccess : config.activeSuccess);
  }

  async function deleteRecord(record: AccessRecord) {
    const confirmed = window.confirm(`Delete the login for ${record.displayName}? This cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(record.id);
    try {
      const response = await fetch(config.itemEndpoint(record.id), { method: 'DELETE', credentials: 'include' });
      const payload = await response.json().catch(() => null) as ApiPayload | null;
      if (!response.ok || !payload?.ok) throw new Error(extractError(payload, `Failed to delete ${config.itemLabel}.`));
      setRecords((current) => current.filter((entry) => entry.id !== record.id));
      setSelectedId(null);
      setNotice({ tone: 'success', message: config.deleteSuccess });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : `Failed to delete ${config.itemLabel}.` });
    } finally {
      setDeletingId(null);
    }
  }

  async function copyLoginLink() {
    try {
      await navigator.clipboard.writeText(loginLink);
      setNotice({ tone: 'success', message: `${config.loginLinkLabel} copied.` });
    } catch {
      setNotice({ tone: 'error', message: 'Copy failed. Use the link shown on this page.' });
    }
  }

  async function shareLoginLink() {
    if (navigator.share) {
      try {
        await navigator.share({ title: config.shareTitle, text: config.shareText, url: loginLink });
        return;
      } catch {
        // Clipboard fallback below.
      }
    }
    await copyLoginLink();
  }

  function renderRoleSelect(value: string, onChange: (value: string) => void) {
    if (!config.roleField || !config.roleOptions.length) return null;
    return (
      <FriendlySelect
        label={config.roleLabel}
        value={value}
        options={config.roleOptions}
        onChange={onChange}
        className={`${refinementStyles.roleSelect} ${dealerPolish ? styles.dealerRoleSelect : ''}`}
      />
    );
  }

  function renderRecordSummary(record: AccessRecord, includeManageButton: boolean) {
    const roleSummary = config.roleSummary(record);
    return (
      <div className={`${styles.loginSummary} ${ownerStyles.userRow}`}>
        <div className={styles.loginIdentity}>
          <LoginDetailIcon kind="person" />
          <div><strong>{record.displayName}</strong><span>{record.username}</span></div>
        </div>
        {roleSummary ? <span className={ownerStyles.rowRole}>{roleSummary}</span> : null}
        <div className={styles.loginActions}>
          <span className={`${baseStyles.statusText} ${record.isActive ? baseStyles.statusActive : baseStyles.statusInactive}`}>
            {record.isActive ? 'Active' : 'Inactive'}
          </span>
          {includeManageButton ? (
            <button type="button" className={styles.loginManageButton} onClick={() => { setOwnerDirty(false); setSelectedId(record.id); }} aria-label={`Manage ${record.displayName}`}>
              <LoginDetailIcon kind="gear" /> Manage
            </button>
          ) : null}
        </div>

      </div>
    );
  }

  const isSelectedBusy = selectedRecord ? busyId === selectedRecord.id || deletingId === selectedRecord.id : false;

  return (
    <main className={baseStyles.page}>
      <AppHeader active="none" />
      <section className={baseStyles.shell}>
        <button type="button" className={baseStyles.backButton} onClick={() => window.location.assign('/account')}>
          ← Back to account
        </button>

        <AccessLauncher
          config={config}
          count={records.length}
          loading={loading}
          loginLink={loginLink}
          onNew={() => openFlow('new')}
          onManage={() => openFlow('manage')}
          onCopy={() => void copyLoginLink()}
          onShare={() => void shareLoginLink()}
        />

        {notice ? (
          <div className={`${baseStyles.notice} ${notice.tone === 'success' ? baseStyles.noticeSuccess : baseStyles.noticeError}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            {notice.message}
          </div>
        ) : null}
      </section>

      <AppAccessModal
        open={activeFlow === 'new'}
        notificationStyle
        title={`New ${config.itemLabel}`}
        description="Enter the login details."
        closeDisabled={creating || namespaceBusy}
        onClose={closeFlow}
      >
        <div className={`${styles.newUserSetup} ${dealerPolish ? styles.dealerSetup : ''}`}>
        <InlineNotice notice={notice} />
        {renderAccountNameSetup()}
        {accountName ? <section className={`${baseStyles.card} ${styles.surface}`}>
          <h3 className={styles.setupTitle}>Login details</h3>
          <form className={`${baseStyles.form} ${styles.setupForm}`} onSubmit={createRecord}>
            <label className={`${baseStyles.field} ${styles.field}`}>
              <span>{config.displayNameLabel}</span>
              <span className={styles.setupInputIcon}><SettingsDetailIcon name="person" /><input
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={config.displayNamePlaceholder}
                autoComplete="off"
              /></span>
            </label>
            <label className={`${baseStyles.field} ${styles.field}`}>
              <span>Person’s username</span>
              <span className={styles.setupInputIcon}><SettingsDetailIcon name="email" /><input
                value={draft.username}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, username: normalizeUsername(event.target.value) }));
                  setCreateUsernameError('');
                }}
                placeholder="john"
                maxLength={32}
                autoCapitalize="none"
                autoComplete="off"
                aria-invalid={Boolean(createUsernameError)}
              /></span>
              <small className={styles.usernamePreview}>{`Full app login: ${usernamePreview(draft.username || 'john')}`}</small>
              {createUsernameError ? <small className={baseStyles.fieldError} role="alert">{createUsernameError}</small> : null}
            </label>
            {renderRoleSelect(draft.role, (role) => setDraft((current) => ({ ...current, role })))}
            <div className={`${baseStyles.field} ${styles.field}`}>
              <label className={`${baseStyles.fieldLabel} ${styles.fieldLabel}`} htmlFor={`${kind}-create-password`}>{config.passwordLabel}</label>
              <div className={`${baseStyles.passwordInputWrap} ${styles.setupInputIcon}`}><SettingsDetailIcon name="lock" />
                <input
                  id={`${kind}-create-password`}
                  type={showCreatePassword ? 'text' : 'password'}
                  value={draft.password}
                  onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value.slice(0, config.passwordMaximum) }))}
                  placeholder={`Minimum ${config.passwordMinimum} characters`}
                  minLength={config.passwordMinimum}
                  maxLength={config.passwordMaximum}
                  autoComplete="new-password"
                />
                <button type="button" className={`${baseStyles.passwordToggleButton} ${styles.passwordEye}`} aria-label={`${showCreatePassword ? 'Hide' : 'Show'} ${config.passwordLabel.toLowerCase()}`} aria-pressed={showCreatePassword} onClick={() => setShowCreatePassword((current) => !current)}>
                  <AccessSectionIcon name="eye"/>
                </button>
              </div>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelButton} onClick={closeFlow} disabled={creating}>Cancel</button>
              <button type="submit" className={`${baseStyles.primaryButton} ${styles.primaryButton}`} disabled={creating}>
                {creating ? 'Creating…' : 'Create login'}
              </button>
            </div>
          </form>
        </section> : null}
        </div>
      </AppAccessModal>

      <AppAccessModal
        open={activeFlow === 'manage'}
        notificationStyle
        title={businessSettingsOpen ? 'Business login settings' : selectedRecord ? `Manage ${selectedRecord.displayName}` : config.itemPlural}
        description={businessSettingsOpen ? 'One business ID for your app logins.' : selectedRecord ? selectedRecord.username : 'Choose a person to manage.'}
        compact={Boolean(selectedRecord)}

        wide
        closeDisabled={Boolean(busyId || deletingId || namespaceBusy || ownerAccessBusy)}
        onClose={closeFlow}
      >
        <InlineNotice notice={notice} />
        {businessSettingsOpen ? <div className={styles.newUserSetup}>
          <button type="button" className={styles.modalBackButton} onClick={() => setBusinessSettingsOpen(false)} disabled={namespaceBusy}>‹ All logins</button>
          {renderAccountNameSetup()}
        </div> : !selectedRecord ? (
          <section className={`${baseStyles.card} ${styles.surface}`}>
            <div className={styles.directoryHeader}>
              <strong>{loading ? `Loading ${config.itemPlural.toLowerCase()}…` : `${records.length} ${records.length === 1 ? 'login' : 'logins'}`}</strong>
              <div className={ownerStyles.listActions}>
                <button type="button" onClick={() => setBusinessSettingsOpen(true)}>Business login settings</button>
                <button type="button" className={ownerStyles.primary} onClick={() => openFlow('new')}>Add user</button>
              </div>
            </div>
            {loading ? <div className={styles.emptyState}><p>Loading access details…</p></div> : null}
            {!loading && !records.length ? (
              <div className={styles.emptyState}>
                <strong>No logins created yet</strong>
                <p>Create the first login before opening the management flow.</p>
                <button type="button" className={styles.emptyAction} onClick={() => openFlow('new')}>Create first login</button>
              </div>
            ) : null}
            {!loading && records.length ? (
              <div className={`${baseStyles.managerList} ${styles.directoryList}`}>
                {records.map((record) => (
                  <article key={record.id} className={`${baseStyles.managerCard} ${styles.directoryCard} ${ownerStyles.directoryRow}`}>
                    {renderRecordSummary(record, true)}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : <OwnerLoginSections
          dealerPolish={dealerPolish}
          key={selectedRecord.id} record={selectedRecord} busy={isSelectedBusy || ownerAccessBusy}
          accountName={accountName} passwordMinimum={config.passwordMinimum} passwordMaximum={config.passwordMaximum}
          onDirtyChange={setOwnerDirty} hasUnsavedChanges={ownerDirty}
          onSave={(changes, message) => patchRecord(selectedRecord, changes, message)}
          onToggle={() => void toggleRecord(selectedRecord)} onDelete={() => void deleteRecord(selectedRecord)}
          onBack={() => { if (!ownerDirty || window.confirm('Discard unsaved changes?')) { setOwnerDirty(false); setSelectedId(null); } }}
          passwordLabel={config.passwordLabel}
          roleField={config.roleField ?? undefined} currentRole={config.roleValue(selectedRecord)}
          roleOptions={kind === 'owner' ? undefined : config.roleOptions.map(option => ({ value: option.value, label: option.label, text: option.description ?? '' }))}
          renderPermissions={kind === 'field' ? onSaved => <FieldManagerAccessPanel managerId={selectedRecord.id} section="permissions" onSaved={onSaved} onDirtyChange={setOwnerDirty} onBusyChange={setOwnerAccessBusy}/> : undefined}
          renderFuelAccess={kind === 'field' ? onSaved => <FieldManagerAccessPanel managerId={selectedRecord.id} section="fuel" onSaved={onSaved} onDirtyChange={setOwnerDirty} onBusyChange={setOwnerAccessBusy}/> : undefined}
          renderAssetAccess={kind === 'dealer' ? undefined : kind === 'field' ? onSaved => <FieldManagerAccessPanel managerId={selectedRecord.id} section="assets" onSaved={onSaved} onDirtyChange={setOwnerDirty} onBusyChange={setOwnerAccessBusy}/> : (onSaved) => <OwnerAppAssetAccessPanel userId={selectedRecord.id} onSaved={() => { setOwnerDirty(false); setNotice({ tone: 'success', message: 'Asset access saved.' }); onSaved(); }} onBusyChange={setOwnerAccessBusy} onDirtyChange={setOwnerDirty} />}
        />}
      </AppAccessModal>
    </main>
  );
}

function FieldManagerAccessPanel({ managerId, section, onSaved, onDirtyChange, onBusyChange }: { managerId: string; section: 'permissions' | 'assets' | 'fuel'; onSaved: () => void; onDirtyChange: (dirty: boolean) => void; onBusyChange: (busy: boolean) => void }) {
  const savedSettings = useRef('');
  const [picker, setPicker] = useState<'groupIds' | 'assetIds' | 'fuelStorageIds' | null>(null);
  const [settings, setSettings] = useState<ManagerAccessSettings | null>(null);
  const [assets, setAssets] = useState<NonNullable<ManagerAccessResponse['assets']>>([]);
  const [groups, setGroups] = useState<NonNullable<ManagerAccessResponse['groups']>>([]);
  const [storages, setStorages] = useState<NonNullable<ManagerAccessResponse['storages']>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/field-managers/${encodeURIComponent(managerId)}/access`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) as ManagerAccessResponse | null }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload?.ok || !payload.settings) throw new Error(payload?.error || 'Failed to load access.');
        savedSettings.current = JSON.stringify(payload.settings);
        setSettings(payload.settings);
        setAssets(sortAccessOptions(payload.assets ?? [], (asset) => asset.title));
        setGroups(sortAccessOptions(payload.groups ?? [], (group) => group.name));
        setStorages(sortAccessOptions(payload.storages ?? [], (storage) => storage.name));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Failed to load access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [managerId]);

  useEffect(() => { onDirtyChange(!!settings && JSON.stringify(settings) !== savedSettings.current); }, [settings, onDirtyChange]);
  useEffect(() => { onBusyChange(loading || saving); return () => onBusyChange(false); }, [loading, saving, onBusyChange]);

  async function saveAccess() {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/field-managers/${encodeURIComponent(managerId)}/access`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => null) as ManagerAccessResponse | null;
      if (!response.ok || !payload?.ok || !payload.settings) throw new Error(payload?.error || 'Failed to save access.');
      setSettings(payload.settings);
      savedSettings.current = JSON.stringify(payload.settings);
      onDirtyChange(false);
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save access.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.accessPanel}><p className={styles.accessMessage}>Loading app access…</p></div>;
  if (!settings) return <div className={styles.accessPanel}><p className={styles.accessMessage}>{message || 'Access could not be loaded.'}</p></div>;

  const choices = section === 'fuel' ? FUEL_SCOPE_OPTIONS : ASSET_SCOPE_OPTIONS;
  const scopeKey = section === 'fuel' ? 'fuelScope' : 'assetScope';
  return <section className={ownerStyles.assetPanel} aria-label={`Field Manager ${section}`}>
    <fieldset className={ownerStyles.fields} disabled={saving}>
      {section === 'permissions' ? <div className={ownerStyles.choices}>{([
        ['canRecordWork', 'Check, service and repair', 'tools'],
        ['canScheduleMaintenance', 'Schedule maintenance', 'clock'],
        ['canRecordFuel', 'Fuel assets', 'box'],
        ['canRefillFuel', 'Refill fuel tanks', 'box'],
      ] as const).map(([key, label, icon]) => <label key={key} className={ownerStyles.choice} data-selected={settings[key]}>
        <input type="checkbox" checked={settings[key]} onChange={event => setSettings(current => current ? { ...current, [key]: event.target.checked } : current)}/>
        <span className={ownerStyles.roleIcon}><AccessSectionIcon name={icon}/></span><strong>{label}</strong>
      </label>)}</div> : <>
        <div className={ownerStyles.choices}>{choices.map(option => <label key={option.value} className={ownerStyles.choice} data-selected={settings[scopeKey] === option.value}>
          <input type="radio" name={`field-${section}-scope`} checked={settings[scopeKey] === option.value} onChange={() => setSettings(current => current ? { ...current, [scopeKey]: option.value } : current)}/>
          <span><strong>{option.label}</strong><small>{option.description}</small></span>
        </label>)}</div>
        {settings[scopeKey] === 'selected' ? <div className={ownerStyles.grid}>{(section === 'fuel' ? [
          { key: 'fuelStorageIds' as const, title: 'Choose fuel tanks', icon: 'box' },
        ] : [
          { key: 'groupIds' as const, title: 'Umbrellas', icon: 'umbrella' },
          { key: 'assetIds' as const, title: 'Choose assets', icon: 'assets' },
        ]).map(choice => <button key={choice.key} type="button" className={ownerStyles.card} onClick={() => setPicker(choice.key)}>
          <span className={ownerStyles.icon}><AccessSectionIcon name={choice.icon}/></span><span className={ownerStyles.copy}><strong>{choice.title}</strong><small>{settings[choice.key].length} selected</small></span>
        </button>)}</div> : null}
      </>}
    </fieldset>
    {picker ? <OwnerAccessPicker title={picker === 'groupIds' ? 'Choose umbrellas' : picker === 'assetIds' ? 'Choose assets' : 'Choose fuel tanks'} description={picker === 'groupIds' ? 'Includes current and future linked assets.' : 'Choose access for this login.'} selected={settings[picker]} options={picker === 'groupIds' ? groups.map(group => ({ id: group.id, title: group.name, detail: `${group.memberCount} linked assets` })) : picker === 'assetIds' ? assets.map(asset => ({ id: asset.id, title: asset.title, detail: asset.kind })) : storages.map(storage => ({ id: storage.id, title: storage.name, detail: storage.locationLabel }))} onClose={() => setPicker(null)} onConfirm={ids => { setSettings(current => current ? { ...current, [picker]: ids } : current); setPicker(null); }}/> : null}
    {message ? <p role="status" className={styles.accessMessage}>{message}</p> : null}
    <footer className={ownerStyles.footer}><button type="button" className={ownerStyles.primary} disabled={saving || JSON.stringify(settings) === savedSettings.current} onClick={() => void saveAccess()}>{saving ? 'Saving…' : 'Save changes'}</button></footer>
  </section>;
}

function OwnerAppAssetAccessPanel({ userId, onSaved, onBusyChange, onDirtyChange }: { userId: string; onSaved?: () => void; onBusyChange?: (busy: boolean) => void; onDirtyChange?: (dirty: boolean) => void }) {
  const savedSettings = useRef('');
  const [settings, setSettings] = useState<AssetAccessSettings | null>(null);
  const [assets, setAssets] = useState<AssetAccessOption[]>([]);
  const [groups, setGroups] = useState<AssetGroupAccessOption[]>([]);
  const [registers, setRegisters] = useState<{ id: string; name: string }[]>([]);
  const [picker, setPicker] = useState<'groupIds' | 'registerIds' | 'assetIds' | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { onBusyChange?.(saving); }, [saving, onBusyChange]);
  useEffect(() => { onDirtyChange?.(!!settings && JSON.stringify(settings) !== savedSettings.current); }, [settings, onDirtyChange]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/owner-app/users/${encodeURIComponent(userId)}/access`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) as OwnerAssetAccessResponse | null }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload?.ok || !payload.settings) throw new Error(payload?.error || 'Failed to load access.');
        savedSettings.current = JSON.stringify(payload.settings);
        setSettings(payload.settings);
        setRegisters(sortAccessOptions(payload.registers ?? [], register => register.name));
        setAssets(sortAccessOptions(payload.assets ?? [], (asset) => asset.title));
        setGroups(sortAccessOptions(payload.groups ?? [], (group) => group.name));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Failed to load access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  async function saveAccess() {
    if (!settings) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(`/api/owner-app/users/${encodeURIComponent(userId)}/access`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const payload = await response.json().catch(() => null) as OwnerAssetAccessResponse | null;
      if (!response.ok || !payload?.ok || !payload.settings) throw new Error(payload?.error || 'Failed to save access.');
      savedSettings.current = JSON.stringify(payload.settings);
      setSettings(payload.settings);
      setMessage('Access saved.');
      onDirtyChange?.(false);
      onBusyChange?.(false);
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save access.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.accessPanel}><p className={styles.accessMessage}>Loading app access…</p></div>;
  if (!settings) return <div className={styles.accessPanel}><p className={styles.accessMessage}>{message || 'Access could not be loaded.'}</p></div>;

  const includedCount = new Set([...settings.assetIds, ...groups.filter(group => settings.groupIds.includes(group.id)).flatMap(group => group.memberAssetIds ?? []), ...assets.filter(asset => asset.registerId && settings.registerIds?.includes(asset.registerId)).map(asset => asset.id)]).size;
  const countLabel = (count: number, label: string) => `${count} ${label}${count === 1 ? '' : 's'}`;
  return (
    <section className={`${styles.accessPanel} ${ownerStyles.assetPanel}`} aria-label="Owner App asset access">
      <fieldset className={ownerStyles.fields} disabled={saving}>
        <legend className={ownerStyles.hint}>Which assets can this person access?</legend>
        <div className={ownerStyles.choices}>{ASSET_SCOPE_OPTIONS.map(option => <label key={option.value} className={ownerStyles.choice} data-selected={settings.assetScope === option.value}>
          <input type="radio" name="owner-asset-scope" checked={settings.assetScope === option.value} onChange={() => setSettings(current => current ? { ...current, assetScope: option.value } : current)} />
          <span><strong>{option.label}</strong><small>{option.value === 'all' ? 'Include all current and future assets.' : 'Choose umbrellas, registers or individual assets.'}</small></span>
        </label>)}</div>
      </fieldset>

      {settings.assetScope === 'selected' ? <>
        <div className={ownerStyles.pickerCards}>{([
          { key: 'groupIds', title: 'Umbrella', icon: 'umbrella', text: 'Current and future linked assets.' },
          { key: 'registerIds', title: 'Registers', icon: 'assets', text: 'Current and future register assets.' },
          { key: 'assetIds', title: 'Choose assets', icon: 'box', text: 'Select individual assets.' },
        ] as const).map(choice => <button type="button" className={ownerStyles.card} key={choice.key} disabled={saving} onClick={() => setPicker(choice.key)}><span className={ownerStyles.icon}><AccessSectionIcon name={choice.icon}/></span><span className={ownerStyles.copy}><strong>{choice.title}</strong><span>{choice.text}</span><small>{(settings[choice.key] ?? []).length} selected</small></span></button>)}</div>
        <p className={ownerStyles.hint} aria-live="polite">{countLabel(settings.groupIds.length, 'umbrella')} · {countLabel((settings.registerIds ?? []).length, 'register')} · {countLabel(settings.assetIds.length, 'individual asset')} · {countLabel(includedCount, 'asset')} included</p>
        {picker ? <OwnerAccessPicker key={picker} title={picker === 'groupIds' ? 'Choose umbrellas' : picker === 'registerIds' ? 'Choose registers' : 'Choose assets'} description={picker === 'assetIds' ? 'Choose individual assets for this login.' : 'Includes current and future assets.'} selected={settings[picker] ?? []} options={picker === 'groupIds' ? groups.map(group => ({ id: group.id, title: group.name, detail: `${group.memberCount} linked assets` })) : picker === 'registerIds' ? registers.map(register => ({ id: register.id, title: register.name, detail: `${assets.filter(asset => asset.registerId === register.id).length} assets` })) : assets.map(asset => ({ id: asset.id, title: asset.title, detail: asset.kind }))} onClose={() => setPicker(null)} onConfirm={ids => { setSettings(current => current ? { ...current, [picker]: ids } : current); setPicker(null); }}/>: null}
      </> : null}

      {message ? <p className={styles.accessMessage}>{message}</p> : null}
      <footer className={ownerStyles.footer}><button type="button" className={ownerStyles.primary} onClick={() => void saveAccess()} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button></footer>
    </section>
  );
}

export function DealerAppAccessManagement({ middlemanMode = false }: { middlemanMode?: boolean }) {
  const middlemanConfig = useMemo<Partial<DirectoryConfig> | undefined>(() => middlemanMode ? {
    title: 'Middleman App Access',
    loginPath: '/middleman/login',
    qrApp: 'middleman',
    description: 'Create and manage secure logins for your Middleman workspace.',
    newDescription: 'Create a Middleman App login.',
    manageDescription: 'Edit access, change passwords or remove a login.',
    loginLinkLabel: 'Middleman App login link',
    shareTitle: 'Aim4price Middleman App',
    shareText: 'Open the Aim4price Middleman App here:',
    itemLabel: 'Middleman App user',
    itemPlural: 'Middleman App users',
    displayNameLabel: 'User name',
    displayNamePlaceholder: 'Example: Sales agent',
    defaultRole: 'sales',
    roleOptions: MIDDLEMAN_ROLE_OPTIONS,
    createSuccess: 'Middleman App login created.',
    updateSuccess: 'Middleman App login updated.',
    updatePasswordSuccess: 'Middleman App login and password updated.',
    activeSuccess: 'Middleman App login activated.',
    inactiveSuccess: 'Middleman App login deactivated.',
    deleteSuccess: 'Middleman App login deleted.',
  } : undefined, [middlemanMode]);

  return <AppAccessManagement kind="dealer" configOverride={middlemanConfig} />;
}

export function OwnerAppAccessManagement() {
  return <AppAccessManagement kind="owner" />;
}

export function FieldManagerAppAccessManagement() {
  return <AppAccessManagement kind="field" />;
}


