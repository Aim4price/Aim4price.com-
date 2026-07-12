'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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
};

type WorkspaceState = {
  reviews: Record<string, AssetReview>;
  nonAssetCovers: string[];
  frozenAtIso: string | null;
};

const ASSET_GROUPS = [
  'Property',
  'Vehicles',
  'Mobile equipment',
  'Fixed machinery',
  'Irrigation',
  'Solar & electrical',
  'Dairy equipment',
  'Stock & livestock',
  'Other',
];

const POLICY_SECTIONS = [
  'Fire & buildings',
  'All Risks',
  'Machinery Breakdown',
  'Motor',
  'Electronic Equipment',
  'Goods in Transit',
  'Business Interruption',
  'Liability',
  'Livestock & game',
  'Other / refer',
];

const NON_ASSET_COVERS = ['Business Interruption', 'Liability', 'Goods in Transit', 'Money', 'Fidelity', 'Deterioration of stock'];

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
  if (/building|shed|house|property|structure|store/.test(value)) return 'Property';
  if (/vehicle|hilux|truck|bakkie|trailer/.test(value)) return 'Vehicles';
  if (/pivot|irrigation|pump|borehole/.test(value)) return 'Irrigation';
  if (/solar|battery|inverter|electrical/.test(value)) return 'Solar & electrical';
  if (/dairy|milking|milk|effluent/.test(value)) return 'Dairy equipment';
  if (/tractor|loader|excavator|harvester|equipment/.test(value)) return 'Mobile equipment';
  if (/livestock|cattle|game|stock/.test(value)) return 'Stock & livestock';
  return 'Fixed machinery';
}

function inferPolicySection(asset: SharedRegisterAsset): string {
  const group = inferAssetGroup(asset);
  if (group === 'Property') return 'Fire & buildings';
  if (group === 'Vehicles') return 'Motor';
  if (group === 'Solar & electrical') return 'Electronic Equipment';
  if (group === 'Fixed machinery' || group === 'Dairy equipment') return 'Machinery Breakdown';
  if (group === 'Stock & livestock') return 'Livestock & game';
  return 'All Risks';
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

export default function SharedRegisterWorkspace({ share }: { share: SharedRegisterLead }) {
  const snapshot = sharedRegisterSnapshot(share);
  const assets = useMemo(() => snapshot?.assets ?? [], [snapshot]);
  const [tab, setTab] = useState<Tab>('overview');
  const [workspace, setWorkspace] = useState<WorkspaceState>(defaultState);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSection, setBulkSection] = useState('');
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AssetReview>(EMPTY_REVIEW);
  const [notice, setNotice] = useState('');

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

  const classifiedCount = assets.filter((asset, index) => {
    const review = workspace.reviews[assetId(asset, index)];
    return Boolean(review?.assetGroup && review.policySection && review.decision !== 'review');
  }).length;
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
      return (!normalizedQuery || searchable.includes(normalizedQuery)) && (sectionFilter === 'all' || section === sectionFilter);
    });
  }, [assets, query, sectionFilter, workspace.reviews]);

  const sectionRows = useMemo(() => {
    const rows = new Map<string, { count: number; replacement: number; proposed: number }>();
    assets.forEach((asset, index) => {
      const review = workspace.reviews[assetId(asset, index)];
      const section = review?.policySection || 'Unclassified';
      const row = rows.get(section) ?? { count: 0, replacement: 0, proposed: 0 };
      row.count += 1;
      row.replacement += replacementValue(asset);
      row.proposed += numberValue(review?.proposedValue) || replacementValue(asset);
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

  function saveReview() {
    if (!editingAssetId) return;
    setWorkspace((current) => ({ ...current, reviews: { ...current.reviews, [editingAssetId]: draft } }));
    setEditingAssetId(null);
    setNotice('Insurance review saved separately from the owner asset record.');
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
      return { ...current, reviews };
    });
    setSelectedIds([]);
    setBulkSection('');
    setNotice('Selected assets classified.');
  }

  function toggleNonAssetCover(cover: string) {
    setWorkspace((current) => ({
      ...current,
      nonAssetCovers: current.nonAssetCovers.includes(cover)
        ? current.nonAssetCovers.filter((item) => item !== cover)
        : [...current.nonAssetCovers, cover],
    }));
  }

  function freezeSnapshot() {
    setWorkspace((current) => ({ ...current, frozenAtIso: new Date().toISOString() }));
    setNotice('Prototype submission snapshot frozen in this browser.');
  }

  if (!snapshot) return null;

  const editingAssetIndex = editingAssetId ? assets.findIndex((asset, index) => assetId(asset, index) === editingAssetId) : -1;
  const editingAsset = editingAssetIndex >= 0 ? assets[editingAssetIndex] : null;

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={styles.notice}>{notice}</div> : null}
        <header className={styles.workspaceHeader}>
          <div>
            <Link href="/shared-registers" className={styles.backLink}>← Shared Registers</Link>
            <span className={styles.eyebrow}>{share.id === 'demo' ? 'Interactive prototype' : 'Insurance review'}</span>
            <h1>{share.ownerBusinessName || snapshot.ownerName}</h1>
            <p>{snapshot.title} · Shared {dateLabel(snapshot.generatedAtIso)} · Owner data is read-only</p>
          </div>
          <div className={styles.headerActions}>
            <span className={styles.progressPill}>{progress}% reviewed</span>
            <button type="button" className={styles.primaryButton} onClick={() => setTab('report')}>Preview report</button>
          </div>
        </header>

        <nav className={styles.tabs} aria-label="Insurance workspace sections">
          {(['overview', 'review', 'report'] as Tab[]).map((item) => (
            <button key={item} type="button" className={tab === item ? styles.activeTab : ''} onClick={() => setTab(item)}>
              {item === 'overview' ? 'Overview' : item === 'review' ? 'Review assets' : 'Report'}
              {item === 'review' && informationRequiredCount ? <span>{informationRequiredCount}</span> : null}
            </button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <div className={styles.overviewLayout}>
            <section className={styles.summaryGrid}>
              <article><span>Total assets</span><strong>{assets.length}</strong><small>{money(snapshot.totalValue)} register value</small></article>
              <article><span>Replacement value</span><strong>{money(snapshot.totalReplacementValue)}</strong><small>Excluding VAT</small></article>
              <article><span>Classified</span><strong>{classifiedCount} of {assets.length}</strong><small>{progress}% review complete</small></article>
              <article><span>Open requests</span><strong>{informationRequiredCount}</strong><small>{noteCount} broker notes</small></article>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <div><span className={styles.kicker}>Review progress</span><h2>Only work the exceptions</h2></div>
                <button className={styles.secondaryButton} type="button" onClick={() => setTab('review')}>Continue review</button>
              </div>
              <div className={styles.progressTrack}><span style={{ width: `${progress}%` }} /></div>
              <div className={styles.actionGrid}>
                <article><strong>{assets.length - classifiedCount}</strong><span>Assets still need a decision</span></article>
                <article><strong>{informationRequiredCount}</strong><span>Information requests to resolve</span></article>
                <article><strong>{sectionRows.filter(([section]) => section !== 'Unclassified').length}</strong><span>Policy sections currently used</span></article>
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
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search assets, locations or schedule items" />
              <select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)}>
                <option value="all">All policy sections</option>
                <option value="Unclassified">Unclassified</option>
                {POLICY_SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
              </select>
            </div>

            {selectedIds.length ? (
              <div className={styles.bulkBar}>
                <strong>{selectedIds.length} selected</strong>
                <select value={bulkSection} onChange={(event) => setBulkSection(event.target.value)}>
                  <option value="">Choose policy section</option>
                  {POLICY_SECTIONS.map((section) => <option key={section} value={section}>{section}</option>)}
                </select>
                <button type="button" onClick={applyBulkSection} disabled={!bulkSection}>Apply</button>
                <button type="button" onClick={() => setSelectedIds([])}>Clear</button>
              </div>
            ) : null}

            <div className={styles.assetTable}>
              <div className={styles.assetTableHead}>
                <span></span><span>Asset</span><span>Location</span><span>Existing status</span><span>Insurance classification</span><span>Value</span><span></span>
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
                      {review ? <span className={styles.decisionTag}>{decisionLabel(review.decision)}</span> : null}
                    </div>
                    <span className={styles.valueCell}><strong>{money(replacementValue(asset))}</strong><small>Replacement</small></span>
                    <button type="button" className={styles.reviewButton} onClick={() => openReview(asset, index)}>{review ? 'Edit' : 'Review'}</button>
                  </article>
                );
              })}
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
                <button type="button" className={styles.primaryButton} onClick={freezeSnapshot}>Freeze snapshot</button>
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
            <header><div><span className={styles.kicker}>Insurance overlay</span><h2 id="asset-review-title">{assetTitle(editingAsset)}</h2><p>{assetLocation(editingAsset)} · {money(replacementValue(editingAsset))} replacement value</p></div><button type="button" onClick={() => setEditingAssetId(null)} aria-label="Close">×</button></header>
            <div className={styles.modalBody}>
              <div className={styles.suggestionBox}><span>Aim4price suggestion</span><strong>{inferAssetGroup(editingAsset)} → {inferPolicySection(editingAsset)}</strong><button type="button" onClick={() => setDraft((current) => ({ ...current, assetGroup: inferAssetGroup(editingAsset), policySection: inferPolicySection(editingAsset) }))}>Use suggestion</button></div>
              <div className={styles.formGrid}>
                <label><span>Basic asset group</span><select value={draft.assetGroup} onChange={(event) => setDraft((current) => ({ ...current, assetGroup: event.target.value }))}><option value="">Choose group</option>{ASSET_GROUPS.map((group) => <option key={group}>{group}</option>)}</select></label>
                <label><span>Policy section</span><select value={draft.policySection} onChange={(event) => setDraft((current) => ({ ...current, policySection: event.target.value }))}><option value="">Choose section</option>{POLICY_SECTIONS.map((section) => <option key={section}>{section}</option>)}</select></label>
                <label><span>Schedule item</span><input value={draft.scheduleItem} onChange={(event) => setDraft((current) => ({ ...current, scheduleItem: event.target.value }))} placeholder="e.g. Irrigation equipment at Spitskop" /></label>
                <label><span>Proposed sum insured excl. VAT</span><input type="number" min="0" value={draft.proposedValue} onChange={(event) => setDraft((current) => ({ ...current, proposedValue: event.target.value }))} /></label>
                <label className={styles.fullField}><span>Review decision</span><select value={draft.decision} onChange={(event) => setDraft((current) => ({ ...current, decision: event.target.value as Decision }))}><option value="review">Needs review</option><option value="included">Include</option><option value="excluded">Exclude</option><option value="information_required">Information required</option></select></label>
                <label className={styles.fullField}><span>Broker or underwriter note</span><textarea value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} placeholder="Add a concise note or question for the client." rows={4} /></label>
                <label className={styles.fullField}><span>Note visibility</span><select value={draft.noteVisibility} onChange={(event) => setDraft((current) => ({ ...current, noteVisibility: event.target.value as NoteVisibility }))}><option value="shared">Shared with client</option><option value="private">Private broker note</option></select></label>
              </div>
            </div>
            <footer><button type="button" className={styles.secondaryButton} onClick={() => setEditingAssetId(null)}>Cancel</button><button type="button" className={styles.primaryButton} onClick={saveReview}>Save review</button></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
