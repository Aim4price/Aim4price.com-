'use client';

import { useMemo, useState, type ChangeEvent } from 'react';
import {
  INSURANCE_COVER_CATALOGUE,
  INSURANCE_INDUSTRY_PROFILES,
  INSURANCE_REGULATORY_CLASSES,
  type InsuranceClientSegment,
  type InsuranceIndustryProfileKey,
} from '../../../lib/insurance-cover-catalogue';
import type { InsuranceWorkspaceAsset } from '../../../lib/insurance-workspace-types';
import type {
  InsuranceCurrentCoverPosition,
  InsurancePlacementStage,
  InsuranceCommand,
  InsuranceCoverAssessment,
  InsuranceEvidence,
  InsuranceLocation,
  InsuranceRiskObject,
  InsuranceWorkspaceData,
} from '../../../lib/insurance-workspace-types';
import styles from './workspace.module.css';

type RunCommand = (command: InsuranceCommand, successMessage?: string) => Promise<boolean>;

function label(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value: string | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function money(value: string | number | null | undefined, currency = 'ZAR'): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'Not recorded';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(parsed);
}

const currentCoverOptions: Array<{ value: InsuranceCurrentCoverPosition; label: string }> = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'not_recorded', label: 'Not recorded' },
  { value: 'confirmed_included', label: 'Confirmed included' },
  { value: 'confirmed_excluded', label: 'Confirmed excluded' },
  { value: 'covered_elsewhere', label: 'Covered elsewhere' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const placementOptions: Array<{ value: InsurancePlacementStage; label: string }> = [
  { value: 'not_assessed', label: 'Not assessed' },
  { value: 'area_to_consider', label: 'Area to consider' },
  { value: 'information_required', label: 'Information required' },
  { value: 'quote_requested', label: 'Quote requested' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'broker_recommended', label: 'Broker recommended' },
  { value: 'client_accepted', label: 'Client accepted' },
  { value: 'client_declined', label: 'Client declined' },
  { value: 'insurer_declined', label: 'Insurer declined' },
  { value: 'not_taken', label: 'Not taken' },
  { value: 'not_applicable', label: 'Not applicable' },
];

export function InsuranceOverviewPanel({ workspace, runCommand }: { workspace: InsuranceWorkspaceData; runCommand: RunCommand }) {
  const [setupView, setSetupView] = useState<'classification' | 'locations' | 'parties' | 'source'>(() => workspace.segments.length === 0 ? 'classification' : workspace.locations.length === 0 ? 'locations' : workspace.parties.length === 0 ? 'parties' : 'source');
  const [segments, setSegments] = useState<InsuranceClientSegment[]>(workspace.segments);
  const [industries, setIndustries] = useState<InsuranceIndustryProfileKey[]>(workspace.industryProfiles);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationUse, setLocationUse] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyType, setPartyType] = useState<'person' | 'organisation' | 'trust' | 'estate' | 'other'>('organisation');
  const [partyRole, setPartyRole] = useState<'insured' | 'owner' | 'financier_mortgagee' | 'beneficiary' | 'operator' | 'custodian' | 'principal' | 'contractor'>('insured');
  const [partyRoleContext, setPartyRoleContext] = useState('');
  const latestSnapshot = workspace.snapshotRevisions[0];

  function toggleSegment(segment: InsuranceClientSegment) {
    setSegments((current) => current.includes(segment) ? current.filter((entry) => entry !== segment) : [...current, segment]);
    if (segment === 'commercial' && segments.includes('commercial')) setIndustries([]);
  }

  function toggleIndustry(industry: InsuranceIndustryProfileKey) {
    setIndustries((current) => current.includes(industry) ? current.filter((entry) => entry !== industry) : [...current, industry]);
  }

  return <section>
    <nav className={styles.substepNav} aria-label="Client setup sections">
      <button className={setupView === 'classification' ? styles.activeView : ''} type="button" onClick={() => setSetupView('classification')}>1. Classification {workspace.segments.length ? '✓' : ''}</button>
      <button className={setupView === 'locations' ? styles.activeView : ''} type="button" onClick={() => setSetupView('locations')}>2. Locations ({workspace.locations.length})</button>
      <button className={setupView === 'parties' ? styles.activeView : ''} type="button" onClick={() => setSetupView('parties')}>3. Parties ({workspace.parties.length})</button>
      <button className={setupView === 'source' ? styles.activeView : ''} type="button" onClick={() => setSetupView('source')}>4. Source check</button>
    </nav>

    {setupView === 'classification' ? <article className={styles.card}>
        <h2>Client classification</h2>
        <p>First identify whether this is a domestic or commercial review. For commercial clients, select every industry profile that applies.</p>
        <div className={styles.checkGrid}>
          {(['domestic', 'commercial'] as InsuranceClientSegment[]).map((segment) => <label className={styles.checkCard} key={segment}><input type="checkbox" checked={segments.includes(segment)} onChange={() => toggleSegment(segment)} /><span><strong>{label(segment)}</strong><small>Top-level client segment</small></span></label>)}
        </div>
        {segments.includes('commercial') ? <div className={styles.industryGrid}>{INSURANCE_INDUSTRY_PROFILES.map((industry) => <label className={styles.compactCheck} key={industry.key}><input type="checkbox" checked={industries.includes(industry.key)} onChange={() => toggleIndustry(industry.key)} /><span>{industry.label}</span></label>)}</div> : <p className={styles.infoBox}>Choose Commercial to record one or more industry profiles.</p>}
        <button className={styles.primaryButton} type="button" disabled={!segments.length} onClick={() => void runCommand({ operation: 'update_profile', expectedVersion: workspace.version, segments, industryProfiles: segments.includes('commercial') ? industries : [] }, 'Client classification saved.').then((ok) => { if (ok) setSetupView('locations'); })}>Save and continue to locations</button>
      </article> : null}

    {setupView === 'locations' ? <article className={styles.card}>
        <h2>Workspace locations</h2>
        <p>Add the sites needed for risk and schedule links. This does not change the owner&apos;s original location text.</p>
        <div className={styles.formGrid}>
          <label><span>Location / site label</span><input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} /></label>
          <label><span>Occupancy / use</span><input value={locationUse} onChange={(event) => setLocationUse(event.target.value)} /></label>
          <label className={styles.wide}><span>Address</span><input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} /></label>
        </div>
        <button className={styles.primaryButton} type="button" disabled={!locationLabel.trim()} onClick={() => void runCommand({ operation: 'save_location', label: locationLabel, addressText: locationAddress, occupancyUse: locationUse }, 'Location added.').then((ok) => { if (ok) { setLocationLabel(''); setLocationAddress(''); setLocationUse(''); } })}>Add location</button>
        <div className={styles.simpleList}>{workspace.locations.map((location) => <div key={location.id}><strong>{location.label}</strong><span>{location.isUnknown ? 'Unknown / not supplied' : location.occupancyUse || 'Use not recorded'}</span><small>{location.addressText || 'Address not recorded'} · {location.assetIds.length} linked assets</small></div>)}</div>
        <button className={styles.secondaryButton} type="button" onClick={() => setSetupView('parties')}>Continue to parties →</button>
      </article> : null}

    {setupView === 'parties' ? <article className={styles.card}>
        <h2>Parties and roles</h2>
        <p>Add the insured, owner, financier or other party whose interests need to be reflected in the review.</p>
        <div className={styles.formGrid}>
          <label><span>Party name</span><input value={partyName} onChange={(event) => setPartyName(event.target.value)} /></label>
          <label><span>Party type</span><select value={partyType} onChange={(event) => setPartyType(event.target.value as typeof partyType)}><option value="organisation">Organisation</option><option value="person">Person</option><option value="trust">Trust</option><option value="estate">Estate</option><option value="other">Other</option></select></label>
          <label><span>Role</span><select value={partyRole} onChange={(event) => setPartyRole(event.target.value as typeof partyRole)}><option value="insured">Insured</option><option value="owner">Owner</option><option value="financier_mortgagee">Financier / mortgagee</option><option value="beneficiary">Beneficiary</option><option value="operator">Operator</option><option value="custodian">Custodian</option><option value="principal">Principal</option><option value="contractor">Contractor</option></select></label>
          <label><span>Role context</span><input value={partyRoleContext} onChange={(event) => setPartyRoleContext(event.target.value)} /></label>
        </div>
        <button className={styles.primaryButton} type="button" disabled={!partyName.trim()} onClick={() => void runCommand({ operation: 'save_party', partyType, displayName: partyName, roles: [{ roleKey: partyRole, context: partyRoleContext }] }, 'Party and role added.').then((ok) => { if (ok) { setPartyName(''); setPartyRoleContext(''); } })}>Add party</button>
        <div className={styles.simpleList}>{workspace.parties.map((party) => <div key={party.id}><strong>{party.displayName}</strong><span>{label(party.partyType)}</span><small>{party.roles.map((role) => `${label(role.roleKey)}${role.context ? ` — ${role.context}` : ''}`).join(', ')}</small></div>)}</div>
        <button className={styles.secondaryButton} type="button" onClick={() => setSetupView('source')}>Continue to source check →</button>
      </article> : null}

    {setupView === 'source' ? <article className={styles.card}>
      <h2>Authorised source check</h2>
      <p>Confirm that the imported source is the revision you intend to review. Owner facts remain separate from broker-recorded cover evidence.</p>
      <dl>
        <div><dt>Revision</dt><dd>{latestSnapshot ? latestSnapshot.revision : 'Not recorded'}</dd></div>
        <div><dt>Generated</dt><dd>{dateLabel(latestSnapshot?.generatedAtIso ?? null)}</dd></div>
        <div><dt>Imported</dt><dd>{dateLabel(latestSnapshot?.importedAtIso ?? null)}</dd></div>
        <div><dt>Assets</dt><dd>{latestSnapshot?.assetCount ?? workspace.overview.assetCount}</dd></div>
        <div><dt>Authorisation</dt><dd>{latestSnapshot?.ownerAuthorisationReference || 'Not recorded'}</dd></div>
      </dl>
      {workspace.latestSnapshotDiffs.length ? <><h3>Latest authorised changes</h3><div className={styles.simpleList}>{workspace.latestSnapshotDiffs.map((diff) => <div key={diff.id}><strong>{label(diff.changeType)}</strong><span>{diff.sourceAssetKey}</span><small>{diff.changedFields.join(', ') || 'Material fields not listed'}</small></div>)}</div></> : <p className={styles.infoBox}>No later owner-authorised snapshot revision has been ingested.</p>}
      {workspace.availableSnapshotShares.length ? <><h3>Later authorised shares available</h3><div className={styles.simpleList}>{workspace.availableSnapshotShares.map((share) => <div key={share.id}><strong>{dateLabel(share.createdAtIso)}</strong><span>{share.assetCount} shared assets</span><small>{share.ownerMessage || 'No owner message supplied'}</small><button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'ingest_snapshot_revision', shareId: share.id, expectedVersion: workspace.version }, 'Owner-authorised snapshot revision ingested.')}>Ingest as next revision</button></div>)}</div></> : null}
      <p className={styles.disclaimer}>Replacement value, owner-provided insured value and broker-recorded current sum insured are separate facts. A missing sum insured remains unknown.</p>
    </article> : null}
  </section>;
}

export function InsuranceRiskObjectEditor({ riskObject, locations, runCommand }: { riskObject: InsuranceRiskObject; locations: InsuranceLocation[]; runCommand: RunCommand }) {
  const [objectType, setObjectType] = useState(riskObject.objectType);
  const [useDescription, setUseDescription] = useState(riskObject.useDescription);
  const [locationId, setLocationId] = useState(riskObject.locationId ?? '');
  const [classificationStatus, setClassificationStatus] = useState(riskObject.classificationStatus);
  return <div className={styles.riskObjectEditor}>
    <div><small>Broker classification — separate from policy section</small><strong>{riskObject.objectLabel}</strong></div>
    <label><span>Risk-object type</span><input value={objectType} onChange={(event) => setObjectType(event.target.value)} /></label>
    <label><span>Normalized location</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Unknown / not supplied</option>{locations.filter((location) => !location.isUnknown).map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}</select></label>
    <label><span>Classification status</span><select value={classificationStatus} onChange={(event) => setClassificationStatus(event.target.value as typeof classificationStatus)}><option value="unconfirmed">Unconfirmed</option><option value="human_confirmed">Human confirmed</option><option value="dismissed">Dismissed</option></select></label>
    <label className={styles.wide}><span>Use / operating context</span><input value={useDescription} onChange={(event) => setUseDescription(event.target.value)} /></label>
    <button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'save_risk_object', id: riskObject.id, expectedVersion: riskObject.version, objectType, objectLabel: riskObject.objectLabel, useDescription, locationId: locationId || null, classificationStatus }, 'Risk-object classification saved.')}>Save classification</button>
  </div>;
}

function AssessmentEditor({ assessment, runCommand }: { assessment: InsuranceCoverAssessment; runCommand: RunCommand }) {
  const [currentCoverPosition, setCurrentCoverPosition] = useState(assessment.currentCoverPosition);
  const [placementStage, setPlacementStage] = useState(assessment.placementStage);
  const [sourceReference, setSourceReference] = useState(assessment.provenance.sourceReference);
  const [brokerRationale, setBrokerRationale] = useState(assessment.brokerRationale);
  const [componentLabel, setComponentLabel] = useState('');
  const [componentType, setComponentType] = useState<'extension' | 'condition' | 'warranty' | 'endorsement'>('extension');
  const [componentStatus, setComponentStatus] = useState<InsuranceCurrentCoverPosition>('unknown');
  const [termType, setTermType] = useState<'sum_insured' | 'sublimit' | 'basic_excess' | 'time_excess'>('sum_insured');
  const [termAmount, setTermAmount] = useState('');

  async function saveAssessment() {
    await runCommand({
      operation: 'save_assessment', id: assessment.id, expectedVersion: assessment.version,
      canonicalCoverKey: assessment.canonicalCoverKey, coverLabel: assessment.coverLabel,
      exposureStatus: assessment.exposureStatus, currentCoverPosition, placementStage,
      brokerRationale, dismissalReason: assessment.dismissalReason,
      sourceType: 'broker_recorded', sourceReference,
      assetIds: assessment.assetIds, exposureIds: assessment.exposureIds, locationIds: assessment.locationIds,
      partyIds: assessment.partyIds, sectionIds: assessment.sectionIds, scheduleItemIds: assessment.scheduleItemIds,
    }, `${assessment.coverLabel} assessment saved.`);
  }

  return <article className={styles.coverAssessmentCard}>
    <header><div><small>{assessment.systemSuggestionRuleId ? 'Suggested area to consider' : 'Broker-added assessment'}</small><h3>{assessment.coverLabel}</h3></div><strong>{label(assessment.currentCoverPosition)}</strong></header>
    {assessment.systemSuggestionRationale ? <p className={styles.suggestionReason}>{assessment.systemSuggestionRationale}</p> : null}
    <div className={styles.formGrid}>
      <label><span>Current-cover position</span><select value={currentCoverPosition} onChange={(event) => setCurrentCoverPosition(event.target.value as InsuranceCurrentCoverPosition)}>{currentCoverOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span>Review / placement stage</span><select value={placementStage} onChange={(event) => setPlacementStage(event.target.value as InsurancePlacementStage)}>{placementOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label className={styles.wide}><span>Source reference {currentCoverPosition === 'confirmed_included' ? '(required)' : ''}</span><input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="Policy schedule, wording, insurer confirmation or recorded source" /></label>
      <label className={styles.wide}><span>Broker rationale</span><textarea rows={2} value={brokerRationale} onChange={(event) => setBrokerRationale(event.target.value)} /></label>
    </div>
    <button className={styles.primaryButton} type="button" onClick={() => void saveAssessment()}>Save assessment</button>

    <details className={styles.inlineDetails}><summary>Components, limits and excesses</summary>
      {assessment.components.length ? <div className={styles.simpleList}>{assessment.components.map((component) => <div key={component.id}><strong>{component.label}</strong><span>{label(component.componentType)} · {label(component.selectionStatus)}</span><small>{component.conditionsNotes || component.provenance.sourceReference || 'No additional terms recorded'}</small></div>)}</div> : <p>No structured components recorded.</p>}
      <div className={styles.formGrid}>
        <label><span>Component type</span><select value={componentType} onChange={(event) => setComponentType(event.target.value as typeof componentType)}><option value="extension">Extension</option><option value="condition">Condition</option><option value="warranty">Warranty</option><option value="endorsement">Endorsement</option></select></label>
        <label><span>Current position</span><select value={componentStatus} onChange={(event) => setComponentStatus(event.target.value as InsuranceCurrentCoverPosition)}>{currentCoverOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className={styles.wide}><span>Component label</span><input value={componentLabel} onChange={(event) => setComponentLabel(event.target.value)} /></label>
      </div>
      <button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'save_component', assessmentId: assessment.id, componentType, label: componentLabel, selectionStatus: componentStatus, sourceType: 'broker_recorded', sourceReference }, 'Cover component saved.').then((ok) => { if (ok) setComponentLabel(''); })}>Add component</button>
      <div className={styles.financialRows}>{assessment.financialTerms.map((term) => <div key={term.id}><strong>{label(term.termType)}</strong><span>{term.amount ? money(term.amount, term.currency) : term.percentage ? `${term.percentage}%` : term.timeValue ? `${term.timeValue} ${term.timeUnit}` : 'Recorded without amount'}</span></div>)}</div>
      <div className={styles.formGrid}>
        <label><span>Financial term</span><select value={termType} onChange={(event) => setTermType(event.target.value as typeof termType)}><option value="sum_insured">Sum insured</option><option value="sublimit">Sublimit</option><option value="basic_excess">Basic excess</option><option value="time_excess">Time excess</option></select></label>
        <label><span>{termType === 'time_excess' ? 'Hours' : 'Amount (ZAR)'}</span><input inputMode="decimal" value={termAmount} onChange={(event) => setTermAmount(event.target.value)} /></label>
      </div>
      <button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'save_financial_term', assessmentId: assessment.id, termType, amount: termType === 'time_excess' ? null : termAmount, timeValue: termType === 'time_excess' ? termAmount : null, timeUnit: termType === 'time_excess' ? 'hours' : '', currency: 'ZAR', sourceType: 'broker_recorded', sourceReference }, 'Financial term saved.').then((ok) => { if (ok) setTermAmount(''); })}>Add financial term</button>
    </details>
  </article>;
}

export function InsuranceCoversPanel({ workspace, assets, runCommand }: { workspace: InsuranceWorkspaceData; assets: InsuranceWorkspaceAsset[]; runCommand: RunCommand }) {
  const [coverView, setCoverView] = useState<'exposures' | 'suggestions' | 'assessments'>(() => workspace.exposures.length === 0 ? 'exposures' : workspace.suggestions.some((suggestion) => !suggestion.decision) ? 'suggestions' : 'assessments');
  const [assessmentIndex, setAssessmentIndex] = useState(() => Math.max(0, workspace.assessments.filter((assessment) => assessment.canonicalCoverKey).findIndex((assessment) => assessment.placementStage === 'not_assessed')));
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [regulatoryClass, setRegulatoryClass] = useState('all');
  const [showFullCatalogue, setShowFullCatalogue] = useState(false);
  const [exposureLabel, setExposureLabel] = useState('');
  const [exposureType, setExposureType] = useState('liability');
  const [exposureDescription, setExposureDescription] = useState('');
  const [exposureAssetIds, setExposureAssetIds] = useState<string[]>([]);
  const [exposureLocationIds, setExposureLocationIds] = useState<string[]>([]);
  const [exposurePartyIds, setExposurePartyIds] = useState<string[]>([]);
  const [suggestionRationale, setSuggestionRationale] = useState('');
  const existingKeys = new Set(workspace.assessments.map((assessment) => assessment.canonicalCoverKey).filter(Boolean));
  const assessments = workspace.assessments.filter((assessment) => assessment.canonicalCoverKey);
  const activeAssessment = assessments[Math.min(assessmentIndex, Math.max(0, assessments.length - 1))];
  const suggestedKeys = new Set(workspace.suggestions.filter((suggestion) => suggestion.suggestedCoverKey && !suggestion.decision).map((suggestion) => suggestion.suggestedCoverKey));
  const families = [...new Set(INSURANCE_COVER_CATALOGUE.map((cover) => cover.familyKey))].sort();

  const filteredCatalogue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const relevant = INSURANCE_COVER_CATALOGUE.filter((cover) => {
      if (family !== 'all' && cover.familyKey !== family) return false;
      if (regulatoryClass !== 'all' && !cover.regulatoryMappings.some((mapping) => mapping.classKey === regulatoryClass)) return false;
      if (normalized && ![cover.label, cover.key, cover.familyKey, ...cover.aliases].join(' ').toLowerCase().includes(normalized)) return false;
      if (showFullCatalogue || normalized || family !== 'all' || regulatoryClass !== 'all') return true;
      return suggestedKeys.has(cover.key) || cover.eligibleClientSegments.some((segment) => workspace.segments.includes(segment)) && (!cover.relevantIndustryProfiles.length || cover.relevantIndustryProfiles.some((industry) => workspace.industryProfiles.includes(industry)));
    });
    return showFullCatalogue || normalized || family !== 'all' || regulatoryClass !== 'all' ? relevant : relevant.slice(0, 18);
  }, [family, regulatoryClass, query, showFullCatalogue, suggestedKeys, workspace.industryProfiles, workspace.segments]);

  return <section>
    <header className={styles.sectionHeader}><div><h2>Covers and exposures</h2><p>System suggestions, current policy evidence and broker decisions remain separate.</p></div><button type="button" onClick={() => void runCommand({ operation: 'refresh_suggestions' }, 'Deterministic suggestions refreshed.')}>Refresh suggestions</button></header>
    <nav className={styles.substepNav} aria-label="Cover review sections">
      <button className={coverView === 'exposures' ? styles.activeView : ''} type="button" onClick={() => setCoverView('exposures')}>1. Exposures ({workspace.exposures.length})</button>
      <button className={coverView === 'suggestions' ? styles.activeView : ''} type="button" onClick={() => setCoverView('suggestions')}>2. Areas to consider ({workspace.suggestions.filter((suggestion) => !suggestion.decision).length})</button>
      <button className={coverView === 'assessments' ? styles.activeView : ''} type="button" onClick={() => setCoverView('assessments')}>3. Cover decisions ({workspace.assessments.filter((assessment) => assessment.canonicalCoverKey).length})</button>
    </nav>

    {coverView === 'exposures' ? <><div className={styles.overviewGrid}>
      <article className={styles.card}>
        <h2>Non-asset exposure</h2>
        <p>Add people, liability, income, receivables, contracts, projects, crops, animals or intangible interests without inventing an asset row.</p>
        <div className={styles.formGrid}>
          <label><span>Exposure type</span><select value={exposureType} onChange={(event) => setExposureType(event.target.value)}><option value="liability">Liability</option><option value="income">Income / business interruption</option><option value="people">People</option><option value="receivables">Receivables</option><option value="contract">Contract or project</option><option value="crop">Crop field</option><option value="animal">Animals</option><option value="cyber">Data / cyber</option><option value="other">Other</option></select></label>
          <label><span>Label</span><input value={exposureLabel} onChange={(event) => setExposureLabel(event.target.value)} /></label>
          <label className={styles.wide}><span>Description</span><textarea rows={3} value={exposureDescription} onChange={(event) => setExposureDescription(event.target.value)} /></label>
          <label><span>Linked assets</span><select className={styles.multiSelect} multiple value={exposureAssetIds} onChange={(event) => setExposureAssetIds(selectedValues(event))}>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title}</option>)}</select></label>
          <label><span>Linked locations</span><select className={styles.multiSelect} multiple value={exposureLocationIds} onChange={(event) => setExposureLocationIds(selectedValues(event))}>{workspace.locations.map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}</select></label>
          <label><span>Linked parties</span><select className={styles.multiSelect} multiple value={exposurePartyIds} onChange={(event) => setExposurePartyIds(selectedValues(event))}>{workspace.parties.map((party) => <option value={party.id} key={party.id}>{party.displayName}</option>)}</select></label>
        </div>
        <button className={styles.primaryButton} type="button" onClick={() => void runCommand({ operation: 'save_exposure', exposureType, label: exposureLabel, description: exposureDescription, exposureStatus: 'confirmed', assetIds: exposureAssetIds, locationIds: exposureLocationIds, partyIds: exposurePartyIds }, 'Exposure added.').then((ok) => { if (ok) { setExposureLabel(''); setExposureDescription(''); setExposureAssetIds([]); setExposureLocationIds([]); setExposurePartyIds([]); } })}>Add exposure</button>
      </article>
      <article className={styles.card}>
        <h2>Recorded exposures</h2>
        <div className={styles.simpleList}>{workspace.exposures.map((exposure) => <div key={exposure.id}><strong>{exposure.label}</strong><span>{label(exposure.exposureType)} · {label(exposure.exposureStatus)}</span><small>{exposure.assetIds.length ? `${exposure.assetIds.length} linked assets` : 'Non-asset exposure'}{exposure.description ? ` · ${exposure.description}` : ''}</small></div>)}</div>
      </article>
    </div><button className={styles.secondaryButton} type="button" onClick={() => setCoverView('suggestions')}>Continue to areas to consider →</button></> : null}

    {coverView === 'suggestions' ? <>{workspace.suggestions.some((suggestion) => !suggestion.decision) ? <article className={styles.card}>
      <h2>Open deterministic suggestions</h2>
      <p>Accepting a suggestion creates an assessment at <em>Area to consider</em>. It does not mark the client insured and does not create a broker recommendation.</p>
      <label><span>Decision rationale</span><input value={suggestionRationale} onChange={(event) => setSuggestionRationale(event.target.value)} placeholder="Why this suggestion is accepted, dismissed or needs information" /></label>
      <div className={styles.suggestionList}>{workspace.suggestions.filter((suggestion) => !suggestion.decision).slice(0, 30).map((suggestion) => <article key={suggestion.id}><div><small>{suggestion.ruleId} · {label(suggestion.confidence)} confidence</small><strong>{suggestion.suggestedCoverKey ? INSURANCE_COVER_CATALOGUE.find((cover) => cover.key === suggestion.suggestedCoverKey)?.label : label(suggestion.suggestedRiskObjectType)}</strong><p>{suggestion.rationale}</p></div><div><button type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'accepted_for_assessment', rationale: suggestionRationale || 'Accepted by broker for assessment.' }, 'Suggestion accepted for assessment.')}>Assess</button><button type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'information_required', rationale: suggestionRationale || 'Further information required.' }, 'Suggestion marked for information.')}>Need info</button><button type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'dismissed_with_reason', rationale: suggestionRationale || 'Dismissed by broker after review.' }, 'Suggestion dismissed.')}>Dismiss</button></div></article>)}</div>
    </article> : <p className={styles.infoBox}>There are no open system suggestions. Use the catalogue below if another cover needs to be assessed.</p>}

    <article className={styles.card}>
      <div className={styles.catalogueHeader}><div><h2>South African non-life catalogue</h2><p>{INSURANCE_COVER_CATALOGUE.length} canonical learning definitions · version {workspace.catalogueVersion}</p></div><button className={styles.secondaryButton} type="button" onClick={() => setShowFullCatalogue((current) => !current)}>{showFullCatalogue ? 'Show relevant shortlist' : 'Browse all 66 covers'}</button></div>
      <div className={styles.catalogueFilters}>
        <label><span>Search</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search cover, alias or family" /></label>
        <label><span>Family</span><select value={family} onChange={(event) => setFamily(event.target.value)}><option value="all">All families</option>{families.map((entry) => <option key={entry} value={entry}>{label(entry)}</option>)}</select></label>
        <label><span>Regulatory class</span><select value={regulatoryClass} onChange={(event) => setRegulatoryClass(event.target.value)}><option value="all">All classes</option>{INSURANCE_REGULATORY_CLASSES.map((entry) => <option value={entry.key} key={entry.key}>{entry.label}</option>)}</select></label>
      </div>
      <div className={styles.catalogueList}>{filteredCatalogue.map((cover) => <article key={cover.key}><div><small>{label(cover.familyKey)} · {cover.regulatoryMappings.map((mapping) => label(mapping.classKey)).join(', ')}</small><h3>{cover.label}</h3><p>{cover.purpose}</p><span>{cover.specialistReferral ? 'Specialist / referral confirmation required' : 'Standard catalogue definition — verify wording'}</span></div><button type="button" disabled={existingKeys.has(cover.key)} onClick={() => void runCommand({ operation: 'save_assessment', canonicalCoverKey: cover.key, coverLabel: cover.label, exposureStatus: 'discovered', currentCoverPosition: 'unknown', placementStage: 'area_to_consider', sourceType: 'broker_recorded', sourceReference: 'Broker selected from canonical catalogue' }, `${cover.label} added for assessment.`)}>{existingKeys.has(cover.key) ? 'Already added' : 'Add assessment'}</button></article>)}</div>
    </article>
    <button className={styles.secondaryButton} type="button" onClick={() => setCoverView('assessments')}>Continue to cover decisions →</button></> : null}

    {coverView === 'assessments' ? <>{activeAssessment ? <><div className={styles.assetReviewNav}>
      <button type="button" disabled={assessmentIndex <= 0} onClick={() => setAssessmentIndex((current) => Math.max(0, current - 1))}>← Previous</button>
      <label><span>Cover {assessmentIndex + 1} of {assessments.length}</span><select value={activeAssessment.id} onChange={(event) => setAssessmentIndex(assessments.findIndex((assessment) => assessment.id === event.target.value))}>{assessments.map((assessment, index) => <option value={assessment.id} key={assessment.id}>{index + 1}. {assessment.coverLabel} · {label(assessment.placementStage)}</option>)}</select></label>
      <button type="button" disabled={assessmentIndex >= assessments.length - 1} onClick={() => setAssessmentIndex((current) => Math.min(assessments.length - 1, current + 1))}>Next cover →</button>
    </div><div className={styles.assessmentList}><AssessmentEditor key={`${activeAssessment.id}-${activeAssessment.version}`} assessment={activeAssessment} runCommand={runCommand} /></div></> : <p className={styles.infoBox}>No cover assessments have been added yet. Return to Areas to consider to add one.</p>}
    {!assets.length ? null : <p className={styles.infoBox}>Asset links are preserved separately from cover definitions. Use the policy schedule workflow to record grouped, blanket or individually specified treatment.</p>}</> : null}
  </section>;
}

function selectedValues(event: ChangeEvent<HTMLSelectElement>): string[] {
  return Array.from(event.target.selectedOptions).map((option) => option.value);
}

export function InsurancePoliciesPanel({ workspace, assets, runCommand }: { workspace: InsuranceWorkspaceData; assets: InsuranceWorkspaceAsset[]; runCommand: RunCommand }) {
  const [policyView, setPolicyView] = useState<'policy' | 'section' | 'schedule' | 'terms' | 'review'>(() => {
    const existingSections = workspace.policies.flatMap((policy) => policy.sections);
    const existingItems = existingSections.flatMap((section) => section.scheduleItems);
    return workspace.policies.length === 0 ? 'policy' : existingSections.length === 0 ? 'section' : existingItems.length === 0 ? 'schedule' : 'review';
  });
  const [insurerName, setInsurerName] = useState('');
  const [productName, setProductName] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policySource, setPolicySource] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [sectionLabel, setSectionLabel] = useState('');
  const [canonicalCoverKey, setCanonicalCoverKey] = useState('');
  const [wordingReference, setWordingReference] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [itemLabel, setItemLabel] = useState('');
  const [treatment, setTreatment] = useState<'individual' | 'grouped' | 'blanket' | 'unscheduled'>('individual');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [exposureIds, setExposureIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [partyIds, setPartyIds] = useState<string[]>([]);
  const [financialScheduleItemId, setFinancialScheduleItemId] = useState('');
  const [scheduleTermType, setScheduleTermType] = useState<'sum_insured' | 'any_one_item_limit' | 'any_one_event_limit' | 'any_one_location_limit' | 'annual_aggregate' | 'sublimit' | 'basic_excess' | 'additional_excess' | 'percentage_excess' | 'time_excess' | 'coinsurance'>('sum_insured');
  const [scheduleTermValue, setScheduleTermValue] = useState('');
  const sections = workspace.policies.flatMap((policy) => policy.sections);
  const scheduleItems = sections.flatMap((section) => section.scheduleItems);
  const scheduleTermUsesPercentage = scheduleTermType === 'percentage_excess' || scheduleTermType === 'coinsurance';
  const scheduleTermUsesTime = scheduleTermType === 'time_excess';

  return <section>
    <header className={styles.sectionHeader}><div><h2>Policies and schedule</h2><p>Record the insurer&apos;s actual hierarchy and map it to the canonical catalogue without replacing insurer labels.</p></div></header>
    <nav className={styles.substepNav} aria-label="Policy capture sections">
      <button className={policyView === 'policy' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('policy')}>1. Policy ({workspace.policies.length})</button>
      <button className={policyView === 'section' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('section')}>2. Section ({sections.length})</button>
      <button className={policyView === 'schedule' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('schedule')}>3. Schedule item ({scheduleItems.length})</button>
      <button className={policyView === 'terms' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('terms')}>4. Limits & excesses</button>
      <button className={policyView === 'review' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('review')}>5. Review</button>
    </nav>
    <div className={`${styles.workflowGrid} ${styles.singleWorkflow}`}>
      {policyView === 'policy' ? <article className={styles.card}><h2>1. Add current policy</h2><p>Start with the policy shown on the insurer schedule. You can add another policy later from this same step.</p><div className={styles.formGrid}>
        <label><span>Insurer</span><input value={insurerName} onChange={(event) => setInsurerName(event.target.value)} /></label>
        <label><span>Policy number</span><input value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} /></label>
        <label><span>Product name</span><input value={productName} onChange={(event) => setProductName(event.target.value)} /></label>
        <label><span>Schedule / source reference</span><input value={policySource} onChange={(event) => setPolicySource(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!insurerName.trim() && !policyNumber.trim() && !productName.trim()} onClick={() => void runCommand({ operation: 'save_policy', insurerName, productName, policyNumber, status: 'current', sourceType: 'policy_schedule', sourceReference: policySource }, 'Policy added.').then((ok) => { if (ok) { setInsurerName(''); setProductName(''); setPolicyNumber(''); setPolicyView('section'); } })}>Save and continue to policy section</button></article> : null}

      {policyView === 'section' ? <article className={styles.card}><h2>2. Add policy section</h2><p>Use the insurer&apos;s actual section label, then map it to the closest catalogue definition where appropriate.</p><div className={styles.formGrid}>
        <label><span>Policy</span><select value={policyId} onChange={(event) => setPolicyId(event.target.value)}><option value="">Select policy</option>{workspace.policies.map((policy) => <option value={policy.id} key={policy.id}>{[policy.insurerName, policy.policyNumber].filter(Boolean).join(' · ') || 'Unnamed policy'}</option>)}</select></label>
        <label><span>Actual insurer section label</span><input value={sectionLabel} onChange={(event) => setSectionLabel(event.target.value)} /></label>
        <label><span>Canonical mapping</span><select value={canonicalCoverKey} onChange={(event) => setCanonicalCoverKey(event.target.value)}><option value="">Not mapped yet</option>{INSURANCE_COVER_CATALOGUE.map((cover) => <option value={cover.key} key={cover.key}>{cover.label}</option>)}</select></label>
        <label><span>Wording edition / reference</span><input value={wordingReference} onChange={(event) => setWordingReference(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!policyId || !sectionLabel.trim()} onClick={() => void runCommand({ operation: 'save_section', policyId, canonicalCoverKey: canonicalCoverKey || null, actualSectionLabel: sectionLabel, wordingEditionReference: wordingReference, status: 'current', sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'Policy section added.').then((ok) => { if (ok) { setSectionLabel(''); setPolicyView('schedule'); } })}>Save and continue to schedule item</button></article> : null}

      {policyView === 'schedule' ? <article className={styles.card}><h2>3. Add schedule item</h2><p>Choose the section, name the schedule line, and link the assets, locations, exposures or parties that it covers.</p><div className={styles.formGrid}>
        <label><span>Policy section</span><select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">Select section</option>{sections.map((section) => <option value={section.id} key={section.id}>{section.actualSectionLabel}</option>)}</select></label>
        <label><span>Treatment</span><select value={treatment} onChange={(event) => setTreatment(event.target.value as typeof treatment)}><option value="individual">Individual</option><option value="grouped">Grouped</option><option value="blanket">Blanket</option><option value="unscheduled">Unscheduled</option></select></label>
        <label className={styles.wide}><span>Schedule item label</span><input value={itemLabel} onChange={(event) => setItemLabel(event.target.value)} /></label>
        <label><span>Linked assets (Ctrl/Cmd for several)</span><select className={styles.multiSelect} multiple value={assetIds} onChange={(event) => setAssetIds(selectedValues(event))}>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.title}</option>)}</select></label>
        <label><span>Linked exposures</span><select className={styles.multiSelect} multiple value={exposureIds} onChange={(event) => setExposureIds(selectedValues(event))}>{workspace.exposures.map((exposure) => <option value={exposure.id} key={exposure.id}>{exposure.label}</option>)}</select></label>
        <label><span>Linked locations</span><select className={styles.multiSelect} multiple value={locationIds} onChange={(event) => setLocationIds(selectedValues(event))}>{workspace.locations.map((location) => <option value={location.id} key={location.id}>{location.label}</option>)}</select></label>
        <label><span>Linked parties</span><select className={styles.multiSelect} multiple value={partyIds} onChange={(event) => setPartyIds(selectedValues(event))}>{workspace.parties.map((party) => <option value={party.id} key={party.id}>{party.displayName}</option>)}</select></label>
      </div><button className={styles.primaryButton} type="button" disabled={!sectionId || !itemLabel.trim()} onClick={() => void runCommand({ operation: 'save_schedule_item', sectionId, itemLabel, treatment, assetIds, exposureIds, locationIds, partyIds, sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'Schedule item added.').then((ok) => { if (ok) { setItemLabel(''); setAssetIds([]); setExposureIds([]); setLocationIds([]); setPartyIds([]); setPolicyView('terms'); } })}>Save and continue to limits and excesses</button></article> : null}

      {policyView === 'terms' ? <article className={styles.card}><h2>4. Add schedule limit or excess</h2><p>Record each financial term separately so sums insured, limits, percentages and time excesses remain distinct.</p><div className={styles.formGrid}>
        <label><span>Schedule item</span><select value={financialScheduleItemId} onChange={(event) => setFinancialScheduleItemId(event.target.value)}><option value="">Select schedule item</option>{scheduleItems.map((item) => <option value={item.id} key={item.id}>{item.itemLabel}</option>)}</select></label>
        <label><span>Term type</span><select value={scheduleTermType} onChange={(event) => setScheduleTermType(event.target.value as typeof scheduleTermType)}><option value="sum_insured">Sum insured</option><option value="any_one_item_limit">Any one item limit</option><option value="any_one_event_limit">Any one event limit</option><option value="any_one_location_limit">Any one location limit</option><option value="annual_aggregate">Annual aggregate</option><option value="sublimit">Sublimit</option><option value="basic_excess">Basic excess</option><option value="additional_excess">Additional excess</option><option value="percentage_excess">Percentage excess</option><option value="time_excess">Time excess</option><option value="coinsurance">Co-insurance</option></select></label>
        <label><span>{scheduleTermUsesTime ? 'Hours' : scheduleTermUsesPercentage ? 'Percentage' : 'Amount (ZAR)'}</span><input inputMode="decimal" value={scheduleTermValue} onChange={(event) => setScheduleTermValue(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!financialScheduleItemId || !scheduleTermValue.trim()} onClick={() => void runCommand({ operation: 'save_financial_term', scheduleItemId: financialScheduleItemId, termType: scheduleTermType, amount: scheduleTermUsesPercentage || scheduleTermUsesTime ? null : scheduleTermValue, percentage: scheduleTermUsesPercentage ? scheduleTermValue : null, timeValue: scheduleTermUsesTime ? scheduleTermValue : null, timeUnit: scheduleTermUsesTime ? 'hours' : '', currency: 'ZAR', sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'Schedule financial term added.').then((ok) => { if (ok) { setScheduleTermValue(''); setPolicyView('review'); } })}>Save term and review policy</button><button className={styles.secondaryButton} type="button" onClick={() => setPolicyView('review')}>Skip for now and review →</button></article> : null}
    </div>

    {policyView === 'review' ? <><div className={styles.policyList}>{workspace.policies.map((policy) => <article className={styles.card} key={policy.id}><header className={styles.policyHeader}><div><small>{policy.productName || 'Product not recorded'}</small><h2>{[policy.insurerName, policy.policyNumber].filter(Boolean).join(' · ') || 'Policy details incomplete'}</h2></div><strong>{label(policy.status)}</strong></header>{policy.sections.length ? policy.sections.map((section) => <details className={styles.policySection} key={section.id} open><summary><span>{section.actualSectionLabel}</span><small>{section.canonicalCoverKey ? INSURANCE_COVER_CATALOGUE.find((cover) => cover.key === section.canonicalCoverKey)?.label : 'Canonical mapping not recorded'}</small></summary><p>Wording: {section.wordingEditionReference || 'Not recorded'} · Source: {section.provenance.sourceReference || label(section.provenance.sourceType)}</p>{section.scheduleItems.length ? <div className={styles.simpleList}>{section.scheduleItems.map((item) => <div key={item.id}><strong>{item.itemLabel}</strong><span>{label(item.treatment)} · {item.assetIds.length} assets · {item.exposureIds.length} exposures</span><small>{item.itemDescription || 'No schedule description recorded'} · {item.financialTerms.length} financial terms</small></div>)}</div> : <p className={styles.infoBox}>No schedule items recorded.</p>}</details>) : <p className={styles.infoBox}>No policy sections recorded.</p>}</article>)}</div>{!workspace.policies.length ? <p className={styles.infoBox}>No policies have been recorded. Return to step 1 to add the first policy.</p> : null}</> : null}
  </section>;
}

export function InsuranceQuestionsPanel({ workspace, runCommand }: { workspace: InsuranceWorkspaceData; runCommand: RunCommand }) {
  const [supportView, setSupportView] = useState<'questions' | 'notes' | 'evidence'>(() => workspace.informationRequests.some((request) => !['resolved', 'not_applicable'].includes(request.status)) ? 'questions' : workspace.evidence.length === 0 ? 'evidence' : 'notes');
  const [question, setQuestion] = useState('');
  const [reason, setReason] = useState('');
  const [noteType, setNoteType] = useState<'private_broker' | 'client_information_request' | 'insurer_underwriter' | 'report_visible'>('private_broker');
  const [noteBody, setNoteBody] = useState('');
  const [evidenceType, setEvidenceType] = useState<'shared_photo' | 'shared_document' | 'policy_schedule' | 'wording' | 'endorsement' | 'valuation' | 'certificate' | 'correspondence' | 'other_reference'>('other_reference');
  const [evidenceLabel, setEvidenceLabel] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceTarget, setEvidenceTarget] = useState('');
  const evidenceTargets = [
    ...workspace.parties.map((entry) => ({ value: `party:${entry.id}`, label: `Party · ${entry.displayName}` })),
    ...workspace.locations.map((entry) => ({ value: `location:${entry.id}`, label: `Location · ${entry.label}` })),
    ...workspace.riskObjects.map((entry) => ({ value: `risk_object:${entry.id}`, label: `Risk object · ${entry.objectLabel}` })),
    ...workspace.exposures.map((entry) => ({ value: `exposure:${entry.id}`, label: `Exposure · ${entry.label}` })),
    ...workspace.policies.map((entry) => ({ value: `policy:${entry.id}`, label: `Policy · ${entry.policyNumber || entry.insurerName || 'Unnamed'}` })),
    ...workspace.policies.flatMap((policy) => policy.sections.map((entry) => ({ value: `section:${entry.id}`, label: `Section · ${entry.actualSectionLabel}` }))),
    ...workspace.assessments.map((entry) => ({ value: `assessment:${entry.id}`, label: `Assessment · ${entry.coverLabel}` })),
    ...workspace.informationRequests.map((entry) => ({ value: `information_request:${entry.id}`, label: `Question · ${entry.question}` })),
  ];

  function saveEvidence() {
    const [entityType, entityId] = evidenceTarget ? evidenceTarget.split(':') : [];
    return runCommand({
      operation: 'save_evidence', evidenceType, label: evidenceLabel,
      sourceReference: evidenceReference, notes: evidenceNotes,
      entityType: entityType as InsuranceEvidence['links'][number]['entityType'] | undefined,
      entityId: entityId || null,
    } as InsuranceCommand, 'Evidence reference saved.').then((ok) => {
      if (ok) { setEvidenceLabel(''); setEvidenceReference(''); setEvidenceNotes(''); setEvidenceTarget(''); }
    });
  }

  return <section>
    <header className={styles.sectionHeader}><div><h2>Supporting information</h2><p>Resolve gaps, keep audience-specific notes separate, and record the evidence used for decisions.</p></div></header>
    <nav className={styles.substepNav} aria-label="Supporting information sections">
      <button className={supportView === 'questions' ? styles.activeView : ''} type="button" onClick={() => setSupportView('questions')}>1. Questions ({workspace.overview.openInformationRequestCount} open)</button>
      <button className={supportView === 'notes' ? styles.activeView : ''} type="button" onClick={() => setSupportView('notes')}>2. Notes ({workspace.notes.length})</button>
      <button className={supportView === 'evidence' ? styles.activeView : ''} type="button" onClick={() => setSupportView('evidence')}>3. Evidence ({workspace.evidence.length})</button>
    </nav>

    {supportView === 'questions' ? <><article className={styles.card}><h2>Add information request</h2><p>Ask only for information that is needed to finish a cover or policy decision.</p><div className={styles.formGrid}>
        <label className={styles.wide}><span>Question</span><textarea rows={3} value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
        <label className={styles.wide}><span>Why it is needed</span><textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!question.trim()} onClick={() => void runCommand({ operation: 'save_information_request', question, reason, status: 'open' }, 'Information request added.').then((ok) => { if (ok) { setQuestion(''); setReason(''); } })}>Add request</button></article>
      <article className={styles.card}><h2>Outstanding questions</h2>{workspace.informationRequests.length ? <div className={styles.questionList}>{workspace.informationRequests.map((request) => <article key={request.id}><div><small>{label(request.status)} · {dateLabel(request.requestedAtIso)}</small><strong>{request.question}</strong><p>{request.reason}</p>{request.response ? <p><b>Response:</b> {request.response}</p> : null}</div>{!['resolved', 'not_applicable'].includes(request.status) ? <button type="button" onClick={() => void runCommand({ operation: 'save_information_request', id: request.id, expectedVersion: request.version, question: request.question, reason: request.reason, relatedEntityType: request.relatedEntityType, relatedEntityId: request.relatedEntityId, status: 'resolved', response: request.response }, 'Information request resolved.')}>Resolve</button> : null}</article>)}</div> : <p className={styles.infoBox}>No information requests have been recorded.</p>}</article>
      <button className={styles.secondaryButton} type="button" onClick={() => setSupportView('notes')}>Continue to notes →</button></> : null}

    {supportView === 'notes' ? <><article className={styles.card}><h2>Add note</h2><p>Choose the audience first. Private broker notes never enter client-ready reports.</p><div className={styles.formGrid}>
        <label><span>Audience / type</span><select value={noteType} onChange={(event) => setNoteType(event.target.value as typeof noteType)}><option value="private_broker">Private broker note</option><option value="client_information_request">Client information request</option><option value="insurer_underwriter">Insurer / underwriter note</option><option value="report_visible">Report-visible note</option></select></label>
        <label className={styles.wide}><span>Note</span><textarea rows={4} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!noteBody.trim()} onClick={() => void runCommand({ operation: 'save_note', noteType, body: noteBody }, 'Note saved.').then((ok) => { if (ok) setNoteBody(''); })}>Save note</button></article>
      <div className={styles.noteColumns}>{(['private_broker', 'client_information_request', 'insurer_underwriter', 'report_visible'] as const).map((type) => <article className={styles.card} key={type}><h2>{label(type)}</h2>{workspace.notes.filter((note) => note.noteType === type).length ? <div className={styles.simpleList}>{workspace.notes.filter((note) => note.noteType === type).map((note) => <div key={note.id}><strong>{dateLabel(note.createdAtIso)}</strong><span>{note.body}</span></div>)}</div> : <p className={styles.infoBox}>No notes recorded.</p>}</article>)}</div>
      <button className={styles.secondaryButton} type="button" onClick={() => setSupportView('evidence')}>Continue to evidence →</button></> : null}

    {supportView === 'evidence' ? <><article className={styles.card}><h2>Add evidence reference</h2><p>Reference an already shared photo/document or a schedule, wording, valuation, certificate or correspondence. This does not expose private uploads publicly.</p><div className={styles.formGrid}>
        <label><span>Evidence type</span><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as typeof evidenceType)}><option value="shared_photo">Shared photo</option><option value="shared_document">Shared document</option><option value="policy_schedule">Policy schedule</option><option value="wording">Wording</option><option value="endorsement">Endorsement</option><option value="valuation">Valuation</option><option value="certificate">Certificate</option><option value="correspondence">Correspondence</option><option value="other_reference">Other reference</option></select></label>
        <label><span>Label</span><input value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} /></label>
        <label><span>Source / document reference</span><input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} /></label>
        <label><span>Link to record (optional)</span><select value={evidenceTarget} onChange={(event) => setEvidenceTarget(event.target.value)}><option value="">Workspace-level evidence</option>{evidenceTargets.map((target) => <option value={target.value} key={target.value}>{target.label}</option>)}</select></label>
        <label className={styles.wide}><span>Evidence notes</span><textarea rows={2} value={evidenceNotes} onChange={(event) => setEvidenceNotes(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!evidenceLabel.trim()} onClick={() => void saveEvidence()}>Save evidence reference</button></article>
      <article className={styles.card}><h2>Evidence trail</h2>{workspace.evidence.length ? <div className={styles.simpleList}>{workspace.evidence.map((entry) => <div key={entry.id}><strong>{entry.label}</strong><span>{label(entry.evidenceType)} · {entry.sourceReference || entry.existingSharedReference}</span><small>{entry.links.length ? `${entry.links.length} linked record${entry.links.length === 1 ? '' : 's'}` : 'Workspace-level reference'}{entry.notes ? ` · ${entry.notes}` : ''}</small></div>)}</div> : <p className={styles.infoBox}>No evidence references recorded.</p>}</article></> : null}
  </section>;
}
