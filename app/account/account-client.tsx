'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

type NoticeTone = 'success' | 'error';

type AccountProfile = {
  userId: string;
  name: string;
  email: string;
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
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
  businessName: string;
  phone: string;
  accountType: string;
  vatNumber: string;
  province: string;
  townCity: string;
  addressLine1: string;
  addressLine2: string;
  notes: string;
};

const initialProfileDraft: ProfileDraft = {
  businessName: '',
  phone: '',
  accountType: 'owner',
  vatNumber: '',
  province: '',
  townCity: '',
  addressLine1: '',
  addressLine2: '',
  notes: '',
};

const initialScanPinStatus: AccountScanPinStatus = {
  enabled: false,
  hasPin: false,
  updatedAtIso: null,
};

const PROFILE_COMPLETION_TOTAL = 6;

function buildProfileDraft(profile: AccountProfile | null): ProfileDraft {
  if (!profile) {
    return initialProfileDraft;
  }

  return {
    businessName: profile.businessName,
    phone: profile.phone,
    accountType: profile.accountType || 'owner',
    vatNumber: profile.vatNumber,
    province: profile.province,
    townCity: profile.townCity,
    addressLine1: profile.addressLine1,
    addressLine2: profile.addressLine2,
    notes: profile.notes,
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

function countCompletedFields(profile: ProfileDraft): number {
  return [
    profile.businessName,
    profile.phone,
    profile.accountType,
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
  const addressLines = useMemo(() => buildAddressLines(profileDraft), [profileDraft]);
  const marketplaceSellerName = useMemo(() => {
    return profileDraft.businessName.trim() || profile?.name || 'No seller name saved yet';
  }, [profile?.name, profileDraft.businessName]);
  const scanPinStatusLabel = scanPinStatus.enabled ? 'Active' : 'Disabled';
  const scanPinSummary = scanPinStatus.enabled
    ? 'QR scan access is on. Anyone with the farm PIN can open the scan page.'
    : 'QR scan access is off until a scan PIN is saved.';

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
            <span className={styles.eyebrow}>Profile</span>
            <h1>Account details</h1>
            <p>
              Keep your business and contact details in one clean workspace. This is the
              seller profile that feeds the rest of Aim4price.
            </p>
          </div>

          <div className={styles.heroAside}>
            <div className={styles.heroStat}>
              <span>Profile completion</span>
              <strong>{completedFields}/{PROFILE_COMPLETION_TOTAL}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Account type</span>
              <strong>{profileDraft.accountType || 'owner'}</strong>
            </div>
            <div className={styles.heroStat}>
              <span>Last updated</span>
              <strong>{formatDate(profile?.updatedAtIso)}</strong>
            </div>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.layout}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Account profile</span>
                <h2>Business and contact details</h2>
                <p>Use this page for the information you want tied to reports, exports and seller contact details.</p>
              </div>
            </div>

            {isLoading ? (
              <p className={styles.loading}>Loading account details...</p>
            ) : (
              <form className={styles.form} onSubmit={handleProfileSubmit}>
                <label className={`${styles.field} ${styles.halfField}`}>
                  <span>Full name</span>
                  <input value={profile?.name ?? ''} disabled />
                </label>

                <label className={`${styles.field} ${styles.halfField}`}>
                  <span>Email</span>
                  <input value={profile?.email ?? ''} disabled />
                </label>

                <label className={`${styles.field} ${styles.halfField}`}>
                  <span>Business / farm / dealership</span>
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

                <label className={`${styles.field} ${styles.thirdField}`}>
                  <span>Account type</span>
                  <select
                    value={profileDraft.accountType}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, accountType: event.target.value }))
                    }
                  >
                    <option value="owner">Owner / Farmer</option>
                    <option value="dealer">Dealer</option>
                    <option value="broker">Broker</option>
                    <option value="insurer">Insurer</option>
                    <option value="bank">Bank</option>
                  </select>
                </label>

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
                  <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
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

          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kicker}>Scan access</span>
                  <h2>QR scan PIN</h2>
                  <p>This PIN is used on scanned asset pages. It keeps the operational side separate from valuations.</p>
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

            <section className={styles.sidebarCard}>
              <div className={styles.cardHeader}>
                <div>
                  <span className={styles.kicker}>Seller preview</span>
                  <h2>Marketplace contact</h2>
                  <p>This is the contact footprint buyers will rely on when you publish equipment.</p>
                </div>
              </div>

              <div className={styles.summaryStack}>
                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Seller</span>
                  <div className={styles.summaryList}>
                    <strong>{marketplaceSellerName}</strong>
                    <span>{profile?.email || 'No email found'}</span>
                  </div>
                </div>

                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Phone</span>
                  <span className={styles.summaryValue}>{profileDraft.phone.trim() || 'No phone saved yet'}</span>
                </div>

                <div className={styles.summaryRow}>
                  <span className={styles.summaryLabel}>Location</span>
                  <span className={styles.summaryValue}>
                    {addressLines.length ? addressLines.join(', ') : 'No address saved yet'}
                  </span>
                </div>
              </div>
            </section>

            <section className={`${styles.sidebarCard} ${styles.dangerCard}`}>
              <div className={styles.dangerCopy}>
                <span className={styles.dangerKicker}>Danger zone</span>
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
              <span className={styles.dangerKicker}>Delete account</span>
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
