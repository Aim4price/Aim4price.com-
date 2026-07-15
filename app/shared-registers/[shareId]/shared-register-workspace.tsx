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
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed',
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

function money(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
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

export default function SharedRegisterWorkspace({ initialWorkspace }: { initialWorkspace: InsuranceWorkspaceData }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | InsuranceReviewStatus>('all');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<InsuranceWorkspaceAsset | null>(null);
  const [dirty, setDirty] = useState(false);
  const [covers, setCovers] = useState(initialWorkspace.generalCovers.map((cover) => ({ ...cover })));
  const [bulk, setBulk] = useState({ insurerName: '', policyNumber: '', policySectionLabel: '', reviewStatus: '' });
  const pageSize = 50;

  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspace.assets.filter((asset) => {
      if (categoryFilter !== 'all' && asset.review.categoryKey !== categoryFilter) return false;
      if (reviewFilter !== 'all' && asset.review.reviewStatus !== reviewFilter) return false;
      return !normalized || [asset.title, asset.kind, asset.location, asset.serialNumber, asset.registrationNumber, asset.review.policySectionLabel]
        .join(' ').toLowerCase().includes(normalized);
    });
  }, [workspace.assets, query, categoryFilter, reviewFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const visibleAssets = filteredAssets.slice((page - 1) * pageSize, page * pageSize);
  const completedCount = workspace.assets.filter((asset) => asset.review.reviewStatus === 'completed').length;
  const informationCount = workspace.assets.filter((asset) => asset.review.recommendationStatus === 'information_required').length;
  const uninsuredCount = workspace.assets.filter((asset) => asset.review.currentInsuranceStatus === 'not_insured').length;

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
      if (!quiet) setNotice({ tone: 'success', message: 'Asset review saved to the broker workspace.' });
      return updated;
    } catch (error) {
      setDirty(true);
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The asset review could not be saved.' });
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
    // The draft object is the autosave source; workspace responses must not restart the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, dirty]);

  function openAsset(asset: InsuranceWorkspaceAsset) {
    setDraft(cloneAsset(asset));
    setDirty(false);
    setNotice(null);
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
    if (next) openAsset(next);
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

  function toggleSelected(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((candidate) => candidate !== id) : [...current, id]);
  }

  async function applyBulk() {
    const changes = Object.fromEntries(Object.entries(bulk).filter(([, value]) => value !== ''));
    if (!selectedIds.length || !Object.keys(changes).length) {
      setNotice({ tone: 'error', message: 'Select assets and enter at least one safe bulk field.' });
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}/bulk`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetIds: selectedIds, changes }),
      });
      const updated = await readResponse(response);
      setWorkspace(updated);
      setSelectedIds([]);
      setBulk({ insurerName: '', policyNumber: '', policySectionLabel: '', reviewStatus: '' });
      setNotice({ tone: 'success', message: `Bulk fields applied to ${selectedIds.length} assets.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Bulk update failed.' });
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
      setNotice({ tone: 'success', message: `${titleCase(type)} report snapshot generated.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The report could not be generated.' });
    } finally { setSaving(false); }
  }

  return (
    <main className={styles.page}>
      <AppHeader active="shared-registers" />
      <section className={styles.shell}>
        {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}>{notice.message}</div> : null}
        <div className={styles.backRow}><Link href="/shared-registers">← Portfolio</Link><span>{saving ? 'Saving…' : 'Saved to server'}</span></div>
        <header className={styles.workspaceHeader}>
          <div>
            <p>{workspace.snapshotReference}</p>
            <h1>{workspace.clientName}</h1>
            <span>{workspace.clientMeta || 'Owner-provided shared register'} · Snapshot {dateLabel(workspace.snapshotGeneratedAtIso)}</span>
          </div>
          <div className={styles.headerStatus}><small>Workspace status</small><strong>{REVIEW_STATUS_LABELS[workspace.reviewStatus]}</strong></div>
        </header>

        <nav className={styles.tabs} aria-label="Insurance workspace">
          {([['overview', 'Overview'], ['assets', 'Assets'], ['general', 'General Covers'], ['reports', 'Reports']] as Array<[Tab, string]>).map(([value, label]) => (
            <button className={tab === value ? styles.activeTab : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>
          ))}
        </nav>

        {tab === 'overview' ? (
          <section className={styles.overview}>
            <div className={styles.summaryGrid}>
              <article><span>Assets</span><strong>{workspace.assetCount}</strong><small>{completedCount} reviews completed</small></article>
              <article><span>Replacement value</span><strong>{money(workspace.totalReplacementValue)}</strong><small>From shared register snapshot</small></article>
              <article><span>Not insured</span><strong>{uninsuredCount}</strong><small>Recorded owner status</small></article>
              <article><span>Information required</span><strong>{informationCount}</strong><small>Broker review decisions</small></article>
            </div>
            <div className={styles.twoColumn}>
              <article className={styles.card}>
                <h2>Review setup</h2>
                <p>Choose the client profile to control the available general-cover checklist. Asset recommendations remain manual.</p>
                <label><span>Client profile</span><select value={workspace.clientProfile} onChange={(event) => void updateWorkspaceSettings({ clientProfile: event.target.value })}>{CLIENT_PROFILES.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label><span>Workspace status</span><select value={workspace.reviewStatus} onChange={(event) => void updateWorkspaceSettings({ reviewStatus: event.target.value })}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
              </article>
              <article className={styles.card}>
                <h2>Source register</h2>
                <dl><div><dt>Snapshot reference</dt><dd>{workspace.snapshotReference}</dd></div><div><dt>Generated</dt><dd>{dateLabel(workspace.snapshotGeneratedAtIso)}</dd></div><div><dt>Register value</dt><dd>{money(workspace.totalRegisterValue)}</dd></div><div><dt>Replacement value</dt><dd>{money(workspace.totalReplacementValue)}</dd></div></dl>
                <p className={styles.readOnlyNote}>Owner facts are read-only in this workspace. Broker review data is stored separately with an audit trail.</p>
              </article>
            </div>
            {workspace.ownerMessage ? <article className={styles.card}><h2>Owner message</h2><p>{workspace.ownerMessage}</p></article> : null}
          </section>
        ) : null}

        {tab === 'assets' ? (
          <section>
            <div className={styles.assetToolbar}>
              <label><span>Search assets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Asset, location, serial or policy section" /></label>
              <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{ASSET_CATEGORIES.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label>
              <label><span>Review</span><select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}><option value="all">All statuses</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
            </div>
            {selectedIds.length ? (
              <div className={styles.bulkBar}>
                <strong>{selectedIds.length} selected</strong>
                <input value={bulk.insurerName} onChange={(event) => setBulk({ ...bulk, insurerName: event.target.value })} placeholder="Insurer" />
                <input value={bulk.policyNumber} onChange={(event) => setBulk({ ...bulk, policyNumber: event.target.value })} placeholder="Policy number" />
                <input value={bulk.policySectionLabel} onChange={(event) => setBulk({ ...bulk, policySectionLabel: event.target.value })} placeholder="Policy section" />
                <select value={bulk.reviewStatus} onChange={(event) => setBulk({ ...bulk, reviewStatus: event.target.value })}><option value="">Keep review status</option><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>
                <button type="button" onClick={() => void applyBulk()} disabled={saving}>Apply</button>
              </div>
            ) : null}
            <div className={styles.assetTableWrap}>
              <table className={styles.assetTable}>
                <thead><tr><th><span className={styles.srOnly}>Select</span></th><th>Asset</th><th>Type / location</th><th>Current status</th><th>Policy section</th><th>Recommendation</th><th>Sum insured</th><th>Review</th><th /></tr></thead>
                <tbody>{visibleAssets.map((asset) => (
                  <tr key={asset.id}>
                    <td><input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleSelected(asset.id)} aria-label={`Select ${asset.title}`} /></td>
                    <td><strong>{asset.title}</strong><small>{asset.serialNumber || asset.registrationNumber || 'No serial recorded'}</small></td>
                    <td><strong>{asset.kind}</strong><small>{asset.location || 'No location supplied'}</small></td>
                    <td>{titleCase(asset.review.currentInsuranceStatus)}</td>
                    <td>{asset.review.policySectionLabel || '—'}</td>
                    <td>{titleCase(asset.review.recommendationStatus)}</td>
                    <td className={styles.numeric}>{money(asset.review.sumInsured)}</td>
                    <td>{REVIEW_STATUS_LABELS[asset.review.reviewStatus]}</td>
                    <td><button type="button" onClick={() => openAsset(asset)}>Review</button></td>
                  </tr>
                ))}</tbody>
              </table>
              {!visibleAssets.length ? <div className={styles.empty}>No assets match these filters.</div> : null}
            </div>
            <div className={styles.pagination}><span>{filteredAssets.length} assets · Page {page} of {pageCount}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Next</button></div></div>
          </section>
        ) : null}

        {tab === 'general' ? (
          <section className={styles.generalSection}>
            <header><div><h2>General covers</h2><p>Record non-asset covers and a manual broker recommendation for the selected client profile.</p></div><button type="button" onClick={() => void saveCovers()} disabled={saving}>Save all covers</button></header>
            {workspace.clientProfile === 'unclassified' ? <div className={styles.infoBox}>Select a client profile on Overview to narrow this checklist.</div> : null}
            <div className={styles.coverGrid}>{covers.map((cover, index) => (
              <article className={styles.coverCard} key={cover.key}>
                <h3>{cover.label}</h3>
                <div className={styles.formGrid}>
                  <label><span>Current status</span><select value={cover.status} onChange={(event) => changeCover(index, { status: event.target.value as InsuranceGeneralCoverReview['status'] })}>{OPTION_STATUS_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Broker recommendation</span><select value={cover.recommendationStatus} onChange={(event) => changeCover(index, { recommendationStatus: event.target.value as InsuranceGeneralCoverReview['recommendationStatus'] })}>{RECOMMENDATION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                  <label><span>Insurer</span><input value={cover.insurerName} onChange={(event) => changeCover(index, { insurerName: event.target.value })} /></label>
                  <label><span>Policy number</span><input value={cover.policyNumber} onChange={(event) => changeCover(index, { policyNumber: event.target.value })} /></label>
                  <label><span>Policy section</span><input value={cover.policySectionLabel} onChange={(event) => changeCover(index, { policySectionLabel: event.target.value })} /></label>
                  <label><span>Limit (ZAR)</span><input type="number" min="0" value={cover.limitAmount ?? ''} onChange={(event) => changeCover(index, { limitAmount: event.target.value ? Number(event.target.value) : null })} /></label>
                  {cover.status === 'excluded' ? <label><span>Exclusion reason</span><select value={cover.exclusionReasonKey} onChange={(event) => changeCover(index, { exclusionReasonKey: event.target.value })}>{EXCLUSION_REASONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}
                  <label className={styles.wide}><span>Recommendation rationale</span><textarea value={cover.recommendationNote} onChange={(event) => changeCover(index, { recommendationNote: event.target.value })} rows={2} /></label>
                  <label className={styles.wide}><span>Notes</span><textarea value={cover.notes} onChange={(event) => changeCover(index, { notes: event.target.value })} rows={2} /></label>
                </div>
              </article>
            ))}</div>
          </section>
        ) : null}

        {tab === 'reports' ? (
          <section className={styles.reports}>
            <div className={styles.reportGrid}>
              <article><h2>Summary report</h2><p>Landscape review schedule for client discussion and placement preparation.</p><button type="button" onClick={() => void generateReport('summary')} disabled={saving}>Generate summary</button></article>
              <article><h2>Detailed report</h2><p>Portrait report with every asset field, option decision, rationale, and general cover.</p><button type="button" onClick={() => void generateReport('detailed')} disabled={saving}>Generate detailed report</button></article>
            </div>
            <article className={styles.reportHistory}><h2>Report snapshots</h2><p>Each report is stored as an immutable revision of the recorded workspace data.</p>{workspace.reports.length ? <table><thead><tr><th>Reference</th><th>Type</th><th>Revision</th><th>Generated</th><th /></tr></thead><tbody>{workspace.reports.map((report) => <tr key={report.id}><td>{report.reference}</td><td>{titleCase(report.type)}</td><td>{report.revision}</td><td>{dateLabel(report.generatedAtIso)}</td><td><a href={`/api/insurance-reports/${report.id}`} target="_blank" rel="noreferrer">Open</a></td></tr>)}</tbody></table> : <div className={styles.empty}>No report snapshots generated yet.</div>}</article>
            <p className={styles.disclaimer}>This report reflects insurance information and recommendations recorded by the broker. Aim4price does not provide financial advice or independently confirm insurance cover.</p>
          </section>
        ) : null}
      </section>

      {draft ? (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null); }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-label={`Review ${draft.title}`}>
            <header><div><small>Asset review</small><h2>{draft.title}</h2><p>{draft.kind} · {draft.location || 'No location supplied'}</p></div><button type="button" onClick={() => setDraft(null)} aria-label="Close review">×</button></header>
            <div className={styles.ownerFacts}><h3>Owner-provided facts</h3><dl><div><dt>Register value</dt><dd>{money(draft.registerValue)}</dd></div><div><dt>Replacement value</dt><dd>{money(draft.replacementValue)}</dd></div><div><dt>Serial / registration</dt><dd>{[draft.serialNumber, draft.registrationNumber].filter(Boolean).join(' / ') || '—'}</dd></div><div><dt>Year / condition</dt><dd>{[draft.yearModel, draft.condition].filter(Boolean).join(' / ') || '—'}</dd></div></dl></div>
            <div className={styles.drawerBody}>
              <section><h3>Classification and current cover</h3><div className={styles.formGrid}>
                <label><span>Asset category</span><select value={draft.review.categoryKey} onChange={(event) => changeReview('categoryKey', event.target.value)}>{ASSET_CATEGORIES.map((category) => <option value={category.key} key={category.key}>{category.label}</option>)}</select></label>
                <label><span>Current insurance status</span><select value={draft.review.currentInsuranceStatus} onChange={(event) => changeReview('currentInsuranceStatus', event.target.value as InsuranceAssetReview['currentInsuranceStatus'])}>{CURRENT_INSURANCE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label><span>Insurer</span><input value={draft.review.insurerName} onChange={(event) => changeReview('insurerName', event.target.value)} /></label>
                <label><span>Policy number</span><input value={draft.review.policyNumber} onChange={(event) => changeReview('policyNumber', event.target.value)} /></label>
                <label><span>Policy section</span><input list="policy-sections" value={draft.review.policySectionLabel} onChange={(event) => changeReview('policySectionLabel', event.target.value)} /><datalist id="policy-sections">{categoryDefinition(draft.review.categoryKey).policySections.map((section) => <option value={section} key={section} />)}</datalist></label>
                <label><span>Renewal date</span><input type="date" value={draft.review.renewalDate} onChange={(event) => changeReview('renewalDate', event.target.value)} /></label>
                <label className={styles.wide}><span>Schedule description</span><textarea value={draft.review.scheduleDescription} onChange={(event) => changeReview('scheduleDescription', event.target.value)} rows={2} /></label>
              </div></section>
              <section><h3>Cover structure</h3><div className={styles.formGrid}>
                <label><span>Cover basis</span><input value={draft.review.coverBasis} onChange={(event) => changeReview('coverBasis', event.target.value)} placeholder="Replacement, market or agreed value" /></label>
                <label><span>Sum insured (ZAR)</span><input type="number" min="0" value={draft.review.sumInsured ?? ''} onChange={(event) => changeReview('sumInsured', event.target.value ? Number(event.target.value) : null)} /></label>
                <label><span>VAT basis</span><select value={draft.review.vatBasis} onChange={(event) => changeReview('vatBasis', event.target.value as InsuranceAssetReview['vatBasis'])}><option value="">Not recorded</option><option value="exclusive">Exclusive</option><option value="inclusive">Inclusive</option><option value="unknown">Unknown</option></select></label>
                <label><span>Scheduling treatment</span><select value={draft.review.schedulingTreatment} onChange={(event) => changeReview('schedulingTreatment', event.target.value as InsuranceAssetReview['schedulingTreatment'])}><option value="">Not recorded</option><option value="individual">Individual</option><option value="grouped">Grouped</option><option value="blanket">Blanket</option><option value="not_applicable">Not applicable</option></select></label>
                <label className={styles.wide}><span>Excess</span><input value={draft.review.excessText} onChange={(event) => changeReview('excessText', event.target.value)} placeholder="Record the applicable excess wording or amount" /></label>
                <label className={styles.wide}><span>Special conditions</span><textarea value={draft.review.specialConditions} onChange={(event) => changeReview('specialConditions', event.target.value)} rows={2} /></label>
              </div></section>
              <section><h3>Cover options</h3><div className={styles.optionTable}>{draft.review.options.map((option, index) => <div className={styles.optionRow} key={option.key}><div><strong>{option.label}</strong><small>{optionsForCategory(draft.review.categoryKey).find((definition) => definition.key === option.key)?.helpText}</small></div><select value={option.status} onChange={(event) => changeOption(index, { status: event.target.value as InsuranceOptionReview['status'] })}>{OPTION_STATUS_OPTIONS.map((choice) => <option value={choice.value} key={choice.value}>{choice.label}</option>)}</select>{option.status === 'excluded' ? <select value={option.exclusionReasonKey} onChange={(event) => changeOption(index, { exclusionReasonKey: event.target.value })}>{EXCLUSION_REASONS.map((reason) => <option value={reason.value} key={reason.value}>{reason.label}</option>)}</select> : <span /> }<input value={option.note} onChange={(event) => changeOption(index, { note: event.target.value })} placeholder="Option note" /></div>)}</div></section>
              <section><h3>Broker recommendation</h3><div className={styles.formGrid}>
                <label><span>Recommendation</span><select value={draft.review.recommendationStatus} onChange={(event) => changeReview('recommendationStatus', event.target.value as InsuranceAssetReview['recommendationStatus'])}>{RECOMMENDATION_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
                <label><span>Review status</span><select value={draft.review.reviewStatus} onChange={(event) => changeReview('reviewStatus', event.target.value as InsuranceAssetReview['reviewStatus'])}><option value="not_started">Not started</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select></label>
                {draft.review.recommendationStatus === 'exclude' ? <label><span>Exclusion reason</span><select value={draft.review.recommendationReasonKey} onChange={(event) => changeReview('recommendationReasonKey', event.target.value)}>{EXCLUSION_REASONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label> : null}
                <label className={styles.wide}><span>Recommendation rationale</span><textarea value={draft.review.recommendationNote} onChange={(event) => changeReview('recommendationNote', event.target.value)} rows={3} placeholder="Record the broker's rationale. Aim4price does not generate a recommendation." /></label>
                <label className={styles.wide}><span>Information required</span><textarea value={draft.review.informationRequiredNote} onChange={(event) => changeReview('informationRequiredNote', event.target.value)} rows={2} /></label>
              </div></section>
            </div>
            <footer><span>{dirty ? 'Unsaved changes · autosaving' : saving ? 'Saving…' : 'Saved to server'}</span><div><button type="button" onClick={() => setDraft(null)}>Close</button><button type="button" onClick={() => void saveAndNext()} disabled={saving}>Save and next</button></div></footer>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
