'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import type {
  InsuranceCommand,
  InsuranceFinancialTerm,
  InsuranceReportType,
  InsuranceWorkspaceAsset,
  InsuranceWorkspaceData,
} from '../../../lib/insurance-workspace-types';
import { getInsuranceWorkspaceReadiness } from '../../../lib/insurance-workspace-readiness';
import {
  InsuranceCoversPanel,
  InsuranceOverviewPanel,
  InsurancePoliciesPanel,
  InsuranceQuestionsPanel,
  InsuranceRiskObjectEditor,
} from './insurance-workspace-panels';
import styles from './workspace.module.css';

type StepId = 'setup' | 'assets' | 'covers' | 'policies' | 'questions' | 'finish';
type Notice = { tone: 'success' | 'error'; message: string };
type AssetView = 'guided' | 'browse';

const VAT_MULTIPLIER = 1.15;
const REQUIRED_STEPS: StepId[] = ['setup', 'assets', 'covers', 'policies'];
const WORKFLOW_STEPS: Array<{ id: StepId; title: string; shortTitle: string; description: string; optional?: boolean }> = [
  { id: 'setup', title: 'Confirm the client', shortTitle: 'Client', description: 'Confirm the client, locations and insured parties.' },
  { id: 'assets', title: 'Review the assets', shortTitle: 'Assets', description: 'Check each asset and confirm its insurance classification.' },
  { id: 'covers', title: 'Choose the cover plan', shortTitle: 'Cover plan', description: 'Review relevant cover suggestions and record decisions.' },
  { id: 'policies', title: 'Record policy evidence', shortTitle: 'Policy', description: 'Capture the actual schedule, sections, limits and excesses.' },
  { id: 'questions', title: 'Add supporting information', shortTitle: 'Supporting info', description: 'Record questions, notes and evidence when needed.', optional: true },
  { id: 'finish', title: 'Check and create the report', shortTitle: 'Finish', description: 'Resolve required items and generate the final report.' },
];

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

function vatIncluded(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * VAT_MULTIPLIER * 100) / 100;
}

function termValueVatIncluded(term: InsuranceFinancialTerm | undefined): number | null {
  const amount = asNumber(term?.amount);
  if (amount === null) return null;
  return term?.vatBasis === 'exclusive' ? vatIncluded(amount) : amount;
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
    .filter(Boolean).join(' · ') || titleCase(asset.kind);
}

function assetGps(asset: InsuranceWorkspaceAsset): { lat: number; lng: number } | null {
  const lat = asNumber(asset.snapshot.lastKnownLat);
  const lng = asNumber(asset.snapshot.lastKnownLng);
  return lat === null || lng === null ? null : { lat, lng };
}

function detailRows(asset: InsuranceWorkspaceAsset): Array<[string, string]> {
  const specs = asRecord(asset.snapshot.specsJson);
  return [
    ['Asset type', titleCase(asset.kind)],
    ['Location supplied by owner', asset.location || 'Unknown / not supplied'],
    ['Brand', asText(asset.snapshot.brandName) || '—'],
    ['Model', asText(asset.snapshot.modelName) || asText(asset.snapshot.typedModelName) || '—'],
    ['Year model', asset.yearModel ? String(asset.yearModel) : '—'],
    ['Condition', asset.condition ? titleCase(asset.condition) : '—'],
    ['Serial number', asset.serialNumber || '—'],
    ['Registration', asset.registrationNumber || '—'],
    ['Finance status', asText(specs.financeStatus) ? titleCase(asText(specs.financeStatus)) : '—'],
    ['Owner-provided insured value (VAT included)', money(vatIncluded(asNumber(asset.snapshot.insuredValueExVat)))],
    ['Register value (VAT included)', money(vatIncluded(asset.registerValue))],
    ['Replacement value (VAT included)', money(vatIncluded(asset.replacementValue))],
  ];
}

function workflowCompletion(workspace: InsuranceWorkspaceData): Record<StepId, boolean> {
  const readiness = getInsuranceWorkspaceReadiness(workspace);
  const supportingInfoUsed = workspace.evidence.length > 0 || workspace.notes.length > 0 || workspace.informationRequests.length > 0;
  return {
    setup: readiness.completion.setup,
    assets: readiness.completion.assets,
    covers: readiness.completion.covers,
    policies: readiness.completion.policies,
    questions: supportingInfoUsed && workspace.overview.openInformationRequestCount === 0,
    finish: readiness.ready && workspace.reports.length > 0,
  };
}

function initialStep(workspace: InsuranceWorkspaceData): StepId {
  const completion = workflowCompletion(workspace);
  return REQUIRED_STEPS.find((step) => !completion[step]) || 'finish';
}

export default function SharedRegisterWorkspace({ initialWorkspace }: { initialWorkspace: InsuranceWorkspaceData }) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [step, setStep] = useState<StepId>(() => initialStep(initialWorkspace));
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [saving, setSaving] = useState(false);
  const [assetIndex, setAssetIndex] = useState(() => Math.max(0, initialWorkspace.assets.findIndex((asset) => {
    const riskObject = initialWorkspace.riskObjects.find((entry) => entry.workspaceAssetId === asset.id);
    return !riskObject || riskObject.classificationStatus === 'unconfirmed';
  })));
  const [assetView, setAssetView] = useState<AssetView>('guided');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const contentRef = useRef<HTMLDivElement>(null);

  const completion = useMemo(() => workflowCompletion(workspace), [workspace]);
  const readiness = useMemo(() => getInsuranceWorkspaceReadiness(workspace), [workspace]);
  const currentStepIndex = WORKFLOW_STEPS.findIndex((entry) => entry.id === step);
  const completedRequiredCount = readiness.readyStepCount;
  const requiredReady = readiness.ready;
  const reviewedAssetCount = workspace.assets.filter((asset) => workspace.riskObjects.some((entry) => entry.workspaceAssetId === asset.id && entry.classificationStatus !== 'unconfirmed')).length;
  const canonicalAssessments = workspace.assessments.filter((assessment) => assessment.canonicalCoverKey);
  const assessedCoverCount = canonicalAssessments.filter((assessment) => assessment.currentCoverPosition !== 'unknown' && assessment.placementStage !== 'not_assessed').length;
  const policySectionCount = workspace.policies.reduce((total, policy) => total + policy.sections.length, 0);
  const scheduleItemCount = workspace.policies.reduce((total, policy) => total + policy.sections.reduce((sectionTotal, section) => sectionTotal + section.scheduleItems.length, 0), 0);
  const activeAsset = workspace.assets[Math.min(assetIndex, Math.max(0, workspace.assets.length - 1))];
  const kinds = useMemo(() => [...new Set(workspace.assets.map((asset) => asset.kind))].sort(), [workspace.assets]);
  const filteredAssets = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return workspace.assets.filter((asset) => {
      if (kindFilter !== 'all' && asset.kind !== kindFilter) return false;
      return !normalized || [asset.title, asset.kind, asset.location, asset.serialNumber, asset.registrationNumber]
        .join(' ').toLowerCase().includes(normalized);
    }).sort((a, b) => a.title.localeCompare(b.title));
  }, [workspace.assets, query, kindFilter]);

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
    if (!requiredReady) {
      setNotice({ tone: 'error', message: 'Complete the four required review steps before creating a report.' });
      return;
    }
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

  function goToStep(nextStep: StepId) {
    setStep(nextStep);
    setShowAllSteps(false);
    setNotice(null);
    window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function goToAsset(index: number) {
    setAssetIndex(Math.min(Math.max(index, 0), Math.max(0, workspace.assets.length - 1)));
    setAssetView('guided');
    window.requestAnimationFrame(() => contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  async function continueAfterAssetSave() {
    if (assetIndex < workspace.assets.length - 1) {
      goToAsset(assetIndex + 1);
      return;
    }
    const refreshed = await runCommand({ operation: 'refresh_suggestions' }, 'All assets reviewed. Cover suggestions are ready.');
    if (refreshed) goToStep('covers');
  }

  const stepGuidance: Record<StepId, { body: string; progress: string }> = {
    setup: { body: 'Confirm three basics: the client profile, at least one real location, and the insured party.', progress: `${workspace.locations.filter((location) => !location.isUnknown).length} saved locations · ${workspace.parties.length} parties` },
    assets: { body: 'Check the suggested classification, saved location and values. Confirm it, then move to the next asset.', progress: `${reviewedAssetCount} of ${workspace.assets.length} reviewed` },
    covers: { body: 'Start with system suggestions. Decide what is relevant before opening the full catalogue.', progress: `${assessedCoverCount} of ${canonicalAssessments.length} decided` },
    policies: { body: 'Use the actual insurer schedule. Record each amount exactly as shown and confirm whether it is VAT-inclusive or VAT-exclusive.', progress: `${workspace.policies.length} policies · ${policySectionCount} sections · ${scheduleItemCount} items` },
    questions: { body: 'Questions created from missing information appear here. Record the client response and keep notes and evidence with the review.', progress: `${workspace.overview.openInformationRequestCount} open questions · ${workspace.evidence.length} evidence items` },
    finish: { body: 'The readiness check shows exactly what remains. Reports unlock when all required steps are ready.', progress: `${completedRequiredCount} of ${REQUIRED_STEPS.length} required steps ready` },
  };

  const nextStep = WORKFLOW_STEPS[Math.min(WORKFLOW_STEPS.length - 1, currentStepIndex + 1)];
  const canContinue = completion[step] || step === 'questions';

  return <main className={styles.page}>
    <AppHeader active="shared-registers" />
    <section className={styles.shell}>
      {notice ? <div className={`${styles.notice} ${notice.tone === 'error' ? styles.noticeError : ''}`}>{notice.message}</div> : null}
      <div className={styles.backRow}><Link href="/shared-registers">← Shared Registers</Link><span>{saving ? 'Saving…' : '✓ All changes saved'}</span></div>

      <header className={styles.compactWorkspaceHeader}>
        <div><small>Insurance review</small><h1>{workspace.clientName}</h1><p>{workspace.clientMeta || 'Client insurance workspace'}</p></div>
        <div className={styles.requiredProgress}><strong>{completedRequiredCount}/{REQUIRED_STEPS.length}</strong><span>required steps ready</span></div>
      </header>

      <section className={styles.currentTaskCard} aria-label="Current review task">
        <div className={styles.currentTaskTop}>
          <div><span>Step {currentStepIndex + 1} of {WORKFLOW_STEPS.length}{WORKFLOW_STEPS[currentStepIndex].optional ? ' · Optional' : ''}</span><h2>{WORKFLOW_STEPS[currentStepIndex].title}</h2><p>{stepGuidance[step].body}</p></div>
          <strong>{stepGuidance[step].progress}</strong>
        </div>
        <div className={styles.progressTrack}><span style={{ width: `${(completedRequiredCount / REQUIRED_STEPS.length) * 100}%` }} /></div>
      </section>

      <button className={`${styles.allStepsToggle} ${showAllSteps ? styles.allStepsToggleOpen : ''}`} type="button" onClick={() => setShowAllSteps((current) => !current)} aria-expanded={showAllSteps} aria-controls="insurance-step-menu"><span className={styles.stepsIcon} aria-hidden="true">☷</span><span>{showAllSteps ? 'Close steps' : 'View all steps'}</span><strong>{currentStepIndex + 1}/{WORKFLOW_STEPS.length}</strong></button>
      {showAllSteps ? <><button className={styles.stepMenuBackdrop} data-website-overlay type="button" aria-label="Close step menu" onClick={() => setShowAllSteps(false)} /><aside className={styles.stepMenuPanel} id="insurance-step-menu" aria-label="Insurance review steps">
        <header><div><span>Insurance review</span><h2>All steps</h2><p>Select a step to open it. Your saved work will remain in place.</p></div><button type="button" onClick={() => setShowAllSteps(false)} aria-label="Close step menu">×</button></header>
        <nav className={styles.stepper}>
          {WORKFLOW_STEPS.map((entry, index) => {
            const isActive = entry.id === step;
            const isComplete = completion[entry.id];
            const status = isComplete ? 'Ready' : entry.optional ? 'Optional' : isActive ? 'In progress' : 'Still needed';
            return <button className={`${styles.stepButton} ${isActive ? styles.activeStep : ''} ${isComplete ? styles.completeStep : ''}`} type="button" key={entry.id} onClick={() => { setShowAllSteps(false); goToStep(entry.id); }} aria-current={isActive ? 'step' : undefined}>
              <span className={styles.stepNumber}>{isComplete ? '✓' : index + 1}</span><span><strong>{entry.shortTitle}</strong><small>{status}</small></span>
            </button>;
          })}
        </nav>
      </aside></> : null}

      <div ref={contentRef} className={styles.workflowContent}>
        {step === 'setup' ? <section className={styles.overview}>
          {workspace.ownerMessage ? <article className={styles.clientMessage}><span>Message from client</span><p>{workspace.ownerMessage}</p></article> : null}
          <InsuranceOverviewPanel workspace={workspace} runCommand={runCommand} />
        </section> : null}

        {step === 'assets' ? <section className={styles.assetsSection}>
          <div className={styles.viewSwitch} role="group" aria-label="Asset view">
            <button className={assetView === 'guided' ? styles.activeView : ''} type="button" onClick={() => setAssetView('guided')}>Review next asset</button>
            <button className={assetView === 'browse' ? styles.activeView : ''} type="button" onClick={() => setAssetView('browse')}>Asset checklist</button>
          </div>

          {assetView === 'guided' ? <>{activeAsset ? (() => {
            const riskObject = workspace.riskObjects.find((entry) => entry.workspaceAssetId === activeAsset.id);
            const photos = assetPhotos(activeAsset);
            const gps = assetGps(activeAsset);
            const sumTerm = workspace.assessments.filter((assessment) => assessment.assetIds.includes(activeAsset.id)).flatMap((assessment) => assessment.financialTerms).find((term) => term.termType === 'sum_insured' && term.amount !== null);
            const reviewed = Boolean(riskObject && riskObject.classificationStatus !== 'unconfirmed');
            return <>
              <div className={styles.assetReviewNav}>
                <button type="button" onClick={() => goToAsset(assetIndex - 1)} disabled={assetIndex <= 0}>← Previous</button>
                <label><span>Reviewing asset {assetIndex + 1} of {workspace.assets.length}</span><select value={activeAsset.id} onChange={(event) => goToAsset(workspace.assets.findIndex((asset) => asset.id === event.target.value))}>{workspace.assets.map((asset, index) => <option value={asset.id} key={asset.id}>{index + 1}. {asset.title}</option>)}</select></label>
                <button type="button" onClick={() => goToAsset(assetIndex + 1)} disabled={assetIndex >= workspace.assets.length - 1}>Next asset →</button>
              </div>

              <article className={`${styles.assetCard} ${styles.focusedAssetCard}`}>
                <div className={styles.assetReviewStatus}><span className={reviewed ? styles.statusComplete : styles.statusPending}>{reviewed ? '✓ Reviewed' : 'Next action: confirm the classification below'}</span><span>{photos.length} photo{photos.length === 1 ? '' : 's'} shared</span></div>
                <div className={styles.assetHero}>
                  <div className={styles.assetIdentity}><small>{titleCase(activeAsset.kind)}</small><h2>{activeAsset.title}</h2><p>{assetMeta(activeAsset)}</p></div>
                  <div className={styles.locationCard}>
                    <span>Saved location</span><strong>{activeAsset.location || (gps ? 'GPS location available' : 'Not supplied')}</strong>
                    {gps ? <><small>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</small><a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noreferrer">Open saved GPS in Maps ↗</a></> : <small>No GPS coordinates were shared for this asset.</small>}
                  </div>
                </div>

                <div className={styles.valueComparison}>
                  <div><small>Replacement value</small><strong>{money(vatIncluded(activeAsset.replacementValue))}</strong><span>VAT included · Register fact</span></div>
                  <div><small>Owner-provided insured value</small><strong>{money(vatIncluded(asNumber(activeAsset.snapshot.insuredValueExVat)))}</strong><span>VAT included · Not proof of cover</span></div>
                  <div><small>Recorded sum insured</small><strong>{money(termValueVatIncluded(sumTerm))}</strong><span>VAT included · Policy evidence</span></div>
                </div>

                {photos.length ? <section className={styles.assetPhotoGallery}><header><div><span>Shared photos</span><strong>{photos.length} available</strong></div><small>Select any photo to open the full image.</small></header><div>{photos.map((photo, index) => <a href={photo} target="_blank" rel="noreferrer" key={`${photo}-${index}`}><img src={photo} alt={`${activeAsset.title} photo ${index + 1}`} /><span>Photo {index + 1}</span></a>)}</div></section> : <div className={styles.photoPlaceholder}>No photos were shared for this asset.</div>}

                {riskObject ? <InsuranceRiskObjectEditor key={`${riskObject.id}-${riskObject.version}`} riskObject={riskObject} locations={workspace.locations} runCommand={runCommand} onSaved={continueAfterAssetSave} /> : <p className={styles.infoBox}>A suggested classification is not available yet. Refresh the review and try again.</p>}

                <details className={styles.assetDisclosure}>
                  <summary>View serial number, registration and all asset facts</summary>
                  <div className={styles.detailsPanel}><h3>Owner-authorised asset details</h3><dl>{detailRows(activeAsset).map(([rowLabel, value]) => <div key={rowLabel}><dt>{rowLabel}</dt><dd>{value}</dd></div>)}</dl></div>
                </details>
              </article>
            </>;
          })() : <div className={styles.empty}>No assets were shared for this workspace.</div>}</> : <>
            <div className={styles.assetToolbar}>
              <label className={styles.assetSearch}><span>Find an asset</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, location, serial or registration" /></label>
              <label><span>Asset type</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">All asset types</option>{kinds.map((kind) => <option value={kind} key={kind}>{titleCase(kind)}</option>)}</select></label>
            </div>
            <div className={styles.assetBrowseList}>{filteredAssets.map((asset) => {
              const index = workspace.assets.findIndex((entry) => entry.id === asset.id);
              const riskObject = workspace.riskObjects.find((entry) => entry.workspaceAssetId === asset.id);
              const reviewed = Boolean(riskObject && riskObject.classificationStatus !== 'unconfirmed');
              const photos = assetPhotos(asset);
              const gps = assetGps(asset);
              return <button type="button" key={asset.id} onClick={() => goToAsset(index)}>{photos[0] ? <img src={photos[0]} alt="" /> : <span className={styles.assetListPlaceholder} /> }<span className={reviewed ? styles.statusComplete : styles.statusPending}>{reviewed ? '✓' : '!'}</span><span><strong>{asset.title}</strong><small>{gps ? `GPS: ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : asset.location || 'Location not supplied'} · {assetMeta(asset)}</small></span><span>{reviewed ? 'Review again' : 'Review now'} →</span></button>;
            })}{!filteredAssets.length ? <div className={styles.empty}>No assets match the current filters.</div> : null}</div>
          </>}
        </section> : null}

        {step === 'covers' ? <InsuranceCoversPanel workspace={workspace} assets={workspace.assets} runCommand={runCommand} /> : null}
        {step === 'policies' ? <InsurancePoliciesPanel workspace={workspace} assets={workspace.assets} runCommand={runCommand} /> : null}
        {step === 'questions' ? <InsuranceQuestionsPanel workspace={workspace} runCommand={runCommand} /> : null}
        {step === 'finish' ? <section className={styles.reports}>
          <article className={styles.readinessCard}>
            <header><div><span>Required readiness check</span><h2>{requiredReady ? 'Everything required is ready' : 'Complete the highlighted items first'}</h2></div><strong>{completedRequiredCount}/{REQUIRED_STEPS.length} ready</strong></header>
            <div className={styles.readinessList}>{WORKFLOW_STEPS.filter((entry) => REQUIRED_STEPS.includes(entry.id)).map((entry) => {
              const issues = readiness.issues.filter((issue) => issue.step === entry.id);
              return <button type="button" key={entry.id} onClick={() => goToStep(entry.id)}><span className={completion[entry.id] ? styles.statusComplete : styles.statusPending}>{completion[entry.id] ? '✓' : '!'}</span><span><strong>{entry.title}</strong><small>{completion[entry.id] ? 'Ready' : issues.slice(0, 3).map((issue) => issue.title).join(' · ')}{issues.length > 3 ? ` · +${issues.length - 3} more` : ''}</small></span><span>{completion[entry.id] ? 'Review' : 'Fix now'} →</span></button>;
            })}</div>
            <button className={styles.optionalSupportLink} type="button" onClick={() => goToStep('questions')}><span>Client questions and supporting information</span><strong>{workspace.overview.openInformationRequestCount ? `${workspace.overview.openInformationRequestCount} need attention` : completion.questions ? '✓ Added and resolved' : 'Add notes or evidence if needed'} →</strong></button>
          </article>
          <div className={styles.reportGrid}>
            <article><span>Recommended</span><h2>Client summary</h2><p>A concise, client-ready view of the cover position, values and outstanding information.</p><button type="button" onClick={() => void generateReport('summary')} disabled={saving || !requiredReady}>{requiredReady ? 'Create summary report' : 'Complete required steps first'}</button></article>
            <article><span>Full working record</span><h2>Detailed report</h2><p>The policy hierarchy, schedule links, VAT-inclusive values, limits, excesses and evidence trail.</p><button type="button" onClick={() => void generateReport('detailed')} disabled={saving || !requiredReady}>{requiredReady ? 'Create detailed report' : 'Complete required steps first'}</button></article>
          </div>
          <article className={styles.reportHistory}><h2>Previous reports</h2><p>Previous reports do not mark the current review complete. Create a new report only when the readiness check is green.</p>{workspace.reports.length ? <div className={styles.reportList}>{workspace.reports.map((report) => <div key={report.id}><div><strong>{titleCase(report.type)} report</strong><small>Revision {report.revision} · {dateLabel(report.generatedAtIso)}</small></div><a href={`/api/insurance-reports/${report.id}`} target="_blank" rel="noreferrer">Open report</a></div>)}</div> : <div className={styles.empty}>No reports have been generated yet.</div>}</article>
          <p className={styles.disclaimer}>System suggestions are areas to consider, not confirmation of cover. Only a recorded human decision and supporting source can confirm the current position.</p>
        </section> : null}

        <footer className={styles.workflowFooter}>
          <button type="button" onClick={() => goToStep(WORKFLOW_STEPS[Math.max(0, currentStepIndex - 1)].id)} disabled={currentStepIndex === 0}>← {currentStepIndex > 0 ? WORKFLOW_STEPS[currentStepIndex - 1].shortTitle : 'Previous'}</button>
          <div><span>{completion[step] ? '✓ This step is ready' : step === 'questions' ? 'Optional — use only when needed' : 'Complete the main action above to continue'}</span><small>Your saved changes are kept automatically.</small></div>
          <button className={styles.primaryButton} type="button" onClick={() => goToStep(nextStep.id)} disabled={currentStepIndex === WORKFLOW_STEPS.length - 1 || !canContinue}>{currentStepIndex < WORKFLOW_STEPS.length - 1 ? `${canContinue ? 'Continue to' : 'Finish this step for'} ${nextStep.shortTitle} →` : 'Review complete'}</button>
        </footer>
      </div>
    </section>
  </main>;
}

