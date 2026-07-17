'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import type {
  InsuranceCommand,
  InsuranceReportType,
  InsuranceWorkspaceAsset,
  InsuranceWorkspaceData,
} from '../../../lib/insurance-workspace-types';
import {
  InsuranceCoversPanel,
  InsuranceOverviewPanel,
  InsurancePoliciesPanel,
  InsuranceQuestionsPanel,
  InsuranceRiskObjectEditor,
} from './insurance-workspace-panels';
import styles from './workspace.module.css';

type Tab = 'overview' | 'assets' | 'covers' | 'policies' | 'questions' | 'reports';
type Notice = { tone: 'success' | 'error'; message: string };

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
  if (value === null || value === undefined) return 'Not recorded';
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

function assetPhotos(asset: InsuranceWorkspaceAsset): string[] {
  const snapshotPhotos = Array.isArray(asset.snapshot.photos) ? asset.snapshot.photos : [];
  return [...new Set([asset.photoUrl, ...snapshotPhotos]
    .map((value) => asText(value))
    .filter((value) => Boolean(value) && (value.startsWith('/') || value.startsWith('https://') || value.startsWith('http://') || value.startsWith('data:image/'))))];
}

function assetMeta(asset: InsuranceWorkspaceAsset): string {
  const brand = asText(asset.snapshot.brandName);
  const model = asText(asset.snapshot.modelName) || asText(asset.snapshot.typedModelName);
  const hours = asNumber(asset.snapshot.hours);
  return [brand, model, asset.yearModel, hours !== null ? `${new Intl.NumberFormat('en-ZA').format(hours)} hours` : '', titleCase(asset.condition)]
    .filter(Boolean).join(' · ') || asset.kind;
}

function detailRows(asset: InsuranceWorkspaceAsset): Array<[string, string]> {
  const specs = asRecord(asset.snapshot.specsJson);
  const lat = asNumber(asset.snapshot.lastKnownLat);
  const lng = asNumber(asset.snapshot.lastKnownLng);
  const rows: Array<[string, string]> = [
    ['Asset type', asset.kind],
    ['Location supplied by owner', asset.location || 'Unknown / not supplied'],
    ['Brand', asText(asset.snapshot.brandName) || '—'],
    ['Model', asText(asset.snapshot.modelName) || asText(asset.snapshot.typedModelName) || '—'],
    ['Year model', asset.yearModel ? String(asset.yearModel) : '—'],
    ['Condition', asset.condition ? titleCase(asset.condition) : '—'],
    ['Serial number', asset.serialNumber || '—'],
    ['Registration', asset.registrationNumber || '—'],
    ['Finance status', asText(specs.financeStatus) ? titleCase(asText(specs.financeStatus)) : '—'],
    ['Owner-provided insured value', money(asNumber(asset.snapshot.insuredValueExVat))],
    ['Register value', money(asset.registerValue)],
    ['Replacement value', money(asset.replacementValue)],
  ];
  if (lat !== null && lng !== null) rows.splice(2, 0, ['Map coordinates', `${lat.toFixed(6)}, ${lng.toFixed(6)}`]);
  return rows;
}

export default function SharedRegisterWorkspace({ initialWorkspace }: { initialWorkspace: InsuranceWorkspaceData }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [tab, setTab] = useState<Tab>('overview');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  const [photoIndexByAsset, setPhotoIndexByAsset] = useState<Record<string, number>>({});
  const pageSize = 20;

  const kinds = useMemo(() => [...new Set(workspace.assets.map((asset) => asset.kind))].sort(), [workspace.assets]);
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspace.assets.filter((asset) => {
      if (kindFilter !== 'all' && asset.kind !== kindFilter) return false;
      return !normalized || [asset.title, asset.kind, asset.location, asset.serialNumber, asset.registrationNumber]
        .join(' ').toLowerCase().includes(normalized);
    }).sort((a, b) => (a.location || 'Unknown / not supplied').localeCompare(b.location || 'Unknown / not supplied') || a.title.localeCompare(b.title));
  }, [workspace.assets, query, kindFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredAssets.length / pageSize));
  const visibleAssets = filteredAssets.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [query, kindFilter]);

  async function readWorkspace(response: Response): Promise<InsuranceWorkspaceData> {
    const payload = (await response.json()) as { workspace?: InsuranceWorkspaceData; error?: string };
    if (!response.ok || !payload.workspace) throw new Error(payload.error || 'The insurance workspace could not be saved.');
    return payload.workspace;
  }

  async function runCommand(command: InsuranceCommand, successMessage = 'Insurance workspace updated.'): Promise<boolean> {
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command),
      });
      setWorkspace(await readWorkspace(response));
      setNotice({ tone: 'success', message: successMessage });
      return true;
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The insurance workspace could not be updated.' });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function generateReport(type: InsuranceReportType) {
    setSaving(true);
    try {
      const response = await fetch(`/api/insurance-workspaces/${workspace.id}/reports`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error || 'The report could not be generated.');
      setWorkspace(await readWorkspace(await fetch(`/api/insurance-workspaces/${workspace.id}`)));
      window.open(payload.url, '_blank', 'noopener,noreferrer');
      setNotice({ tone: 'success', message: `${titleCase(type)} report generated.` });
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'The report could not be generated.' });
    } finally {
      setSaving(false);
    }
  }

  return <main className={styles.page}>
    <AppHeader active="shared-registers" />
    <section className={styles.shell}>
      {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}>{notice.message}</div> : null}
      <div className={styles.backRow}><Link href="/shared-registers">← Shared Registers</Link><span>{saving ? 'Saving…' : 'Saved'}</span></div>
      <header className={styles.workspaceHeader}>
        <div><h1>{workspace.clientName}</h1><p>{workspace.clientMeta || 'Insurance review workspace'}</p></div>
        <div className={styles.headerStatus}><small>Workspace status</small><strong>{titleCase(workspace.reviewStatus)}</strong></div>
      </header>

      <nav className={styles.tabs} aria-label="Insurance workspace">
        {([['overview', 'Overview'], ['assets', 'Locations & Assets'], ['covers', 'Covers & Exposures'], ['policies', 'Policies & Schedule'], ['questions', 'Questions & Notes'], ['reports', 'Reports']] as Array<[Tab, string]>).map(([value, label]) => (
          <button className={tab === value ? styles.activeTab : ''} type="button" key={value} onClick={() => setTab(value)}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' ? <section className={styles.overview}>
        <InsuranceOverviewPanel workspace={workspace} runCommand={runCommand} />
        {workspace.ownerMessage ? <article className={styles.card}><h2>Message from client</h2><p>{workspace.ownerMessage}</p></article> : null}
      </section> : null}

      {tab === 'assets' ? <section className={styles.assetsSection}>
        <div className={styles.assetToolbar}>
          <label className={styles.assetSearch}><span className={styles.srOnly}>Search assets</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by asset, location or serial" /></label>
          <label><span className={styles.srOnly}>Filter asset type</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">All asset types</option>{kinds.map((kind) => <option value={kind} key={kind}>{kind}</option>)}</select></label>
        </div>
        <div className={styles.assetList}>{visibleAssets.map((asset, assetIndex) => {
          const isExpanded = expandedAssetId === asset.id;
          const photos = assetPhotos(asset);
          const photoIndex = Math.min(photoIndexByAsset[asset.id] ?? 0, Math.max(0, photos.length - 1));
          const locationLabel = asset.location || 'Unknown / not supplied';
          const previousLocation = assetIndex > 0 ? visibleAssets[assetIndex - 1].location || 'Unknown / not supplied' : '';
          const sumTerm = workspace.assessments.filter((assessment) => assessment.assetIds.includes(asset.id))
            .flatMap((assessment) => assessment.financialTerms).find((term) => term.termType === 'sum_insured' && term.amount !== null);
          const riskObject = workspace.riskObjects.find((entry) => entry.workspaceAssetId === asset.id);
          return <Fragment key={asset.id}>
            {assetIndex === 0 || locationLabel !== previousLocation ? <div className={styles.locationHeading}><span>Location</span><h2>{locationLabel}</h2></div> : null}
            <article className={`${styles.assetCard} ${isExpanded ? styles.assetCardExpanded : ''}`}>
              <div className={styles.assetHeader}>
                <div className={styles.assetTitleBlock}><h2>{asset.title}</h2><p>{assetMeta(asset)}</p><span>{locationLabel}</span></div>
                <div className={styles.assetHeaderAside}>
                  <div className={styles.valueComparison}>
                    <div><small>Replacement value</small><strong>{money(asset.replacementValue)}</strong><span>Register fact</span></div>
                    <div><small>Owner-provided insured value</small><strong>{money(asNumber(asset.snapshot.insuredValueExVat))}</strong><span>Not proof of current cover</span></div>
                    <div><small>Recorded sum insured</small><strong>{money(sumTerm?.amount === null || sumTerm?.amount === undefined ? null : Number(sumTerm.amount))}</strong><span>Policy or broker evidence</span></div>
                  </div>
                  <button className={styles.viewButton} type="button" onClick={() => setExpandedAssetId((current) => current === asset.id ? null : asset.id)}>{isExpanded ? 'Hide details' : 'View details'}</button>
                </div>
              </div>
              {riskObject ? <InsuranceRiskObjectEditor key={`${riskObject.id}-${riskObject.version}`} riskObject={riskObject} locations={workspace.locations} runCommand={runCommand} /> : null}
              {isExpanded ? <div className={styles.assetDetails}>
                <div className={styles.photoPanel}>{photos.length ? <><a className={styles.mainPhoto} href={photos[photoIndex]} target="_blank" rel="noreferrer"><img src={photos[photoIndex]} alt={`${asset.title} photo`} /></a>{photos.length > 1 ? <div className={styles.photoThumbs}>{photos.map((photo, index) => <button className={index === photoIndex ? styles.activeThumb : ''} type="button" key={photo} onClick={() => setPhotoIndexByAsset((current) => ({ ...current, [asset.id]: index }))}><img src={photo} alt={`${asset.title} thumbnail ${index + 1}`} /></button>)}</div> : null}</> : <div className={styles.photoPlaceholder}>No photo shared</div>}</div>
                <div className={styles.detailsPanel}><h3>Owner-authorised asset details</h3><dl>{detailRows(asset).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
              </div> : null}
            </article>
          </Fragment>;
        })}{!visibleAssets.length ? <div className={styles.empty}>No assets match the current filters.</div> : null}</div>
        {pageCount > 1 ? <div className={styles.pagination}><span>{filteredAssets.length} assets · Page {page} of {pageCount}</span><div><button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>Previous</button><button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={page === pageCount}>Next</button></div></div> : null}
      </section> : null}

      {tab === 'covers' ? <InsuranceCoversPanel workspace={workspace} assets={workspace.assets} runCommand={runCommand} /> : null}
      {tab === 'policies' ? <InsurancePoliciesPanel workspace={workspace} assets={workspace.assets} runCommand={runCommand} /> : null}
      {tab === 'questions' ? <InsuranceQuestionsPanel workspace={workspace} runCommand={runCommand} /> : null}
      {tab === 'reports' ? <section className={styles.reports}>
        <div className={styles.reportGrid}>
          <article><h2>Summary report</h2><p>A client-ready snapshot of source revision, current-cover evidence, areas to consider, values and outstanding questions.</p><button type="button" onClick={() => void generateReport('summary')} disabled={saving}>Generate summary</button></article>
          <article><h2>Detailed report</h2><p>Includes policy hierarchy, schedule links, components, structured limits, excesses, provenance and unresolved information.</p><button type="button" onClick={() => void generateReport('detailed')} disabled={saving}>Generate detailed report</button></article>
        </div>
        <article className={styles.reportHistory}><h2>Previous reports</h2>{workspace.reports.length ? <div className={styles.reportList}>{workspace.reports.map((report) => <div key={report.id}><div><strong>{titleCase(report.type)} report</strong><small>Revision {report.revision} · {dateLabel(report.generatedAtIso)}</small></div><a href={`/api/insurance-reports/${report.id}`} target="_blank" rel="noreferrer">Open report</a></div>)}</div> : <div className={styles.empty}>No reports have been generated yet.</div>}</article>
        <p className={styles.disclaimer}>System-generated items are labelled as areas to consider. Only explicit human action with a recorded source can confirm current cover or a broker recommendation. Private broker notes are excluded.</p>
      </section> : null}
    </section>
  </main>;
}
