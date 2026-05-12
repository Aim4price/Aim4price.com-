'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type AccountProfile = {
  userId: string;
  name: string;
  displayName: string;
  email: string;
  logoUrl: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
  createdAtIso: string | null;
  updatedAtIso: string | null;
};

type AccountScanPinStatus = {
  enabled: boolean;
  hasPin: boolean;
  updatedAtIso: string | null;
};

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
  error?: string;
};

type ScanPinApiResponse = {
  ok: boolean;
  scanPin?: AccountScanPinStatus;
  error?: string;
};

type ProfileDraft = {
  displayName: string;
  logoUrl: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
  marketplaceSellerName: string;
  marketplacePhone: string;
  marketplaceEmail: string;
  marketplaceLocation: string;
};

const initialProfileDraft: ProfileDraft = {
  displayName: '',
  logoUrl: '',
  businessName: '',
  phone: '',
  accountType: 'owner',
  vatNumber: '',
  province: '',
  townCity: '',
  addressLine1: '',
  addressLine2: '',
  notes: '',
  marketplaceSellerName: '',
  marketplacePhone: '',
  marketplaceEmail: '',
  marketplaceLocation: '',
};

const initialScanPinStatus: AccountScanPinStatus = {
  enabled: false,
  hasPin: false,
  updatedAtIso: null,
};

const PROFILE_COMPLETION_TOTAL = 6;
const MAX_LOGO_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  owner: 'Owner / Farmer',
  dealer: 'Dealer',
  broker: 'Broker',
  insurer: 'Insurer',
  bank: 'Bank',
};

function buildProfileLocation(profile: AccountProfile): string {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  const displayName = profile.displayName || profile.name;
  const fallbackLocation = buildProfileLocation(profile);

  return {
    displayName,
    logoUrl: profile.logoUrl,
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType || 'owner',
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
    marketplaceSellerName: profile.marketplaceSellerName || profile.businessName || displayName,
    marketplacePhone: profile.marketplacePhone || profile.phone,
    marketplaceEmail: profile.marketplaceEmail || profile.email,
    marketplaceLocation: profile.marketplaceLocation || fallbackLocation,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';

  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

function formatUploadSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function countCompletedFields(profile: ProfileDraft): number {
  return [
    profile.displayName,
    profile.businessName,
    profile.phone,
    profile.province,
    profile.townCity,
    profile.addressLine1,
  ].filter((value) => String(value ?? '').trim()).length;
}

function buildAddressLines(profile: ProfileDraft): string[] {
  return [profile.addressLine1, profile.townCity, profile.province]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function normalizePinInput(value: string): string {
  return value.replace(/\D+/g, '').slice(0, 8);
}

function formatAccountTypeLabel(value: string): string {
  const normalized = String(value ?? '').trim();

  if (!normalized) {
    return 'Owner / Farmer';
  }

  return ACCOUNT_TYPE_LABELS[normalized] ?? normalized;
}

function buildInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return 'A4';
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join('');
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      result ? resolve(result) : reject(new Error('Failed to read logo file.'));
    };

    reader.onerror = () => reject(new Error('Failed to read logo file.'));
    reader.readAsDataURL(file);
  });
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return text.trim() ? { message: text } : null;
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback;
  }

  const record = payload as Record<string, unknown>;
  const errorRecord =
    typeof record.error === 'object' && record.error !== null
      ? (record.error as Record<string, unknown>)
      : null;

  const candidates = [record.message, record.error, record.reason, errorRecord?.message, errorRecord?.error];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

export default function AccountClient() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(initialProfileDraft);
  const [scanPinStatus, setScanPinStatus] = useState<AccountScanPinStatus>(initialScanPinStatus);
  const [scanPinDraft, setScanPinDraft] = useState('');
  const [scanPinConfirmDraft, setScanPinConfirmDraft] = useState('');
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingScanPin, setIsLoadingScanPin] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingScanPin, setIsSavingScanPin] = useState(false);
  const [isDisablingScanPin, setIsDisablingScanPin] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isReadingLogo, setIsReadingLogo] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);

      try {
        const response = await fetch('/api/account-profile', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as ProfileApiResponse;

        if (!response.ok || !data.ok || !data.profile) {
          throw new Error(data.error ?? 'Failed to load account profile.');
        }

        if (!mounted) {
          return;
        }

        setProfile(data.profile);
        setProfileDraft(buildProfileDraft(data.profile));
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load account profile.',
        });
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    async function loadScanPin() {
      setIsLoadingScanPin(true);

      try {
        const response = await fetch('/api/account-profile/scan-pin', {
          cache: 'no-store',
          credentials: 'include',
        });

        const data = (await response.json()) as ScanPinApiResponse;

        if (!response.ok || !data.ok || !data.scanPin) {
          throw new Error(data.error ?? 'Failed to load scan PIN settings.');
        }

        if (!mounted) {
          return;
        }

        setScanPinStatus(data.scanPin);
      } catch (error) {
        if (!mounted) {
          return;
        }

        setNotice({
          tone: 'error',
          message: error instanceof Error ? error.message : 'Failed to load scan PIN settings.',
        });
      } finally {
        if (mounted) {
          setIsLoadingScanPin(false);
        }
      }
    }

    void loadProfile();
    void loadScanPin();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isDeleteDialogOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeletingAccount) {
        setIsDeleteDialogOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isDeleteDialogOpen, isDeletingAccount]);

  const completedFields = useMemo(() => countCompletedFields(profileDraft), [profileDraft]);
  const completionPercentage = Math.round((completedFields / PROFILE_COMPLETION_TOTAL) * 100);
  const completionLabel =
    completedFields >= PROFILE_COMPLETION_TOTAL
      ? 'Ready for reports, exports and marketplace listings.'
      : `${PROFILE_COMPLETION_TOTAL - completedFields} profile details still open.`;
  const addressLines = useMemo(() => buildAddressLines(profileDraft), [profileDraft]);
  const accountTypeLabel = useMemo(() => formatAccountTypeLabel(profileDraft.accountType), [profileDraft.accountType]);
  const accountDisplayName = profileDraft.displayName.trim() || profile?.name || 'Aim4price user';
  const profileInitials = useMemo(
    () => buildInitials(accountDisplayName || profileDraft.businessName || 'Aim4price'),
    [accountDisplayName, profileDraft.businessName],
  );
  const scanPinStatusLabel = scanPinStatus.enabled ? 'Active' : 'Disabled';
  const scanPinSummary = scanPinStatus.enabled
    ? 'QR scan access is on. Anyone with the farm PIN can open the scan page.'
    : 'QR scan access is off until a scan PIN is saved.';
  const logoUrl = profileDraft.logoUrl.trim();
  const marketplaceSellerName =
    profileDraft.marketplaceSellerName.trim() || profileDraft.businessName.trim() || accountDisplayName;
  const marketplacePhone = profileDraft.marketplacePhone.trim() || profileDraft.phone.trim() || 'No phone saved yet';
  const marketplaceEmail = profileDraft.marketplaceEmail.trim() || profile?.email || 'No email found';
  const marketplaceLocation =
    profileDraft.marketplaceLocation.trim() || (addressLines.length ? addressLines.join(', ') : 'No location saved yet');

  async function handleLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!file) {
      return;
    }

    const fileType = String(file.type ?? '').trim().toLowerCase();

    if (!ALLOWED_LOGO_TYPES.has(fileType)) {
      setNotice({ tone: 'error', message: 'Upload a JPG, PNG or WEBP logo.' });
      return;
    }

    if (file.size > MAX_LOGO_UPLOAD_BYTES) {
      setNotice({ tone: 'error', message: `Logo must be ${formatUploadSize(MAX_LOGO_UPLOAD_BYTES)} or smaller.` });
      return;
    }

    setIsReadingLogo(true);

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setProfileDraft((current) => ({ ...current, logoUrl: dataUrl }));
      setNotice({ tone: 'success', message: 'Logo selected. Save account details to keep it.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to read logo file.' });
    } finally {
      setIsReadingLogo(false);
    }
  }

  function handleRemoveLogo() {
    setProfileDraft((current) => ({ ...current, logoUrl: '' }));
    setNotice({ tone: 'success', message: 'Logo removed. Save account details to apply the change.' });
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);

    try {
      const response = await fetch('/api/account-profile', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileDraft),
      });

      const data = (await response.json()) as ProfileApiResponse;

      if (!response.ok || !data.ok || !data.profile) {
        throw new Error(data.error ?? 'Failed to save account details.');
      }

      setProfile(data.profile);
      setProfileDraft(buildProfileDraft(data.profile));
      setNotice({ tone: 'success', message: 'Account details saved.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save account details.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleScanPinSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedPin = normalizePinInput(scanPinDraft);
    const normalizedConfirmPin = normalizePinInput(scanPinConfirmDraft);

    if (!normalizedPin) {
      setNotice({ tone: 'error', message: 'Enter a scan PIN.' });
      return;
    }

    if (normalizedPin.length < 4 || normalizedPin.length > 8) {
      setNotice({ tone: 'error', message: 'Scan PIN must be 4 to 8 digits.' });
      return;
    }

    if (normalizedPin !== normalizedConfirmPin) {
      setNotice({ tone: 'error', message: 'Scan PINs do not match.' });
      return;
    }

    setIsSavingScanPin(true);

    try {
      const response = await fetch('/api/account-profile/scan-pin', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pin: normalizedPin,
          confirmPin: normalizedConfirmPin,
        }),
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(extractErrorMessage(payload, 'Failed to save scan PIN.'));
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft('');
      setScanPinConfirmDraft('');
      setNotice({ tone: 'success', message: 'Scan PIN saved. QR scan access is now active.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to save scan PIN.',
      });
    } finally {
      setIsSavingScanPin(false);
    }
  }

  async function handleDisableScanPin() {
    setIsDisablingScanPin(true);

    try {
      const response = await fetch('/api/account-profile/scan-pin', {
        method: 'DELETE',
        credentials: 'include',
      });

      const payload = await readResponsePayload(response);
      const data = (payload ?? null) as ScanPinApiResponse | null;

      if (!response.ok || !data?.ok || !data.scanPin) {
        throw new Error(extractErrorMessage(payload, 'Failed to disable scan PIN.'));
      }

      setScanPinStatus(data.scanPin);
      setScanPinDraft('');
      setScanPinConfirmDraft('');
      setNotice({ tone: 'success', message: 'Scan PIN disabled.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to disable scan PIN.',
      });
    } finally {
      setIsDisablingScanPin(false);
    }
  }

  function closeDeleteDialog() {
    if (isDeletingAccount) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDeletePassword('');
    setDeleteConfirmText('');
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deletePassword.trim()) {
      setNotice({ tone: 'error', message: 'Enter your password to delete this account.' });
      return;
    }

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setNotice({ tone: 'error', message: 'Type DELETE to confirm account removal.' });
      return;
    }

    setIsDeletingAccount(true);

    try {
      const response = await fetch('/api/auth/delete-user', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          password: deletePassword,
          callbackURL: '/',
        }),
      });

      const payload = await readResponsePayload(response);

      if (!response.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to delete account.'));
      }

      setNotice({
        tone: 'success',
        message: 'Your account and saved workspace data were deleted. Redirecting…',
      });
      setIsDeleteDialogOpen(false);
      setDeletePassword('');
      setDeleteConfirmText('');

      window.setTimeout(() => {
        window.location.assign('/');
      }, 700);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete account.',
      });
    } finally {
      setIsDeletingAccount(false);
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroLogoMark} aria-label="Current account logo">
              {logoUrl ? <img src={logoUrl} alt="Account logo" /> : <span>{profileInitials}</span>}
            </div>
            <h1>Account details</h1>
            <p>
              Keep your business identity, scan access and marketplace buyer details in one clean workspace.
              This profile feeds reports, exports and published equipment.
            </p>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroProfileCard}>
              <span className={styles.profileAvatar} aria-hidden="true">
                {profileInitials}
              </span>
              <div className={styles.profileSummary}>
                <span>Signed in as</span>
                <strong>{accountDisplayName}</strong>
                <small>{profile?.email || 'Account email loading'}</small>
              </div>
            </div>

            <div className={styles.heroStat}>
              <span>Profile completion</span>
              <strong>{completedFields}/{PROFILE_COMPLETION_TOTAL}</strong>
              <div className={styles.progressTrack} aria-hidden="true">
                <span style={{ width: `${completionPercentage}%` }} />
              </div>
              <small>{completionLabel}</small>
            </div>

            <div className={styles.heroStatGrid}>
              <div className={styles.heroStat}>
                <span>Account type</span>
                <strong>{accountTypeLabel}</strong>
              </div>
              <div className={styles.heroStat}>
                <span>Scan access</span>
                <strong>{scanPinStatusLabel}</strong>
              </div>
            </div>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.layout}>
          <div className={styles.mainColumn}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Business and contact details</h2>
                  <p>Edit the details used across your account, reports and owner workspace.</p>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.loading}>Loading account details...</p>
              ) : (
                <form className={styles.form} onSubmit={handleProfileSubmit}>
                  <div className={`${styles.logoPanel} ${styles.fullWidth}`}>
                    <div className={styles.logoPreview} aria-label="Business logo preview">
                      {logoUrl ? <img src={logoUrl} alt="Business logo" /> : <span>{profileInitials}</span>}
                    </div>
                    <div className={styles.logoCopy}>
                      <strong>Business logo</strong>
                      <span>Upload your own logo for a cleaner business profile. JPG, PNG or WEBP up to 2 MB.</span>
                    </div>
                    <div className={styles.logoActions}>
                      <label className={`${styles.secondaryButton} ${styles.uploadButton}`}>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={handleLogoFileChange}
                          disabled={isReadingLogo || isSavingProfile}
                        />
                        {isReadingLogo ? 'Reading logo...' : logoUrl ? 'Change logo' : 'Upload logo'}
                      </label>
                      <button
                        type="button"
                        className={styles.ghostButton}
                        onClick={handleRemoveLogo}
                        disabled={!logoUrl || isSavingProfile}
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Full name</span>
                    <input
                      value={profileDraft.displayName}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, displayName: event.target.value }))
                      }
                      placeholder="Full name"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Email</span>
                    <input value={profile?.email ?? ''} disabled />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Business name</span>
                    <input
                      value={profileDraft.businessName}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, businessName: event.target.value }))
                      }
                      placeholder="Business name"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.halfField}`}>
                    <span>Phone</span>
                    <input
                      type="tel"
                      value={profileDraft.phone}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="Phone number"
                    />
                  </label>

                  <div className={`${styles.field} ${styles.thirdField}`}>
                    <span>Account type</span>
                    <div className={styles.readOnlyValue} aria-readonly="true">
                      {accountTypeLabel}
                    </div>
                    <small className={styles.fieldHint}>Locked to your current account setup.</small>
                  </div>

                  <label className={`${styles.field} ${styles.thirdField}`}>
                    <span>Province</span>
                    <input
                      value={profileDraft.province}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, province: event.target.value }))}
                      placeholder="Province"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.thirdField}`}>
                    <span>Town / city</span>
                    <input
                      value={profileDraft.townCity}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, townCity: event.target.value }))}
                      placeholder="Town or city"
                    />
                  </label>

                  <label className={`${styles.field} ${styles.fullWidth}`}>
                    <span>Address line 1</span>
                    <input
                      value={profileDraft.addressLine1}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, addressLine1: event.target.value }))
                      }
                      placeholder="Address line 1"
                    />
                  </label>
                  <div className={styles.actionsRow}>
                    <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                      {isSavingProfile ? 'Saving...' : 'Save account details'}
                    </button>
                    <Link href="/asset-register" className={styles.secondaryButton}>
                      Open asset register
                    </Link>
                    <Link href="/asset-map" className={styles.secondaryButton}>
                      Open asset map
                    </Link>
                  </div>
                </form>
              )}
            </section>

            <section className={`${styles.card} ${styles.marketplaceCard}`}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Marketplace contact</h2>
                  <p>Edit the buyer-facing details shown when your equipment is published on the marketplace.</p>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.loading}>Loading marketplace contact...</p>
              ) : (
                <form className={styles.marketplaceEditor} onSubmit={handleProfileSubmit}>
                  <div className={styles.marketplacePreview}>
                    <div className={styles.previewLogo} aria-hidden="true">
                      {logoUrl ? <img src={logoUrl} alt="" /> : <span>{profileInitials}</span>}
                    </div>
                    <div className={styles.previewContent}>
                      <span>Buyer preview</span>
                      <strong>{marketplaceSellerName}</strong>
                      <small>{marketplaceEmail}</small>
                    </div>
                    <div className={styles.previewDetails}>
                      <div>
                        <span>Phone</span>
                        <strong>{marketplacePhone}</strong>
                      </div>
                      <div>
                        <span>Location</span>
                        <strong>{marketplaceLocation}</strong>
                      </div>
                    </div>
                  </div>

                  <div className={styles.marketplaceFields}>
                    <label className={styles.field}>
                      <span>Seller display name</span>
                      <input
                        value={profileDraft.marketplaceSellerName}
                        onChange={(event) =>
                          setProfileDraft((current) => ({ ...current, marketplaceSellerName: event.target.value }))
                        }
                        placeholder="Name buyers should see"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Marketplace phone</span>
                      <input
                        type="tel"
                        value={profileDraft.marketplacePhone}
                        onChange={(event) =>
                          setProfileDraft((current) => ({ ...current, marketplacePhone: event.target.value }))
                        }
                        placeholder="Buyer contact number"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Marketplace email</span>
                      <input
                        type="email"
                        value={profileDraft.marketplaceEmail}
                        onChange={(event) =>
                          setProfileDraft((current) => ({ ...current, marketplaceEmail: event.target.value }))
                        }
                        placeholder="Buyer contact email"
                      />
                    </label>

                    <label className={styles.field}>
                      <span>Marketplace location</span>
                      <input
                        value={profileDraft.marketplaceLocation}
                        onChange={(event) =>
                          setProfileDraft((current) => ({ ...current, marketplaceLocation: event.target.value }))
                        }
                        placeholder="Town, province or branch location"
                      />
                    </label>

                    <div className={styles.marketplaceActions}>
                      <button type="submit" className={styles.primaryButton} disabled={isSavingProfile || isReadingLogo}>
                        {isSavingProfile ? 'Saving...' : 'Save marketplace contact'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </section>
          </div>

          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>QR scan PIN</h2>
                  <p>This PIN is used on scanned asset pages. It keeps operational updates separate from valuations.</p>
                </div>
              </div>

              {isLoadingScanPin ? (
                <p className={styles.loading}>Loading scan PIN...</p>
              ) : (
                <>
                  <div className={styles.summaryStack}>
                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Status</span>
                      <div className={styles.summaryList}>
                        <strong>{scanPinStatusLabel}</strong>
                        <span>{scanPinSummary}</span>
                      </div>
                    </div>

                    <div className={styles.summaryRow}>
                      <span className={styles.summaryLabel}>Last changed</span>
                      <span className={styles.summaryValue}>{formatDate(scanPinStatus.updatedAtIso)}</span>
                    </div>
                  </div>

                  <form className={styles.pinForm} onSubmit={handleScanPinSubmit}>
                    <div className={styles.pinGrid}>
                      <label className={styles.field}>
                        <span>New scan PIN</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          value={scanPinDraft}
                          onChange={(event) => setScanPinDraft(normalizePinInput(event.target.value))}
                          placeholder="4 to 8 digits"
                        />
                      </label>

                      <label className={styles.field}>
                        <span>Confirm scan PIN</span>
                        <input
                          type="password"
                          inputMode="numeric"
                          autoComplete="new-password"
                          value={scanPinConfirmDraft}
                          onChange={(event) => setScanPinConfirmDraft(normalizePinInput(event.target.value))}
                          placeholder="Repeat PIN"
                        />
                      </label>
                    </div>

                    <p className={styles.helperText}>
                      Use a simple farm PIN that trusted staff can use when scanning a metal QR tag in the field.
                    </p>

                    <div className={styles.inlineActions}>
                      <button type="submit" className={styles.primaryButton} disabled={isSavingScanPin}>
                        {isSavingScanPin ? 'Saving scan PIN...' : scanPinStatus.hasPin ? 'Update scan PIN' : 'Save scan PIN'}
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleDisableScanPin}
                        disabled={isDisablingScanPin || !scanPinStatus.hasPin}
                      >
                        {isDisablingScanPin ? 'Disabling...' : 'Disable scan PIN'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>

            <section className={`${styles.sidebarCard} ${styles.dangerCard}`}>
              <div className={styles.dangerCopy}>
                <h2>Delete account</h2>
                <p>
                  Permanently remove your login, saved valuations, asset register items and account
                  profile from Aim4price.
                </p>
              </div>

              <button type="button" className={styles.dangerButton} onClick={() => setIsDeleteDialogOpen(true)}>
                Delete my account
              </button>
            </section>
          </aside>
        </div>
      </section>

      {isDeleteDialogOpen ? (
        <div className={styles.modalBackdrop} onClick={closeDeleteDialog}>
          <section className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Confirm permanent removal</h2>
              <p>
                This removes your full Aim4price workspace, including saved valuations, asset register
                items and account details.
              </p>
            </div>

            <form className={styles.modalForm} onSubmit={handleDeleteAccount}>
              <div className={styles.confirmBox}>
                <strong>This action cannot be undone.</strong>
                <p>Enter your password and type DELETE below to confirm.</p>
              </div>

              <label className={styles.modalField}>
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Enter your password"
                />
              </label>

              <label className={styles.modalField}>
                <span>Type DELETE to confirm</span>
                <input
                  value={deleteConfirmText}
                  onChange={(event) => setDeleteConfirmText(event.target.value)}
                  placeholder="DELETE"
                />
              </label>

              <div className={styles.modalActions}>
                <button type="button" className={styles.ghostButton} onClick={closeDeleteDialog}>
                  Cancel
                </button>
                <button type="submit" className={styles.dangerButton} disabled={isDeletingAccount}>
                  {isDeletingAccount ? 'Deleting account...' : 'Delete account'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
