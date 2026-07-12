'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import { sharedRegisterSnapshot, type SharedRegisterAsset, type SharedRegisterLead } from '../../../lib/shared-register-prototype';
import styles from './workspace.module.css';

type Tab = 'overview' | 'review' | 'report';
type Decision = 'review' | 'included' | 'excluded' | 'information_required';
type NoteVisibility = 'shared' | 'private';

type AssetReview = {
  assetGroup: string;
  policySection: string;
  scheduleItem: string;
  decision: Decision;
  proposedValue: string;
  note: string;
  noteVisibility: NoteVisibility;
  lastReviewedAtIso?: string;
};

type WorkspaceState = {
  reviews: Record<string, AssetReview>;
  nonAssetCovers: string[];
  frozenAtIso: string | null;
};

const ASSET_GROUPS = [
  'Buildings & property',
  'Vehicles',
  'Mobile plant & equipment',
  'Fixed plant & machinery',
  'Electronic equipment',
  'Irrigation & water systems',
  'Renewable energy',
  'Stock & materials',
  'Livestock & biological assets',
  'Other',
];

const POLICY_SECTIONS = [
  'Fire & allied perils',
  'Buildings Combined',
  'Office Contents',
  'Business All Risks',
  'Machinery Breakdown',
  'Motor',
  'Electronic Equipment',
  'Goods in Transit',
  'Theft',
  'Glass',
  'Accidental Damage',
  'Deterioration of Stock',
  'Livestock & Game',
  'Other / refer',
];

const NON_ASSET_COVERS = [
  'Business Interruption',
  'Public Liability',
  'Employers Liability',
  'Goods in Transit',
  'Money',
  'Fidelity',
  'Deterioration of Stock',
  'Fire on Veld',
];

const DECISION_OPTIONS: Array<{ value: Decision; label: string; description: string }> = [
  { value: 'included', label: 'Include', description: 'Add to the proposed insurance structure.' },
  { value: 'information_required', label: 'Need information', description: 'Ask the client before deciding.' },
  { value: 'excluded', label: 'Exclude', description: 'Leave out with a recorded decision.' },
  { value: 'review', label: 'Review later', description: 'Keep this asset outstanding.' },
];

const EMPTY_REVIEW: AssetReview = {
  assetGroup: '',
  policySection: '',
  scheduleItem: '',
  decision: 'review',
  proposedValue: '',
  note: '',
  noteVisibility: 'shared',
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value || 0);
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function assetId(asset: SharedRegisterAsset, index: number): string {
  return text(asset.id) || `asset-${index}`;
}

function assetTitle(asset: SharedRegisterAsset): string {
  return text(asset.title) || [text(asset.brandName), text(asset.modelName) || text(asset.typedModelName)].filter(Boolean).join(' ') || 'Untitled asset';
}

function assetKind(asset: SharedRegisterAsset): string {
  return text(asset.equipmentFamilyLabel) || text(asset.kind) || 'Asset';
}

function assetValue(asset: SharedRegisterAsset): number {
  return numberValue(asset.value ?? asset.selectedValueExVat ?? asset.aim4priceValueExVat);
}

function replacementValue(asset: SharedRegisterAsset): number {
  const specs = asRecord(asset.specsJson);
  return numberValue(
    asset.replacementPriceExVat ??
      asset.replacementPriceUsedExVat ??
      asset.userReplacementPriceExVat ??
      specs.replacementPriceExVat ??
      specs.replacement_price_ex_vat,
  );
}

function assetLocation(asset: SharedRegisterAsset): string {
  const specs = asRecord(asset.specsJson);
  return text(asset.lastKnownLocationText) || text(specs.location) || text(specs.assetLocation) || 'Location not supplied';
}

function existingInsuranceStatus(asset: SharedRegisterAsset): 'Yes' | 'No' | 'Not sure' | 'N/A' {
  const specs = asRecord(asset.specsJson);
  const raw = text(specs.insuranceStatus ?? specs.insurance_status).toLowerCase().replace(/[\s-]+/g, '_');
  if (['yes', 'true', 'insured'].includes(raw)) return 'Yes';
  if (['no', 'false', 'not_insured', 'uninsured'].includes(raw)) return 'No';
  if (['not_applicable', 'n_a', 'na'].includes(raw)) return 'N/A';
  if (raw) return 'Not sure';
  if (asset.isInsured === true) return 'Yes';
  if (asset.isInsured === false) return 'Not sure';
  return 'Not sure';
}

function inferAssetGroup(asset: SharedRegisterAsset): string {
  const value = `${assetKind(asset)} ${assetTitle(asset)}`.toLowerCase();
  if (/building|shed|house|property|structure|store|warehouse|office/.test(value)) return 'Buildings & property';
  if (/vehicle|hilux|truck|bakkie|trailer/.test(value)) return 'Vehicles';
  if (/pivot|irrigation|pump|borehole|water system/.test(value)) return 'Irrigation & water systems';
  if (/solar|battery|inverter|renewable/.test(value)) return 'Renewable energy';
  if (/computer|server|electronic|camera|alarm/.test(value)) return 'Electronic equipment';
  if (/tractor|loader|excavator|harvester|forklift|mobile equipment/.test(value)) return 'Mobile plant & equipment';
  if (/livestock|cattle|game|animal/.test(value)) return 'Livestock & biological assets';
  if (/stock|material|inventory|produce/.test(value)) return 'Stock & materials';
  return 'Fixed plant & machinery';
}

function inferPolicySection(asset: SharedRegisterAsset): string {
  const group = inferAssetGroup(asset);
  if (group === 'Buildings & property') return 'Fire & allied perils';
  if (group === 'Vehicles') return 'Motor';
  if (group === 'Electronic equipment') return 'Electronic Equipment';
  if (group === 'Fixed plant & machinery' || group === 'Renewable energy') return 'Machinery Breakdown';
  if (group === 'Livestock & biological assets') return 'Livestock & Game';
  if (group === 'Stock & materials') return 'Fire & allied perils';
  return 'Business All Risks';
}

function decisionLabel(decision: Decision): string {
  return {
    review: 'Needs review',
    included: 'Include',
    excluded: 'Exclude',
    information_required: 'Information required',
  }[decision];
}

function defaultState(): WorkspaceState {
  return { reviews: {}, nonAssetCovers: [], frozenAtIso: null };
}

function reviewIsComplete(review: AssetReview | undefined): boolean {
  if (!review?.assetGroup) return false;
  if (review.decision === 'included') return Boolean(review.policySection);
  if (review.decision === 'excluded') return true;
  return false;
}

function reviewSectionLabel(review: AssetReview | undefined): string {
  if (review?.decision === 'excluded') return 'Excluded from proposal';
  if (review?.decision === 'information_required') return 'Information required';
  if (review?.decision === 'included' && review.policySection) return review.policySection;
  return 'Unclassified';
}

type SelectOption = { value: string; label: string };

function CustomSelect({
  value,
  options,
  placeholder,
  ariaLabel,
  onChange,
  compact = false,
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div ref={rootRef} className={`${styles.customSelect} ${compact ? styles.customSelectCompact : ''}`}>
      <button
        type="button"
        className={`${styles.customSelectButton} ${isOpen ? styles.customSelectButtonOpen : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={selected ? '' : styles.customSelectPlaceholder}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {isOpen ? (
        <div className={styles.customSelectMenu} role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              key={option.value}
              className={`${styles.customSelectOption} ${option.value === value ? styles.customSelectOptionActive : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value ? <b>✓</b> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function SharedRegisterWorkspace({ share }: { share: SharedRegisterLead }) {
  const snapshot = sharedRegisterSnapshot(share);
  const assets = useMemo(() => snapshot?.assets ?? [], [snapshot]);
  const [tab, setTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<WorkspaceState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState('outstanding');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSection, setBulkSection] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetReview>(EMPTY_REVIEW);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');

  const storageKey = `aim4price:insurance-workspace:${share.id}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setWorkspace({ ...defaultState(), ...(JSON.parse(saved) as WorkspaceState) });
    } catch {
      // A damaged browser prototype state should not block the register.
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, [hydrated, storageKey, workspace]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const classifiedCount = assets.filter((asset, index) => reviewIsComplete(workspace.reviews[assetId(asset, index)])).length;
  const informationRequiredCount = Object.values(workspace.reviews).filter((review) => review.decision === 'information_required').length;
  const noteCount = Object.values(workspace.reviews).filter((review) => review.note.trim()).length;
  const progress = assets.length ? Math.round((classifiedCount / assets.length) * 100) : 0;

  const visibleAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return assets.filter((asset, index) => {
      const id = assetId(asset, index);
      const review = workspace.reviews[id];
      const searchable = [assetTitle(asset), assetKind(asset), assetLocation(asset), review?.assetGroup, review?.policySection, review?.scheduleItem]
        .join(' ')
        .toLowerCase();
      const section = review?.policySection || 'Unclassified';
      const matchesReviewFilter =
        reviewFilter === 'all' ||
        (reviewFilter === 'outstanding' && !reviewIsComplete(review)) ||
        (reviewFilter === 'information_required' && review?.decision === 'information_required') ||
        (reviewFilter === 'included' && reviewIsComplete(review) && review?.decision === 'included') ||
        (reviewFilter === 'excluded' && reviewIsComplete(review) && review?.decision === 'excluded');
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (sectionFilter === 'all' || section === sectionFilter) &&
        matchesReviewFilter
      );
    });
  }, [assets, query, reviewFilter, sectionFilter, workspace.reviews]);

  const sectionRows = useMemo(() => {
    const rows = new Map<string, { count: number; replacement: number; proposed: number }>();
    assets.forEach((asset, index) => {
      const review = workspace.reviews[assetId(asset, index)];
      const section = reviewSectionLabel(review);
      const row = rows.get(section) ?? { count: 0, replacement: 0, proposed: 0 };
      row.count += 1;
      row.replacement += replacementValue(asset);
      if (review?.decision === 'included') {
        row.proposed += numberValue(review.proposedValue) || replacementValue(asset);
      }
      rows.set(section, row);
    });
    return Array.from(rows.entries()).sort(([a], [b]) => (a === 'Unclassified' ? 1 : b === 'Unclassified' ? -1 : a.localeCompare(b)));
  }, [assets, workspace.reviews]);

  function openReview(asset: SharedRegisterAsset, index: number) {
    const id = assetId(asset, index);
    const current = workspace.reviews[id];
    setEditingAssetId(id);
    setDraft(
      current ?? {
        ...EMPTY_REVIEW,
        assetGroup: inferAssetGroup(asset),
        policySection: '',
        proposedValue: replacementValue(asset) ? String(Math.round(replacementValue(asset))) : '',
      },
    );
  }

  function showNotice(message: string, tone: 'success' | 'error' = 'success') {
    setNoticeTone(tone);
    setNotice(message);
  }

  function nextOutstandingAssetId(currentAssetId: string): string | null {
    const currentIndex = assets.findIndex((asset, index) => assetId(asset, index) === currentAssetId);
    const orderedAssets = [...assets.slice(currentIndex + 1), ...assets.slice(0, currentIndex + 1)];
    const nextAsset = orderedAssets.find((asset) => {
      const index = assets.indexOf(asset);
      const id = assetId(asset, index);
      return id !== currentAssetId && !reviewIsComplete(workspace.reviews[id]);
    });
    if (!nextAsset) return null;
    const index = assets.indexOf(nextAsset);
    return assetId(nextAsset, index);
  }

  function openReviewById(id: string) {
    const index = assets.findIndex((asset, assetIndex) => assetId(asset, assetIndex) === id);
    if (index >= 0) openReview(assets[index], index);
  }

  function openNextOutstandingReview() {
    setTab('review');
    setReviewFilter('outstanding');
    const next = assets.find((asset, index) => !reviewIsComplete(workspace.reviews[assetId(asset, index)]));
    if (next) {
      const index = assets.indexOf(next);
      openReview(next, index);
    }
  }

  function saveReview(openNext = false) {
    if (!editingAssetId) return;
    if (!draft.assetGroup) {
      showNotice('Choose an asset group before saving.', 'error');
      return;
    }
    if (draft.decision === 'included' && !draft.policySection) {
      showNotice('Choose a policy section for an included asset.', 'error');
      return;
    }
    if (draft.decision === 'information_required' && !draft.note.trim()) {
      showNotice('Add the information needed from the client.', 'error');
      return;
    }

    const savedReview = { ...draft, lastReviewedAtIso: new Date().toISOString() };
    const nextId = openNext ? nextOutstandingAssetId(editingAssetId) : null;
    setWorkspace((current) => ({ ...current, frozenAtIso: null, reviews: { ...current.reviews, [editingAssetId]: savedReview } }));
    setEditingAssetId(null);
    showNotice(draft.decision === 'information_required' ? 'Information request saved.' : 'Asset review saved.');
    if (nextId) window.setTimeout(() => openReviewById(nextId), 0);
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function applyBulkSection() {
    if (!bulkSection || !selectedIds.length) return;
    setWorkspace((current) => {
      const reviews = { ...current.reviews };
      selectedIds.forEach((id) => {
        const assetIndex = assets.findIndex((asset, index) => assetId(asset, index) === id);
        const asset = assets[assetIndex];
        const existing = reviews[id] ?? EMPTY_REVIEW;
        reviews[id] = {
          ...existing,
          assetGroup: existing.assetGroup || (asset ? inferAssetGroup(asset) : 'Other'),
          policySection: bulkSection,
          decision: existing.decision === 'review' ? 'included' : existing.decision,
          proposedValue: existing.proposedValue || (asset ? String(Math.round(replacementValue(asset))) : ''),
        };
      });
      return { ...current, frozenAtIso: null, reviews };
    });
    setSelectedIds([]);
    setBulkSection('');
    showNotice('Selected assets classified.');
  }

  function toggleNonAssetCover(cover: string) {
    setWorkspace((current) => ({
      ...current,
      frozenAtIso: null,
      nonAssetCovers: current.nonAssetCovers.includes(cover)
        ? current.nonAssetCovers.filter((item) => item !== cover)
        : [...current.nonAssetCovers, cover],
    }));
  }

  function freezeSnapshot() {
    if (classifiedCount !== assets.length || informationRequiredCount > 0) {
      setTab('review');
      setReviewFilter('outstanding');
      showNotice(
        informationRequiredCount > 0
          ? `Resolve ${informationRequiredCount} information request${informationRequiredCount === 1 ? '' : 's'} before freezing the submission.`
          : `Review the remaining ${assets.length - classifiedCount} asset${assets.length - classifiedCount === 1 ? '' : 's'} before freezing the submission.`,
        'error',
      );
      return;
    }
    setWorkspace((current) => ({ ...current, frozenAtIso: new Date().toISOString() }));
    showNotice('Submission snapshot frozen in this browser.');
  }

  if (!snapshot) return null;

  const editingAssetIndex = editingAssetId ? assets.findIndex((asset, index) => assetId(asset, index) === editingAssetId) : -1;
  const editingAsset = editingAssetIndex >= 0 ? assets[editingAssetIndex] : null;

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${noticeTone === 'error' ? styles.noticeError : ''}`}>{notice}</div> : null}
        <div className={styles.workspaceBackRow}>
          <Link href="/shared-registers" className={styles.backLink}>← Shared Registers</Link>
        </div>
        <header className={styles.workspaceHeader}>
          <div className={styles.workspaceTitleBlock}>
            <h1>{share.ownerBusinessName || snapshot.ownerName}</h1>
          </div>
        </header>
        <p className={styles.workspaceMetaRow}>{snapshot.title} · Shared {dateLabel(snapshot.generatedAtIso)} · Read-only owner register</p>

        <nav className={styles.tabs} aria-label="Insurance workspace sections">
          {(['overview', 'review', 'report'] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? styles.activeTab : ''} onClick={() => setTab(item)}>
              {item === 'overview' ? 'Overview' : item === 'review' ? `Review assets${informationRequiredCount ? ` (${informationRequiredCount})` : ''}` : 'Report'}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <div className={styles.overviewLayout}>
            <section className={styles.summaryGrid}>
              <article className={styles.summaryTileActive}><span>Total assets</span><strong>{assets.length}</strong><small>{money(snapshot.totalValue)} register value</small></article>
              <article><span>Replacement value</span><strong>{money(snapshot.totalReplacementValue)}</strong><small>Excluding VAT</small></article>
              <article><span>Review progress</span><strong>{classifiedCount} of {assets.length}</strong><small>{informationRequiredCount} open requests · {noteCount} notes</small></article>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div><h2>Asset review</h2><p>Confirm the assets that need attention.</p></div>
                <button className={styles.secondaryButton} type="button" onClick={openNextOutstandingReview}>Continue review</button>
              </div>
              <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
              <div className={styles.actionGrid}>
                <article><strong>{assets.length - classifiedCount}</strong><span>Need a decision</span></article>
                <article><strong>{informationRequiredCount}</strong><span>Information requests</span></article>
                <article><strong>{sectionRows.filter(([section]) => POLICY_SECTIONS.includes(section)).length}</strong><span>Policy sections</span></article>
              </div>
            </section>

            <div className={styles.twoColumn}>
              <section className={styles.card}>
                <div className={styles.cardHeader}><div><span className={styles.kicker}>Insurance view</span><h2>Policy sections</h2></div></div>
                <div className={styles.sectionList}>
                  {sectionRows.map(([section, row]) => (
                    <div key={section}><span><strong>{section}</strong><small>{row.count} assets</small></span><b>{money(row.proposed)}</b></div>
                  ))}
                </div>
              </section>

              <section className={styles.card}>
                <div className={styles.cardHeader}><div><span className={styles.kicker}>Operation-level cover</span><h2>Non-asset covers</h2></div></div>
                <p className={styles.helperCopy}>Track these at client or location level instead of forcing them onto a physical asset.</p>
                <div className={styles.coverChips}>
                  {NON_ASSET_COVERS.map((cover) => (
                    <button key={cover} type="button" className={workspace.nonAssetCovers.includes(cover) ? styles.activeChip : ''} onClick={() => toggleNonAssetCover(cover)}>
                      {workspace.nonAssetCovers.includes(cover) ? '✓ ' : '+ '}{cover}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        ) : null}

        {tab === 'review' ? (
          <section className={styles.reviewPanel}>
            <div className={styles.reviewToolbar}>
              <label className={styles.reviewSearch}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m16.5 16.5 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets, locations or schedule items" />
              </label>
              <CustomSelect
                value={reviewFilter}
                ariaLabel="Filter review status"
                placeholder="Review status"
                onChange={setReviewFilter}
                options={[
                  { value: 'outstanding', label: 'Needs review' },
                  { value: 'information_required', label: 'Information required' },
                  { value: 'included', label: 'Included' },
                  { value: 'excluded', label: 'Excluded' },
                  { value: 'all', label: 'All review statuses' },
                ]}
              />
              <CustomSelect
                value={sectionFilter}
                ariaLabel="Filter policy section"
                placeholder="Policy section"
                onChange={setSectionFilter}
                options={[
                  { value: 'all', label: 'All policy sections' },
                  { value: 'Unclassified', label: 'Unclassified' },
                  ...POLICY_SECTIONS.map((section) => ({ value: section, label: section })),
                ]}
              />
            </div>

            {selectedIds.length ? (
              <div className={styles.bulkBar}>
                <strong>{selectedIds.length} selected</strong>
                <CustomSelect
                  compact
                  value={bulkSection}
                  ariaLabel="Choose policy section for selected assets"
                  placeholder="Choose policy section"
                  onChange={setBulkSection}
                  options={POLICY_SECTIONS.map((section) => ({ value: section, label: section }))}
                />
                <button type="button" onClick={applyBulkSection} disabled={!bulkSection}>Apply</button>
                <button type="button" onClick={() => setSelectedIds([])}>Clear</button>
              </div>
            ) : null}

            <div className={styles.assetTableScroll}>
              <div className={styles.assetTable}>
                <div className={styles.assetTableHead}>
                <label className={styles.checkWrap}>
                  <input
                    type="checkbox"
                    checked={Boolean(visibleAssets.length) && visibleAssets.every((asset) => selectedIds.includes(assetId(asset, assets.indexOf(asset))))}
                    onChange={() => {
                      const visibleIds = visibleAssets.map((asset) => assetId(asset, assets.indexOf(asset)));
                      const allSelected = visibleIds.every((id) => selectedIds.includes(id));
                      setSelectedIds((current) => allSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds])));
                    }}
                    aria-label="Select all visible assets"
                  />
                  <span />
                </label>
                <span>Asset</span><span>Location</span><span>Current insurance</span><span>Review classification</span><span>Replacement</span><span></span>
                </div>
                {visibleAssets.map((asset) => {
                const index = assets.indexOf(asset);
                const id = assetId(asset, index);
                const review = workspace.reviews[id];
                const suggestion = inferPolicySection(asset);
                return (
                  <article className={styles.assetRow} key={id}>
                    <label className={styles.checkWrap}><input type="checkbox" checked={selectedIds.includes(id)} onChange={() => toggleSelected(id)} /><span /></label>
                    <div className={styles.assetIdentity}>
                      <span className={styles.assetAvatar}>{assetTitle(asset).slice(0, 2).toUpperCase()}</span>
                      <span><strong>{assetTitle(asset)}</strong><small>{assetKind(asset)}</small>{review?.note ? <em>Broker note</em> : null}</span>
                    </div>
                    <span className={styles.locationCell}>{assetLocation(asset)}</span>
                    <span className={`${styles.existingStatus} ${existingInsuranceStatus(asset) === 'Yes' ? styles.statusYes : existingInsuranceStatus(asset) === 'No' ? styles.statusNo : styles.statusUnknown}`}>{existingInsuranceStatus(asset)}</span>
                    <div className={styles.classificationCell}>
                      {review?.policySection ? <strong>{review.policySection}</strong> : <strong className={styles.unclassified}>Unclassified</strong>}
                      <small>{review?.assetGroup || `Suggested: ${suggestion}`}</small>
                      {review ? <span className={`${styles.decisionTag} ${styles[`decision_${review.decision}`]}`}>{decisionLabel(review.decision)}</span> : null}
                    </div>
                    <span className={styles.valueCell}><strong>{money(replacementValue(asset))}</strong><small>Replacement</small></span>
                    <button type="button" className={styles.reviewButton} onClick={() => openReview(asset, index)}>{review ? 'Edit' : 'Review'}</button>
                  </article>
                );
                })}
              </div>
            </div>
            {!visibleAssets.length ? <div className={styles.emptyState}>No assets match these filters.</div> : null}
          </section>
        ) : null}

        {tab === 'report' ? (
          <section className={styles.reportPage}>
            <div className={styles.reportActions}>
              <div><span className={styles.kicker}>Underwriting preview</span><h2>Insurance classification report</h2><p>Prepared from a frozen owner snapshot and broker-side review.</p></div>
              <div>
                <button type="button" className={styles.secondaryButton} onClick={() => window.print()}>Print / save PDF</button>
                <button type="button" className={styles.primaryButton} onClick={freezeSnapshot}>Freeze submission</button>
              </div>
            </div>
            {workspace.frozenAtIso ? <div className={styles.frozenBanner}>Frozen {dateLabel(workspace.frozenAtIso)} · Further browser changes create a new working version.</div> : null}
            <div className={styles.reportHero}>
              <div><span>Aim4price insurance review</span><h2>{share.ownerBusinessName || snapshot.ownerName}</h2><p>{snapshot.ownerMeta || [share.ownerProvince, share.ownerTownCity].filter(Boolean).join(' · ')}</p></div>
              <div><span>Review progress</span><strong>{progress}%</strong><small>{classifiedCount} of {assets.length} assets classified</small></div>
            </div>
            <div className={styles.reportMetrics}>
              <span><small>Register value</small><strong>{money(snapshot.totalValue)}</strong></span>
              <span><small>Replacement value</small><strong>{money(snapshot.totalReplacementValue)}</strong></span>
              <span><small>Information required</small><strong>{informationRequiredCount}</strong></span>
              <span><small>Unclassified assets</small><strong>{assets.length - classifiedCount}</strong></span>
            </div>
            <section className={styles.reportSection}>
              <h3>Policy section summary</h3>
              <div className={styles.reportTable}>
                <div><strong>Policy section</strong><strong>Assets</strong><strong>Replacement value</strong><strong>Proposed value</strong></div>
                {sectionRows.map(([section, row]) => <div key={section}><span>{section}</span><span>{row.count}</span><span>{money(row.replacement)}</span><span>{money(row.proposed)}</span></div>)}
              </div>
            </section>
            <section className={styles.reportSection}>
              <h3>Non-asset covers selected for review</h3>
              <p>{workspace.nonAssetCovers.length ? workspace.nonAssetCovers.join(' · ') : 'None selected yet.'}</p>
            </section>
            <section className={styles.reportSection}>
              <h3>Broker notes and information requests</h3>
              <div className={styles.reportNotes}>
                {assets.map((asset, index) => ({ asset, review: workspace.reviews[assetId(asset, index)] })).filter(({ review }) => review?.note || review?.decision === 'information_required').map(({ asset, review }) => (
                  <article key={assetTitle(asset)}><strong>{assetTitle(asset)}</strong><span>{review?.note || 'Additional information is required.'}</span><small>{review?.noteVisibility === 'private' ? 'Private broker note' : 'Shared with client'} · {review ? decisionLabel(review.decision) : ''}</small></article>
                ))}
                {!informationRequiredCount && !noteCount ? <p>No notes or information requests have been added.</p> : null}
              </div>
            </section>
            <footer className={styles.reportFooter}>Prototype report · Insurance classifications are broker-side working decisions and do not amend the owner’s asset records or confirm cover.</footer>
          </section>
        ) : null}
      </section>

      {editingAsset ? (
        <div className={styles.modalOverlay} role="presentation">
          <button type="button" className={styles.modalBackdrop} onClick={() => setEditingAssetId(null)} aria-label="Close review" />
          <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="asset-review-title">
            <header><div><span className={styles.kicker}>Review asset</span><h2 id="asset-review-title">{assetTitle(editingAsset)}</h2><p>Insurance working record · Owner details remain read-only</p></div><button type="button" onClick={() => setEditingAssetId(null)} aria-label="Close">×</button></header>
            <div className={styles.modalBody}>
              <div className={styles.assetFactGrid}>
                <span><small>Location</small><strong>{assetLocation(editingAsset)}</strong></span>
                <span><small>Replacement</small><strong>{money(replacementValue(editingAsset))}</strong></span>
                <span><small>Register value</small><strong>{money(assetValue(editingAsset))}</strong></span>
                <span><small>Current status</small><strong>{existingInsuranceStatus(editingAsset)}</strong></span>
              </div>
              <div className={styles.suggestionBox}><span>Aim4price suggestion</span><strong>{inferAssetGroup(editingAsset)} → {inferPolicySection(editingAsset)}</strong><button type="button" onClick={() => setDraft((current) => ({ ...current, assetGroup: inferAssetGroup(editingAsset), policySection: inferPolicySection(editingAsset) }))}>Use suggestion</button></div>
              <div className={styles.formGrid}>
                <div className={styles.formField}><span>Asset group</span><CustomSelect value={draft.assetGroup} ariaLabel="Choose asset group" placeholder="Choose asset group" onChange={(value) => setDraft((current) => ({ ...current, assetGroup: value }))} options={ASSET_GROUPS.map((group) => ({ value: group, label: group }))} /></div>
                <div className={styles.formField}><span>Policy section</span><CustomSelect value={draft.policySection} ariaLabel="Choose policy section" placeholder="Choose policy section" onChange={(value) => setDraft((current) => ({ ...current, policySection: value }))} options={POLICY_SECTIONS.map((section) => ({ value: section, label: section }))} /></div>
                <label><span>Schedule item</span><input value={draft.scheduleItem} onChange={(event) => setDraft((current) => ({ ...current, scheduleItem: event.target.value }))} placeholder="e.g. Irrigation equipment at Spitskop" /></label>
                <label><span>Proposed sum insured excl. VAT</span><input type="number" min="0" value={draft.proposedValue} onChange={(event) => setDraft((current) => ({ ...current, proposedValue: event.target.value }))} /></label>
                <fieldset className={`${styles.fullField} ${styles.decisionField}`}>
                  <legend>Review decision</legend>
                  <div className={styles.decisionGrid}>
                    {DECISION_OPTIONS.map((option) => (
                      <button type="button" key={option.value} className={draft.decision === option.value ? styles.decisionButtonActive : ''} onClick={() => setDraft((current) => ({ ...current, decision: option.value }))}>
                        <span className={styles.decisionRadio}>{draft.decision === option.value ? '✓' : ''}</span>
                        <span><strong>{option.label}</strong><small>{option.description}</small></span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <label className={styles.fullField}><span>Broker or underwriter note</span><textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add a concise note or question for the client." rows={4} /></label>
                <fieldset className={`${styles.fullField} ${styles.visibilityField}`}>
                  <legend>Note visibility</legend>
                  <div>
                    <button type="button" className={draft.noteVisibility === 'shared' ? styles.visibilityActive : ''} onClick={() => setDraft((current) => ({ ...current, noteVisibility: 'shared' }))}>Shared with client</button>
                    <button type="button" className={draft.noteVisibility === 'private' ? styles.visibilityActive : ''} onClick={() => setDraft((current) => ({ ...current, noteVisibility: 'private' }))}>Private note</button>
                  </div>
                </fieldset>
              </div>
            </div>
            <footer>
              <button type="button" className={styles.modalCancelButton} onClick={() => setEditingAssetId(null)}>Cancel</button>
              <button type="button" className={styles.secondaryButton} onClick={() => saveReview(false)}>Save</button>
              <button type="button" className={styles.primaryButton} onClick={() => saveReview(true)}>Save & next</button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
