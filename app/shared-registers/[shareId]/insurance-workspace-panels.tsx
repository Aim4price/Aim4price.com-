'use client';

import { useMemo, useState } from 'react';
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
  InsuranceFinancialTerm,
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

function financialTermMoney(term: InsuranceFinancialTerm): string {
  const amount = Number(term.amount);
  if (!Number.isFinite(amount)) return 'Not recorded';
  return money(term.vatBasis === 'exclusive' ? amount * 1.15 : amount, term.currency);
}

const currentCoverOptions: Array<{ value: InsuranceCurrentCoverPosition; label: string }> = [
  { value: 'unknown', label: 'Choose the current position…' },
  { value: 'not_recorded', label: 'No current-cover evidence available' },
  { value: 'confirmed_included', label: 'Included on the current policy' },
  { value: 'confirmed_excluded', label: 'Explicitly excluded on the current policy' },
  { value: 'covered_elsewhere', label: 'Covered elsewhere' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const placementOptions: Array<{ value: InsurancePlacementStage; label: string }> = [
  { value: 'not_assessed', label: 'Choose what happens next…' },
  { value: 'area_to_consider', label: 'Keep under consideration' },
  { value: 'information_required', label: 'More information is required' },
  { value: 'quote_requested', label: 'Quote requested' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'broker_recommended', label: 'Broker recommended' },
  { value: 'client_accepted', label: 'Client accepted' },
  { value: 'client_declined', label: 'Client declined' },
  { value: 'insurer_declined', label: 'Insurer declined' },
  { value: 'not_taken', label: 'Not taken' },
  { value: 'not_applicable', label: 'Not applicable' },
];

const riskObjectTypeOptions = [
  ['mobile_machinery', 'Mobile Machinery'],
  ['mobile_plant', 'Mobile Plant or Agricultural Machinery'],
  ['motor_vehicle', 'Motor Vehicle'],
  ['commercial_building', 'Commercial Building'],
  ['domestic_building', 'Domestic Building'],
  ['contents', 'Contents and Equipment'],
  ['electronic_equipment', 'Electronic Equipment'],
  ['stock_or_goods', 'Stock, Goods or Materials'],
  ['portable_equipment', 'Portable Equipment'],
  ['crop_field', 'Crop Field or Growing Crop'],
  ['livestock', 'Livestock or Animals'],
  ['project_or_contract_works', 'Project or Contract Works'],
  ['unclassified_physical_asset', 'Other Physical Asset'],
] as const;

export function InsuranceOverviewPanel({ workspace, runCommand }: { workspace: InsuranceWorkspaceData; runCommand: RunCommand }) {
  const [setupView, setSetupView] = useState<'classification' | 'locations' | 'parties'>(() => workspace.segments.length === 0 ? 'classification' : !workspace.locations.some((location) => !location.isUnknown) ? 'locations' : 'parties');
  const [segments, setSegments] = useState<InsuranceClientSegment[]>(workspace.segments);
  const [industries, setIndustries] = useState<InsuranceIndustryProfileKey[]>(workspace.industryProfiles);
  const [locationLabel, setLocationLabel] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [locationUse, setLocationUse] = useState('');
  const [locationLatitude, setLocationLatitude] = useState('');
  const [locationLongitude, setLocationLongitude] = useState('');
  const [partyName, setPartyName] = useState(workspace.parties.length ? '' : workspace.clientName);
  const [partyType, setPartyType] = useState<'person' | 'organisation' | 'trust' | 'estate' | 'other'>('organisation');
  const [partyRole, setPartyRole] = useState<'insured' | 'owner' | 'financier_mortgagee' | 'beneficiary' | 'operator' | 'custodian' | 'principal' | 'contractor'>('insured');
  const [partyRoleContext, setPartyRoleContext] = useState('');
  const latestSnapshot = workspace.snapshotRevisions[0];
  const realLocations = workspace.locations.filter((location) => !location.isUnknown);
  const assetGpsLocations = [...new Map(workspace.assets.flatMap((asset) => {
    const rawLat = asset.snapshot.lastKnownLat;
    const rawLng = asset.snapshot.lastKnownLng;
    if (rawLat === null || rawLat === undefined || rawLat === '' || rawLng === null || rawLng === undefined || rawLng === '') return [];
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [[`${lat.toFixed(6)}:${lng.toFixed(6)}`, { asset, lat, lng }]] as const : [];
  })).values()];
  const latestGeneratedMs = latestSnapshot?.generatedAtIso ? new Date(latestSnapshot.generatedAtIso).getTime() : 0;
  const newerShares = [...new Map(workspace.availableSnapshotShares.filter((share) => {
    const createdMs = new Date(share.createdAtIso).getTime();
    return Number.isFinite(createdMs) && createdMs > latestGeneratedMs;
  }).map((share) => [`${share.createdAtIso}:${share.assetCount}`, share])).values()];

  function toggleSegment(segment: InsuranceClientSegment) {
    setSegments((current) => current.includes(segment) ? current.filter((entry) => entry !== segment) : [...current, segment]);
    if (segment === 'commercial' && segments.includes('commercial')) setIndustries([]);
  }

  function toggleIndustry(industry: InsuranceIndustryProfileKey) {
    setIndustries((current) => current.includes(industry) ? current.filter((entry) => entry !== industry) : [...current, industry]);
  }

  function useAssetGps(asset: InsuranceWorkspaceAsset, lat: number, lng: number) {
    setLocationLabel(asset.location || asset.title);
    setLocationAddress(asset.location);
    setLocationLatitude(String(lat));
    setLocationLongitude(String(lng));
  }

  function saveLocation() {
    return runCommand({
      operation: 'save_location', label: locationLabel, addressText: locationAddress, occupancyUse: locationUse,
      latitude: locationLatitude || null, longitude: locationLongitude || null,
    }, 'Location saved.').then((ok) => {
      if (ok) { setLocationLabel(''); setLocationAddress(''); setLocationUse(''); setLocationLatitude(''); setLocationLongitude(''); }
    });
  }

  return <section>
    <nav className={styles.substepNav} aria-label="Client setup checklist">
      <button className={setupView === 'classification' ? styles.activeView : ''} type="button" onClick={() => setSetupView('classification')}><span>1</span> Client profile {workspace.segments.length ? '✓' : ''}</button>
      <button className={setupView === 'locations' ? styles.activeView : ''} type="button" onClick={() => setSetupView('locations')}><span>2</span> Saved locations {realLocations.length ? '✓' : ''}</button>
      <button className={setupView === 'parties' ? styles.activeView : ''} type="button" onClick={() => setSetupView('parties')}><span>3</span> Insured parties {workspace.parties.length ? '✓' : ''}</button>
    </nav>

    {setupView === 'classification' ? <article className={styles.card}>
        <div className={styles.cardHeading}><span>Required</span><h2>What type of client is this?</h2><p>This choice controls which cover suggestions appear later.</p></div>
        <div className={styles.checkGrid}>
          {(['domestic', 'commercial'] as InsuranceClientSegment[]).map((segment) => <label className={styles.checkCard} key={segment}><input type="checkbox" checked={segments.includes(segment)} onChange={() => toggleSegment(segment)} /><span><strong>{label(segment)}</strong><small>{segment === 'domestic' ? 'Personal, household and private-use insurance' : 'Business, farming and commercial insurance'}</small></span></label>)}
        </div>
        {segments.includes('commercial') ? <><h3 className={styles.fieldGroupTitle}>Which industries apply?</h3><div className={styles.industryGrid}>{INSURANCE_INDUSTRY_PROFILES.map((industry) => <label className={styles.compactCheck} key={industry.key}><input type="checkbox" checked={industries.includes(industry.key)} onChange={() => toggleIndustry(industry.key)} /><span>{industry.label}</span></label>)}</div></> : null}
        <button className={styles.primaryButton} type="button" disabled={!segments.length || (segments.includes('commercial') && !industries.length)} onClick={() => void runCommand({ operation: 'update_profile', expectedVersion: workspace.version, segments, industryProfiles: segments.includes('commercial') ? industries : [] }, 'Client profile saved.').then((ok) => { if (ok) setSetupView('locations'); })}>Save profile and continue →</button>
      </article> : null}

    {setupView === 'locations' ? <article className={styles.card}>
        <div className={styles.cardHeading}><span>Required</span><h2>Where are the assets or risks located?</h2><p>Save at least one real location. GPS coordinates found in the shared register are shown below.</p></div>
        {assetGpsLocations.length ? <section className={styles.gpsSuggestionSection}><header><strong>GPS locations found on shared assets</strong><small>Select one to prefill the location form.</small></header><div className={styles.gpsCardGrid}>{assetGpsLocations.map(({ asset, lat, lng }) => <article className={styles.gpsCard} key={`${lat}:${lng}`}><span>Saved GPS</span><strong>{asset.location || asset.title}</strong><small>{lat.toFixed(6)}, {lng.toFixed(6)}</small><div><button type="button" onClick={() => useAssetGps(asset, lat, lng)}>Use this location</button><a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer">Open map ↗</a></div></article>)}</div></section> : <p className={styles.infoBox}>No GPS coordinates were shared. Enter a site label and address below.</p>}
        <h3 className={styles.fieldGroupTitle}>Add a saved location</h3>
        <div className={styles.formGrid}>
          <label><span>Location name *</span><input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} placeholder="For example: Main farm or George depot" /></label>
          <label><span>What happens here?</span><input value={locationUse} onChange={(event) => setLocationUse(event.target.value)} placeholder="Storage, farming, office, workshop…" /></label>
          <label className={styles.wide}><span>Street address or farm description</span><input value={locationAddress} onChange={(event) => setLocationAddress(event.target.value)} /></label>
          <label><span>GPS latitude</span><input inputMode="decimal" value={locationLatitude} onChange={(event) => setLocationLatitude(event.target.value)} placeholder="-33.9249" /></label>
          <label><span>GPS longitude</span><input inputMode="decimal" value={locationLongitude} onChange={(event) => setLocationLongitude(event.target.value)} placeholder="18.4241" /></label>
        </div>
        <button className={styles.primaryButton} type="button" disabled={!locationLabel.trim()} onClick={() => void saveLocation()}>Save location</button>
        {realLocations.length ? <><h3 className={styles.fieldGroupTitle}>Saved workspace locations</h3><div className={styles.savedLocationGrid}>{realLocations.map((location) => <article key={location.id}><span>✓ Saved</span><h3>{location.label}</h3><p>{location.addressText || location.occupancyUse || 'Address not recorded'}</p>{location.latitude && location.longitude ? <><small>{location.latitude}, {location.longitude}</small><a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">Open GPS in Maps ↗</a></> : <small>No GPS coordinates saved</small>}<strong>{location.assetIds.length} linked asset{location.assetIds.length === 1 ? '' : 's'}</strong></article>)}</div></> : null}
        <button className={styles.secondaryButton} type="button" disabled={!realLocations.length} onClick={() => setSetupView('parties')}>Continue to insured parties →</button>
      </article> : null}

    {setupView === 'parties' ? <article className={styles.card}>
        <div className={styles.cardHeading}><span>Required</span><h2>Who must be shown on the insurance?</h2><p>Start with the main insured. Add owners or financiers only when they have a separate interest.</p></div>
        <div className={styles.formGrid}>
          <label><span>Name *</span><input value={partyName} onChange={(event) => setPartyName(event.target.value)} /></label>
          <label><span>Party type</span><select value={partyType} onChange={(event) => setPartyType(event.target.value as typeof partyType)}><option value="organisation">Organisation</option><option value="person">Person</option><option value="trust">Trust</option><option value="estate">Estate</option><option value="other">Other</option></select></label>
          <label><span>Insurance role</span><select value={partyRole} onChange={(event) => setPartyRole(event.target.value as typeof partyRole)}><option value="insured">Main insured</option><option value="owner">Owner</option><option value="financier_mortgagee">Financier / mortgagee</option><option value="beneficiary">Beneficiary</option><option value="operator">Operator</option><option value="custodian">Custodian</option><option value="principal">Principal</option><option value="contractor">Contractor</option></select></label>
          <label><span>Extra explanation (optional)</span><input value={partyRoleContext} onChange={(event) => setPartyRoleContext(event.target.value)} /></label>
        </div>
        <button className={styles.primaryButton} type="button" disabled={!partyName.trim()} onClick={() => void runCommand({ operation: 'save_party', partyType, displayName: partyName, roles: [{ roleKey: partyRole, context: partyRoleContext }] }, 'Insured party saved.').then((ok) => { if (ok) { setPartyName(''); setPartyRoleContext(''); } })}>Save party</button>
        {workspace.parties.length ? <div className={styles.partyCardGrid}>{workspace.parties.map((party) => <article key={party.id}><span>{label(party.partyType)}</span><h3>{party.displayName}</h3><p>{party.roles.map((role) => `${label(role.roleKey)}${role.context ? ` — ${role.context}` : ''}`).join(', ')}</p></article>)}</div> : null}
        {workspace.parties.length ? <p className={styles.successBox}>✓ Client setup has the required profile, location and insured-party information.</p> : null}
      </article> : null}

    <details className={styles.advancedPanel}>
      <summary>Advanced: source revision and import history</summary>
      <div><h2>Authorised source</h2><p>These controls are only needed when the client sends a genuinely newer register.</p>
      <dl>
        <div><dt>Revision</dt><dd>{latestSnapshot ? latestSnapshot.revision : 'Not recorded'}</dd></div>
        <div><dt>Generated</dt><dd>{dateLabel(latestSnapshot?.generatedAtIso ?? null)}</dd></div>
        <div><dt>Imported</dt><dd>{dateLabel(latestSnapshot?.importedAtIso ?? null)}</dd></div>
        <div><dt>Assets</dt><dd>{latestSnapshot?.assetCount ?? workspace.overview.assetCount}</dd></div>
        <div><dt>Authorisation</dt><dd>{latestSnapshot?.ownerAuthorisationReference || 'Not recorded'}</dd></div>
      </dl>
      {workspace.latestSnapshotDiffs.length ? <><h3>Latest authorised changes</h3><div className={styles.simpleList}>{workspace.latestSnapshotDiffs.map((diff) => <div key={diff.id}><strong>{label(diff.changeType)}</strong><span>{diff.sourceAssetKey}</span><small>{diff.changedFields.join(', ') || 'Material fields not listed'}</small></div>)}</div></> : <p className={styles.infoBox}>No later owner-authorised snapshot revision has been ingested.</p>}
      {newerShares.length ? <><h3>Newer authorised registers</h3><div className={styles.simpleList}>{newerShares.map((share) => <div key={share.id}><strong>{dateLabel(share.createdAtIso)}</strong><span>{share.assetCount} shared assets</span><small>{share.ownerMessage || 'No owner message supplied'}</small><button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'ingest_snapshot_revision', shareId: share.id, expectedVersion: workspace.version }, 'Newer owner-authorised register imported.')}>Import this newer register</button></div>)}</div></> : <p className={styles.infoBox}>No newer register is available. The current source should remain unchanged.</p>}
      </div>
    </details>
  </section>;
}

export function InsuranceRiskObjectEditor({ riskObject, locations, runCommand, onSaved }: { riskObject: InsuranceRiskObject; locations: InsuranceLocation[]; runCommand: RunCommand; onSaved?: () => void | Promise<void> }) {
  const [objectType, setObjectType] = useState(riskObject.objectType);
  const [useDescription, setUseDescription] = useState(riskObject.useDescription);
  const [locationId, setLocationId] = useState(riskObject.locationId ?? '');
  const knownType = riskObjectTypeOptions.some(([value]) => value === objectType);

  async function save(status: InsuranceRiskObject['classificationStatus'], continueAfterSave = false) {
    const ok = await runCommand({
      operation: 'save_risk_object', id: riskObject.id, expectedVersion: riskObject.version,
      objectType, objectLabel: riskObject.objectLabel, useDescription, locationId: locationId || null, classificationStatus: status,
    }, status === 'human_confirmed' ? 'Asset classification confirmed.' : status === 'dismissed' ? 'Asset marked as not applicable.' : 'Changes saved.');
    if (ok && continueAfterSave) await onSaved?.();
  }

  return <section className={styles.classificationCard}>
    <header><div><span>Next action</span><h3>Confirm the insurance classification</h3><p>The suggested type can be changed. Choose plain-language options below, then confirm and continue.</p></div><strong>{riskObject.classificationStatus === 'human_confirmed' ? '✓ Confirmed' : 'Needs confirmation'}</strong></header>
    <div className={styles.classificationFields}>
      <label><span>What kind of insurance item is this?</span><select value={objectType} onChange={(event) => setObjectType(event.target.value)}>{!knownType ? <option value={objectType}>{label(objectType)}</option> : null}{riskObjectTypeOptions.map(([value, optionLabel]) => <option value={value} key={value}>{optionLabel}</option>)}</select><small>Shown in reports as “{riskObjectTypeOptions.find(([value]) => value === objectType)?.[1] || label(objectType)}”.</small></label>
      <label><span>Which saved location applies?</span><select value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">Choose a saved location</option>{locations.filter((location) => !location.isUnknown).map((location) => <option value={location.id} key={location.id}>{location.label}{location.latitude && location.longitude ? ' · GPS saved' : ''}</option>)}</select><small>{locationId ? 'This location will be linked to the asset.' : 'Choose a real location before confirming.'}</small></label>
      <label className={styles.wide}><span>How is it used?</span><input value={useDescription} onChange={(event) => setUseDescription(event.target.value)} placeholder="For example: Farm operations, contracting, private use…" /></label>
    </div>
    <div className={styles.classificationActions}>
      <button className={styles.primaryButton} type="button" disabled={!objectType || !locationId} onClick={() => void save('human_confirmed', true)}>{riskObject.classificationStatus === 'human_confirmed' ? 'Save and review next asset →' : 'Looks correct — confirm and continue →'}</button>
      <button className={styles.secondaryButton} type="button" onClick={() => void save('unconfirmed')}>Save without confirming</button>
    </div>
    <details className={styles.advancedInline}><summary>This item should not be included in the insurance review</summary><p>Use this only when the shared row is not an insurable asset or was included by mistake.</p><button type="button" onClick={() => void save('dismissed', true)}>Mark not applicable and continue</button></details>
  </section>;
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
    <header><div><small>{assessment.systemSuggestionRuleId ? 'Suggested for this review' : 'Added by broker'}</small><h3>{assessment.coverLabel}</h3></div><strong>{assessment.currentCoverPosition === 'unknown' ? 'Decision needed' : label(assessment.currentCoverPosition)}</strong></header>
    {assessment.systemSuggestionRationale ? <p className={styles.suggestionReason}>{assessment.systemSuggestionRationale}</p> : null}
    <h4 className={styles.decisionPrompt}>Make two decisions</h4>
    <div className={styles.formGrid}>
      <label><span>1. What does the current policy say?</span><select value={currentCoverPosition} onChange={(event) => setCurrentCoverPosition(event.target.value as InsuranceCurrentCoverPosition)}>{currentCoverOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label><span>2. What should happen next?</span><select value={placementStage} onChange={(event) => setPlacementStage(event.target.value as InsurancePlacementStage)}>{placementOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
      <label className={styles.wide}><span>Where did you confirm this? {currentCoverPosition === 'confirmed_included' ? '*' : '(optional when no evidence exists)'}</span><input value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} placeholder="For example: Santam schedule dated 15 July 2026, section 4" /></label>
      <label className={styles.wide}><span>Why is this the right decision?</span><textarea rows={2} value={brokerRationale} onChange={(event) => setBrokerRationale(event.target.value)} placeholder="Short explanation for the file and final report" /></label>
    </div>
    <button className={styles.primaryButton} type="button" disabled={currentCoverPosition === 'unknown' || placementStage === 'not_assessed' || (currentCoverPosition === 'confirmed_included' && !sourceReference.trim())} onClick={() => void saveAssessment()}>Save cover decision</button>

    <details className={styles.inlineDetails}><summary>Advanced: extensions, conditions, limits and excesses</summary>
      {assessment.components.length ? <div className={styles.simpleList}>{assessment.components.map((component) => <div key={component.id}><strong>{component.label}</strong><span>{label(component.componentType)} · {label(component.selectionStatus)}</span><small>{component.conditionsNotes || component.provenance.sourceReference || 'No additional terms recorded'}</small></div>)}</div> : <p>No structured components recorded.</p>}
      <div className={styles.formGrid}>
        <label><span>Component type</span><select value={componentType} onChange={(event) => setComponentType(event.target.value as typeof componentType)}><option value="extension">Extension</option><option value="condition">Condition</option><option value="warranty">Warranty</option><option value="endorsement">Endorsement</option></select></label>
        <label><span>Current position</span><select value={componentStatus} onChange={(event) => setComponentStatus(event.target.value as InsuranceCurrentCoverPosition)}>{currentCoverOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <label className={styles.wide}><span>Component label</span><input value={componentLabel} onChange={(event) => setComponentLabel(event.target.value)} /></label>
      </div>
      <button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'save_component', assessmentId: assessment.id, componentType, label: componentLabel, selectionStatus: componentStatus, sourceType: 'broker_recorded', sourceReference }, 'Cover component saved.').then((ok) => { if (ok) setComponentLabel(''); })}>Add component</button>
      <div className={styles.financialRows}>{assessment.financialTerms.map((term) => <div key={term.id}><strong>{label(term.termType)}</strong><span>{term.amount ? `${financialTermMoney(term)} VAT included` : term.percentage ? `${term.percentage}%` : term.timeValue ? `${term.timeValue} ${term.timeUnit}` : 'Recorded without amount'}</span></div>)}</div>
      <div className={styles.formGrid}>
        <label><span>Financial term</span><select value={termType} onChange={(event) => setTermType(event.target.value as typeof termType)}><option value="sum_insured">Sum insured</option><option value="sublimit">Sublimit</option><option value="basic_excess">Basic excess</option><option value="time_excess">Time excess</option></select></label>
        <label><span>{termType === 'time_excess' ? 'Hours' : 'Amount including VAT (ZAR)'}</span><input inputMode="decimal" value={termAmount} onChange={(event) => setTermAmount(event.target.value)} /></label>
      </div>
      <button className={styles.secondaryButton} type="button" onClick={() => void runCommand({ operation: 'save_financial_term', assessmentId: assessment.id, termType, amount: termType === 'time_excess' ? null : termAmount, timeValue: termType === 'time_excess' ? termAmount : null, timeUnit: termType === 'time_excess' ? 'hours' : '', currency: 'ZAR', vatBasis: termType === 'time_excess' ? 'not_applicable' : 'inclusive', sourceType: 'broker_recorded', sourceReference }, 'VAT-inclusive financial term saved.').then((ok) => { if (ok) setTermAmount(''); })}>Add VAT-inclusive financial term</button>
    </details>
  </article>;
}

export function InsuranceCoversPanel({ workspace, assets, runCommand }: { workspace: InsuranceWorkspaceData; assets: InsuranceWorkspaceAsset[]; runCommand: RunCommand }) {
  const [coverView, setCoverView] = useState<'exposures' | 'suggestions' | 'assessments'>(() => workspace.suggestions.some((suggestion) => suggestion.suggestedCoverKey && !suggestion.decision) ? 'suggestions' : workspace.assessments.some((assessment) => assessment.canonicalCoverKey) ? 'assessments' : 'suggestions');
  const [assessmentIndex, setAssessmentIndex] = useState(() => Math.max(0, workspace.assessments.filter((assessment) => assessment.canonicalCoverKey).findIndex((assessment) => assessment.placementStage === 'not_assessed')));
  const [query, setQuery] = useState('');
  const [family, setFamily] = useState('all');
  const [regulatoryClass, setRegulatoryClass] = useState('all');
  const [exposureLabel, setExposureLabel] = useState('');
  const [exposureType, setExposureType] = useState('liability');
  const [exposureDescription, setExposureDescription] = useState('');
  const [exposureAssetIds, setExposureAssetIds] = useState<string[]>([]);
  const [exposureLocationIds, setExposureLocationIds] = useState<string[]>([]);
  const [exposurePartyIds, setExposurePartyIds] = useState<string[]>([]);
  const existingKeys = new Set(workspace.assessments.map((assessment) => assessment.canonicalCoverKey).filter(Boolean));
  const assessments = workspace.assessments.filter((assessment) => assessment.canonicalCoverKey);
  const activeAssessment = assessments[Math.min(assessmentIndex, Math.max(0, assessments.length - 1))];
  const openSuggestions = workspace.suggestions.filter((suggestion) => suggestion.suggestedCoverKey && !suggestion.decision);
  const nonAssetExposures = workspace.exposures.filter((exposure) => exposure.exposureType !== 'physical_asset');
  const physicalAssetExposures = workspace.exposures.filter((exposure) => exposure.exposureType === 'physical_asset');
  const unreviewedAssets = workspace.riskObjects.filter((riskObject) => riskObject.classificationStatus !== 'human_confirmed');
  const families = [...new Set(INSURANCE_COVER_CATALOGUE.map((cover) => cover.familyKey))].sort();

  const filteredCatalogue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const relevant = INSURANCE_COVER_CATALOGUE.filter((cover) => {
      if (family !== 'all' && cover.familyKey !== family) return false;
      if (regulatoryClass !== 'all' && !cover.regulatoryMappings.some((mapping) => mapping.classKey === regulatoryClass)) return false;
      if (normalized && ![cover.label, cover.key, cover.familyKey, ...cover.aliases].join(' ').toLowerCase().includes(normalized)) return false;
      return Boolean(normalized || family !== 'all' || regulatoryClass !== 'all');
    });
    return relevant.slice(0, 30);
  }, [family, regulatoryClass, query]);

  function toggleLink(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  return <section>
    <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Guided cover review</span><h2>Decide what cover needs attention</h2><p>Start with the recommendations created from the client profile and reviewed assets. Nothing is treated as insured until you record policy evidence.</p></div><button type="button" onClick={() => void runCommand({ operation: 'refresh_suggestions' }, 'Cover recommendations refreshed.')}>Refresh recommendations</button></header>
    <nav className={styles.substepNav} aria-label="Cover review sections">
      <button className={coverView === 'suggestions' ? styles.activeView : ''} type="button" onClick={() => setCoverView('suggestions')}>1. Recommended covers ({openSuggestions.length})</button>
      <button className={coverView === 'exposures' ? styles.activeView : ''} type="button" onClick={() => setCoverView('exposures')}>2. Extra exposures ({nonAssetExposures.length})</button>
      <button className={coverView === 'assessments' ? styles.activeView : ''} type="button" onClick={() => setCoverView('assessments')}>3. Cover decisions ({workspace.assessments.filter((assessment) => assessment.canonicalCoverKey).length})</button>
    </nav>

    {coverView === 'suggestions' ? <>
      {unreviewedAssets.length ? <div className={styles.warningBox}><strong>Finish reviewing the assets first</strong><span>{unreviewedAssets.length} asset{unreviewedAssets.length === 1 ? '' : 's'} still need a confirmed type and saved location. Recommendations become more useful after that.</span></div> : null}
      {openSuggestions.length ? <div className={styles.recommendationGrid}>{openSuggestions.map((suggestion) => {
        const cover = INSURANCE_COVER_CATALOGUE.find((entry) => entry.key === suggestion.suggestedCoverKey);
        if (!cover) return null;
        return <article className={styles.recommendationCard} key={suggestion.id}>
          <header><span>{label(suggestion.confidence)} confidence</span><small>{label(cover.familyKey)}</small></header>
          <h3>{cover.label}</h3>
          <p>{cover.purpose}</p>
          <details><summary>Why this was recommended</summary><p>{suggestion.rationale}</p></details>
          <div><button className={styles.primaryButton} type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'accepted_for_assessment', rationale: 'Added by the broker for cover review.' }, `${cover.label} added to cover decisions.`)}>Review this cover</button><button type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'information_required', rationale: 'More information is needed before this cover can be decided.' }, 'Recommendation marked for more information.')}>Need information</button><button type="button" onClick={() => void runCommand({ operation: 'decide_suggestion', suggestionId: suggestion.id, decision: 'dismissed_with_reason', rationale: 'Reviewed by the broker and not relevant to this client.' }, 'Recommendation marked not relevant.')}>Not relevant</button></div>
        </article>;
      })}</div> : <div className={styles.successBox}><strong>✓ No recommendations are waiting for review.</strong><span>{unreviewedAssets.length ? 'Finish the asset review, then refresh recommendations.' : assessments.length ? 'Continue to cover decisions, or search the catalogue if something is missing.' : 'Refresh recommendations to build a shortlist from the completed client and asset information.'}</span></div>}
      <div className={styles.nextActionRow}><button className={styles.primaryButton} type="button" disabled={!assessments.length} onClick={() => setCoverView('assessments')}>Continue to cover decisions →</button><button className={styles.secondaryButton} type="button" onClick={() => setCoverView('exposures')}>Add an extra exposure</button></div>
      <details className={styles.advancedPanel}>
        <summary>Can’t find a cover? Search the full catalogue</summary>
        <article className={styles.card}>
          <p>Use this only when the recommended shortlist does not include the cover you need.</p>
          <div className={styles.catalogueFilters}>
            <label><span>Search cover name</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="For example: business interruption" /></label>
            <label><span>Cover family</span><select value={family} onChange={(event) => setFamily(event.target.value)}><option value="all">Choose a family</option>{families.map((entry) => <option key={entry} value={entry}>{label(entry)}</option>)}</select></label>
            <label><span>Regulatory class</span><select value={regulatoryClass} onChange={(event) => setRegulatoryClass(event.target.value)}><option value="all">Choose a class</option>{INSURANCE_REGULATORY_CLASSES.map((entry) => <option value={entry.key} key={entry.key}>{entry.label}</option>)}</select></label>
          </div>
          {!query.trim() && family === 'all' && regulatoryClass === 'all' ? <p className={styles.infoBox}>Enter a cover name or choose a filter to see matching covers.</p> : <div className={styles.catalogueList}>{filteredCatalogue.map((cover) => <article key={cover.key}><div><small>{label(cover.familyKey)}</small><h3>{cover.label}</h3><p>{cover.purpose}</p></div><button type="button" disabled={existingKeys.has(cover.key)} onClick={() => void runCommand({ operation: 'save_assessment', canonicalCoverKey: cover.key, coverLabel: cover.label, exposureStatus: 'discovered', currentCoverPosition: 'unknown', placementStage: 'not_assessed', sourceType: 'broker_recorded', sourceReference: 'Selected by broker from cover catalogue' }, `${cover.label} added to cover decisions.`)}>{existingKeys.has(cover.key) ? 'Already added' : 'Add to review'}</button></article>)}</div>}
        </article>
      </details>
    </> : null}

    {coverView === 'exposures' ? <><div className={styles.assetExposureSummary}><strong>{physicalAssetExposures.length} asset exposure{physicalAssetExposures.length === 1 ? '' : 's'} already carried across</strong><span>You do not need to add the shared assets again. Only add risks that are not represented by an asset—such as liability, income, people, crops or cyber.</span></div><div className={styles.overviewGrid}>
      <article className={styles.card}>
        <div className={styles.cardHeading}><span>Optional</span><h2>Add an extra exposure</h2><p>Only add something here when it is not already one of the shared assets.</p></div>
        <div className={styles.formGrid}>
          <label><span>Exposure type</span><select value={exposureType} onChange={(event) => setExposureType(event.target.value)}><option value="liability">Liability</option><option value="income">Income / business interruption</option><option value="people">People</option><option value="receivables">Receivables</option><option value="contract">Contract or project</option><option value="crop">Crop field</option><option value="animal">Animals</option><option value="cyber">Data / cyber</option><option value="other">Other</option></select></label>
          <label><span>Short name *</span><input value={exposureLabel} onChange={(event) => setExposureLabel(event.target.value)} placeholder="For example: Public liability" /></label>
          <label className={styles.wide}><span>What could be lost or go wrong?</span><textarea rows={3} value={exposureDescription} onChange={(event) => setExposureDescription(event.target.value)} /></label>
        </div>
        <details className={styles.linkedAdvanced}><summary>Link this exposure to specific records (optional)</summary><div>
          <fieldset><legend>Assets</legend>{assets.map((asset) => <label key={asset.id}><input type="checkbox" checked={exposureAssetIds.includes(asset.id)} onChange={() => toggleLink(asset.id, exposureAssetIds, setExposureAssetIds)} /> {asset.title}</label>)}</fieldset>
          <fieldset><legend>Locations</legend>{workspace.locations.filter((location) => !location.isUnknown).map((location) => <label key={location.id}><input type="checkbox" checked={exposureLocationIds.includes(location.id)} onChange={() => toggleLink(location.id, exposureLocationIds, setExposureLocationIds)} /> {location.label}</label>)}</fieldset>
          <fieldset><legend>Parties</legend>{workspace.parties.map((party) => <label key={party.id}><input type="checkbox" checked={exposurePartyIds.includes(party.id)} onChange={() => toggleLink(party.id, exposurePartyIds, setExposurePartyIds)} /> {party.displayName}</label>)}</fieldset>
        </div></details>
        <button className={styles.primaryButton} type="button" disabled={!exposureLabel.trim()} onClick={() => void runCommand({ operation: 'save_exposure', exposureType, label: exposureLabel, description: exposureDescription, exposureStatus: 'confirmed', assetIds: exposureAssetIds, locationIds: exposureLocationIds, partyIds: exposurePartyIds }, 'Extra exposure added.').then((ok) => { if (ok) { setExposureLabel(''); setExposureDescription(''); setExposureAssetIds([]); setExposureLocationIds([]); setExposurePartyIds([]); } })}>Save extra exposure</button>
      </article>
      <article className={styles.card}>
        <h2>Saved extra exposures</h2>
        {nonAssetExposures.length ? <div className={styles.simpleList}>{nonAssetExposures.map((exposure) => <div key={exposure.id}><strong>{exposure.label}</strong><span>{label(exposure.exposureType)} · {label(exposure.exposureStatus)}</span><small>{exposure.assetIds.length ? `${exposure.assetIds.length} linked assets` : 'Not linked to a specific asset'}{exposure.description ? ` · ${exposure.description}` : ''}</small></div>)}</div> : <p className={styles.infoBox}>No extra exposures added. That is fine if the shared asset list covers the risk review.</p>}
      </article>
    </div><button className={styles.secondaryButton} type="button" onClick={() => setCoverView('suggestions')}>Back to recommended covers</button></> : null}

    {coverView === 'assessments' ? <>{activeAssessment ? <><div className={styles.assetReviewNav}>
      <button type="button" disabled={assessmentIndex <= 0} onClick={() => setAssessmentIndex((current) => Math.max(0, current - 1))}>← Previous</button>
      <label><span>Cover {assessmentIndex + 1} of {assessments.length}</span><select value={activeAssessment.id} onChange={(event) => setAssessmentIndex(assessments.findIndex((assessment) => assessment.id === event.target.value))}>{assessments.map((assessment, index) => <option value={assessment.id} key={assessment.id}>{index + 1}. {assessment.coverLabel} · {label(assessment.placementStage)}</option>)}</select></label>
      <button type="button" disabled={assessmentIndex >= assessments.length - 1} onClick={() => setAssessmentIndex((current) => Math.min(assessments.length - 1, current + 1))}>Next cover →</button>
    </div><div className={styles.assessmentList}><AssessmentEditor key={`${activeAssessment.id}-${activeAssessment.version}`} assessment={activeAssessment} runCommand={runCommand} /></div></> : <p className={styles.infoBox}>No cover assessments have been added yet. Return to Areas to consider to add one.</p>}
    {!assets.length ? null : <p className={styles.infoBox}>You will link individual assets to the correct schedule item when you record the policy evidence.</p>}</> : null}
  </section>;
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
  const [policyId, setPolicyId] = useState(workspace.policies[0]?.id ?? '');
  const [sectionLabel, setSectionLabel] = useState('');
  const [canonicalCoverKey, setCanonicalCoverKey] = useState('');
  const [wordingReference, setWordingReference] = useState('');
  const [sectionId, setSectionId] = useState(workspace.policies.flatMap((policy) => policy.sections)[0]?.id ?? '');
  const [itemLabel, setItemLabel] = useState('');
  const [treatment, setTreatment] = useState<'individual' | 'grouped' | 'blanket' | 'unscheduled'>('individual');
  const [assetIds, setAssetIds] = useState<string[]>([]);
  const [exposureIds, setExposureIds] = useState<string[]>([]);
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [partyIds, setPartyIds] = useState<string[]>([]);
  const [financialScheduleItemId, setFinancialScheduleItemId] = useState(workspace.policies.flatMap((policy) => policy.sections).flatMap((section) => section.scheduleItems)[0]?.id ?? '');
  const [scheduleTermType, setScheduleTermType] = useState<'sum_insured' | 'any_one_item_limit' | 'any_one_event_limit' | 'any_one_location_limit' | 'annual_aggregate' | 'sublimit' | 'basic_excess' | 'additional_excess' | 'percentage_excess' | 'time_excess' | 'coinsurance'>('sum_insured');
  const [scheduleTermValue, setScheduleTermValue] = useState('');
  const sections = workspace.policies.flatMap((policy) => policy.sections);
  const scheduleItems = sections.flatMap((section) => section.scheduleItems);
  const scheduleTermUsesPercentage = scheduleTermType === 'percentage_excess' || scheduleTermType === 'coinsurance';
  const scheduleTermUsesTime = scheduleTermType === 'time_excess';

  function toggleScheduleLink(value: string, current: string[], setter: (next: string[]) => void) {
    setter(current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  return <section>
    <header className={styles.sectionHeader}><div><span className={styles.eyebrow}>Follow the document from top to bottom</span><h2>Copy the current policy schedule</h2><p>Add the policy, its section, the relevant schedule line, then the VAT-inclusive limit or excess shown on the document.</p></div></header>
    <nav className={styles.substepNav} aria-label="Policy capture sections">
      <button className={policyView === 'policy' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('policy')}>1. Policy details {workspace.policies.length ? '✓' : ''}</button>
      <button className={policyView === 'section' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('section')}>2. Policy section {sections.length ? '✓' : ''}</button>
      <button className={policyView === 'schedule' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('schedule')}>3. Schedule line {scheduleItems.length ? '✓' : ''}</button>
      <button className={policyView === 'terms' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('terms')}>4. Value / excess</button>
      <button className={policyView === 'review' ? styles.activeView : ''} type="button" onClick={() => setPolicyView('review')}>5. Check</button>
    </nav>
    <div className={`${styles.workflowGrid} ${styles.singleWorkflow}`}>
      {policyView === 'policy' ? <article className={styles.card}><div className={styles.cardHeading}><span>Start here</span><h2>Copy the policy heading</h2><p>Use exactly what appears on the insurer&apos;s schedule so another broker can trace it later.</p></div><div className={styles.formGrid}>
        <label><span>Insurer *</span><input value={insurerName} onChange={(event) => setInsurerName(event.target.value)} placeholder="Insurer name" /></label>
        <label><span>Policy number *</span><input value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} /></label>
        <label><span>Product name (optional)</span><input value={productName} onChange={(event) => setProductName(event.target.value)} /></label>
        <label><span>Where did you get this? *</span><input value={policySource} onChange={(event) => setPolicySource(event.target.value)} placeholder="Document name, email or schedule reference" /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!insurerName.trim() || !policyNumber.trim() || !policySource.trim()} onClick={() => void runCommand({ operation: 'save_policy', insurerName, productName, policyNumber, status: 'current', sourceType: 'policy_schedule', sourceReference: policySource }, 'Policy details saved.').then((ok) => { if (ok) { setInsurerName(''); setProductName(''); setPolicyNumber(''); setPolicyView('section'); } })}>Save policy and continue →</button></article> : null}

      {policyView === 'section' ? <article className={styles.card}><div className={styles.cardHeading}><span>Next</span><h2>Copy one section heading</h2><p>Keep the insurer&apos;s wording. Matching it to a cover is optional but useful.</p></div><div className={styles.formGrid}>
        <label><span>Policy</span><select value={policyId} onChange={(event) => setPolicyId(event.target.value)}><option value="">Select policy</option>{workspace.policies.map((policy) => <option value={policy.id} key={policy.id}>{[policy.insurerName, policy.policyNumber].filter(Boolean).join(' · ') || 'Unnamed policy'}</option>)}</select></label>
        <label><span>Section heading *</span><input value={sectionLabel} onChange={(event) => setSectionLabel(event.target.value)} placeholder="For example: Agricultural vehicles" /></label>
        <label><span>Match to a cover (optional)</span><select value={canonicalCoverKey} onChange={(event) => setCanonicalCoverKey(event.target.value)}><option value="">Leave unmatched</option>{INSURANCE_COVER_CATALOGUE.map((cover) => <option value={cover.key} key={cover.key}>{cover.label}</option>)}</select></label>
        <label><span>Wording edition / page reference</span><input value={wordingReference} onChange={(event) => setWordingReference(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!policyId || !sectionLabel.trim()} onClick={() => void runCommand({ operation: 'save_section', policyId, canonicalCoverKey: canonicalCoverKey || null, actualSectionLabel: sectionLabel, wordingEditionReference: wordingReference, status: 'current', sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'Policy section saved.').then((ok) => { if (ok) { setSectionLabel(''); setPolicyView('schedule'); } })}>Save section and continue →</button></article> : null}

      {policyView === 'schedule' ? <article className={styles.card}><div className={styles.cardHeading}><span>Then</span><h2>Copy the relevant schedule line</h2><p>Choose what this line applies to by ticking cards. There is no Ctrl/Cmd multi-select.</p></div><div className={styles.formGrid}>
        <label><span>Policy section</span><select value={sectionId} onChange={(event) => setSectionId(event.target.value)}><option value="">Select section</option>{sections.map((section) => <option value={section.id} key={section.id}>{section.actualSectionLabel}</option>)}</select></label>
        <label><span>How the schedule treats these items</span><select value={treatment} onChange={(event) => setTreatment(event.target.value as typeof treatment)}><option value="individual">Each item listed separately</option><option value="grouped">Several items grouped together</option><option value="blanket">One blanket amount</option><option value="unscheduled">Not individually scheduled</option></select></label>
        <label className={styles.wide}><span>Schedule line label *</span><input value={itemLabel} onChange={(event) => setItemLabel(event.target.value)} /></label>
      </div><div className={styles.scheduleLinkGrid}>
        <fieldset><legend>Which assets are on this line?</legend>{assets.map((asset) => <label key={asset.id}><input type="checkbox" checked={assetIds.includes(asset.id)} onChange={() => toggleScheduleLink(asset.id, assetIds, setAssetIds)} /><span>{asset.title}<small>{asset.location || 'No location supplied'}</small></span></label>)}</fieldset>
        <fieldset><legend>Locations or parties (optional)</legend>{workspace.locations.filter((location) => !location.isUnknown).map((location) => <label key={location.id}><input type="checkbox" checked={locationIds.includes(location.id)} onChange={() => toggleScheduleLink(location.id, locationIds, setLocationIds)} /><span>{location.label}<small>Saved location</small></span></label>)}{workspace.parties.map((party) => <label key={party.id}><input type="checkbox" checked={partyIds.includes(party.id)} onChange={() => toggleScheduleLink(party.id, partyIds, setPartyIds)} /><span>{party.displayName}<small>{party.roles.map((role) => label(role.roleKey)).join(', ')}</small></span></label>)}</fieldset>
      </div><details className={styles.linkedAdvanced}><summary>Link an extra non-asset exposure</summary><div><fieldset><legend>Extra exposures</legend>{workspace.exposures.filter((exposure) => exposure.exposureType !== 'physical_asset').map((exposure) => <label key={exposure.id}><input type="checkbox" checked={exposureIds.includes(exposure.id)} onChange={() => toggleScheduleLink(exposure.id, exposureIds, setExposureIds)} /> {exposure.label}</label>)}</fieldset></div></details><button className={styles.primaryButton} type="button" disabled={!sectionId || !itemLabel.trim()} onClick={() => void runCommand({ operation: 'save_schedule_item', sectionId, itemLabel, treatment, assetIds, exposureIds, locationIds, partyIds, sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'Schedule line saved.').then((ok) => { if (ok) { setItemLabel(''); setAssetIds([]); setExposureIds([]); setLocationIds([]); setPartyIds([]); setPolicyView('terms'); } })}>Save schedule line and continue →</button></article> : null}

      {policyView === 'terms' ? <article className={styles.card}><div className={styles.cardHeading}><span>VAT included</span><h2>Add the value, limit or excess</h2><p>Enter monetary amounts exactly as the client pays them, including VAT. Percentages and time excesses are labelled separately.</p></div><div className={styles.formGrid}>
        <label><span>Schedule item</span><select value={financialScheduleItemId} onChange={(event) => setFinancialScheduleItemId(event.target.value)}><option value="">Select schedule item</option>{scheduleItems.map((item) => <option value={item.id} key={item.id}>{item.itemLabel}</option>)}</select></label>
        <label><span>What is this amount?</span><select value={scheduleTermType} onChange={(event) => setScheduleTermType(event.target.value as typeof scheduleTermType)}><option value="sum_insured">Sum insured</option><option value="any_one_item_limit">Any one item limit</option><option value="any_one_event_limit">Any one event limit</option><option value="any_one_location_limit">Any one location limit</option><option value="annual_aggregate">Annual aggregate</option><option value="sublimit">Sublimit</option><option value="basic_excess">Basic excess</option><option value="additional_excess">Additional excess</option><option value="percentage_excess">Percentage excess</option><option value="time_excess">Time excess</option><option value="coinsurance">Co-insurance</option></select></label>
        <label><span>{scheduleTermUsesTime ? 'Hours' : scheduleTermUsesPercentage ? 'Percentage' : 'VAT-inclusive amount (ZAR)'}</span><input inputMode="decimal" value={scheduleTermValue} onChange={(event) => setScheduleTermValue(event.target.value)} /></label>
      </div><button className={styles.primaryButton} type="button" disabled={!financialScheduleItemId || !scheduleTermValue.trim()} onClick={() => void runCommand({ operation: 'save_financial_term', scheduleItemId: financialScheduleItemId, termType: scheduleTermType, amount: scheduleTermUsesPercentage || scheduleTermUsesTime ? null : scheduleTermValue, percentage: scheduleTermUsesPercentage ? scheduleTermValue : null, timeValue: scheduleTermUsesTime ? scheduleTermValue : null, timeUnit: scheduleTermUsesTime ? 'hours' : '', currency: 'ZAR', vatBasis: scheduleTermUsesPercentage || scheduleTermUsesTime ? 'not_applicable' : 'inclusive', sourceType: 'policy_schedule', sourceReference: policySource || 'Broker-recorded policy schedule' }, 'VAT-inclusive policy term saved.').then((ok) => { if (ok) { setScheduleTermValue(''); setPolicyView('review'); } })}>Save value and check policy →</button><button className={styles.secondaryButton} type="button" onClick={() => setPolicyView('review')}>No value shown — check policy</button></article> : null}
    </div>

    {policyView === 'review' ? <><div className={styles.policyList}>{workspace.policies.map((policy) => <article className={styles.card} key={policy.id}><header className={styles.policyHeader}><div><small>{policy.productName || 'Current policy'}</small><h2>{[policy.insurerName, policy.policyNumber].filter(Boolean).join(' · ') || 'Policy details incomplete'}</h2></div><strong>✓ Saved</strong></header>{policy.sections.length ? policy.sections.map((section) => <details className={styles.policySection} key={section.id} open><summary><span>{section.actualSectionLabel}</span><small>{section.canonicalCoverKey ? INSURANCE_COVER_CATALOGUE.find((cover) => cover.key === section.canonicalCoverKey)?.label : 'Not matched to a catalogue cover'}</small></summary><p>Wording: {section.wordingEditionReference || 'Not recorded'} · Source: {section.provenance.sourceReference || label(section.provenance.sourceType)}</p>{section.scheduleItems.length ? <div className={styles.simpleList}>{section.scheduleItems.map((item) => <div key={item.id}><strong>{item.itemLabel}</strong><span>{label(item.treatment)} · {item.assetIds.length} assets · {item.locationIds.length} locations</span><small>{item.financialTerms.length ? item.financialTerms.map((term) => `${label(term.termType)}: ${term.amount ? `${financialTermMoney(term)} VAT included` : term.percentage ? `${term.percentage}%` : term.timeValue ? `${term.timeValue} ${term.timeUnit}` : 'Recorded'}`).join(' · ') : 'No value or excess recorded'}</small></div>)}</div> : <p className={styles.infoBox}>No schedule lines recorded yet.</p>}</details>) : <p className={styles.infoBox}>No policy sections recorded yet.</p>}</article>)}</div>{!workspace.policies.length ? <p className={styles.infoBox}>No policy evidence has been recorded. Return to Policy details to start.</p> : <p className={styles.successBox}>✓ Policy evidence saved. Check that every confirmed current cover has a matching section or schedule line.</p>}</> : null}
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
