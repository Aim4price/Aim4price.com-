'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from '../shared-access/page.module.css';

type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';

type SharedRegisterSummary = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  partnerType: PartnerType;
  status: GrantStatus;
  permissionLevel: string;
  includeDocuments: boolean;
  includeScanHistory: boolean;
  ownerMessage: string;
  ownerName: string;
  ownerBusinessName: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  createdAtIso: string;
  acceptedAtIso: string | null;
  revokedAtIso: string | null;
  declinedAtIso: string | null;
  lastViewedAtIso: string | null;
  assetCount: number;
  totalValue: number;
};

type AssetRegisterItem = {
  id: string;
  title: string;
  kind: string;
  value: number;
  brandName: string;
  modelName: string;
  typedModelName: string;
  equipmentFamilyLabel: string;
  yearModel: number | null;
  hours: number | null;
  condition: string;
  serialNumber: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  lastScannedAtIso: string | null;
  updatedAtIso: string;
};

type SharedRegistersResponse = {
  ok: boolean;
  registers?: SharedRegisterSummary[];
  grant?: SharedRegisterSummary;
  error?: string;
};

type SharedAssetsResponse = {
  ok: boolean;
  assets?: AssetRegisterItem[];
  error?: string;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }).format(parsed);
}

function formatStatus(value: GrantStatus): string {
  if (value === 'active') return 'Active';
  if (value === 'pending') return 'Pending';
  if (value === 'revoked') return 'Revoked';
  return 'Declined';
}

function statusClass(value: GrantStatus): string {
  if (value === 'active') return styles.statusActive;
  if (value === 'pending') return styles.statusPending;
  if (value === 'revoked') return styles.statusRevoked;
  return styles.statusDeclined;
}

function formatPartnerType(value: PartnerType): string {
  if (value === 'dealer') return 'Dealer';
  if (value === 'finance') return 'Finance';
  return 'Insurance';
}

function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-ZA').format(Math.round(value));
}

function ownerName(register: SharedRegisterSummary): string {
  return register.ownerBusinessName || register.ownerName || 'Aim4price owner';
}

function ownerLocation(register: SharedRegisterSummary): string {
  return [register.ownerTownCity, register.ownerProvince].filter(Boolean).join(', ') || 'Location not saved';
}

export default function SharedRegistersClient() {
  const [registers, setRegisters] = useState<SharedRegisterSummary[]>([]);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState('');
  const [assets, setAssets] = useState<AssetRegisterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const activeRegisters = useMemo(() => registers.filter((register) => register.status === 'active'), [registers]);
  const pendingRegisters = useMemo(() => registers.filter((register) => register.status === 'pending'), [registers]);
  const selectedRegister = useMemo(
    () => activeRegisters.find((register) => register.ownerUserId === selectedOwnerUserId) ?? null,
    [activeRegisters, selectedOwnerUserId],
  );

  const totalSharedValue = useMemo(
    () => activeRegisters.reduce((sum, register) => sum + Number(register.totalValue || 0), 0),
    [activeRegisters],
  );

  const loadRegisters = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/shared-registers', { cache: 'no-store', credentials: 'include' });
      const data = (await response.json()) as SharedRegistersResponse;

      if (!response.ok || !data.ok || !data.registers) {
        throw new Error(data.error ?? 'Failed to load shared registers.');
      }

      setRegisters(data.registers);
      const firstActive = data.registers.find((register) => register.status === 'active');
      setSelectedOwnerUserId((current) => current || firstActive?.ownerUserId || '');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load shared registers.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAssets = useCallback(async (ownerUserId: string) => {
    if (!ownerUserId) {
      setAssets([]);
      return;
    }

    setIsLoadingAssets(true);

    try {
      const response = await fetch(`/api/shared-registers/${encodeURIComponent(ownerUserId)}/assets`, {
        cache: 'no-store',
        credentials: 'include',
      });
      const data = (await response.json()) as SharedAssetsResponse;

      if (!response.ok || !data.ok || !data.assets) {
        throw new Error(data.error ?? 'Failed to load shared register assets.');
      }

      setAssets(data.assets);
    } catch (error) {
      setAssets([]);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load shared assets.' });
    } finally {
      setIsLoadingAssets(false);
    }
  }, []);

  useEffect(() => {
    void loadRegisters();
  }, [loadRegisters]);

  useEffect(() => {
    void loadAssets(selectedOwnerUserId);
  }, [loadAssets, selectedOwnerUserId]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function respondToGrant(grantId: string, action: 'accept' | 'decline') {
    try {
      const response = await fetch(`/api/shared-access/${grantId}/${action}`, {
        method: 'PATCH',
        credentials: 'include',
      });
      const data = (await response.json()) as SharedRegistersResponse;

      if (!response.ok || !data.ok || !data.grant) {
        throw new Error(data.error ?? `Failed to ${action} access.`);
      }

      setNotice({ tone: 'success', message: action === 'accept' ? 'Shared register accepted.' : 'Shared register declined.' });
      await loadRegisters();
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : `Failed to ${action} access.` });
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <h1>Shared registers</h1>
            <p>
              View Asset Registers that machinery owners have shared with your partner account. V1 access is view-only.
            </p>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.statGrid}>
          <div className={styles.statCard}>
            <span>Active registers</span>
            <strong>{activeRegisters.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Pending requests</span>
            <strong>{pendingRegisters.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Visible value</span>
            <strong>{formatCurrency(totalSharedValue)}</strong>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.stack}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Requests</h2>
                  <p>Accept or decline register access requests sent to this account.</p>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.emptyState}>Loading requests...</p>
              ) : pendingRegisters.length ? (
                <div className={styles.grantList}>
                  {pendingRegisters.map((register) => (
                    <article key={register.id} className={styles.grantCard}>
                      <div className={styles.cardTitleRow}>
                        <strong>{ownerName(register)}</strong>
                        <span className={`${styles.statusPill} ${statusClass(register.status)}`}>{formatStatus(register.status)}</span>
                      </div>
                      <div className={styles.cardMetaRow}>
                        <span>{ownerLocation(register)}</span>
                        <span>{formatPartnerType(register.partnerType)}</span>
                        <span>Requested {formatDate(register.createdAtIso)}</span>
                      </div>
                      {register.ownerMessage ? <p>{register.ownerMessage}</p> : null}
                      <div className={styles.inlineActions}>
                        <button type="button" className={styles.primaryButton} onClick={() => void respondToGrant(register.id, 'accept')}>
                          Accept access
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={() => void respondToGrant(register.id, 'decline')}>
                          Decline
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>No pending register requests.</p>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>Active shared registers</h2>
                  <p>Choose a register to view its current assets.</p>
                </div>
              </div>

              {isLoading ? (
                <p className={styles.emptyState}>Loading active registers...</p>
              ) : activeRegisters.length ? (
                <div className={styles.grantList}>
                  {activeRegisters.map((register) => (
                    <button
                      key={register.id}
                      type="button"
                      className={`${styles.grantCard} ${selectedOwnerUserId === register.ownerUserId ? styles.partnerCardActive : ''}`}
                      onClick={() => setSelectedOwnerUserId(register.ownerUserId)}
                    >
                      <div className={styles.cardTitleRow}>
                        <strong>{ownerName(register)}</strong>
                        <span className={`${styles.statusPill} ${statusClass(register.status)}`}>{formatStatus(register.status)}</span>
                      </div>
                      <div className={styles.cardMetaRow}>
                        <span>{ownerLocation(register)}</span>
                        <span>{register.assetCount} assets</span>
                        <span>{formatCurrency(register.totalValue)}</span>
                        {register.lastViewedAtIso ? <span>Last viewed {formatDate(register.lastViewedAtIso)}</span> : null}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyState}>No active shared registers yet.</p>
              )}
            </section>
          </div>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>{selectedRegister ? ownerName(selectedRegister) : 'Register assets'}</h2>
                <p>{selectedRegister ? `${assets.length} visible assets in this shared register.` : 'Select an active register.'}</p>
              </div>
            </div>

            {isLoadingAssets ? (
              <p className={styles.emptyState}>Loading assets...</p>
            ) : selectedRegister && assets.length ? (
              <div className={styles.assetList}>
                {assets.map((asset) => (
                  <article key={asset.id} className={styles.assetCard}>
                    <div className={styles.cardTitleRow}>
                      <strong>{asset.title}</strong>
                      <span className={styles.assetValue}>{formatCurrency(asset.value)}</span>
                    </div>
                    <div className={styles.cardMetaRow}>
                      <span>{[asset.brandName, asset.modelName || asset.typedModelName].filter(Boolean).join(' ') || asset.equipmentFamilyLabel || asset.kind}</span>
                      <span>Year {asset.yearModel ?? '—'}</span>
                      <span>Hours {formatHours(asset.hours)}</span>
                      <span>Updated {formatDate(asset.updatedAtIso)}</span>
                    </div>
                    <p>
                      Finance: {asset.isFinanced ? 'Yes' : 'No'} · Insurance: {asset.isInsured ? 'Yes' : 'No'} · Licensed:{' '}
                      {asset.isLicensed ? 'Yes' : 'No'}
                    </p>
                  </article>
                ))}
              </div>
            ) : selectedRegister ? (
              <p className={styles.emptyState}>This shared register has no visible assets yet.</p>
            ) : (
              <p className={styles.emptyState}>Select an active shared register to view assets.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
