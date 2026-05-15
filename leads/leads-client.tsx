'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import styles from '../shared-access/page.module.css';

type LeadType = 'finance' | 'insurance' | 'replacement_quote';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';

type AssetLead = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  leadType: LeadType;
  status: LeadStatus;
  assetSnapshot: Record<string, unknown>;
  includedSections: Record<string, unknown>;
  ownerMessage: string;
  ownerContactName: string;
  ownerContactPhone: string;
  ownerContactEmail: string;
  ownerName: string;
  ownerBusinessName: string;
  ownerPhone: string;
  ownerProvince: string;
  ownerTownCity: string;
  partnerName: string;
  partnerBusinessName: string;
  partnerPhone: string;
  partnerProvince: string;
  partnerTownCity: string;
  createdAtIso: string;
  viewedAtIso: string | null;
  acceptedAtIso: string | null;
  quotedAtIso: string | null;
  declinedAtIso: string | null;
  closedAtIso: string | null;
  updatedAtIso: string;
};

type LeadsResponse = {
  ok: boolean;
  leads?: AssetLead[];
  lead?: AssetLead;
  error?: string;
};

type SessionResponse = {
  ok: boolean;
  signedIn: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
};

function formatCurrency(value: unknown): string {
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

function formatLeadType(value: LeadType): string {
  if (value === 'finance') return 'Finance offer';
  if (value === 'insurance') return 'Insurance quote';
  return 'Replacement quote';
}

function formatStatus(value: LeadStatus): string {
  if (value === 'sent') return 'Sent';
  if (value === 'viewed') return 'Viewed';
  if (value === 'accepted') return 'Accepted';
  if (value === 'quoted') return 'Quoted';
  if (value === 'declined') return 'Declined';
  return 'Closed';
}

function statusClass(value: LeadStatus): string {
  if (value === 'accepted') return styles.statusAccepted;
  if (value === 'quoted') return styles.statusQuoted;
  if (value === 'declined') return styles.statusDeclined;
  if (value === 'closed') return styles.statusRevoked;
  if (value === 'sent') return styles.statusPending;
  return styles.statusActive;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function assetTitle(lead: AssetLead): string {
  return asText(lead.assetSnapshot.title) || 'Shared asset';
}

function assetDescription(lead: AssetLead): string {
  return [
    lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '',
    asText(lead.assetSnapshot.brandName),
    asText(lead.assetSnapshot.modelName) || asText(lead.assetSnapshot.typedModelName),
  ]
    .filter(Boolean)
    .join(' ') || asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset';
}

function contactLine(lead: AssetLead): string {
  return [lead.ownerContactName || lead.ownerBusinessName || lead.ownerName, lead.ownerContactPhone, lead.ownerContactEmail]
    .filter(Boolean)
    .join(' · ');
}

export default function LeadsClient() {
  const [sessionUserId, setSessionUserId] = useState('');
  const [leads, setLeads] = useState<AssetLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const receivedLeads = useMemo(
    () => leads.filter((lead) => lead.partnerUserId === sessionUserId),
    [leads, sessionUserId],
  );
  const sentLeads = useMemo(() => leads.filter((lead) => lead.ownerUserId === sessionUserId), [leads, sessionUserId]);
  const openReceivedLeads = useMemo(
    () => receivedLeads.filter((lead) => !['declined', 'closed'].includes(lead.status)),
    [receivedLeads],
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [sessionResponse, leadsResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/asset-leads', { cache: 'no-store', credentials: 'include' }),
      ]);

      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const leadsData = (await leadsResponse.json()) as LeadsResponse;

      if (!sessionResponse.ok || !sessionData.signedIn || !sessionData.user) {
        throw new Error('You must be signed in.');
      }

      if (!leadsResponse.ok || !leadsData.ok || !leadsData.leads) {
        throw new Error(leadsData.error ?? 'Failed to load leads.');
      }

      setSessionUserId(sessionData.user.id);
      setLeads(leadsData.leads);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to load leads.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function updateLeadStatus(leadId: string, status: LeadStatus) {
    try {
      const response = await fetch(`/api/asset-leads/${leadId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.ok || !data.lead) {
        throw new Error(data.error ?? 'Failed to update lead.');
      }

      setLeads((current) => current.map((lead) => (lead.id === leadId ? data.lead as AssetLead : lead)));
      setNotice({ tone: 'success', message: 'Lead updated.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to update lead.' });
    }
  }

  function renderLeadCard(lead: AssetLead, mode: 'received' | 'sent') {
    return (
      <article key={lead.id} className={styles.leadCard}>
        <div className={styles.cardTitleRow}>
          <strong>{assetTitle(lead)}</strong>
          <span className={`${styles.statusPill} ${statusClass(lead.status)}`}>{formatStatus(lead.status)}</span>
        </div>
        <div className={styles.cardMetaRow}>
          <span>{formatLeadType(lead.leadType)}</span>
          <span>{assetDescription(lead)}</span>
          <span>{formatCurrency(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat)}</span>
          <span>Created {formatDate(lead.createdAtIso)}</span>
        </div>
        {mode === 'received' ? (
          <p>Owner: {contactLine(lead) || lead.ownerBusinessName || lead.ownerName || 'Owner contact not saved'}</p>
        ) : (
          <p>Sent to: {lead.partnerBusinessName || lead.partnerName || 'Aim4price partner'}</p>
        )}
        {lead.ownerMessage ? <p>{lead.ownerMessage}</p> : null}
        {mode === 'received' ? (
          <div className={styles.inlineActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => void updateLeadStatus(lead.id, 'viewed')}>
              Mark viewed
            </button>
            <button type="button" className={styles.primaryButton} onClick={() => void updateLeadStatus(lead.id, 'accepted')}>
              Accept lead
            </button>
            <button type="button" className={styles.secondaryButton} onClick={() => void updateLeadStatus(lead.id, 'quoted')}>
              Mark quoted
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => void updateLeadStatus(lead.id, 'declined')}>
              Decline
            </button>
          </div>
        ) : lead.status !== 'closed' ? (
          <div className={styles.inlineActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => void updateLeadStatus(lead.id, 'closed')}>
              Close lead
            </button>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className={styles.page}>
      <AppHeader active="none" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <h1>Leads</h1>
            <p>
              Track finance, insurance and replacement-quote requests created from Asset Register items. This is the
              first dashboard layer before PDF/email automation is added.
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
            <span>Received</span>
            <strong>{receivedLeads.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Open received</span>
            <strong>{openReceivedLeads.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Sent</span>
            <strong>{sentLeads.length}</strong>
          </div>
        </div>

        <div className={styles.grid}>
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Received leads</h2>
                <p>Leads sent to your dealer, finance or insurance account.</p>
              </div>
            </div>

            {isLoading ? (
              <p className={styles.emptyState}>Loading leads...</p>
            ) : receivedLeads.length ? (
              <div className={styles.leadList}>{receivedLeads.map((lead) => renderLeadCard(lead, 'received'))}</div>
            ) : (
              <p className={styles.emptyState}>No received leads yet.</p>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Sent leads</h2>
                <p>Asset quote requests sent from your owner account.</p>
              </div>
            </div>

            {isLoading ? (
              <p className={styles.emptyState}>Loading sent leads...</p>
            ) : sentLeads.length ? (
              <div className={styles.leadList}>{sentLeads.map((lead) => renderLeadCard(lead, 'sent'))}</div>
            ) : (
              <p className={styles.emptyState}>No sent leads yet. The asset-level buttons will be connected in the next step.</p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
