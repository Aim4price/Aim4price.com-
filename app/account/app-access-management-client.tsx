'use client';

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

type AssetAccessSettings = Pick<ManagerAccessSettings, 'assetScope' | 'assetIds' | 'groupIds'>;

type AssetAccessOption = { id: string; title: string; kind: string };
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
  ok?: boolean;
  settings?: AssetAccessSettings;
  assets?: AssetAccessOption[];
  groups?: AssetGroupAccessOption[];
  error?: string;
};

const DEALER_ROLE_OPTIONS: Array<FriendlySelectOption<string>> = [
  { value: 'owner', label: 'Owner / Manager', description: 'Full access and problem assignment.' },
  { value: 'sales', label: 'Sales', description: 'All tools except Client Costs.' },
  { value: 'parts', label: 'Parts', description: 'No Marketplace or Get Estimate.' },
  { value: 'technician', label: 'Technician', description: 'Overview and Maintenance only.' },
];

const MIDDLEMAN_ROLE_OPTIONS: Array<FriendlySelectOption<string>> = [
  { value: 'owner', label: 'Owner / Manager', description: 'Full access to the Middleman workspace and login management.' },
  { value: 'sales', label: 'Sales', description: 'Valuations, Ad Studio, Marketplace and the shared showroom.' },
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
    description: 'Manage staff access.',
    newDescription: 'Create a login.',
    manageDescription: 'Edit access.',
    loginLinkLabel: 'Dealer App staff login link',
    loginPath: '/dealer/login',
    qrApp: 'dealer',
    shareTitle: 'Aim4price Dealer App',
    shareText: 'Open the Aim4price Dealer App here:',
    listEndpoint: '/api/dealer/staff',
    itemEndpoint: (id) => `/api/dealer/staff/${encodeURIComponent(id)}`,
    listKey: 'staff',
    itemKey: 'staff',
    itemLabel: 'Dealer App staff member',
    itemPlural: 'Dealer App staff logins',
    displayNameLabel: 'Staff member name',
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
    description: 'Manage user access.',
    newDescription: 'Create a login.',
    manageDescription: 'Edit access.',
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
    description: 'Manage manager access.',
    newDescription: 'Create a login.',
    manageDescription: 'Edit access.',
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
            src={`/api/account/app-access-qr?app=${config.qrApp}`}
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

function formatDateTime(value: string | null): string {
  if (!value) return 'Not yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not yet';
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
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

function draftFromRecord(record: AccessRecord, config: DirectoryConfig): AccessDraft {
  return {
    displayName: record.displayName,
    username: record.username,
    password: '',
    role: config.roleValue(record),
  };
}

function AppAccessModal({
  open,
  title,
  description,
  wide = false,
  closeDisabled = false,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  wide?: boolean;
  closeDisabled?: boolean;
  onClose: () => void;
  children: ReactNode;
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
      if (event.key === 'Escape' && !closeDisabledRef.current) onCloseRef.current();
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
        className={`${styles.modal} ${wide ? styles.modalWide : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className={styles.modalHeader}>
          <h2 id={titleId}>{title}</h2>
          <p id={descriptionId}>{description}</p>
          <button
            ref={closeRef}
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className={styles.modalBody}>{children}</div>
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
            <strong>New</strong>
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
            <strong>Manage</strong>
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
  const [records, setRecords] = useState<AccessRecord[]>([]);
  const [draft, setDraft] = useState<AccessDraft>(() => emptyDraft(config));
  const [editDrafts, setEditDrafts] = useState<Record<string, AccessDraft>>({});
  const [activeFlow, setActiveFlow] = useState<ActiveFlow>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [createUsernameError, setCreateUsernameError] = useState('');
  const [editUsernameErrors, setEditUsernameErrors] = useState<Record<string, string>>({});
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
    if (accountName) return null;
    return <section className={`${baseStyles.card} ${styles.surface} ${styles.businessLoginSetup}`}>
      <div className={styles.surfaceHeader}>
        <h3>Business login name</h3>
        <p>Choose once for all your apps. Existing logins will keep working.</p>
      </div>
      <form className={baseStyles.form} onSubmit={confirmAccountName}>
        <label className={baseStyles.field}>
          <span>Business name for logins</span>
          <input value={accountNameDraft} onChange={event => setAccountNameDraft(event.target.value.toLowerCase())}
            autoCapitalize="none" autoComplete="off" minLength={3} maxLength={32} required disabled={namespaceBusy} />
          <small>Example: kuyler@{accountNameDraft || 'vasbyt'}. This stays the same if your business name changes.</small>
        </label>
        {namespaceError ? <p role="alert" className={baseStyles.fieldError}>{namespaceError}</p> : null}
        <button type="submit" className={baseStyles.primaryButton} disabled={namespaceBusy}>
          {namespaceBusy ? 'Loading…' : 'Confirm business login name'}
        </button>
        {namespaceError ? <button type="button" className={styles.emptyAction} onClick={() => void loadAccountName()}>Reload</button> : null}
      </form>
    </section>;
  }

  function usernamePreview(value: string) {
    if (!accountName) return 'Confirm your business login name before renaming this login.';
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
      setEditDrafts(Object.fromEntries(nextRecords.map((record) => [record.id, draftFromRecord(record, config)])));
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : `Failed to load ${config.itemPlural}.` });
    } finally {
      setLoading(false);
    }
  }

  function openFlow(flow: Exclude<ActiveFlow, null>) {
    setNotice(null);
    setSelectedId(null);
    setActiveFlow(flow);
  }

  function closeFlow() {
    if (creating || busyId || deletingId || namespaceBusy) return;
    setActiveFlow(null);
    setSelectedId(null);
  }

  function updateEditDraft(id: string, changes: Partial<AccessDraft>) {
    setEditDrafts((current) => ({
      ...current,
      [id]: { ...(current[id] ?? emptyDraft(config)), ...changes },
    }));
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
      setEditDrafts((current) => ({ ...current, [created.id]: draftFromRecord(created, config) }));
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
    setEditUsernameErrors((current) => ({ ...current, [record.id]: '' }));
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
      setEditDrafts((current) => ({ ...current, [updated.id]: draftFromRecord(updated, config) }));
      setVisiblePasswords((current) => ({ ...current, [updated.id]: false }));
      setEditUsernameErrors((current) => ({ ...current, [updated.id]: '' }));
      setNotice({ tone: 'success', message: successMessage });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to update ${config.itemLabel}.`;
      if (/username is already in use/i.test(message)) {
        setEditUsernameErrors((current) => ({ ...current, [record.id]: message }));
        setNotice(null);
      } else {
        setNotice({ tone: 'error', message });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function saveRecord(event: FormEvent<HTMLFormElement>, record: AccessRecord) {
    event.preventDefault();
    const edit = editDrafts[record.id];
    if (!edit) return;
    const username = normalizeUsername(edit.username);
    if (!edit.displayName.trim() || username.length < 3) {
      setNotice({ tone: 'error', message: 'Enter a display name and a username with at least 3 characters.' });
      return;
    }

    const changes: Record<string, unknown> = {
      displayName: edit.displayName.trim(),
      username,
    };
    if (config.roleField) changes[config.roleField] = edit.role;
    if (edit.password) {
      if (edit.password.length < config.passwordMinimum) {
        setNotice({ tone: 'error', message: `The new ${config.passwordLabel.toLowerCase()} must contain at least ${config.passwordMinimum} characters.` });
        return;
      }
      changes.password = edit.password;
    }

    await patchRecord(record, changes, edit.password ? config.updatePasswordSuccess : config.updateSuccess);
  }

  async function toggleRecord(record: AccessRecord) {
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
      setEditDrafts((current) => {
        const next = { ...current };
        delete next[record.id];
        return next;
      });
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
        className={refinementStyles.roleSelect}
      />
    );
  }

  function renderRecordSummary(record: AccessRecord, includeManageButton: boolean) {
    const roleSummary = config.roleSummary(record);
    return (
      <div className={baseStyles.managerSummary}>
        <div className={baseStyles.managerIdentity}>
          <strong>{record.displayName}</strong>
          <span>{record.username}</span>
          {roleSummary ? <small className={baseStyles.rolePill}>{roleSummary}</small> : null}
        </div>
        <div className={baseStyles.managerSummaryMeta} aria-label={`${config.itemLabel} dates`}>
          <span><b>Last login</b>{formatDateTime(record.lastLoginAtIso)}</span>
          <span><b>Updated</b>{formatDateTime(record.updatedAtIso)}</span>
        </div>
        <span className={`${baseStyles.statusText} ${record.isActive ? baseStyles.statusActive : baseStyles.statusInactive}`}>
          {record.isActive ? 'Active' : 'Inactive'}
        </span>
        {includeManageButton ? (
          <button type="button" className={baseStyles.manageButton} onClick={() => setSelectedId(record.id)}>
            Manage <span aria-hidden="true">›</span>
          </button>
        ) : null}
      </div>
    );
  }

  const selectedEdit = selectedRecord ? editDrafts[selectedRecord.id] ?? draftFromRecord(selectedRecord, config) : null;
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
        title={`New ${config.itemLabel}`}
        description="Enter the login details."
        closeDisabled={creating || namespaceBusy}
        onClose={closeFlow}
      >
        <InlineNotice notice={notice} />
        {renderAccountNameSetup()}
        {accountName ? <section className={`${baseStyles.card} ${styles.surface}`}>
          <form className={baseStyles.form} onSubmit={createRecord}>
            <label className={baseStyles.field}>
              <span>{config.displayNameLabel}</span>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))}
                placeholder={config.displayNamePlaceholder}
                autoComplete="off"
              />
            </label>
            <label className={baseStyles.field}>
              <span>App username</span>
              <input
                value={draft.username}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, username: normalizeUsername(event.target.value) }));
                  setCreateUsernameError('');
                }}
                placeholder="kuyler"
                maxLength={32}
                autoCapitalize="none"
                autoComplete="off"
                aria-invalid={Boolean(createUsernameError)}
              />
              <small className={styles.usernamePreview}>{usernamePreview(draft.username || 'kuyler')}</small>
              {createUsernameError ? <small className={baseStyles.fieldError} role="alert">{createUsernameError}</small> : null}
            </label>
            {renderRoleSelect(draft.role, (role) => setDraft((current) => ({ ...current, role })))}
            <div className={baseStyles.field}>
              <label className={baseStyles.fieldLabel} htmlFor={`${kind}-create-password`}>{config.passwordLabel}</label>
              <div className={baseStyles.passwordInputWrap}>
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
                <button type="button" className={baseStyles.passwordToggleButton} onClick={() => setShowCreatePassword((current) => !current)}>
                  {showCreatePassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button type="submit" className={baseStyles.primaryButton} disabled={creating}>
              {creating ? 'Creating…' : 'Create login'}
            </button>
          </form>
        </section> : null}
      </AppAccessModal>

      <AppAccessModal
        open={activeFlow === 'manage'}
        title={selectedRecord ? `Manage ${selectedRecord.displayName}` : config.itemPlural}
        description={selectedRecord ? 'Edit this login.' : 'Choose a login to manage.'}
        wide
        closeDisabled={Boolean(busyId || deletingId || namespaceBusy)}
        onClose={closeFlow}
      >
        <InlineNotice notice={notice} />
        {renderAccountNameSetup()}
        {!selectedRecord ? (
          <section className={`${baseStyles.card} ${styles.surface}`}>
            <div className={styles.directoryHeader}>
              <strong>{loading ? `Loading ${config.itemPlural.toLowerCase()}…` : `${records.length} ${records.length === 1 ? 'login' : 'logins'}`}</strong>
              <span>Select one person to continue.</span>
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
                  <article key={record.id} className={`${baseStyles.managerCard} ${styles.directoryCard}`}>
                    {renderRecordSummary(record, true)}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ) : selectedEdit ? (
          <>
            <button type="button" className={styles.modalBackButton} onClick={() => setSelectedId(null)} disabled={isSelectedBusy}>
              ← Back to all logins
            </button>
            <article className={`${baseStyles.managerCard} ${baseStyles.managerCardExpanded} ${styles.editorCard}`}>
              {renderRecordSummary(selectedRecord, false)}
              <div className={baseStyles.managerDropdown}>
                <p className={refinementStyles.focusNote}>
                  <span className={refinementStyles.focusDot} aria-hidden="true" />
                  Update this login, save the changes, then return to the list.
                </p>
                <div className={refinementStyles.sectionHeading}>
                  <span className={refinementStyles.stepNumber}>1</span>
                  <div className={refinementStyles.sectionHeadingCopy}>
                    <h3>Login details and status</h3>
                    <p>Change the name, username, role or password without affecting other app users.</p>
                  </div>
                </div>
                <form className={baseStyles.inlineForm} onSubmit={(event) => void saveRecord(event, selectedRecord)}>
                  <label className={baseStyles.compactField}>
                    <span>{config.displayNameLabel}</span>
                    <input value={selectedEdit.displayName} onChange={(event) => updateEditDraft(selectedRecord.id, { displayName: event.target.value })} />
                  </label>
                  <label className={baseStyles.compactField}>
                    <span>App username</span>
                    <input
                      value={selectedEdit.username}
                      onChange={(event) => {
                        updateEditDraft(selectedRecord.id, { username: normalizeUsername(event.target.value) });
                        setEditUsernameErrors((current) => ({ ...current, [selectedRecord.id]: '' }));
                      }}
                      aria-invalid={Boolean(editUsernameErrors[selectedRecord.id])}
                    />
                    <small className={styles.usernamePreview}>{selectedEdit.username === selectedRecord.username
                      ? `Current login: ${selectedRecord.username}` : `New login: ${usernamePreview(selectedEdit.username)}`}</small>
                    {editUsernameErrors[selectedRecord.id] ? <small className={baseStyles.fieldError} role="alert">{editUsernameErrors[selectedRecord.id]}</small> : null}
                  </label>
                  {accountName && !selectedRecord.username.endsWith(`@${accountName}`) ? (
                    <button type="button" className={styles.emptyAction} onClick={() => updateEditDraft(selectedRecord.id, {
                      username: `${selectedRecord.username.split('@')[0]}@${accountName}`,
                    })}>Use business username</button>
                  ) : null}
                  {renderRoleSelect(selectedEdit.role, (role) => updateEditDraft(selectedRecord.id, { role }))}
                  <div className={baseStyles.compactField}>
                    <label className={baseStyles.fieldLabel} htmlFor={`${kind}-password-${selectedRecord.id}`}>New {config.passwordLabel.toLowerCase()}</label>
                    <div className={baseStyles.passwordInputWrap}>
                      <input
                        id={`${kind}-password-${selectedRecord.id}`}
                        type={visiblePasswords[selectedRecord.id] ? 'text' : 'password'}
                        value={selectedEdit.password}
                        onChange={(event) => updateEditDraft(selectedRecord.id, { password: event.target.value.slice(0, config.passwordMaximum) })}
                        placeholder={`Leave blank to keep the current ${config.passwordLabel.toLowerCase()}`}
                        minLength={config.passwordMinimum}
                        maxLength={config.passwordMaximum}
                        autoComplete="new-password"
                      />
                      <button type="button" className={baseStyles.passwordToggleButton} onClick={() => setVisiblePasswords((current) => ({ ...current, [selectedRecord.id]: !current[selectedRecord.id] }))}>
                        {visiblePasswords[selectedRecord.id] ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <p className={baseStyles.fieldHint}>Leave blank to keep the current {config.passwordLabel.toLowerCase()}.</p>
                  </div>
                  <div className={baseStyles.managerActions}>
                    <button type="submit" className={baseStyles.secondaryButton} disabled={isSelectedBusy}>
                      {busyId === selectedRecord.id ? 'Saving…' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      className={selectedRecord.isActive ? baseStyles.dangerButton : baseStyles.primaryButton}
                      disabled={isSelectedBusy}
                      onClick={() => void toggleRecord(selectedRecord)}
                    >
                      {selectedRecord.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" className={baseStyles.deleteButton} disabled={isSelectedBusy} onClick={() => void deleteRecord(selectedRecord)}>
                      {deletingId === selectedRecord.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </form>
                {kind === 'owner' && selectedRecord.accessRole !== 'admin' ? (
                  <OwnerAppAssetAccessPanel userId={selectedRecord.id} />
                ) : null}
                {kind === 'owner' && selectedRecord.accessRole === 'admin' ? (
                  <section className={styles.accessPanel} aria-label="Owner App asset access">
                    <p className={styles.accessMessage}>Owner / Admin users always have access to every umbrella and asset.</p>
                  </section>
                ) : null}
                {kind === 'field' ? <FieldManagerAccessPanel managerId={selectedRecord.id} /> : null}
              </div>
            </article>
          </>
        ) : null}
      </AppAccessModal>
    </main>
  );
}

function FieldManagerAccessPanel({ managerId }: { managerId: string }) {
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
        setSettings(payload.settings);
        setAssets(sortAccessOptions(payload.assets ?? [], (asset) => asset.title));
        setGroups(sortAccessOptions(payload.groups ?? [], (group) => group.name));
        setStorages(sortAccessOptions(payload.storages ?? [], (storage) => storage.name));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Failed to load access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [managerId]);

  function toggleId(key: 'assetIds' | 'groupIds' | 'fuelStorageIds', id: string) {
    setSettings((current) => current ? {
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id],
    } : current);
  }

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
      setMessage('Access saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save access.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.accessPanel}><p className={styles.accessMessage}>Loading app access…</p></div>;
  if (!settings) return <div className={styles.accessPanel}><p className={styles.accessMessage}>{message || 'Access could not be loaded.'}</p></div>;

  return (
    <section className={styles.accessPanel} aria-label="Field Manager permissions">
      <div className={refinementStyles.sectionHeading}>
        <span className={refinementStyles.stepNumber}>2</span>
        <div className={refinementStyles.sectionHeadingCopy}>
          <h3>App access</h3>
          <p>Choose what this manager can do and which assets or fuel tanks they may use.</p>
        </div>
      </div>

      <div className={styles.permissionGrid}>
        {([
          ['canRecordWork', 'Check, service and repair'],
          ['canScheduleMaintenance', 'Schedule maintenance'],
          ['canRecordFuel', 'Fuel assets'],
          ['canRefillFuel', 'Refill fuel tanks'],
        ] as const).map(([key, label]) => (
          <label className={styles.permissionChoice} key={key}>
            <input type="checkbox" checked={settings[key]} onChange={(event) => setSettings((current) => current ? { ...current, [key]: event.target.checked } : current)} />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className={styles.accessColumns}>
        <div className={styles.accessColumn}>
          <FriendlySelect
            label="Assets"
            value={settings.assetScope}
            options={ASSET_SCOPE_OPTIONS}
            onChange={(assetScope) => setSettings((current) => current ? { ...current, assetScope } : current)}
            className={refinementStyles.accessSelect}
          />
          {settings.assetScope === 'selected' ? (
            <div className={styles.assetAccessChoices} data-asset-choice-surface="true">
              {groups.length ? (
                <div className={styles.accessChoiceGroup}>
                  <strong>Umbrellas</strong>
                  <small data-asset-choice-secondary="true">Choosing an umbrella includes its current and future linked assets.</small>
                  <div className={styles.accessChecklist} data-asset-choice-list="true">
                    {groups.map((group) => (
                      <label
                        key={group.id}
                        data-asset-choice-row="true"
                        data-asset-choice-selected={settings.groupIds.includes(group.id) ? 'true' : undefined}
                      >
                        <input type="checkbox" checked={settings.groupIds.includes(group.id)} onChange={() => toggleId('groupIds', group.id)} />
                        <span data-asset-choice-copy="true"><strong>{group.name}</strong><small data-asset-choice-meta="true">{group.memberCount} linked {group.memberCount === 1 ? 'asset' : 'assets'}</small></span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.accessChoiceGroup}>
                <strong>Individual assets</strong>
                <small data-asset-choice-secondary="true">Use these for exceptions or assets outside an umbrella.</small>
                <div className={styles.accessChecklist} data-asset-choice-list="true">
                  {assets.length ? assets.map((asset) => (
                    <label
                      key={asset.id}
                      data-asset-choice-row="true"
                      data-asset-choice-selected={settings.assetIds.includes(asset.id) ? 'true' : undefined}
                    >
                      <input type="checkbox" checked={settings.assetIds.includes(asset.id)} onChange={() => toggleId('assetIds', asset.id)} />
                      <span data-asset-choice-copy="true"><strong>{asset.title}</strong><small data-asset-choice-meta="true">{asset.kind}</small></span>
                    </label>
                  )) : <p className={styles.accessMessage}>No assets available.</p>}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className={styles.accessColumn}>
          <FriendlySelect
            label="Fuel tanks"
            value={settings.fuelScope}
            options={FUEL_SCOPE_OPTIONS}
            onChange={(fuelScope) => setSettings((current) => current ? { ...current, fuelScope } : current)}
            className={refinementStyles.accessSelect}
          />
          {settings.fuelScope === 'selected' ? (
            <div className={styles.accessChecklist}>
              {storages.length ? storages.map((storage) => (
                <label key={storage.id}>
                  <input type="checkbox" checked={settings.fuelStorageIds.includes(storage.id)} onChange={() => toggleId('fuelStorageIds', storage.id)} />
                  <span><strong>{storage.name}</strong><small>{storage.locationLabel || 'No location saved'}</small></span>
                </label>
              )) : <p className={styles.accessMessage}>No fuel tanks available.</p>}
            </div>
          ) : null}
        </div>
      </div>

      {message ? <p className={styles.accessMessage}>{message}</p> : null}
      <button type="button" className={baseStyles.primaryButton} onClick={() => void saveAccess()} disabled={saving}>
        {saving ? 'Saving access…' : 'Save access'}
      </button>
    </section>
  );
}

function OwnerAppAssetAccessPanel({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<AssetAccessSettings | null>(null);
  const [assets, setAssets] = useState<AssetAccessOption[]>([]);
  const [groups, setGroups] = useState<AssetGroupAccessOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void fetch(`/api/owner-app/users/${encodeURIComponent(userId)}/access`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json().catch(() => null) as OwnerAssetAccessResponse | null }))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok || !payload?.ok || !payload.settings) throw new Error(payload?.error || 'Failed to load access.');
        setSettings(payload.settings);
        setAssets(sortAccessOptions(payload.assets ?? [], (asset) => asset.title));
        setGroups(sortAccessOptions(payload.groups ?? [], (group) => group.name));
      })
      .catch((error) => { if (active) setMessage(error instanceof Error ? error.message : 'Failed to load access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  function toggleId(key: 'assetIds' | 'groupIds', id: string) {
    setSettings((current) => current ? {
      ...current,
      [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id],
    } : current);
  }

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
      setSettings(payload.settings);
      setMessage('Access saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save access.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className={styles.accessPanel}><p className={styles.accessMessage}>Loading app access…</p></div>;
  if (!settings) return <div className={styles.accessPanel}><p className={styles.accessMessage}>{message || 'Access could not be loaded.'}</p></div>;

  return (
    <section className={styles.accessPanel} aria-label="Owner App asset access">
      <div className={refinementStyles.sectionHeading}>
        <span className={refinementStyles.stepNumber}>2</span>
        <div className={refinementStyles.sectionHeadingCopy}>
          <h3>Asset access</h3>
          <p>Choose which umbrellas and individual assets this user may see in the Owner App.</p>
        </div>
      </div>

      <FriendlySelect
        label="Assets"
        value={settings.assetScope}
        options={ASSET_SCOPE_OPTIONS}
        onChange={(assetScope) => setSettings((current) => current ? { ...current, assetScope } : current)}
        className={refinementStyles.accessSelect}
      />

      {settings.assetScope === 'selected' ? (
        <div className={styles.assetAccessChoices} data-asset-choice-surface="true">
          {groups.length ? (
            <div className={styles.accessChoiceGroup}>
              <strong>Umbrellas</strong>
              <small data-asset-choice-secondary="true">Choosing an umbrella includes its current and future linked assets.</small>
              <div className={styles.accessChecklist} data-asset-choice-list="true">
                {groups.map((group) => (
                  <label
                    key={group.id}
                    data-asset-choice-row="true"
                    data-asset-choice-selected={settings.groupIds.includes(group.id) ? 'true' : undefined}
                  >
                    <input type="checkbox" checked={settings.groupIds.includes(group.id)} onChange={() => toggleId('groupIds', group.id)} />
                    <span data-asset-choice-copy="true"><strong>{group.name}</strong><small data-asset-choice-meta="true">{group.memberCount} linked {group.memberCount === 1 ? 'asset' : 'assets'}</small></span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
          <div className={styles.accessChoiceGroup}>
            <strong>Individual assets</strong>
            <small data-asset-choice-secondary="true">Use these for exceptions or assets outside an umbrella.</small>
            <div className={styles.accessChecklist} data-asset-choice-list="true">
              {assets.length ? assets.map((asset) => (
                <label
                  key={asset.id}
                  data-asset-choice-row="true"
                  data-asset-choice-selected={settings.assetIds.includes(asset.id) ? 'true' : undefined}
                >
                  <input type="checkbox" checked={settings.assetIds.includes(asset.id)} onChange={() => toggleId('assetIds', asset.id)} />
                  <span data-asset-choice-copy="true"><strong>{asset.title}</strong><small data-asset-choice-meta="true">{asset.kind}</small></span>
                </label>
              )) : <p className={styles.accessMessage}>No assets available.</p>}
            </div>
          </div>
        </div>
      ) : null}

      {message ? <p className={styles.accessMessage}>{message}</p> : null}
      <button type="button" className={baseStyles.primaryButton} onClick={() => void saveAccess()} disabled={saving}>
        {saving ? 'Saving access…' : 'Save access'}
      </button>
    </section>
  );
}

export function DealerAppAccessManagement({ middlemanMode = false }: { middlemanMode?: boolean }) {
  const middlemanConfig = useMemo<Partial<DirectoryConfig> | undefined>(() => middlemanMode ? {
    title: 'Middleman App Access',
    loginPath: '/dealer/login?app=middleman',
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

