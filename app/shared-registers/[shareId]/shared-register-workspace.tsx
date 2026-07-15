'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import {
  ASSET_CATEGORIES,
  CLIENT_PROFILES,
  EXCLUSION_REASONS,
  categoryDefinition,
  optionsForCategory,
} from '../../../lib/insurance-option-config';
import type {
  InsuranceAssetReview,
  InsuranceGeneralCoverReview,
  InsuranceOptionReview,
  InsuranceReportType,
  InsuranceReviewStatus,
  InsuranceWorkspaceAsset,
  InsuranceWorkspaceData,
} from '../../../lib/insurance-workspace-types';
import styles from './workspace.module.css';

type Tab = 'overview' | 'assets' | 'general' | 'reports';
type Notice = { tone: 'success' | 'error'; message: string };

const REVIEW_STATUS_LABELS: Record<InsuranceReviewStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
};

const CURRENT_INSURANCE_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'insured', label: 'Insured' },
  { value: 'not_insured', label: 'Not insured' },
  { value: 'covered_elsewhere', label: 'Covered elsewhere' },
  { value: 'not_applicable', label: 'Not applicable' },
] as const;

const RECOMMENDATION_OPTIONS = [
  { value: 'review', label: 'Review' },
  { value: 'include', label: 'Include' },
  { value: 'exclude', label: 'Exclude' },
  { value: 'information_required', label: 'Information required' },
  { value: 'not_applicable', label: 'Not applicable' },
] as const;

const OPTION_STATUS_OPTIONS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'included', label: 'Included' },
  { value: 'excluded', label: 'Excluded' },
  { value: 'not_applicable', label: 'Not applicable' },
] as const;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Not set';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function cloneAsset(asset: InsuranceWorkspaceAsset): InsuranceWorkspaceAsset {
  return { ...asset, snapshot: { ...asset.snapshot }, review: { ...asset.review, options: asset.review.options.map((option) => ({ ...option })) } };
}

function mergeCategoryOptions(categoryKey: string, current: InsuranceOptionReview[]): InsuranceOptionReview[] {
  const existing = new Map(current.map((option) => [option.key, option]));
  return optionsForCategory(categoryKey).map((definition) => existing.get(definition.key) ?? {
    key: definition.key,
    label: definition.label,
    status: 'unknown',
    exclusionReasonKey: '',
    note: '',
    amountValue: null,
    textValue: '',
  });
}

function assetPhotos(asset: InsuranceWorkspaceAsset): string[] {
  const snapshotPhotos = Array.isArray(asset.snapshot.photos) ? asset.snapshot.photos : [];
  return [...new Set([asset.photoUrl, ...snapshotPhotos]
    .map((value) => asText(value))
    .filter((value) => Boolean(value) && (value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://') || value.startsWith('data:image/'))))];
}

function assetMeta(asset: InsuranceWorkspaceAsset): string {
  const snapshot = asset.snapshot;
  const brand = asText(snapshot.brandName);
  const model = asText(snapshot.modelName) || asText(snapshot.typedModelName);
  const hours = asNumber(snapshot.hours);
  return [brand, model, asset.yearModel, hours !== null ? `${new Intl.NumberFormat('en-ZA').format(hours)} hours` : '', titleCase(asset.condition)]
    .filter(Boolean)
    .join(' · ') || asset.kind;
}

function insuredValue(asset: InsuranceWorkspaceAsset): number | null {
  return asset.review.sumInsured ?? asNumber(asset.snapshot.insuredValueExVat);
}

function insuredValueSource(asset: InsuranceWorkspaceAsset): string {
  if (asset.review.sumInsured !== null) return asset.review.vatBasis ? `${titleCase(asset.review.vatBasis)} VAT` : 'Broker recorded';
  if (asNumber(asset.snapshot.insuredValueExVat) !== null) return 'Owner provided';
  return 'Add in Manage cover';
}

function detailRows(asset: InsuranceWorkspaceAsset): Array<[string, string]> {
  const snapshot = asset.snapshot;
  const specs = asRecord(snapshot.specsJson);
  const lat = asNumber(snapshot.lastKnownLat);
  const lng = asNumber(snapshot.lastKnownLng);
  const rows: Array<[string, string]> = [
    ['Asset type', asset.kind],
    ['Location', asset.location || 'Not supplied'],
    ['Brand', asText(snapshot.brandName) || '—'],
    ['Model', asText(snapshot.modelName) || asText(snapshot.typedModelName) || '—'],
    ['Year model', asset.yearModel ? String(asset.yearModel) : '—'],
    ['Usage', asNumber(snapshot.hours) !== null ? `${new Intl.NumberFormat('en-ZA').format(asNumber(snapshot.hours) ?? 0)} hours` : '—'],
    ['Condition', asset.condition ? titleCase(asset.condition) : '—'],
    ['Power', asNumber(snapshot.powerKw) !== null ? `${asNumber(snapshot.powerKw)} kW` : '—'],
    ['Serial number', asset.serialNumber || '—'],
    ['Registration', asset.registrationNumber || '—'],
    ['Finance status', asText(specs.financeStatus) ? titleCase(asText(specs.financeStatus)) : '—'],
    ['License status', asText(specs.licenseStatus) ? titleCase(asText(specs.licenseStatus)) : '—'],
    ['Last scanned', dateLabel(asText(snapshot.lastScannedAtIso) || null)],
    ['Current insurance', titleCase(asset.review.currentInsuranceStatus)],
    ['Owner insured value', money(asNumber(snapshot.insuredValueExVat))],
    ['Register value', money(asset.registerValue)],
    ['Replacement value', money(asset.replacementValue)],
  ];
  if (lat !== null && lng !== null) rows.splice(2, 0, ['Map coordinates', `${lat.toFixed(6)}, ${lng.toFixed(6)}`]);
  return rows;
}

function additionalSpecificationRows(asset: InsuranceWorkspaceAsset): Array<[string, string]> {
  const hiddenKeys = new Set([
    'financeStatus',
    'insuranceStatus',
    'licenseStatus',
    'replacementPriceExVat',
    'replacement_price_ex_vat',
    'replacementPriceUsedExVat',
    'replacement_price_used_ex_vat',
  ]);
  return Object.entries(asRecord(asset.snapshot.specsJson))
    .filter(([key, value]) => !hiddenKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .map(([key, value]) => [titleCase(key.replace(/([a-z])([A-Z])/g, '$1 $2')), String(value)]);
}

function DetailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14M5 12h14M5 16h9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

function ManageIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>;
}

function FilterIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8m-5 5h2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export default function SharedRegisterWorkspace({ initialWorkspace }: { initialWorkspace: InsuranceWorkspaceData }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | InsuranceReviewStatus>('all');
  const [page, setPage] = useState(1);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [photoIndexByAsset, setPhotoIndexByAsset] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<InsuranceWorkspaceAsset | null>(null);
  const [dirty, setDirty] = useState(false);
  const [covers, setCovers] = useState(initialWorkspace.generalCovers.map((cover) => ({ ...cover })));
  const pageSize = 20;

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspace.assets.filter((asset) => {
      if (categoryFilter !== 'all' && asset.review.categoryKey !== categoryFilter) return false;
      if (reviewFilter !== 'all' && asset.review.reviewStatus !== reviewFilter) return false;
      return !normalized || [asset.title, asset.kind, asset.location, asset.serialNumber, asset.registrationNumber]
        .join(' ').toLowerCase().includes(normalized);
    });
  }, [workspace.assets, query, categoryFilter, reviewFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const visibleAssets = filteredAssets.slice((page - 1) * pageSize, page * pageSize);
  const completedCount = workspace.assets.filter((asset) => asset.review.reviewStatus === 'completed').length;
  const informationCount = workspace.assets.filter((asset) => asset.review.recommendationStatus === 'information_required').length;
  const insuredCount = workspace.assets.filter((asset) => asset.review.currentInsuranceStatus === 'insured').length;

  useEffect(() => setPage(1), [query, categoryFilter, reviewFilter]);
  useEffect(() => setCovers(workspace.generalCovers.map((cover) => ({ ...cover }))), [workspace.generalCovers]);

  async function readResponse(response: Response): Promise<InsuranceWorkspaceData> {
    const payload = (await response.json()) as { ok?: boolean; workspace?: InsuranceWorkspaceData; error?: string };
    if (!response.ok || !payload.workspace) throw new Error(payload.error || 'The workspace could not be saved.');
    return payload.workspace;
  }

  async function persistAsset(asset: InsuranceWorkspaceAsset, quiet = false): Promise<InsuranceWorkspaceData | null> {
    setSaving(true);
    setDirty(false);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review: asset.review, options: asset.review.options }),
      });
      const updated = await readResponse(response);
      setWorkspace(updated);
      const savedAsset = updated.assets.find((candidate) => candidate.id === asset.id);
      if (savedAsset) setDraft((current) => current?.id === asset.id ? cloneAsset(savedAsset) : current);
      if (!quiet) setNotice({ tone: 'success', message: 'Insurance details saved.' });
      return updated;
    } catch (error) {
      setDirty(true);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The insurance details could not be saved.' });
      return null;
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!draft || !dirty) return;
    const pending = cloneAsset(draft);
    const timer = window.setTimeout(() => { void persistAsset(pending, true); }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  function openManage(asset: InsuranceWorkspaceAsset) {
    setDraft(cloneAsset(asset));
    setDirty(false);
    setNotice(null);
  }

  async function closeManage() {
    if (draft && dirty) {
      const updated = await persistAsset(draft, true);
      if (!updated) return;
    }
    setDraft(null);
    setDirty(false);
  }

  function changeReview<K extends keyof InsuranceAssetReview>(key: K, value: InsuranceAssetReview[K]) {
    setDraft((current) => {
      if (!current) return current;
      const nextReview = { ...current.review, [key]: value };
      if (key === 'categoryKey') nextReview.options = mergeCategoryOptions(String(value), current.review.options);
      return { ...current, review: nextReview };
    });
    setDirty(true);
  }

  function changeOption(index: number, changes: Partial<InsuranceOptionReview>) {
    setDraft((current) => current ? {
      ...current,
      review: { ...current.review, options: current.review.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...changes } : option) },
    } : current);
    setDirty(true);
  }

  async function saveAndNext() {
    if (!draft) return;
    const currentId = draft.id;
    const updated = await persistAsset(draft);
    if (!updated) return;
    const index = updated.assets.findIndex((asset) => asset.id === currentId);
    const next = updated.assets[index + 1];
    if (next) openManage(next);
  }

  async function updateWorkspaceSettings(changes: Record<string, unknown>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(changes),
      });
      const updated = await readResponse(response);
      setWorkspace(updated);
      setNotice({ tone: 'success', message: 'Workspace settings saved.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Workspace settings could not be saved.' });
    } finally { setSaving(false); }
  }

  function changeCover(index: number, changes: Partial<InsuranceGeneralCoverReview>) {
    setCovers((current) => current.map((cover, coverIndex) => coverIndex === index ? { ...cover, ...changes } : cover));
  }

  async function saveCovers() {
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}/general-covers`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ covers }),
      });
      const updated = await readResponse(response);
      setWorkspace(updated);
      setNotice({ tone: 'success', message: 'General covers saved.' });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'General covers could not be saved.' });
    } finally { setSaving(false); }
  }

  async function generateReport(type: InsuranceReportType) {
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}/reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || 'The report could not be generated.');
      const refreshed = await fetch(`/api/insurance-workspaces/${workspace.id}`);
      setWorkspace(await readResponse(refreshed));
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      setNotice({ tone: 'success', message: `${titleCase(type)} report generated.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The report could not be generated.' });
    } finally { setSaving(false); }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}>{notice.message}</div> : null}
        <div className={styles.backRow}><Link href="/shared-registers">← Shared Registers</Link><span>{saving ? 'Saving…' : 'Saved'}</span></div>
        <header className={styles.workspaceHeader}>
          <div><h1>{workspace.clientName}</h1><p>{workspace.clientMeta || 'Insurance review workspace'}</p></div>
          <div className={styles.headerStatus}><small>Review status</small><strong>{REVIEW_STATUS_LABELS[workspace.reviewStatus]}</strong></div>
        </header>

        <nav className={styles.tabs} aria-label="Insurance workspace">
          {([['overview', 'Overview'], ['assets', 'Assets'], ['general', 'General Covers'], ['reports', 'Reports']] as Array<[Tab, string]>).map(([value, label]) => (
            <button className={tab === value ? styles.activeTab : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <section className={styles.overview}>
            <div className={styles.summaryGrid}>
              <article><span>Total assets</span><strong>{workspace.assetCount}</strong><small>{completedCount} reviewed</small></article>
              <article><span>Currently insured</span><strong>{insuredCount}</strong><small>Based on recorded cover status</small></article>
              <article><span>Information needed</span><strong>{informationCount}</strong><small>Items waiting for client details</small></article>
            </div>
            <div className={styles.overviewGrid}>
              <article className={styles.card}>
                <h2>Review setup</h2>
                <p>Choose the client type and keep the overall review status up to date.</p>
                <div className={styles.formGrid}>
                  <label><span>Client type</span><select value={workspace.clientProfile} onChange={(event) => void updateWorkspaceSettings({ clientProfile: event.target.value })}>{CLIENT_PROFILES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Review status</span><select value={workspace.reviewStatus} onChange={(event) => void updateWorkspaceSettings({ reviewStatus: event.target.value })}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
                </div>
              </article>
              <article className={styles.card}>
                <h2>Client information</h2>
                <p>{workspace.clientMeta || 'No additional client information was supplied.'}</p>
                <dl><div><dt>Assets shared</dt><dd>{workspace.assetCount}</dd></div><div><dt>Last reviewed</dt><dd>{dateLabel(workspace.lastReviewedAtIso)}</dd></div></dl>
              </article>
            </div>
            {workspace.ownerMessage ? <article className={styles.card}><h2>Message from client</h2><p>{workspace.ownerMessage}</p></article> : null}
          </section>
        ) : null}

        {tab === 'assets' ? (
          <section className={styles.assetsSection}>
            <div className={styles.assetToolbar}>
              <label className={styles.assetSearch}><span className={styles.srOnly}>Search assets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by asset, location or serial" /></label>
              <button className={`${styles.filterButton} ${filtersOpen ? styles.filterButtonActive : ''}`} type="button" onClick={() => setFiltersOpen((current) => !current)}><FilterIcon /><span>Filters</span></button>
            </div>
            {filtersOpen ? <div className={styles.filterPanel}><label><span>Asset type</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All asset types</option>{ASSET_CATEGORIES.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label><label><span>Review status</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}><option value="all">All review statuses</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label></div> : null}

            <div className={styles.assetList}>
              {visibleAssets.map((asset) => {
                const isExpanded = expandedAssetId === asset.id;
                const photos = assetPhotos(asset);
                const photoIndex = Math.min(photoIndexByAsset[asset.id] ?? 0, Math.max(0, photos.length - 1));
                const lat = asNumber(asset.snapshot.lastKnownLat);
                const lng = asNumber(asset.snapshot.lastKnownLng);
                const additionalSpecifications = additionalSpecificationRows(asset);
                return (
                  <article className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''}`} key={asset.id}>
                    <div className={styles.assetHeader}>
                      <div className={styles.assetTitleBlock}>
                        <h2>{asset.title}</h2>
                        <p>{assetMeta(asset)}</p>
                        <span>{asset.location || 'Location not supplied'}</span>
                      </div>
                      <div className={styles.assetHeaderAside}>
                        <div className={styles.insuredValue}><small>Insured value</small><strong>{money(insuredValue(asset))}</strong><span>{insuredValueSource(asset)}</span></div>
                        <div className={styles.assetActions}>
                          <button className={styles.viewButton} type="button" onClick={() => setExpandedAssetId((current) => current === asset.id ? null : asset.id)} aria-expanded={isExpanded} aria-controls={`asset-details-${asset.id}`}><DetailIcon /><span>{isExpanded ? 'Hide details' : 'View details'}</span></button>
                          <button className={styles.manageButton} type="button" onClick={() => openManage(asset)}><ManageIcon /><span>Manage cover</span></button>
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className={styles.assetDetails} id={`asset-details-${asset.id}`}>
                        <div className={styles.photoPanel}>
                          {photos.length ? <a className={styles.mainPhoto} href={photos[photoIndex]} target="_blank" rel="noreferrer"><img src={photos[photoIndex]} alt={`${asset.title} photo ${photoIndex + 1}`} /></a> : <div className={styles.photoPlaceholder}><span>No photo shared</span></div>}
                          {photos.length > 1 ? <div className={styles.photoThumbs}>{photos.map((photo, index) => <button className={index === photoIndex ? styles.activeThumb : ''} type="button" key={`${asset.id}-photo-${index}`} onClick={() => setPhotoIndexByAsset((current) => ({ ...current, [asset.id]: index }))}><img src={photo} alt={`${asset.title} thumbnail ${index + 1}`} /></button>)}</div> : null}
                        </div>
                        <div className={styles.detailsPanel}>
                          <div className={styles.detailsHeading}><div><h3>Asset details</h3><p>Information supplied from the client&apos;s asset register.</p></div>{lat !== null && lng !== null ? <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">Open map</a> : null}</div>
                          <dl>{detailRows(asset).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
                          {additionalSpecifications.length ? <details className={styles.specifications}><summary>Additional specifications</summary><dl>{additionalSpecifications.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></details> : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {!visibleAssets.length ? <div className={styles.empty}>No assets match your search and filters.</div> : null}
            </div>
            {pageCount > 1 ? <div className={styles.pagination}><span>{filteredAssets.length} assets · Page {page} of {pageCount}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Next</button></div></div> : null}
          </section>
        ) : null}

        {tab === 'general' ? (
          <section className={styles.generalSection}>
            <header className={styles.sectionHeader}><div><h2>General Covers</h2><p>Manage cover that applies to the client rather than one specific asset.</p></div><button type="button" onClick={() => void saveCovers()} disabled={saving}>Save covers</button></header>
            {workspace.clientProfile === 'unclassified' ? <div className={styles.infoBox}>Choose a client type on Overview to tailor this list.</div> : null}
            <div className={styles.coverGrid}>{covers.map((cover, index) => (
              <article className={styles.coverCard} key={cover.key}>
                <h3>{cover.label}</h3>
                <div className={styles.formGrid}>
                  <label><span>Current status</span><select value={cover.status} onChange={(event) => changeCover(index, { status: event.target.value as InsuranceGeneralCoverReview['status'] })}>{OPTION_STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Broker decision</span><select value={cover.recommendationStatus} onChange={(event) => changeCover(index, { recommendationStatus: event.target.value as InsuranceGeneralCoverReview['recommendationStatus'] })}>{RECOMMENDATION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Insurer</span><input value={cover.insurerName} onChange={(event) => changeCover(index, { insurerName: event.target.value })} /></label>
                  <label><span>Policy number</span><input value={cover.policyNumber} onChange={(event) => changeCover(index, { policyNumber: event.target.value })} /></label>
                  <label><span>Policy section</span><input value={cover.policySectionLabel} onChange={(event) => changeCover(index, { policySectionLabel: event.target.value })} /></label>
                  <label><span>Cover limit (ZAR)</span><input type="number" min="0" value={cover.limitAmount ?? ''} onChange={(event) => changeCover(index, { limitAmount: event.target.value ? Number(event.target.value) : null })} /></label>
                  {cover.status === 'excluded' ? <label><span>Exclusion reason</span><select value={cover.exclusionReasonKey} onChange={(event) => changeCover(index, { exclusionReasonKey: event.target.value })}>{EXCLUSION_REASONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}
                  <label className={styles.wide}><span>Broker notes</span><textarea value={cover.recommendationNote} onChange={(event) => changeCover(index, { recommendationNote: event.target.value })} rows={3} /></label>
                </div>
              </article>
            ))}</div>
          </section>
        ) : null}

        {tab === 'reports' ? (
          <section className={styles.reports}>
            <div className={styles.reportGrid}>
              <article><h2>Summary report</h2><p>A short client-ready overview of assets, cover status, and broker decisions.</p><button type="button" onClick={() => void generateReport('summary')} disabled={saving}>Generate summary</button></article>
              <article><h2>Detailed report</h2><p>A complete review with asset details, insurance options, and general covers.</p><button type="button" onClick={() => void generateReport('detailed')} disabled={saving}>Generate detailed report</button></article>
            </div>
            <article className={styles.reportHistory}><h2>Previous reports</h2>{workspace.reports.length ? <div className={styles.reportList}>{workspace.reports.map((report) => <div key={report.id}><div><strong>{titleCase(report.type)} report</strong><small>Revision {report.revision} · {dateLabel(report.generatedAtIso)}</small></div><a href={`/api/insurance-reports/${report.id}`} target="_blank" rel="noreferrer">Open report</a></div>)}</div> : <div className={styles.empty}>No reports have been generated yet.</div>}</article>
            <p className={styles.disclaimer}>Reports reflect information and recommendations recorded by the broker. Aim4price does not provide financial advice or independently confirm insurance cover.</p>
          </section>
        ) : null}
      </section>

      {draft ? (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) void closeManage(); }}>
          <section className={styles.manageModal} role="dialog" aria-modal="true" aria-label={`Manage insurance for ${draft.title}`}>
            <header><div><small>Manage insurance</small><h2>{draft.title}</h2><p>{assetMeta(draft)}</p></div><button type="button" onClick={() => void closeManage()} aria-label="Close manage insurance">×</button></header>
            <div className={styles.manageBody}>
              <section><h3>Current cover</h3><div className={styles.formGrid}>
                <label><span>Insurance status</span><select value={draft.review.currentInsuranceStatus} onChange={(event) => changeReview('currentInsuranceStatus', event.target.value as InsuranceAssetReview['currentInsuranceStatus'])}>{CURRENT_INSURANCE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label><span>Insured value (ZAR)</span><input type="number" min="0" value={draft.review.sumInsured ?? ''} onChange={(event) => changeReview('sumInsured', event.target.value ? Number(event.target.value) : null)} /></label>
                <label><span>Insurer</span><input value={draft.review.insurerName} onChange={(event) => changeReview('insurerName', event.target.value)} /></label>
                <label><span>Policy number</span><input value={draft.review.policyNumber} onChange={(event) => changeReview('policyNumber', event.target.value)} /></label>
              </div></section>

              <section><h3>Cover setup</h3><div className={styles.formGrid}>
                <label><span>Asset type</span><select value={draft.review.categoryKey} onChange={(event) => changeReview('categoryKey', event.target.value)}>{ASSET_CATEGORIES.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label>
                <label><span>Policy section</span><input list="policy-sections" value={draft.review.policySectionLabel} onChange={(event) => changeReview('policySectionLabel', event.target.value)} /><datalist id="policy-sections">{categoryDefinition(draft.review.categoryKey).policySections.map((section) => <option value={section} key={section} />)}</datalist></label>
                <label><span>Renewal date</span><input type="date" value={draft.review.renewalDate} onChange={(event) => changeReview('renewalDate', event.target.value)} /></label>
                <label><span>Cover basis</span><input value={draft.review.coverBasis} onChange={(event) => changeReview('coverBasis', event.target.value)} placeholder="Replacement, market or agreed value" /></label>
                <label><span>VAT basis</span><select value={draft.review.vatBasis} onChange={(event) => changeReview('vatBasis', event.target.value as InsuranceAssetReview['vatBasis'])}><option value="">Not recorded</option><option value="exclusive">Exclusive</option><option value="inclusive">Inclusive</option><option value="unknown">Unknown</option></select></label>
                <label><span>Scheduling</span><select value={draft.review.schedulingTreatment} onChange={(event) => changeReview('schedulingTreatment', event.target.value as InsuranceAssetReview['schedulingTreatment'])}><option value="">Not recorded</option><option value="individual">Individual</option><option value="grouped">Grouped</option><option value="blanket">Blanket</option><option value="not_applicable">Not applicable</option></select></label>
                <label className={styles.wide}><span>Schedule description</span><textarea value={draft.review.scheduleDescription} onChange={(event) => changeReview('scheduleDescription', event.target.value)} rows={2} /></label>
                <label className={styles.wide}><span>Excess</span><input value={draft.review.excessText} onChange={(event) => changeReview('excessText', event.target.value)} /></label>
              </div></section>

              <section><h3>Cover options</h3><p className={styles.sectionIntro}>Record whether each option is included in the policy.</p><div className={styles.optionList}>{draft.review.options.map((option, index) => <article key={option.key}><div><strong>{option.label}</strong><small>{optionsForCategory(draft.review.categoryKey).find((definition) => definition.key === option.key)?.helpText}</small></div><label><span>Status</span><select value={option.status} onChange={(event) => changeOption(index, { status: event.target.value as InsuranceOptionReview['status'] })}>{OPTION_STATUS_OPTIONS.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}</select></label>{option.status === 'excluded' ? <label><span>Reason</span><select value={option.exclusionReasonKey} onChange={(event) => changeOption(index, { exclusionReasonKey: event.target.value })}>{EXCLUSION_REASONS.map((reason) => <option value={reason.value} key={reason.value}>{reason.label}</option>)}</select></label> : null}<label className={styles.optionNote}><span>Notes</span><input value={option.note} onChange={(event) => changeOption(index, { note: event.target.value })} /></label></article>)}</div></section>

              <section><h3>Broker decision</h3><div className={styles.formGrid}>
                <label><span>Recommendation</span><select value={draft.review.recommendationStatus} onChange={(event) => changeReview('recommendationStatus', event.target.value as InsuranceAssetReview['recommendationStatus'])}>{RECOMMENDATION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label><span>Review status</span><select value={draft.review.reviewStatus} onChange={(event) => changeReview('reviewStatus', event.target.value as InsuranceAssetReview['reviewStatus'])}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
                {draft.review.recommendationStatus === 'exclude' ? <label><span>Exclusion reason</span><select value={draft.review.recommendationReasonKey} onChange={(event) => changeReview('recommendationReasonKey', event.target.value)}>{EXCLUSION_REASONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}
                <label className={styles.wide}><span>Recommendation notes</span><textarea value={draft.review.recommendationNote} onChange={(event) => changeReview('recommendationNote', event.target.value)} rows={3} /></label>
                <label className={styles.wide}><span>Information still needed</span><textarea value={draft.review.informationRequiredNote} onChange={(event) => changeReview('informationRequiredNote', event.target.value)} rows={2} /></label>
                <label className={styles.wide}><span>Special conditions</span><textarea value={draft.review.specialConditions} onChange={(event) => changeReview('specialConditions', event.target.value)} rows={2} /></label>
              </div></section>
            </div>
            <footer><span>{dirty ? 'Autosaving changes…' : saving ? 'Saving…' : 'Changes saved'}</span><div><button type="button" onClick={() => void closeManage()}>Close</button><button type="button" onClick={() => void saveAndNext()} disabled={saving}>Save and next</button></div></footer>
          </section>
        </div>
      ) : null}
    </main>
  );
}
