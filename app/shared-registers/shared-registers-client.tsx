'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../components/AppHeader';
import { openAssetSheetPrint, type ReportMethodCard } from '../../lib/report-print';
import styles from '../shared-access/page.module.css';

type AccountType = 'owner' | 'dealer' | 'finance' | 'insurance';
type PartnerType = 'dealer' | 'finance' | 'insurance';
type GrantStatus = 'pending' | 'active' | 'revoked' | 'declined';
type NoticeTone = 'success' | 'error';
type AssetFilter = 'all' | 'notes' | 'marketplace' | 'financed' | 'insured';

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

type OpenPartnerNote = {
  id: string;
  ownerUserId: string;
  partnerUserId: string;
  assetRegisterItemId: string;
  noteText: string;
  status: 'open' | 'noted';
  partnerName: string;
  partnerBusinessName: string;
  createdAtIso: string;
  notedAtIso: string | null;
  updatedAtIso: string;
};

type AssetDocument = {
  id?: string;
  url?: string;
  fileName?: string;
  contentType?: string;
  byteSize?: number;
  uploadedAtIso?: string;
};

type AssetRegisterItem = {
  id: string;
  title: string;
  kind: string;
  value: number;
  selectedValueExVat?: number | null;
  selectedMethod?: string | null;
  brandName: string;
  modelName: string;
  typedModelName: string;
  equipmentFamilyLabel: string;
  yearModel: number | null;
  hours: number | null;
  condition: string;
  serialNumber: string;
  note?: string;
  financeNote?: string;
  isFinanced: boolean;
  isInsured: boolean;
  isLicensed: boolean;
  licenseRegistrationNumber?: string;
  aim4priceValueExVat?: number | null;
  marketMidExVat?: number | null;
  marketplaceStatus?: string;
  marketplaceNotes?: string;
  photos?: string[];
  documents?: AssetDocument[];
  publicAssetCode?: string;
  lastScannedAtIso: string | null;
  updatedAtIso: string;
  openPartnerNote?: OpenPartnerNote | null;
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

type CreateNoteResponse = {
  ok: boolean;
  note?: OpenPartnerNote;
  error?: string;
};

type MarketplaceResponse = {
  ok: boolean;
  assetId?: string;
  marketplaceStatus?: string;
  error?: string;
};

type NoteModalState = {
  asset: AssetRegisterItem;
} | null;

type MarketplaceModalState = {
  asset: AssetRegisterItem;
  askingPrice: string;
  notes: string;
} | null;

function formatCurrency(value: number | null | undefined): string {
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

function assetTitle(asset: AssetRegisterItem): string {
  return asset.title || [asset.brandName, asset.modelName || asset.typedModelName].filter(Boolean).join(' ') || 'Untitled asset';
}

function assetMeta(asset: AssetRegisterItem): string {
  return [
    asset.equipmentFamilyLabel || asset.kind,
    asset.brandName,
    asset.modelName || asset.typedModelName,
    asset.yearModel ? String(asset.yearModel) : '',
    asset.hours !== null ? `${formatHours(asset.hours)} hours` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

function isLiveOnMarketplace(asset: AssetRegisterItem): boolean {
  return String(asset.marketplaceStatus ?? '').toLowerCase() === 'live';
}

function partnerNoteAuthor(note: OpenPartnerNote): string {
  return note.partnerBusinessName || note.partnerName || 'Aim4price partner';
}

function selectedMethodLabel(value?: string | null): string {
  if (value === 'market') return 'Market average';
  if (value === 'manual') return 'Manual';
  return 'Aim4price';
}

function buildMethodCards(asset: AssetRegisterItem): ReportMethodCard[] {
  const selected = asset.selectedMethod || 'aim4price';
  const cards: ReportMethodCard[] = [];

  if (asset.aim4priceValueExVat !== null && typeof asset.aim4priceValueExVat !== 'undefined') {
    cards.push({
      label: 'Aim4price value',
      value: formatCurrency(asset.aim4priceValueExVat),
      note: 'Calculated platform value excluding VAT.',
      selected: selected === 'aim4price',
    });
  }

  if (asset.marketMidExVat !== null && typeof asset.marketMidExVat !== 'undefined') {
    cards.push({
      label: 'Market value',
      value: formatCurrency(asset.marketMidExVat),
      note: 'Market comparison midpoint excluding VAT.',
      selected: selected === 'market',
    });
  }

  if (!cards.length) {
    cards.push({
      label: `${selectedMethodLabel(selected)} value`,
      value: formatCurrency(asset.value),
      note: 'Saved asset register value excluding VAT.',
      selected: true,
    });
  }

  return cards;
}

function downloadAssetSheet(asset: AssetRegisterItem, register: SharedRegisterSummary | null): boolean {
  const owner = register ? ownerName(register) : 'Aim4price owner';
  const ownerAddress = register ? ownerLocation(register) : '—';
  const photos = Array.isArray(asset.photos) ? asset.photos.filter(Boolean) : [];
  const didOpen = openAssetSheetPrint({
    logoUrl: '/brand/aim4price-mark-black.png',
    generatedAt: formatDate(new Date().toISOString()),
    assetBadge: asset.equipmentFamilyLabel || asset.kind || 'Asset',
    heroTitle: assetTitle(asset),
    heroMeta: assetMeta(asset),
    valueLabel: `${selectedMethodLabel(asset.selectedMethod)} value`,
    value: formatCurrency(asset.value),
    valueNote: `${formatCurrency(Math.round(Number(asset.value || 0) * 1.15))} incl. VAT`,
    statusLabel: isLiveOnMarketplace(asset) ? 'Live on marketplace' : 'Shared asset',
    issuerName: owner,
    issuerAddress: ownerAddress,
    issuerPhone: register?.ownerPhone || '—',
    issuerEmail: '—',
    clientRows: [
      { label: 'Owner', value: owner },
      { label: 'Phone', value: register?.ownerPhone || '—' },
      { label: 'Location', value: ownerAddress },
    ],
    summaryItems: [
      { label: 'Value excl. VAT', value: formatCurrency(asset.value) },
      { label: 'Updated', value: formatDate(asset.updatedAtIso) },
      { label: 'Last scanned', value: formatDate(asset.lastScannedAtIso) },
    ],
    photoUrl: photos[0] || null,
    photoUrls: photos,
    qrUrl: null,
    scanUrl: null,
    facts: [
      { label: 'Family', value: asset.equipmentFamilyLabel || asset.kind || '—' },
      { label: 'Brand', value: asset.brandName || '—' },
      { label: 'Model', value: asset.modelName || asset.typedModelName || '—' },
      { label: 'Year', value: asset.yearModel ? String(asset.yearModel) : '—' },
      { label: 'Hours', value: asset.hours !== null ? formatHours(asset.hours) : '—' },
      { label: 'Condition', value: asset.condition || '—' },
      { label: 'Serial number', value: asset.serialNumber || '—' },
      { label: 'Financed', value: asset.isFinanced ? 'Yes' : 'No' },
      { label: 'Insured', value: asset.isInsured ? 'Yes' : 'No' },
      { label: 'Licensed', value: asset.isLicensed ? 'Yes' : 'No' },
    ],
    notes: [
      { label: 'Asset note', value: asset.note || '—' },
      { label: 'Finance note', value: asset.financeNote || '—' },
    ],
    methodCards: buildMethodCards(asset),
    contactRows: [
      { label: 'Owner', value: owner },
      { label: 'Phone', value: register?.ownerPhone || '—' },
    ],
    footerNote: 'Shared register export. This document does not transfer the full Asset Register.',
  });

  return Boolean(didOpen);
}

export default function SharedRegistersClient() {
  const [accountType, setAccountType] = useState<AccountType>('finance');
  const [registers, setRegisters] = useState<SharedRegisterSummary[]>([]);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState('');
  const [expandedAssetId, setExpandedAssetId] = useState('');
  const [assets, setAssets] = useState<AssetRegisterItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [assetFilter, setAssetFilter] = useState<AssetFilter>('all');
  const [noteModal, setNoteModal] = useState<NoteModalState>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [marketplaceModal, setMarketplaceModal] = useState<MarketplaceModalState>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isPublishingMarketplace, setIsPublishingMarketplace] = useState(false);
  const [busyNoteId, setBusyNoteId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: NoticeTone; message: string } | null>(null);

  const isDealer = accountType === 'dealer';
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

  const filteredAssets = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return assets.filter((asset) => {
      if (assetFilter === 'notes' && !asset.openPartnerNote) return false;
      if (assetFilter === 'marketplace' && !isLiveOnMarketplace(asset)) return false;
      if (assetFilter === 'financed' && !asset.isFinanced) return false;
      if (assetFilter === 'insured' && !asset.isInsured) return false;

      if (!query) return true;

      const haystack = [
        asset.title,
        asset.brandName,
        asset.modelName,
        asset.typedModelName,
        asset.equipmentFamilyLabel,
        asset.serialNumber,
        asset.condition,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [assetFilter, assets, searchTerm]);

  const loadRegisters = useCallback(async () => {
    setIsLoading(true);

    try {
      const [sessionResponse, registersResponse] = await Promise.all([
        fetch('/api/me', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/shared-registers', { cache: 'no-store', credentials: 'include' }),
      ]);
      const sessionData = (await sessionResponse.json()) as SessionResponse;
      const registersData = (await registersResponse.json()) as SharedRegistersResponse;

      if (sessionData?.signedIn && sessionData.user?.accountType) {
        setAccountType(sessionData.user.accountType);
      }

      if (!registersResponse.ok || !registersData.ok || !registersData.registers) {
        throw new Error(registersData.error ?? 'Failed to load shared registers.');
      }

      setRegisters(registersData.registers);
      const firstActive = registersData.registers.find((register) => register.status === 'active');
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

  function openNoteModal(asset: AssetRegisterItem) {
    setNoteModal({ asset });
    setNoteDraft('');
  }

  async function submitNote() {
    if (!noteModal || !selectedRegister) return;
    const text = noteDraft.trim();

    if (!text) {
      setNotice({ tone: 'error', message: 'Write a note before sending.' });
      return;
    }

    setIsSavingNote(true);

    try {
      const response = await fetch(
        `/api/shared-registers/${encodeURIComponent(selectedRegister.ownerUserId)}/assets/${encodeURIComponent(noteModal.asset.id)}/notes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: text }),
        },
      );
      const data = (await response.json()) as CreateNoteResponse;

      if (!response.ok || !data.ok || !data.note) {
        throw new Error(data.error ?? 'Failed to save note.');
      }

      setAssets((current) => current.map((asset) => (asset.id === noteModal.asset.id ? { ...asset, openPartnerNote: data.note! } : asset)));
      setNotice({ tone: 'success', message: 'Note sent. The asset is now highlighted until it is marked noted.' });
      setNoteModal(null);
      setNoteDraft('');
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to save note.' });
    } finally {
      setIsSavingNote(false);
    }
  }

  async function markNoteNoted(noteId: string, assetId: string) {
    setBusyNoteId(noteId);

    try {
      const response = await fetch(`/api/asset-notes/${encodeURIComponent(noteId)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'noted' }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to mark note as noted.');
      }

      setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, openPartnerNote: null } : asset)));
      setNotice({ tone: 'success', message: 'Note marked as noted.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to mark note as noted.' });
    } finally {
      setBusyNoteId(null);
    }
  }

  function openMarketplaceModal(asset: AssetRegisterItem) {
    setMarketplaceModal({
      asset,
      askingPrice: String(Math.round(Number(asset.value) || 0)),
      notes: '',
    });
  }

  async function publishToMarketplace() {
    if (!marketplaceModal || !selectedRegister) return;
    const asset = marketplaceModal.asset;
    setIsPublishingMarketplace(true);

    try {
      const response = await fetch('/api/marketplace', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerUserId: selectedRegister.ownerUserId,
          assetId: asset.id,
          askingPriceExVat: Number(marketplaceModal.askingPrice) || null,
          marketplaceNotes: marketplaceModal.notes,
        }),
      });
      const data = (await response.json()) as MarketplaceResponse;

      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'Failed to send asset to marketplace.');
      }

      setAssets((current) => current.map((entry) => (entry.id === asset.id ? { ...entry, marketplaceStatus: 'live' } : entry)));
      setNotice({ tone: 'success', message: `${assetTitle(asset)} was sent to marketplace under the dealer contact details.` });
      setMarketplaceModal(null);
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Failed to send asset to marketplace.' });
    } finally {
      setIsPublishingMarketplace(false);
    }
  }

  function handleDownloadAsset(asset: AssetRegisterItem) {
    const didOpen = downloadAssetSheet(asset, selectedRegister);
    if (!didOpen) {
      setNotice({ tone: 'error', message: 'Enable pop-ups to download or print the asset valuation PDF.' });
    }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="asset-register" />

      <section className={styles.shell}>
        <div className={styles.hero}>
          <div>
            <h1>Shared registers</h1>
            <p>
              Open the owner registers shared to this partner account. You can view details, download the asset valuation PDF and leave notes.
              Options, QR codes and delete actions stay owner-only.
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
                  <h2>Asset Register access</h2>
                  <p>Search owner registers, open the assets, and keep partner notes visible until marked noted.</p>
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
                  {activeRegisters.map((register) => {
                    const isSelected = register.ownerUserId === selectedOwnerUserId;
                    return (
                      <button
                        type="button"
                        className={`${styles.partnerRegisterCard} ${isSelected ? styles.partnerRegisterCardActive : ''}`}
                        key={register.id}
                        onClick={() => {
                          setSelectedOwnerUserId(register.ownerUserId);
                          setExpandedAssetId('');
                        }}
                      >
                        <span>{ownerName(register)}</span>
                        <strong>{register.assetCount}</strong>
                        <small>{formatCurrency(register.totalValue)} · {ownerLocation(register)}</small>
                        <em>Open</em>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {!isLoading && !activeRegisters.length && !pendingRegisters.length ? (
                <div className={styles.emptyState}>No owner registers are currently shared with this account.</div>
              ) : null}
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div>
                  <h2>{selectedRegister ? `${ownerName(selectedRegister)} assets` : 'Assets'}</h2>
                  <p>{selectedRegister ? 'Partner register view. Restricted owner-only actions are not shown here.' : 'Choose an active shared register above.'}</p>
                </div>
              </div>

              <div className={styles.partnerAssetToolbar}>
                <label className={styles.field}>
                  <span>Search asset register</span>
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search asset, brand, model, serial..."
                  />
                </label>
                <label className={styles.field}>
                  <span>Filters</span>
                  <select value={assetFilter} onChange={(event) => setAssetFilter(event.target.value as AssetFilter)}>
                    <option value="all">All assets</option>
                    <option value="notes">Open notes</option>
                    <option value="marketplace">Marketplace</option>
                    <option value="financed">Financed</option>
                    <option value="insured">Insured</option>
                  </select>
                </label>
              </div>

              {isLoadingAssets ? <div className={styles.emptyState}>Loading assets...</div> : null}

              {!isLoadingAssets && selectedRegister && !filteredAssets.length ? (
                <div className={styles.emptyState}>No assets match this search or filter.</div>
              ) : null}

              {!isLoadingAssets && filteredAssets.length ? (
                <div className={styles.assetList}>
                  {filteredAssets.map((asset) => {
                    const isExpanded = expandedAssetId === asset.id;
                    const openNote = asset.openPartnerNote ?? null;
                    return (
                      <article className={`${styles.assetCard} ${openNote ? styles.assetNoteOpenCard : ''}`} key={asset.id}>
                        <div className={styles.cardTitleRow}>
                          <div>
                            <strong>{assetTitle(asset)}</strong>
                            <p>{assetMeta(asset) || 'No asset details saved.'}</p>
                          </div>
                          <div className={styles.partnerAssetValue}>{formatCurrency(asset.value)}</div>
                        </div>

                        <div className={styles.cardMetaRow}>
                          <span>Company: {selectedRegister ? ownerName(selectedRegister) : '—'}</span>
                          <span>Contact: {selectedRegister?.ownerPhone || '—'}</span>
                          {isLiveOnMarketplace(asset) ? <span className={`${styles.statusPill} ${styles.statusActive}`}>Marketplace</span> : null}
                        </div>

                        {openNote ? (
                          <div className={styles.partnerNotePanel}>
                            <div>
                              <strong>Note from {partnerNoteAuthor(openNote)}</strong>
                              <p>{openNote.noteText}</p>
                            </div>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              disabled={busyNoteId === openNote.id}
                              onClick={() => void markNoteNoted(openNote.id, asset.id)}
                            >
                              {busyNoteId === openNote.id ? 'Saving...' : 'Noted'}
                            </button>
                          </div>
                        ) : null}

                        {isExpanded ? (
                          <div className={styles.partnerAssetDetails}>
                            <div><span>Family</span><strong>{asset.equipmentFamilyLabel || asset.kind || '—'}</strong></div>
                            <div><span>Brand</span><strong>{asset.brandName || '—'}</strong></div>
                            <div><span>Model</span><strong>{asset.modelName || asset.typedModelName || '—'}</strong></div>
                            <div><span>Year</span><strong>{asset.yearModel || '—'}</strong></div>
                            <div><span>Hours</span><strong>{asset.hours !== null ? formatHours(asset.hours) : '—'}</strong></div>
                            <div><span>Condition</span><strong>{asset.condition || '—'}</strong></div>
                            <div><span>Financed</span><strong>{asset.isFinanced ? 'Yes' : 'No'}</strong></div>
                            <div><span>Insured</span><strong>{asset.isInsured ? 'Yes' : 'No'}</strong></div>
                            <div><span>Last scanned</span><strong>{formatDate(asset.lastScannedAtIso)}</strong></div>
                          </div>
                        ) : null}

                        <div className={styles.inlineActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            onClick={() => setExpandedAssetId((current) => (current === asset.id ? '' : asset.id))}
                          >
                            {isExpanded ? 'Hide details' : 'View details'}
                          </button>
                          <button type="button" className={styles.secondaryButton} onClick={() => openNoteModal(asset)}>
                            Leave a note
                          </button>
                          <button type="button" className={styles.primaryButton} onClick={() => handleDownloadAsset(asset)}>
                            Download Asset Valuation PDF
                          </button>
                          {isDealer ? (
                            <button type="button" className={styles.ghostButton} onClick={() => openMarketplaceModal(asset)}>
                              {isLiveOnMarketplace(asset) ? 'Update marketplace' : 'Send to marketplace'}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>

          <aside className={styles.card}>
            <div className={styles.cardHeader}>
              <div>
                <h2>Partner rules</h2>
                <p>This view is intentionally restricted.</p>
              </div>
            </div>
            <div className={styles.partnerRuleList}>
              <div><strong>No Options</strong><span>Owner-only actions remain hidden.</span></div>
              <div><strong>No QR Code</strong><span>Partners cannot create or download owner QR codes.</span></div>
              <div><strong>No Delete Asset</strong><span>Partners cannot remove assets from an owner register.</span></div>
              <div><strong>Notes stay visible</strong><span>A note turns the asset blue until marked noted.</span></div>
              {isDealer ? <div><strong>Dealer marketplace</strong><span>Dealer contact details are used when sending a shared asset to marketplace.</span></div> : null}
            </div>
          </aside>
        </div>
      </section>

      {noteModal ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="shared-note-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="shared-note-title">Leave a note</h2>
                <p>The owner and this partner account will see the asset highlighted until it is marked noted.</p>
              </div>
            </div>
            <label className={styles.field}>
              <span>Note</span>
              <textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} placeholder="Write the follow-up note for this asset..." />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} disabled={isSavingNote} onClick={() => setNoteModal(null)}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} disabled={isSavingNote} onClick={() => void submitNote()}>
                {isSavingNote ? 'Sending...' : 'Send note'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {marketplaceModal ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="dealer-marketplace-title">
            <div className={styles.modalHeader}>
              <div>
                <h2 id="dealer-marketplace-title">Send to marketplace</h2>
                <p>This lists the asset with the dealer contact details, not the owner contact details.</p>
              </div>
            </div>
            <div className={styles.disclaimer}>
              X dealer sent this to marketplace will be written into the listing notes automatically.
            </div>
            <label className={styles.field}>
              <span>Asking price excl. VAT</span>
              <input
                inputMode="numeric"
                value={marketplaceModal.askingPrice}
                onChange={(event) => setMarketplaceModal((current) => (current ? { ...current, askingPrice: event.target.value } : current))}
              />
            </label>
            <label className={styles.field}>
              <span>Marketplace note</span>
              <textarea
                value={marketplaceModal.notes}
                onChange={(event) => setMarketplaceModal((current) => (current ? { ...current, notes: event.target.value } : current))}
                placeholder="Optional dealer note for buyers..."
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.ghostButton} disabled={isPublishingMarketplace} onClick={() => setMarketplaceModal(null)}>
                Cancel
              </button>
              <button type="button" className={styles.primaryButton} disabled={isPublishingMarketplace} onClick={() => void publishToMarketplace()}>
                {isPublishingMarketplace ? 'Sending...' : 'Send to marketplace'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
