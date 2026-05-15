'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { openAssetSheetPrint, type ReportMethodCard } from '../../lib/report-print';
import styles from '../shared-access/page.module.css';

type LeadType = 'finance' | 'insurance' | 'replacement_quote';
type LeadStatus = 'sent' | 'viewed' | 'accepted' | 'quoted' | 'declined' | 'closed';
type NoticeTone = 'success' | 'error';
type LeadStatusFilter = 'all' | 'accepted' | 'declined';

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
  if (value === 'finance') return 'Finance lead';
  if (value === 'insurance') return 'Insurance lead';
  return 'Dealer lead';
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

function asNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function asBoolean(value: unknown): boolean {
  return value === true || String(value ?? '').trim().toLowerCase() === 'true';
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

function ownerDisplayName(lead: AssetLead): string {
  return lead.ownerContactName || lead.ownerBusinessName || lead.ownerName || 'Aim4price owner';
}

function ownerPhone(lead: AssetLead): string {
  return lead.ownerContactPhone || lead.ownerPhone || '';
}

function ownerLocation(lead: AssetLead): string {
  return [lead.ownerTownCity, lead.ownerProvince].filter(Boolean).join(', ') || '—';
}

function contactLine(lead: AssetLead): string {
  return [ownerDisplayName(lead), ownerPhone(lead), lead.ownerContactEmail].filter(Boolean).join(' · ');
}

function buildMethodCards(lead: AssetLead): ReportMethodCard[] {
  const selected = asText(lead.assetSnapshot.selectedMethod) || 'aim4price';
  const cards: ReportMethodCard[] = [];
  const aim4priceValue = asNumber(lead.assetSnapshot.aim4priceValueExVat);
  const marketValue = asNumber(lead.assetSnapshot.marketMidExVat);
  const selectedValue = asNumber(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat) ?? 0;

  if (aim4priceValue !== null) {
    cards.push({
      label: 'Aim4price value',
      value: formatCurrency(aim4priceValue),
      note: 'Calculated platform value excluding VAT.',
      selected: selected === 'aim4price',
    });
  }

  if (marketValue !== null) {
    cards.push({
      label: 'Market value',
      value: formatCurrency(marketValue),
      note: 'Market comparison midpoint excluding VAT.',
      selected: selected === 'market',
    });
  }

  if (!cards.length) {
    cards.push({
      label: 'Saved value',
      value: formatCurrency(selectedValue),
      note: 'Saved asset register value excluding VAT.',
      selected: true,
    });
  }

  return cards;
}

function downloadLeadAsset(lead: AssetLead): boolean {
  const value = asNumber(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat) ?? 0;
  const photos = Array.isArray(lead.assetSnapshot.photos)
    ? lead.assetSnapshot.photos.map((photo) => String(photo ?? '').trim()).filter(Boolean)
    : [];
  const didOpen = openAssetSheetPrint({
    logoUrl: '/brand/aim4price-mark-black.png',
    generatedAt: formatDate(new Date().toISOString()),
    assetBadge: asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || 'Asset',
    heroTitle: assetTitle(lead),
    heroMeta: assetDescription(lead),
    valueLabel: 'Asset value',
    value: formatCurrency(value),
    valueNote: `${formatCurrency(Math.round(value * 1.15))} incl. VAT`,
    statusLabel: `${formatLeadType(lead.leadType)} · ${formatStatus(lead.status)}`,
    issuerName: ownerDisplayName(lead),
    issuerAddress: ownerLocation(lead),
    issuerPhone: ownerPhone(lead) || '—',
    issuerEmail: lead.ownerContactEmail || '—',
    clientRows: [
      { label: 'Owner', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Email', value: lead.ownerContactEmail || '—' },
      { label: 'Location', value: ownerLocation(lead) },
    ],
    summaryItems: [
      { label: 'Lead type', value: formatLeadType(lead.leadType) },
      { label: 'Lead status', value: formatStatus(lead.status) },
      { label: 'Created', value: formatDate(lead.createdAtIso) },
    ],
    photoUrl: photos[0] || null,
    photoUrls: photos,
    qrUrl: null,
    scanUrl: null,
    facts: [
      { label: 'Family', value: asText(lead.assetSnapshot.equipmentFamilyLabel) || asText(lead.assetSnapshot.kind) || '—' },
      { label: 'Brand', value: asText(lead.assetSnapshot.brandName) || '—' },
      { label: 'Model', value: asText(lead.assetSnapshot.modelName) || asText(lead.assetSnapshot.typedModelName) || '—' },
      { label: 'Year', value: lead.assetSnapshot.yearModel ? String(lead.assetSnapshot.yearModel) : '—' },
      { label: 'Hours', value: lead.assetSnapshot.hours ? new Intl.NumberFormat('en-ZA').format(Number(lead.assetSnapshot.hours)) : '—' },
      { label: 'Condition', value: asText(lead.assetSnapshot.condition) || '—' },
      { label: 'Serial number', value: asText(lead.assetSnapshot.serialNumber) || '—' },
      { label: 'Financed', value: asBoolean(lead.assetSnapshot.isFinanced) ? 'Yes' : 'No' },
      { label: 'Insured', value: asBoolean(lead.assetSnapshot.isInsured) ? 'Yes' : 'No' },
    ],
    notes: [
      { label: 'Owner message', value: lead.ownerMessage || '—' },
      { label: 'Partner handling', value: 'Contact the owner privately. Do not place quotes back on Aim4price.' },
    ],
    methodCards: buildMethodCards(lead),
    contactRows: [
      { label: 'Owner', value: ownerDisplayName(lead) },
      { label: 'Phone', value: ownerPhone(lead) || '—' },
      { label: 'Email', value: lead.ownerContactEmail || '—' },
    ],
    footerNote: 'Lead asset valuation PDF. This lead is for private partner follow-up outside Aim4price.',
  });

  return Boolean(didOpen);
}

export default function LeadsClient() {
  const [sessionUserId, setSessionUserId] = useState('');
  const [leads, setLeads] = useState<AssetLead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const receivedLeads = useMemo(
    () => leads.filter((lead) => lead.partnerUserId === sessionUserId),
    [leads, sessionUserId],
  );

  const filteredLeads = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return receivedLeads.filter((lead) => {
      if (statusFilter === 'accepted' && lead.status !== 'accepted') return false;
      if (statusFilter === 'declined' && lead.status !== 'declined') return false;

      if (!query) return true;

      const haystack = [
        assetTitle(lead),
        assetDescription(lead),
        formatLeadType(lead.leadType),
        ownerDisplayName(lead),
        ownerPhone(lead),
        lead.ownerContactEmail,
        lead.ownerBusinessName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [receivedLeads, searchTerm, statusFilter]);

  const acceptedCount = useMemo(() => receivedLeads.filter((lead) => lead.status === 'accepted').length, [receivedLeads]);
  const declinedCount = useMemo(() => receivedLeads.filter((lead) => lead.status === 'declined').length, [receivedLeads]);

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
    const timeout = window.setTimeout(() => setNotice(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  async function updateLeadStatus(leadId: string, status: 'accepted' | 'declined') {
    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as LeadsResponse;

      if (!response.ok || !data.ok || !data.lead) {
        throw new Error(data.error ?? 'Failed to update lead.');
      }

      setLeads((current) => current.map((lead) => (lead.id === leadId ? (data.lead as AssetLead) : lead)));
      setNotice({ tone: 'success', message: status === 'accepted' ? 'Lead accepted. Contact the owner privately.' : 'Lead declined.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to update lead.' });
    }
  }

  async function deleteLead(leadId: string) {
    try {
      const response = await fetch(`/api/asset-leads/${encodeURIComponent(leadId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to delete lead.');
      }

      setLeads((current) => current.filter((lead) => lead.id !== leadId));
      setNotice({ tone: 'success', message: 'Declined lead deleted.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to delete lead.' });
    }
  }

  function handleDownloadLead(lead: AssetLead) {
    const didOpen = downloadLeadAsset(lead);
    if (!didOpen) {
      setNotice({ tone: 'error', message: 'Enable pop-ups to download or print the asset valuation PDF.' });
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="leads" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <h1>Leads</h1>
            <p>
              Review shared asset leads. The only document action here is downloading the asset valuation PDF; partners contact the owner privately outside Aim4price.
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
            <span>Total leads</span>
            <strong>{receivedLeads.length}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Accepted</span>
            <strong>{acceptedCount}</strong>
          </div>
          <div className={styles.statCard}>
            <span>Declined</span>
            <strong>{declinedCount}</strong>
          </div>
        </div>

        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div>
              <h2>Received leads</h2>
              <p>Accept the lead when you want to contact the owner. Declined leads can be deleted.</p>
            </div>
          </div>

          <div className={styles.partnerAssetToolbar}>
            <label className={styles.field}>
              <span>Search</span>
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search asset, owner, contact details..."
              />
            </label>
            <label className={styles.field}>
              <span>Filters</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LeadStatusFilter)}>
                <option value="all">All leads</option>
                <option value="accepted">Accepted</option>
                <option value="declined">Declined</option>
              </select>
            </label>
          </div>

          {isLoading ? <div className={styles.emptyState}>Loading leads...</div> : null}

          {!isLoading && !filteredLeads.length ? (
            <div className={styles.emptyState}>No leads match this search or filter.</div>
          ) : null}

          {!isLoading && filteredLeads.length ? (
            <div className={styles.leadList}>
              {filteredLeads.map((lead) => (
                <article key={lead.id} className={styles.leadCard}>
                  <div className={styles.cardTitleRow}>
                    <div>
                      <strong>{assetTitle(lead)}</strong>
                      <p>{assetDescription(lead)}</p>
                    </div>
                    <span className={`${styles.statusPill} ${statusClass(lead.status)}`}>{formatStatus(lead.status)}</span>
                  </div>

                  <div className={styles.leadContactPanel}>
                    <div>
                      <span>Contact</span>
                      <strong>{ownerDisplayName(lead)}</strong>
                      <small>{contactLine(lead) || 'Owner contact not saved'}</small>
                    </div>
                    <div>
                      <span>Value</span>
                      <strong>{formatCurrency(lead.assetSnapshot.value ?? lead.assetSnapshot.selectedValueExVat)}</strong>
                      <small>{formatLeadType(lead.leadType)} · {formatDate(lead.createdAtIso)}</small>
                    </div>
                  </div>

                  {lead.ownerMessage ? <p>{lead.ownerMessage}</p> : null}

                  <div className={styles.inlineActions}>
                    <button type="button" className={styles.primaryButton} onClick={() => handleDownloadLead(lead)}>
                      Download Asset Valuation PDF
                    </button>
                    {lead.status !== 'accepted' && lead.status !== 'declined' ? (
                      <>
                        <button type="button" className={styles.secondaryButton} onClick={() => void updateLeadStatus(lead.id, 'accepted')}>
                          Accept
                        </button>
                        <button type="button" className={styles.dangerButton} onClick={() => void updateLeadStatus(lead.id, 'declined')}>
                          Decline
                        </button>
                      </>
                    ) : null}
                    {lead.status === 'declined' ? (
                      <button type="button" className={styles.dangerButton} onClick={() => void deleteLead(lead.id)}>
                        Delete
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
