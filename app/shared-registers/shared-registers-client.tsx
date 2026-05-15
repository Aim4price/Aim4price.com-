'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from '../shared-access/page.module.css';

type AccountType = 'owner' | 'dealer' | 'finance' | 'insurance';
type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';

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

type SharedRegistersResponse = {
  ok: boolean;
  registers?: SharedRegisterSummary[];
  grant?: SharedRegisterSummary;
  error?: string;
};

function formatCurrency(value: number | null | undefined): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(Math.round(Number(value) || 0));
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

function ownerName(register: SharedRegisterSummary): string {
  return register.ownerBusinessName || register.ownerName || 'Aim4price owner';
}

function ownerLocation(register: SharedRegisterSummary): string {
  return [register.ownerTownCity, register.ownerProvince].filter(Boolean).join(', ') || 'Location not saved';
}

function registerHref(register: SharedRegisterSummary): string {
  return `/shared-registers/${encodeURIComponent(register.ownerUserId)}`;
}

export default function SharedRegistersClient() {
  const [registers, setRegisters] = useState<SharedRegisterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const activeRegisters = useMemo(() => registers.filter((register) => register.status === 'active'), [registers]);
  const pendingRegisters = useMemo(() => registers.filter((register) => register.status === 'pending'), [registers]);

  const loadRegisters = useCallback(async () => {
    setIsLoading(true);

    try {
      const [sessionResponse, registersResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/shared-registers', { cache: 'no-store', credentials: 'include' }),
      ]);
      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const registersData = (await registersResponse.json()) as SharedRegistersResponse;

      if (!sessionData?.signedIn) {
        throw new Error('You must be signed in.');
      }

      if (!registersResponse.ok || !registersData.ok || !registersData.registers) {
        throw new Error(registersData.error ?? 'Failed to load shared registers.');
      }

      setRegisters(registersData.registers);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load shared registers.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegisters();
  }, [loadRegisters]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 4200);
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
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <h1>Shared registers</h1>
            <p>Open the owner registers shared to this account. Each register opens in a separate tab with the normal Asset Register layout and restricted partner actions.</p>
          </div>
        </div>

        {notice ? (
          <div className={`${styles.notice} ${notice.tone === 'success' ? styles.noticeSuccess : styles.noticeError}`}>
            {notice.message}
          </div>
        ) : null}

        <div className={`${styles.statGrid} ${styles.compactStatGrid}`}>
          <div className={styles.statCard}>
            <span>Active registers</span>
            <strong>{activeRegisters.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Pending requests</span>
            <strong>{pendingRegisters.length}</strong>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Asset Register access</h2>
              <p>Only register cards are shown here. Click Open to view that owner&apos;s Asset Register in a new tab.</p>
            </div>
          </div>

          {isLoading ? <div className={styles.emptyState}>Loading shared registers...</div> : null}

          {!isLoading && pendingRegisters.length ? (
            <div className={styles.partnerRegisterGrid}>
              {pendingRegisters.map((register) => (
                <article className={styles.grantCard} key={register.id}>
                  <div className={styles.cardTitleRow}>
                    <strong>{ownerName(register)}</strong>
                    <span className={`${styles.statusPill} ${statusClass(register.status)}`}>{formatStatus(register.status)}</span>
                  </div>
                  <p>{register.ownerMessage || `${ownerName(register)} wants to share an Asset Register with your ${formatPartnerType(register.partnerType).toLowerCase()} account.`}</p>
                  <div className={styles.inlineActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => void respondToGrant(register.id, 'accept')}>
                      Accept
                    </button>
                    <button type="button" className={styles.dangerButton} onClick={() => void respondToGrant(register.id, 'decline')}>
                      Decline
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          {!isLoading && activeRegisters.length ? (
            <div className={styles.partnerRegisterGrid}>
              {activeRegisters.map((register) => (
                <a
                  className={styles.partnerRegisterCard}
                  href={registerHref(register)}
                  target="_blank"
                  rel="noreferrer"
                  key={register.id}
                >
                  <span>{ownerName(register)}</span>
                  <small>Contact: {register.ownerPhone || '—'}</small>
                  <small>{ownerLocation(register)}</small>
                  <strong>{register.assetCount}</strong>
                  <small>Total value: {formatCurrency(register.totalValue)}</small>
                  <em>Open</em>
                </a>
              ))}
            </div>
          ) : null}

          {!isLoading && !activeRegisters.length && !pendingRegisters.length ? (
            <div className={styles.emptyState}>No owner registers are currently shared with this account.</div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
