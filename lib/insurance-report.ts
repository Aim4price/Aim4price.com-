import { getDb } from './db';
import type { InsuranceFinancialTerm, InsuranceReportType, InsuranceWorkspaceData } from './insurance-workspace-types';
import { getInsuranceWorkspace } from './insurance-workspaces';
import { INSURANCE_COVER_BY_KEY } from './insurance-cover-catalogue';
import { getInsuranceWorkspaceReadiness } from './insurance-workspace-readiness';

type BrokerDetails = {
  displayName: string;
  businessName: string;
  email: string;
  phone: string;
  logoUrl: string;
};

export type InsuranceReportPayload = {
  workspace: InsuranceWorkspaceData;
  broker: BrokerDetails;
  type: InsuranceReportType;
  reference: string;
  generatedAtIso: string;
};

const DISCLAIMER = 'This report reflects information and human decisions recorded by the broker or authorised insurance user. System-generated items are labelled as areas to consider and are not financial advice, confirmation of cover, insurer acceptance or a substitute for the applicable schedule, wording and endorsements. Aim4price does not independently confirm insurance cover.';
const VAT_MULTIPLIER = 1.15;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function money(value: number | string | null | undefined, currency = 'ZAR'): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 'Not recorded';
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency, maximumFractionDigits: 2 }).format(parsed);
}

function vatIncluded(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * VAT_MULTIPLIER : null;
}

function financialAmountVatIncluded(term: InsuranceFinancialTerm): number | null {
  const amount = nullableNumber(term.amount);
  if (amount === null) return null;
  return term.vatBasis === 'exclusive' ? amount * VAT_MULTIPLIER : amount;
}

function financialTermReportLabel(term: InsuranceFinancialTerm): string {
  if (term.amount) {
    const basis = term.vatBasis === 'exclusive' ? 'VAT excl.' : term.vatBasis === 'inclusive' ? 'VAT incl.' : 'VAT basis unconfirmed';
    const normalized = term.vatBasis === 'exclusive' ? ` (${money(financialAmountVatIncluded(term), term.currency)} VAT incl. comparison)` : '';
    return `${money(term.amount, term.currency)} ${basis}${normalized}`;
  }
  if (term.percentage) return `${term.percentage}%`;
  if (term.timeValue) return `${term.timeValue} ${term.timeUnit}`;
  return 'Recorded';
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not recorded'
    : new Intl.DateTimeFormat('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Africa/Johannesburg' }).format(date);
}

function label(value: string): string {
  return value ? value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not recorded';
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'insurance-report';
}

function reportSafeWorkspace(workspace: InsuranceWorkspaceData): InsuranceWorkspaceData {
  return {
    ...workspace,
    availableSnapshotShares: [],
    notes: workspace.notes.filter((note) => note.noteType === 'report_visible'),
  };
}

export async function createInsuranceReportSnapshot(input: {
  brokerUserId: string;
  workspaceId: string;
  type: InsuranceReportType;
  broker: BrokerDetails;
}) {
  const liveWorkspace = await getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
  const readiness = getInsuranceWorkspaceReadiness(liveWorkspace);
  if (!readiness.ready) throw new Error(`INSURANCE_REPORT_NOT_READY:${readiness.issues.length}`);
  const workspace = reportSafeWorkspace(liveWorkspace);
  const db = getDb();
  const client = await db.connect();
  try {
    await client.query('begin');
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [`insurance-report:${input.workspaceId}:${input.type}`]);
    const revisionResult = await client.query<{ revision: number }>(
      `select coalesce(max(revision), 0)::int + 1 as revision
       from insurance_report_snapshots where workspace_id = $1::uuid and report_type = $2`,
      [input.workspaceId, input.type],
    );
    const revision = revisionResult.rows[0]?.revision ?? 1;
    const generatedAtIso = new Date().toISOString();
    const typeCode = input.type === 'summary' ? 'SUM' : 'DET';
    const reference = `${workspace.snapshotReference}-${typeCode}-${String(revision).padStart(2, '0')}`;
    const filename = `${slug(`${workspace.clientName}-${input.type}-insurance-review-${revision}`)}.html`;
    const payload: InsuranceReportPayload = { workspace, broker: input.broker, type: input.type, reference, generatedAtIso };
    const latestSnapshot = workspace.snapshotRevisions[0];
    const result = await client.query<{ id: string }>(
      `insert into insurance_report_snapshots
        (workspace_id, report_type, revision, report_reference, filename, payload_json,
         generated_by_user_id, generated_at, payload_schema_version,
         source_snapshot_revision_id, catalogue_version)
       values ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8::timestamptz, 1, $9::uuid, $10)
       returning id`,
      [input.workspaceId, input.type, revision, reference, filename, JSON.stringify(payload), input.brokerUserId, generatedAtIso, latestSnapshot?.id ?? null, workspace.catalogueVersion],
    );
    await client.query(
      `insert into insurance_review_events
        (workspace_id, actor_user_id, entity_type, entity_id, action, after_json)
       values ($1::uuid, $2, 'report_snapshot', $3, 'generated', $4::jsonb)`,
      [input.workspaceId, input.brokerUserId, result.rows[0].id, JSON.stringify({ type: input.type, revision, reference, schemaVersion: 1, snapshotRevision: latestSnapshot?.revision ?? null })],
    );
    await client.query('commit');
    return { id: result.rows[0].id, type: input.type, revision, reference, filename, generatedAtIso };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function getInsuranceReportSnapshot(brokerUserId: string, reportId: string) {
  const result = await getDb().query<{ filename: string; payload_json: unknown }>(
    `select r.filename, r.payload_json
     from insurance_report_snapshots r
     join insurance_workspaces w on w.id = r.workspace_id
     where r.id = $1::uuid and w.broker_user_id = $2
     limit 1`,
    [reportId, brokerUserId],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_REPORT_NOT_FOUND');
  return { filename: result.rows[0].filename, payload: result.rows[0].payload_json as InsuranceReportPayload };
}

function baseStyles(type: InsuranceReportType): string {
  return `
    @page { size: ${type === 'summary' ? 'A4 landscape' : 'A4 portrait'}; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17332d; font: 10.5px/1.42 Arial, sans-serif; background: #fff; }
    .page { max-width: 1180px; margin: 0 auto; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 14px; border-bottom: 3px solid #153f35; }
    header img { max-width: 180px; max-height: 58px; object-fit: contain; }
    h1 { margin: 0; font-size: 25px; letter-spacing: -.5px; }
    h2 { margin: 22px 0 8px; font-size: 16px; }
    h3 { margin: 18px 0 7px; font-size: 13px; }
    p { margin: 3px 0; }
    .muted { color: #63736f; }
    .meta { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 14px 0; }
    .meta div { padding: 9px; border: 1px solid #d8e1de; }
    .meta small { display: block; color: #62716d; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 7px 6px; border: 1px solid #d6dfdc; vertical-align: top; word-break: break-word; }
    th { color: #fff; background: #1d5144; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .3px; }
    tr:nth-child(even) td { background: #f5f8f7; }
    .right { text-align: right; }
    .section { break-inside: avoid; }
    .callout { margin: 10px 0; padding: 10px 12px; border-left: 4px solid #2d7b60; background: #f3f8f6; }
    .disclaimer { margin-top: 22px; padding: 10px 12px; border: 1px solid #d6dfdc; background: #f7f9f8; color: #56635f; font-size: 9px; }
    .print { position: fixed; right: 18px; bottom: 18px; padding: 10px 14px; border: 0; color: #fff; background: #153f35; cursor: pointer; }
    @media print { .print { display: none; } .page { max-width: none; } }
  `;
}

function reportHeader(payload: InsuranceReportPayload): string {
  const { workspace, broker } = payload;
  const segments = workspace.segments.length ? workspace.segments.map(label).join(' and ') : 'Not classified';
  const industries = workspace.industryProfiles.length ? workspace.industryProfiles.map(label).join(', ') : 'Not recorded';
  const snapshot = workspace.snapshotRevisions[0];
  return `
    <header>
      <div>
        <h1>${escapeHtml(payload.type === 'summary' ? 'Insurance Review Summary' : 'Detailed Insurance Review')}</h1>
        <p class="muted">${escapeHtml(workspace.clientName)} · ${escapeHtml(payload.reference)}</p>
      </div>
      ${broker.logoUrl ? `<img src="${escapeHtml(broker.logoUrl)}" alt="${escapeHtml(broker.businessName || broker.displayName)} logo" />` : `<strong>${escapeHtml(broker.businessName || broker.displayName || 'Insurance broker')}</strong>`}
    </header>
    <div class="meta">
      <div><small>Client</small><strong>${escapeHtml(workspace.clientName)}</strong></div>
      <div><small>Client segment</small><strong>${escapeHtml(segments)}</strong></div>
      <div><small>Industry profiles</small><strong>${escapeHtml(industries)}</strong></div>
      <div><small>Generated</small><strong>${escapeHtml(dateLabel(payload.generatedAtIso))}</strong></div>
      <div><small>Source snapshot</small><strong>${escapeHtml(snapshot ? `Revision ${snapshot.revision} · ${dateLabel(snapshot.generatedAtIso)}` : workspace.snapshotReference)}</strong></div>
      <div><small>Assets</small><strong>${workspace.assetCount}</strong></div>
      <div><small>Replacement values (VAT included)</small><strong>${escapeHtml(money(vatIncluded(workspace.totalReplacementValue)))}</strong></div>
      <div><small>Prepared by</small><strong>${escapeHtml(broker.businessName || broker.displayName)}</strong></div>
    </div>`;
}

function currentCoverSummary(payload: InsuranceReportPayload): string {
  const counts = payload.workspace.overview.currentCoverCounts;
  return `<h2>Recorded current-cover position</h2>
    <table><thead><tr><th>Confirmed included</th><th>Confirmed excluded</th><th>Unknown</th><th>Not recorded</th><th>Covered elsewhere</th><th>Not applicable</th></tr></thead>
    <tbody><tr><td>${counts.confirmed_included}</td><td>${counts.confirmed_excluded}</td><td>${counts.unknown}</td><td>${counts.not_recorded}</td><td>${counts.covered_elsewhere}</td><td>${counts.not_applicable}</td></tr></tbody></table>`;
}

function reviewQualitySummary(payload: InsuranceReportPayload): string {
  const workspace = payload.workspace;
  const currentPolicies = workspace.policies.filter((policy) => policy.status === 'current');
  const renewalDates = currentPolicies.map((policy) => policy.renewalDate || policy.effectiveTo).filter(Boolean).sort();
  const openQuestions = workspace.informationRequests.filter((request) => !['resolved', 'not_applicable'].includes(request.status));
  const moneyTerms = [
    ...workspace.assessments.flatMap((assessment) => assessment.financialTerms),
    ...workspace.policies.flatMap((policy) => policy.sections.flatMap((section) => section.scheduleItems.flatMap((item) => item.financialTerms))),
  ].filter((term) => term.amount);
  const confirmedVatTerms = moneyTerms.filter((term) => ['inclusive', 'exclusive'].includes(term.vatBasis));
  return `<h2>Review control summary</h2><div class="meta">
    <div><small>Assets classified</small><strong>${workspace.riskObjects.filter((riskObject) => riskObject.classificationStatus !== 'unconfirmed').length}/${workspace.assetCount}</strong></div>
    <div><small>Current policies</small><strong>${currentPolicies.length}</strong></div>
    <div><small>Next renewal</small><strong>${escapeHtml(dateLabel(renewalDates[0]))}</strong></div>
    <div><small>Open client questions</small><strong>${openQuestions.length}</strong></div>
    <div><small>Money terms with VAT confirmed</small><strong>${confirmedVatTerms.length}/${moneyTerms.length}</strong></div>
    <div><small>Policy sections</small><strong>${currentPolicies.reduce((total, policy) => total + policy.sections.length, 0)}</strong></div>
    <div><small>Evidence references</small><strong>${workspace.evidence.length}</strong></div>
    <div><small>Review status</small><strong>Ready at report generation</strong></div>
  </div>`;
}

function assetTable(payload: InsuranceReportPayload): string {
  const assessmentByAsset = new Map<string, InsuranceWorkspaceData['assessments']>();
  payload.workspace.assessments.forEach((assessment) => assessment.assetIds.forEach((assetId) => assessmentByAsset.set(assetId, [...(assessmentByAsset.get(assetId) ?? []), assessment])));
  const scheduleTermsByAsset = new Map<string, InsuranceFinancialTerm[]>();
  payload.workspace.policies.forEach((policy) => policy.sections.forEach((section) => section.scheduleItems.forEach((item) => item.assetIds.forEach((assetId) => {
    scheduleTermsByAsset.set(assetId, [...(scheduleTermsByAsset.get(assetId) ?? []), ...item.financialTerms]);
  }))));
  const rows = payload.workspace.assets.map((asset) => {
    const assessments = assessmentByAsset.get(asset.id) ?? [];
    const sumTerms = assessments.flatMap((assessment) => assessment.financialTerms).filter((term) => term.termType === 'sum_insured');
    const scheduleSumTerms = (scheduleTermsByAsset.get(asset.id) ?? []).filter((term) => term.termType === 'sum_insured');
    const recordedSum = scheduleSumTerms[0] ?? sumTerms[0];
    const current = assessments.length ? [...new Set(assessments.map((assessment) => label(assessment.currentCoverPosition)))].join(', ') : 'Unknown';
    const ownerInsuredValue = nullableNumber(asset.snapshot.insuredValueExVat);
    return `<tr>
      <td>${escapeHtml(asset.title)}</td><td>${escapeHtml(asset.kind)}</td><td>${escapeHtml(asset.location || 'Unknown / not supplied')}</td>
      <td class="right">${escapeHtml(money(vatIncluded(asset.replacementValue)))}</td>
      <td class="right">${escapeHtml(money(vatIncluded(ownerInsuredValue)))}</td>
      <td class="right">${escapeHtml(recordedSum ? money(financialAmountVatIncluded(recordedSum), recordedSum.currency) : 'Not recorded')}</td>
      <td>${escapeHtml(current)}</td>
      <td>${escapeHtml(assessments.map((assessment) => assessment.coverLabel).join(', ') || 'Not assessed')}</td>
    </tr>`;
  }).join('');
  return `<h2>Locations and asset inventory</h2>
    <table><thead><tr><th>Asset</th><th>Risk object</th><th>Location</th><th>Replacement value (VAT incl.)</th><th>Owner-provided insured value (VAT incl.)</th><th>Recorded sum insured (VAT incl.)</th><th>Current-cover position</th><th>Linked covers / sections</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">No assets recorded.</td></tr>'}</tbody></table>`;
}

function exposureAndPartyInventory(payload: InsuranceReportPayload): string {
  const workspace = payload.workspace;
  const locationRows = workspace.locations.map((location) => `<tr><td>${escapeHtml(location.label)}</td><td>${escapeHtml(location.isUnknown ? 'Unknown / not supplied' : location.addressText || 'Not recorded')}</td><td>${escapeHtml(location.latitude && location.longitude ? `${location.latitude}, ${location.longitude}` : 'Not recorded')}</td><td>${escapeHtml(location.occupancyUse || 'Not recorded')}</td><td>${location.assetIds.length}</td></tr>`).join('');
  const exposureRows = workspace.exposures.map((exposure) => `<tr><td>${escapeHtml(exposure.label)}</td><td>${escapeHtml(label(exposure.exposureType))}</td><td>${escapeHtml(label(exposure.exposureStatus))}</td><td>${exposure.assetIds.length} assets · ${exposure.locationIds.length} locations · ${exposure.partyIds.length} parties</td><td>${escapeHtml(exposure.provenance.sourceReference || label(exposure.provenance.sourceType))}</td></tr>`).join('');
  const partyRows = workspace.parties.map((party) => `<tr><td>${escapeHtml(party.displayName)}</td><td>${escapeHtml(label(party.partyType))}</td><td>${escapeHtml(party.roles.map((role) => `${label(role.roleKey)}${role.context ? ` — ${role.context}` : ''}`).join('; ') || 'Not recorded')}</td></tr>`).join('');
  return `<h2>Saved locations</h2><table><thead><tr><th>Location</th><th>Address</th><th>Saved GPS</th><th>Occupancy / use</th><th>Linked assets</th></tr></thead><tbody>${locationRows || '<tr><td colspan="5">No saved locations recorded.</td></tr>'}</tbody></table>
    <h2>Non-asset and linked exposures</h2><table><thead><tr><th>Exposure</th><th>Type</th><th>Status</th><th>Links</th><th>Source</th></tr></thead><tbody>${exposureRows || '<tr><td colspan="5">No exposures recorded.</td></tr>'}</tbody></table>
    ${partyRows ? `<h2>Parties and roles</h2><table><thead><tr><th>Party</th><th>Type</th><th>Roles</th></tr></thead><tbody>${partyRows}</tbody></table>` : ''}`;
}

function assessmentTable(payload: InsuranceReportPayload): string {
  const assessments = payload.workspace.assessments ?? [];
  const rows = assessments.map((assessment) => {
    const limits = assessment.financialTerms
      .filter((term) => !['value', 'sum_insured'].includes(term.termType))
      .map((term) => `${label(term.termType)}: ${financialTermReportLabel(term)}`)
      .join('; ');
    const definition = assessment.canonicalCoverKey ? INSURANCE_COVER_BY_KEY[assessment.canonicalCoverKey] : null;
    const dependencies = definition ? [...definition.dependencies, ...definition.overlaps.map((entry) => `Overlap: ${entry}`)] : [];
    const rationale = assessment.placementStage === 'broker_recommended'
      ? `Broker recommendation: ${assessment.brokerRationale}`
      : assessment.systemSuggestionRationale ? `System area to consider: ${assessment.systemSuggestionRationale}` : assessment.brokerRationale || 'Not recorded';
    return `<tr><td>${escapeHtml(assessment.coverLabel)}</td><td>${escapeHtml(label(assessment.exposureStatus))}</td><td>${escapeHtml(label(assessment.currentCoverPosition))}</td><td>${escapeHtml(label(assessment.placementStage))}</td><td>${escapeHtml(assessment.provenance.sourceReference || label(assessment.provenance.sourceType))}</td><td>${escapeHtml(limits || 'Not recorded')}</td><td>${escapeHtml(dependencies.map(label).join('; ') || 'None recorded')}</td><td>${escapeHtml(rationale)}</td></tr>`;
  }).join('');
  return `<h2>Covers and exposures</h2>
    <table><thead><tr><th>Canonical cover</th><th>Exposure status</th><th>Current-cover position</th><th>Review / placement stage</th><th>Source</th><th>Limits / excesses</th><th>Dependencies / overlaps</th><th>Recorded rationale</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="8">No cover assessments recorded.</td></tr>'}</tbody></table>`;
}

function policyHierarchy(payload: InsuranceReportPayload): string {
  const policies = payload.workspace.policies ?? [];
  if (!policies.length) return '<h2>Policies and schedule</h2><p class="callout">No current policy hierarchy has been recorded.</p>';
  return `<h2>Policies and schedule</h2>${policies.map((policy) => `
    <section class="section"><h3>${escapeHtml([policy.insurerName, policy.policyNumber].filter(Boolean).join(' · ') || 'Policy details not recorded')}</h3>
    <p class="muted">${escapeHtml(policy.productName || 'Product not recorded')} · ${escapeHtml(label(policy.status))} · ${escapeHtml(dateLabel(policy.effectiveFrom))} to ${escapeHtml(dateLabel(policy.effectiveTo))} · Renewal ${escapeHtml(dateLabel(policy.renewalDate || policy.effectiveTo))} · Source: ${escapeHtml(policy.provenance.sourceReference || label(policy.provenance.sourceType))}</p>
    <table><thead><tr><th>Actual insurer section</th><th>Canonical mapping</th><th>Wording / reference</th><th>Schedule treatment</th><th>Linked assets / exposures</th><th>Financial terms</th></tr></thead><tbody>
    ${policy.sections.flatMap((section) => section.scheduleItems.length ? section.scheduleItems.map((item) => `<tr><td>${escapeHtml(section.actualSectionLabel)}</td><td>${escapeHtml(section.canonicalCoverKey ? label(section.canonicalCoverKey) : 'Not mapped')}</td><td>${escapeHtml([section.sectionNumberReference, section.wordingEditionReference].filter(Boolean).join(' · ') || 'Not recorded')}</td><td>${escapeHtml(label(item.treatment))}: ${escapeHtml(item.itemLabel)}</td><td>${item.assetIds.length} assets · ${item.exposureIds.length} exposures</td><td>${escapeHtml(item.financialTerms.map((term) => `${label(term.termType)} ${financialTermReportLabel(term)}`).join('; ') || 'Not recorded')}</td></tr>`) : [`<tr><td>${escapeHtml(section.actualSectionLabel)}</td><td>${escapeHtml(section.canonicalCoverKey ? label(section.canonicalCoverKey) : 'Not mapped')}</td><td>${escapeHtml([section.sectionNumberReference, section.wordingEditionReference].filter(Boolean).join(' · ') || 'Not recorded')}</td><td>No schedule items recorded</td><td>—</td><td>Not recorded</td></tr>`]).join('')}
    </tbody></table></section>`).join('')}`;
}

function questionsAndNotes(payload: InsuranceReportPayload): string {
  const requests = (payload.workspace.informationRequests ?? []).filter((request) => ['open', 'sent_to_client', 'answered'].includes(request.status));
  const notes = payload.workspace.notes ?? [];
  const requestRows = requests.map((request) => `<tr><td>${escapeHtml(request.question)}</td><td>${escapeHtml(request.reason)}</td><td>${escapeHtml(label(request.status))}</td><td>${escapeHtml(request.response || 'Not supplied')}</td></tr>`).join('');
  const noteRows = notes.map((note) => `<tr><td>${escapeHtml(label(note.noteType))}</td><td>${escapeHtml(note.body)}</td><td>${escapeHtml(dateLabel(note.createdAtIso))}</td></tr>`).join('');
  return `<h2>Outstanding information</h2><table><thead><tr><th>Question</th><th>Reason</th><th>Status</th><th>Response</th></tr></thead><tbody>${requestRows || '<tr><td colspan="4">No information requests recorded.</td></tr>'}</tbody></table>
    ${noteRows ? `<h2>Report-visible notes</h2><table><thead><tr><th>Type</th><th>Note</th><th>Date</th></tr></thead><tbody>${noteRows}</tbody></table>` : ''}`;
}

function detailedComponents(payload: InsuranceReportPayload): string {
  if (payload.type !== 'detailed') return '';
  const sections = (payload.workspace.assessments ?? []).map((assessment) => {
    const components = assessment.components.map((component) => `<tr><td>${escapeHtml(label(component.componentType))}</td><td>${escapeHtml(component.label)}</td><td>${escapeHtml(label(component.selectionStatus))}</td><td>${escapeHtml(component.territory || 'Not recorded')}</td><td>${escapeHtml(component.conditionsNotes || 'Not recorded')}</td><td>${escapeHtml(component.provenance.sourceReference || label(component.provenance.sourceType))}</td></tr>`).join('');
    return `<section class="section"><h3>${escapeHtml(assessment.coverLabel)} · components</h3><table><thead><tr><th>Type</th><th>Component</th><th>Current position</th><th>Territory</th><th>Conditions / notes</th><th>Source</th></tr></thead><tbody>${components || '<tr><td colspan="6">No structured components recorded.</td></tr>'}</tbody></table></section>`;
  }).join('');
  return `<h2>Structured cover elements</h2>${sections || '<p class="callout">No structured cover elements recorded.</p>'}`;
}

function evidenceTrail(payload: InsuranceReportPayload): string {
  const evidence = payload.workspace.evidence ?? [];
  if (!evidence.length) return '';
  const rows = evidence.map((entry) => `<tr><td>${escapeHtml(entry.label)}</td><td>${escapeHtml(label(entry.evidenceType))}</td><td>${escapeHtml(entry.sourceReference || entry.existingSharedReference || 'Not recorded')}</td><td>${entry.links.length}</td><td>${escapeHtml(entry.notes || 'Not recorded')}</td></tr>`).join('');
  return `<h2>Evidence trail</h2><table><thead><tr><th>Evidence</th><th>Type</th><th>Reference</th><th>Linked records</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function snapshotChanges(payload: InsuranceReportPayload): string {
  const diffs = payload.workspace.latestSnapshotDiffs ?? [];
  if (!diffs.length) return '<h2>Source snapshot changes</h2><p class="callout">No later authorised snapshot changes are recorded for this workspace.</p>';
  const rows = diffs.map((diff) => `<tr><td>${escapeHtml(diff.sourceAssetKey)}</td><td>${escapeHtml(label(diff.changeType))}</td><td>${escapeHtml(diff.changedFields.join(', ') || 'Not listed')}</td></tr>`).join('');
  return `<h2>Source snapshot changes</h2><table><thead><tr><th>Source asset</th><th>Change</th><th>Changed fields</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function reportBody(payload: InsuranceReportPayload): string {
  return [
    reviewQualitySummary(payload),
    currentCoverSummary(payload),
    snapshotChanges(payload),
    assetTable(payload),
    exposureAndPartyInventory(payload),
    assessmentTable(payload),
    policyHierarchy(payload),
    detailedComponents(payload),
    evidenceTrail(payload),
    questionsAndNotes(payload),
  ].join('');
}

export function buildInsuranceReportHtml(payload: InsuranceReportPayload): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(`${workspaceTitle(payload)} insurance report`)}</title><style>${baseStyles(payload.type)}</style></head><body><main class="page">${reportHeader(payload)}${reportBody(payload)}<p class="disclaimer">${escapeHtml(DISCLAIMER)}</p></main><button class="print" onclick="window.print()">Print / Save PDF</button></body></html>`;
}

function workspaceTitle(payload: InsuranceReportPayload): string {
  return payload.workspace.clientName || 'Client';
}

export function safeReportFilename(value: string): string {
  return text(value).replace(/[\r\n"]/g, ' ').slice(0, 180) || 'insurance-report.html';
}
