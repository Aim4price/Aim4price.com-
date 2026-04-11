'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from '../asset-register/page.module.css';

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

type ProfileApiResponse = {
  ok: boolean;
  profile?: AccountProfile;
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
    profile.vatNumber,
    profile.province,
    profile.townCity,
    profile.addressLine1,
    profile.addressLine2,
    profile.notes,
  ].filter((value) => String(value ?? '').trim()).length;
}

export default function AccountClient() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(initialProfileDraft);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return undefined;

    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const completedFields = useMemo(() => countCompletedFields(profileDraft), [profileDraft]);

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

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Account</span>
            <h1>Manage the details used across Aim4price.</h1>
            <p>
              Keep your business profile, contact details and report-ready information in one place.
              This page is the right home for future PDF, export and marketplace defaults.
            </p>
          </div>

          <div className={styles.heroStats}>
            <div className={styles.statCard}>
              <span>Profile fields completed</span>
              <strong>{completedFields}/9</strong>
            </div>
            <div className={styles.statCard}>
              <span>Account type</span>
              <strong>{profileDraft.accountType || 'owner'}</strong>
            </div>
            <div className={styles.statCard}>
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

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Profile</span>
                <h2>Account details</h2>
                <p>
                  These details can flow into valuation PDFs, portfolio exports, contact blocks and
                  future marketplace seller defaults.
                </p>
              </div>
            </div>

            {isLoading ? (
              <p className={styles.loading}>Loading account details...</p>
            ) : (
              <form className={styles.form} onSubmit={handleProfileSubmit}>
                <label className={styles.field}>
                  <span>Full name</span>
                  <input value={profile?.name ?? ''} disabled />
                </label>

                <label className={styles.field}>
                  <span>Email</span>
                  <input value={profile?.email ?? ''} disabled />
                </label>

                <label className={styles.field}>
                  <span>Business / farm / dealership</span>
                  <input
                    value={profileDraft.businessName}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, businessName: event.target.value }))
                    }
                    placeholder="Business name"
                  />
                </label>

                <label className={styles.field}>
                  <span>Phone</span>
                  <input
                    value={profileDraft.phone}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Phone number"
                  />
                </label>

                <label className={styles.field}>
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

                <label className={styles.field}>
                  <span>VAT number</span>
                  <input
                    value={profileDraft.vatNumber}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, vatNumber: event.target.value }))
                    }
                    placeholder="VAT number"
                  />
                </label>

                <label className={styles.field}>
                  <span>Province</span>
                  <input
                    value={profileDraft.province}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, province: event.target.value }))}
                    placeholder="Province"
                  />
                </label>

                <label className={styles.field}>
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

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Address line 2</span>
                  <input
                    value={profileDraft.addressLine2}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, addressLine2: event.target.value }))
                    }
                    placeholder="Address line 2"
                  />
                </label>

                <label className={`${styles.field} ${styles.fullWidth}`}>
                  <span>Notes</span>
                  <textarea
                    rows={4}
                    value={profileDraft.notes}
                    onChange={(event) => setProfileDraft((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Extra account, PDF or contact details"
                  />
                </label>

                <div className={styles.actionsRow}>
                  <button type="submit" className={styles.primaryButton} disabled={isSavingProfile}>
                    {isSavingProfile ? 'Saving...' : 'Save account details'}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <span className={styles.kicker}>Next layer</span>
                <h2>How this page will be used</h2>
                <p>
                  This route is now separated from the asset register so profile settings can grow
                  without cluttering the saved-assets workflow.
                </p>
              </div>
            </div>

            <div className={styles.assetList}>
              <article className={styles.assetCard}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>PDFs</span>
                  <span className={styles.badge}>Reports</span>
                </div>
                <h3>Report-ready details</h3>
                <p className={styles.note}>
                  Business name, address, VAT and contact details are now anchored in one page,
                  which is the correct base for branded PDF exports.
                </p>
              </article>

              <article className={styles.assetCard}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Marketplace</span>
                  <span className={styles.badge}>Seller defaults</span>
                </div>
                <h3>Seller profile groundwork</h3>
                <p className={styles.note}>
                  The next marketplace upgrade can pull default seller contact information from this
                  account layer instead of duplicating it listing by listing.
                </p>
              </article>

              <article className={styles.assetCard}>
                <div className={styles.badgeRow}>
                  <span className={styles.badge}>Workspace</span>
                  <span className={styles.badge}>Navigation</span>
                </div>
                <h3>Cleaner product structure</h3>
                <p className={styles.note}>
                  Asset Register can now focus on saved machinery, while Account owns profile,
                  contact, export and settings workflows.
                </p>
              </article>
            </div>

            <div className={styles.inlineLinks}>
              <Link href="/asset-register" className={styles.secondaryButton}>
                Open asset register
              </Link>
              <Link href="/valuation" className={styles.secondaryButton}>
                Open valuation
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
