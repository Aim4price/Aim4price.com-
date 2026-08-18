import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { classifyInsuranceRisk, INSURANCE_CLASSIFICATION_RULE_VERSION } from './insurance-classification-engine';
import {
  INSURANCE_CATALOGUE_VERSION,
  INSURANCE_COVER_BY_KEY,
  type InsuranceClientSegment,
  type InsuranceIndustryProfileKey,
} from './insurance-cover-catalogue';
import { getDb } from './db';
import { listAssetLeadsForUser, updateAssetLeadStatus, type AssetLead } from './partner-access';
import { isSharedInsuranceRegister, sharedRegisterSnapshot, type SharedRegisterAsset } from './shared-register-prototype';
import type {
  InsuranceCurrentCoverPosition,
  InsurancePlacementStage,
  InsuranceProvenance,
  InsuranceCommand,
  InsuranceCoverAssessment,
  InsuranceCoverComponent,
  InsuranceEvidence,
  InsuranceExposure,
  InsuranceFinancialTerm,
  InsuranceInformationRequest,
  InsuranceLocation,
  InsuranceNote,
  InsuranceParty,
  InsurancePolicy,
  InsurancePolicySection,
  InsuranceRiskObject,
  InsuranceScheduleItem,
  InsuranceSuggestion,
  InsurancePortfolioItem,
  InsuranceReportSnapshotSummary,
  InsuranceReviewStatus,
  InsuranceWorkspaceAsset,
  InsuranceWorkspaceData,
} from './insurance-workspace-types';

type DbRow = Record<string, unknown>;

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableText(value: unknown): string | null {
  const result = text(value);
  return result || null;
}

function integer(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : 0;
}

function numberValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function jsonHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assetTitle(asset: SharedRegisterAsset): string {
  return text(asset.title) || [text(asset.brandName), text(asset.modelName ?? asset.typedModelName)].filter(Boolean).join(' ') || 'Untitled asset';
}

function assetKind(asset: SharedRegisterAsset): string {
  return text(asset.equipmentFamilyLabel) || text(asset.kind) || 'Asset';
}

function assetLocation(asset: SharedRegisterAsset): string {
  const specs = record(asset.specsJson);
  return text(asset.lastKnownLocationText) || text(specs.location ?? specs.assetLocation);
}

function registerValue(asset: SharedRegisterAsset): number {
  return numberValue(asset.value ?? asset.selectedValueExVat ?? asset.aim4priceValueExVat);
}

function replacementValue(asset: SharedRegisterAsset): number {
  const specs = record(asset.specsJson);
  return numberValue(
    asset.replacementPriceExVat ?? asset.replacementPriceUsedExVat ?? asset.userReplacementPriceExVat ??
      specs.replacementPriceExVat ?? specs.replacement_price_ex_vat,
  );
}

function sourceAssetKey(asset: SharedRegisterAsset, index: number): string {
  return text(asset.id) || `snapshot-asset-${index + 1}`;
}

async function insertClassificationSuggestions(
  client: PoolClient,
  input: {
    workspaceId: string;
    workspaceAssetId: string;
    ownerFacts: Record<string, unknown>;
    segments: InsuranceClientSegment[];
    industries: InsuranceIndustryProfileKey[];
    useDescription?: string;
    exposureTypes?: string[];
  },
) {
  const classificationInput = {
    ownerFacts: input.ownerFacts,
    segments: input.segments,
    industries: input.industries,
    useDescription: input.useDescription,
    exposureTypes: input.exposureTypes,
  };
  const result = classifyInsuranceRisk(classificationInput);
  const inputHash = createHash('sha256').update(JSON.stringify(classificationInput)).digest('hex');

  for (const candidate of result.riskObjectCandidates) {
    await client.query(
      `insert into insurance_classification_suggestions
        (workspace_id, workspace_asset_id, suggested_risk_object_type, rule_id, rule_version, rationale, confidence, missing_questions, input_hash)
       select $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9
       where not exists (
         select 1 from insurance_classification_suggestions
         where workspace_id = $1::uuid and workspace_asset_id = $2::uuid
           and suggested_risk_object_type = $3 and rule_id = $4 and input_hash = $9
       )`,
      [input.workspaceId, input.workspaceAssetId, candidate.riskObjectType, candidate.ruleId, INSURANCE_CLASSIFICATION_RULE_VERSION, candidate.rationale, candidate.confidence, JSON.stringify(candidate.missingQuestions), inputHash],
    );
  }

  for (const suggestion of result.coverSuggestions) {
    await client.query(
      `insert into insurance_classification_suggestions
        (workspace_id, workspace_asset_id, suggested_cover_key, rule_id, rule_version, rationale, confidence, missing_questions, input_hash)
       select $1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::jsonb, $9
       where not exists (
         select 1 from insurance_classification_suggestions
         where workspace_id = $1::uuid and workspace_asset_id = $2::uuid
           and suggested_cover_key = $3 and rule_id = $4 and input_hash = $9
       )`,
      [input.workspaceId, input.workspaceAssetId, suggestion.coverKey, suggestion.ruleId, INSURANCE_CLASSIFICATION_RULE_VERSION, suggestion.rationale, suggestion.confidence, JSON.stringify(suggestion.missingQuestions), inputHash],
    );
  }
}

function snapshotReference(lead: AssetLead, generatedAtIso: string): string {
  const date = new Date(generatedAtIso);
  const datePart = Number.isNaN(date.getTime()) ? lead.createdAtIso.slice(0, 10) : date.toISOString().slice(0, 10);
  return `REG-${datePart.replace(/-/g, '')}-${lead.id.slice(0, 8).toUpperCase()}`;
}

function mapWorkspaceAsset(row: DbRow): InsuranceWorkspaceAsset {
  const snapshot = record(row.snapshot_json);
  return {
    id: String(row.id),
    sourceAssetKey: text(row.source_asset_key),
    title: text(row.title),
    kind: text(row.asset_kind_snapshot) || 'Asset',
    location: text(row.location_text),
    registerValue: numberValue(row.register_value),
    replacementValue: numberValue(row.replacement_value),
    photoUrl: text(row.main_photo_url),
    serialNumber: text(snapshot.serialNumber),
    registrationNumber: text(snapshot.licenseRegistrationNumber),
    yearModel: nullableNumber(snapshot.yearModel),
    condition: text(snapshot.condition),
    snapshot,
  };
}

function mapReport(row: DbRow): InsuranceReportSnapshotSummary {
  return {
    id: String(row.id),
    type: text(row.report_type) === 'detailed' ? 'detailed' : 'summary',
    revision: Math.max(1, integer(row.revision)),
    reference: text(row.report_reference),
    filename: text(row.filename),
    generatedAtIso: iso(row.generated_at) ?? new Date().toISOString(),
  };
}

async function findSharedLead(brokerUserId: string, shareId: string): Promise<AssetLead> {
  const leads = await listAssetLeadsForUser(brokerUserId);
  const lead = leads.find(
    (candidate) => candidate.id === shareId && candidate.partnerUserId === brokerUserId && isSharedInsuranceRegister(candidate),
  );
  if (!lead) throw new Error('INSURANCE_SHARE_NOT_FOUND');
  return lead;
}

export async function getOrCreateInsuranceWorkspaceForShare(input: {
  brokerUserId: string;
  shareId: string;
}): Promise<InsuranceWorkspaceData> {
  const lead = await findSharedLead(input.brokerUserId, input.shareId);
  const snapshot = sharedRegisterSnapshot(lead);
  if (!snapshot) throw new Error('INSURANCE_SNAPSHOT_MISSING');

  const db = getDb();
  const existing = await db.query<DbRow>(
    'select id from insurance_workspaces where source_lead_id = $1::uuid and broker_user_id = $2 limit 1',
    [lead.id, input.brokerUserId],
  );
  if (existing.rows[0]) {
    if (lead.status === 'sent') {
      await updateAssetLeadStatus({ currentUserId: input.brokerUserId, leadId: lead.id, status: 'viewed' });
    }
    return getInsuranceWorkspace(input.brokerUserId, String(existing.rows[0].id));
  }

  const client = await db.connect();
  try {
    await client.query('begin');
    const inserted = await client.query<DbRow>(
      `insert into insurance_workspaces
        (source_lead_id, owner_user_id, broker_user_id, snapshot_generated_at, snapshot_reference,
         snapshot_hash, client_name, client_meta, client_logo_url, owner_message, asset_count,
         total_register_value, total_replacement_value, catalogue_version)
       values ($1::uuid, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       on conflict (source_lead_id) do nothing
       returning id`,
      [
        lead.id,
        lead.ownerUserId,
        input.brokerUserId,
        snapshot.generatedAtIso,
        snapshotReference(lead, snapshot.generatedAtIso),
        jsonHash(snapshot),
        lead.ownerBusinessName || lead.ownerName || snapshot.ownerName || 'Aim4price client',
        snapshot.ownerMeta || [lead.ownerProvince, lead.ownerTownCity].filter(Boolean).join(' · '),
        snapshot.logoUrl || null,
        lead.ownerMessage || null,
        snapshot.assetCount,
        snapshot.totalValue,
        snapshot.totalReplacementValue,
        INSURANCE_CATALOGUE_VERSION,
      ],
    );

    let workspaceId = inserted.rows[0] ? String(inserted.rows[0].id) : '';
    if (!workspaceId) {
      const concurrent = await client.query<DbRow>(
        'select id from insurance_workspaces where source_lead_id = $1::uuid and broker_user_id = $2 limit 1',
        [lead.id, input.brokerUserId],
      );
      workspaceId = String(concurrent.rows[0]?.id ?? '');
    }
    if (!workspaceId) throw new Error('INSURANCE_WORKSPACE_CREATE_FAILED');

    if (inserted.rows[0]) {
      const revisionResult = await client.query<DbRow>(
        `insert into insurance_snapshot_revisions
          (workspace_id, revision, source_share_id, source_snapshot_hash, source_generated_at,
           imported_by_user_id, owner_authorisation_reference, asset_count, snapshot_json)
         values ($1::uuid, 1, $2::uuid, $3, $4::timestamptz, $5, $6, $7, $8::jsonb)
         returning id`,
        [workspaceId, lead.id, jsonHash(snapshot), snapshot.generatedAtIso, input.brokerUserId, `shared-register:${lead.id}`, snapshot.assetCount, JSON.stringify(snapshot)],
      );
      const revisionId = String(revisionResult.rows[0].id);
      const unknownLocation = await client.query<DbRow>(
        `insert into insurance_locations
          (workspace_id, label, is_unknown, source_type, source_reference, created_by_user_id, updated_by_user_id)
         values ($1::uuid, 'Unknown / not supplied', true, 'owner_provided', $2, $3, $3)
         returning id`,
        [workspaceId, `shared-register:${lead.id}`, input.brokerUserId],
      );
      const unknownLocationId = String(unknownLocation.rows[0].id);

      for (const [index, asset] of snapshot.assets.entries()) {
        const key = sourceAssetKey(asset, index);
        const assetResult = await client.query<DbRow>(
          `insert into insurance_workspace_assets
            (workspace_id, source_asset_key, source_asset_id, sort_order, title, asset_kind_snapshot,
             category_key, location_text, register_value, replacement_value, main_photo_url,
             snapshot_json, snapshot_hash)
           values ($1::uuid, $2, $3, $4, $5, $6, 'other', $7, $8, $9, $10, $11::jsonb, $12)
           returning id`,
          [
            workspaceId, key, text(asset.id) || null, index, assetTitle(asset), assetKind(asset), assetLocation(asset) || null,
            registerValue(asset), replacementValue(asset), text(asset.photoUrl) || null, JSON.stringify(asset), jsonHash(asset),
          ],
        );
        const workspaceAssetId = String(assetResult.rows[0].id);
        await client.query(
          `insert into insurance_snapshot_assets
            (workspace_id, snapshot_revision_id, source_asset_key, title, snapshot_hash, snapshot_json)
           values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)`,
          [workspaceId, revisionId, key, assetTitle(asset), jsonHash(asset), JSON.stringify(asset)],
        );
        await client.query(
          `insert into insurance_risk_objects
            (workspace_id, workspace_asset_id, object_type, object_label, location_id,
             source_type, source_reference, extraction_method, migration_source_key)
           values ($1::uuid, $2::uuid, $3, $4, $5::uuid, 'system_suggestion', $6, 'deterministic_rule', $7)`,
          [workspaceId, workspaceAssetId, assetKind(asset), assetTitle(asset), unknownLocationId, `shared-register:${lead.id}`, `workspace-asset:${workspaceAssetId}`],
        );
        const exposureResult = await client.query<DbRow>(
          `insert into insurance_exposures
            (workspace_id, exposure_type, label, description, source_type, source_reference,
             extraction_method, migration_source_key, created_by_user_id, updated_by_user_id)
           values ($1::uuid, 'physical_asset', $2, 'Owner-authorised shared-register asset.',
                   'owner_provided', $3, 'imported', $4, $5, $5)
           returning id`,
          [workspaceId, assetTitle(asset), `shared-register:${lead.id}`, `workspace-asset:${workspaceAssetId}`, input.brokerUserId],
        );
        await client.query(
          'insert into insurance_exposure_assets (workspace_id, exposure_id, workspace_asset_id) values ($1::uuid, $2::uuid, $3::uuid)',
          [workspaceId, String(exposureResult.rows[0].id), workspaceAssetId],
        );
        await insertClassificationSuggestions(client, {
          workspaceId,
          workspaceAssetId,
          ownerFacts: asset as Record<string, unknown>,
          segments: [],
          industries: [],
          exposureTypes: ['physical_asset'],
        });
      }
      await audit(client, {
        workspaceId,
        actorUserId: input.brokerUserId,
        entityType: 'workspace',
        entityId: workspaceId,
        action: 'created_from_shared_register',
        after: { sourceLeadId: lead.id, snapshotHash: jsonHash(snapshot), assetCount: snapshot.assets.length },
      });
    }
    await client.query('commit');
    if (lead.status === 'sent') {
      await updateAssetLeadStatus({ currentUserId: input.brokerUserId, leadId: lead.id, status: 'viewed' });
    }
    return getInsuranceWorkspace(input.brokerUserId, workspaceId);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

function decimal(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function dateOnly(value: unknown): string {
  return value ? String(value).slice(0, 10) : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry)).filter(Boolean) : [];
}

function provenance(row: DbRow): InsuranceProvenance {
  return {
    sourceType: (text(row.source_type) || 'broker_recorded') as InsuranceProvenance['sourceType'],
    sourceReference: text(row.source_reference),
    confidence: (text(row.confidence) || '') as InsuranceProvenance['confidence'],
    extractionMethod: (text(row.extraction_method) || 'manual') as InsuranceProvenance['extractionMethod'],
    humanConfirmedBy: text(row.human_confirmed_by),
    humanConfirmedAtIso: iso(row.human_confirmed_at),
    unresolvedQuestion: text(row.unresolved_question),
  };
}

async function audit(
  client: PoolClient,
  input: { workspaceId: string; actorUserId: string; entityType: string; entityId?: string; action: string; before?: unknown; after?: unknown },
) {
  await client.query(
    `insert into insurance_review_events
      (workspace_id, actor_user_id, entity_type, entity_id, action, before_json, after_json)
     values ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      input.workspaceId,
      input.actorUserId,
      input.entityType,
      input.entityId ?? null,
      input.action,
      input.before === undefined ? null : JSON.stringify(input.before),
      input.after === undefined ? null : JSON.stringify(input.after),
    ],
  );
}

async function ownedWorkspace(client: PoolClient, brokerUserId: string, workspaceId: string, lock = false): Promise<DbRow> {
  const result = await client.query<DbRow>(
    `select * from insurance_workspaces
     where id = $1::uuid and broker_user_id = $2
     ${lock ? 'for update' : ''}`,
    [workspaceId, brokerUserId],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_WORKSPACE_NOT_FOUND');
  return result.rows[0];
}

function requireExpectedVersion(id: string | undefined, expectedVersion: number | undefined): number | undefined {
  if (id && !expectedVersion) throw new Error('INSURANCE_VERSION_REQUIRED');
  return expectedVersion;
}

async function touchWorkspace(client: PoolClient, workspaceId: string) {
  await client.query(
    `update insurance_workspaces
     set workspace_version = workspace_version + 1,
         review_status = case when review_status = 'not_started' then 'in_progress' else review_status end,
         last_reviewed_at = now(), updated_at = now()
     where id = $1::uuid`,
    [workspaceId],
  );
}

type LinkTarget = 'asset' | 'risk_object' | 'exposure' | 'location' | 'party' | 'policy' | 'section' | 'schedule_item' | 'assessment' | 'component' | 'financial_term' | 'information_request';

const targetSql: Record<LinkTarget, { table: string; idColumn: string }> = {
  asset: { table: 'insurance_workspace_assets', idColumn: 'id' },
  risk_object: { table: 'insurance_risk_objects', idColumn: 'id' },
  exposure: { table: 'insurance_exposures', idColumn: 'id' },
  location: { table: 'insurance_locations', idColumn: 'id' },
  party: { table: 'insurance_parties', idColumn: 'id' },
  policy: { table: 'insurance_policies', idColumn: 'id' },
  section: { table: 'insurance_policy_sections', idColumn: 'id' },
  schedule_item: { table: 'insurance_schedule_items', idColumn: 'id' },
  assessment: { table: 'insurance_cover_assessments', idColumn: 'id' },
  component: { table: 'insurance_cover_components', idColumn: 'id' },
  financial_term: { table: 'insurance_financial_terms', idColumn: 'id' },
  information_request: { table: 'insurance_information_requests', idColumn: 'id' },
};

async function assertWorkspaceIds(client: PoolClient, workspaceId: string, ids: string[], target: LinkTarget) {
  if (!ids.length) return;
  const definition = targetSql[target];
  if (!definition) throw new Error('INSURANCE_CROSS_WORKSPACE_LINK');
  const result = await client.query<{ count: number }>(
    `select count(*)::int as count from ${definition.table}
     where workspace_id = $1::uuid and ${definition.idColumn} = any($2::uuid[])`,
    [workspaceId, ids],
  );
  if (result.rows[0]?.count !== ids.length) throw new Error('INSURANCE_CROSS_WORKSPACE_LINK');
}

async function replaceLinks(input: {
  client: PoolClient;
  workspaceId: string;
  linkTable: string;
  ownerColumn: string;
  ownerId: string;
  targetColumn: string;
  target: LinkTarget;
  ids: string[];
}) {
  await assertWorkspaceIds(input.client, input.workspaceId, input.ids, input.target);
  await input.client.query(
    `delete from ${input.linkTable} where workspace_id = $1::uuid and ${input.ownerColumn} = $2::uuid`,
    [input.workspaceId, input.ownerId],
  );
  for (const id of input.ids) {
    await input.client.query(
      `insert into ${input.linkTable} (workspace_id, ${input.ownerColumn}, ${input.targetColumn})
       values ($1::uuid, $2::uuid, $3::uuid) on conflict do nothing`,
      [input.workspaceId, input.ownerId, id],
    );
  }
}

function idMap(rows: DbRow[], ownerColumn: string, valueColumn: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const owner = String(row[ownerColumn]);
    map.set(owner, [...(map.get(owner) ?? []), String(row[valueColumn])]);
  }
  return map;
}

function mapFinancialTerm(row: DbRow): InsuranceFinancialTerm {
  return {
    id: String(row.id),
    termType: text(row.term_type) as InsuranceFinancialTerm['termType'],
    amount: decimal(row.amount),
    percentage: decimal(row.percentage),
    timeValue: decimal(row.time_value),
    timeUnit: (text(row.time_unit) || '') as InsuranceFinancialTerm['timeUnit'],
    currency: text(row.currency) || 'ZAR',
    valuationBasis: text(row.valuation_basis),
    limitType: text(row.limit_type),
    vatBasis: (text(row.vat_basis) || '') as InsuranceFinancialTerm['vatBasis'],
    valuationDate: dateOnly(row.valuation_date),
    effectiveFrom: dateOnly(row.effective_from),
    effectiveTo: dateOnly(row.effective_to),
    provenance: provenance(row),
    version: integer(row.version),
  };
}

export async function getInsuranceWorkspace(brokerUserId: string, workspaceId: string): Promise<InsuranceWorkspaceData> {
  const db = getDb();
  const workspaceResult = await db.query<DbRow>(
    'select * from insurance_workspaces where id = $1::uuid and broker_user_id = $2 limit 1',
    [workspaceId, brokerUserId],
  );
  const workspace = workspaceResult.rows[0];
  if (!workspace) throw new Error('INSURANCE_WORKSPACE_NOT_FOUND');

  const [
    industryResult, revisionResult, diffResult, locationResult, riskResult, exposureResult,
    exposureAssetResult, exposureLocationResult, exposurePartyResult, partyResult, roleResult,
    policyResult, sectionResult, scheduleResult, scheduleAssetResult, scheduleExposureResult,
    scheduleLocationResult, schedulePartyResult, assessmentResult, assessmentAssetResult,
    assessmentExposureResult, assessmentLocationResult, assessmentPartyResult, assessmentSectionResult,
    assessmentScheduleResult, componentResult, financialResult, evidenceResult, evidenceLinkResult, requestResult, noteResult,
    suggestionResult, metricResult, assetResult, reportResult,
  ] = await Promise.all([
    db.query<DbRow>('select industry_key from insurance_workspace_industries where workspace_id = $1::uuid order by industry_key', [workspaceId]),
    db.query<DbRow>('select * from insurance_snapshot_revisions where workspace_id = $1::uuid order by revision desc', [workspaceId]),
    db.query<DbRow>(`select d.* from insurance_snapshot_diffs d join insurance_snapshot_revisions r on r.id = d.to_revision_id where d.workspace_id = $1::uuid and r.revision = (select max(revision) from insurance_snapshot_revisions where workspace_id = $1::uuid) order by d.change_type, d.source_asset_key`, [workspaceId]),
    db.query<DbRow>(`select l.*, coalesce(array_remove(array_agg(distinct ro.workspace_asset_id), null), '{}') as asset_ids from insurance_locations l left join insurance_risk_objects ro on ro.location_id = l.id and ro.workspace_id = l.workspace_id where l.workspace_id = $1::uuid group by l.id order by l.is_unknown, l.label`, [workspaceId]),
    db.query<DbRow>('select * from insurance_risk_objects where workspace_id = $1::uuid order by object_label', [workspaceId]),
    db.query<DbRow>('select * from insurance_exposures where workspace_id = $1::uuid order by label', [workspaceId]),
    db.query<DbRow>('select * from insurance_exposure_assets where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_exposure_locations where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_exposure_parties where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_parties where workspace_id = $1::uuid order by display_name', [workspaceId]),
    db.query<DbRow>('select * from insurance_party_roles where workspace_id = $1::uuid order by role_key', [workspaceId]),
    db.query<DbRow>('select * from insurance_policies where workspace_id = $1::uuid order by policy_number nulls last, insurer_name', [workspaceId]),
    db.query<DbRow>('select * from insurance_policy_sections where workspace_id = $1::uuid order by actual_section_label', [workspaceId]),
    db.query<DbRow>('select * from insurance_schedule_items where workspace_id = $1::uuid order by item_label', [workspaceId]),
    db.query<DbRow>('select * from insurance_schedule_item_assets where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_schedule_item_exposures where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_schedule_item_locations where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_schedule_item_parties where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_cover_assessments where workspace_id = $1::uuid order by cover_label_snapshot', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_assets where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_exposures where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_locations where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_parties where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_sections where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_assessment_schedule_items where workspace_id = $1::uuid', [workspaceId]),
    db.query<DbRow>('select * from insurance_cover_components where workspace_id = $1::uuid order by label', [workspaceId]),
    db.query<DbRow>('select * from insurance_financial_terms where workspace_id = $1::uuid order by term_type, created_at', [workspaceId]),
    db.query<DbRow>('select * from insurance_evidence where workspace_id = $1::uuid order by created_at desc', [workspaceId]),
    db.query<DbRow>('select * from insurance_evidence_links where workspace_id = $1::uuid order by created_at', [workspaceId]),
    db.query<DbRow>('select * from insurance_information_requests where workspace_id = $1::uuid order by requested_at desc', [workspaceId]),
    db.query<DbRow>('select * from insurance_notes where workspace_id = $1::uuid order by created_at desc', [workspaceId]),
    db.query<DbRow>(`select s.*, d.decision, d.rationale as decision_rationale from insurance_classification_suggestions s left join insurance_suggestion_decisions d on d.suggestion_id = s.id and d.workspace_id = s.workspace_id where s.workspace_id = $1::uuid order by s.generated_at desc`, [workspaceId]),
    db.query<DbRow>(
      `with asset_sum as (
         select aa.workspace_asset_id, max(ft.amount) as sum_insured
         from insurance_assessment_assets aa
         join insurance_financial_terms ft on ft.workspace_id = aa.workspace_id and ft.assessment_id = aa.assessment_id and ft.term_type = 'sum_insured'
         where aa.workspace_id = $1::uuid group by aa.workspace_asset_id
         union
         select sia.workspace_asset_id, max(ft.amount) as sum_insured
         from insurance_schedule_item_assets sia
         join insurance_financial_terms ft on ft.workspace_id = sia.workspace_id and ft.schedule_item_id = sia.schedule_item_id and ft.term_type = 'sum_insured'
         where sia.workspace_id = $1::uuid group by sia.workspace_asset_id
       ), combined as (
         select workspace_asset_id, max(sum_insured) as sum_insured from asset_sum group by workspace_asset_id
       )
       select
         count(*) filter (where c.sum_insured is null)::int as missing_sum_insured_count,
         count(*) filter (where c.sum_insured is not null and a.replacement_value > 0 and abs(c.sum_insured - a.replacement_value) / a.replacement_value >= 0.10)::int as replacement_difference_count
       from insurance_workspace_assets a left join combined c on c.workspace_asset_id = a.id
       where a.workspace_id = $1::uuid`,
      [workspaceId],
    ),
    db.query<DbRow>('select * from insurance_workspace_assets where workspace_id = $1::uuid order by sort_order, title', [workspaceId]),
    db.query<DbRow>('select * from insurance_report_snapshots where workspace_id = $1::uuid order by generated_at desc', [workspaceId]),
  ]);

  const exposureAssets = idMap(exposureAssetResult.rows, 'exposure_id', 'workspace_asset_id');
  const exposureLocations = idMap(exposureLocationResult.rows, 'exposure_id', 'location_id');
  const exposureParties = idMap(exposurePartyResult.rows, 'exposure_id', 'party_id');
  const roles = new Map<string, InsuranceParty['roles']>();
  for (const row of roleResult.rows) {
    const partyId = String(row.party_id);
    roles.set(partyId, [...(roles.get(partyId) ?? []), { roleKey: text(row.role_key) as InsuranceParty['roles'][number]['roleKey'], context: text(row.role_context) }]);
  }

  const scheduleAssets = idMap(scheduleAssetResult.rows, 'schedule_item_id', 'workspace_asset_id');
  const scheduleExposures = idMap(scheduleExposureResult.rows, 'schedule_item_id', 'exposure_id');
  const scheduleLocations = idMap(scheduleLocationResult.rows, 'schedule_item_id', 'location_id');
  const scheduleParties = idMap(schedulePartyResult.rows, 'schedule_item_id', 'party_id');
  const assessmentAssets = idMap(assessmentAssetResult.rows, 'assessment_id', 'workspace_asset_id');
  const assessmentExposures = idMap(assessmentExposureResult.rows, 'assessment_id', 'exposure_id');
  const assessmentLocations = idMap(assessmentLocationResult.rows, 'assessment_id', 'location_id');
  const assessmentParties = idMap(assessmentPartyResult.rows, 'assessment_id', 'party_id');
  const assessmentSections = idMap(assessmentSectionResult.rows, 'assessment_id', 'section_id');
  const assessmentSchedules = idMap(assessmentScheduleResult.rows, 'assessment_id', 'schedule_item_id');

  const termsByAssessment = new Map<string, InsuranceFinancialTerm[]>();
  const termsByComponent = new Map<string, InsuranceFinancialTerm[]>();
  const termsBySchedule = new Map<string, InsuranceFinancialTerm[]>();
  for (const row of financialResult.rows) {
    const term = mapFinancialTerm(row);
    if (row.assessment_id) termsByAssessment.set(String(row.assessment_id), [...(termsByAssessment.get(String(row.assessment_id)) ?? []), term]);
    if (row.component_id) termsByComponent.set(String(row.component_id), [...(termsByComponent.get(String(row.component_id)) ?? []), term]);
    if (row.schedule_item_id) termsBySchedule.set(String(row.schedule_item_id), [...(termsBySchedule.get(String(row.schedule_item_id)) ?? []), term]);
  }

  const componentsByAssessment = new Map<string, InsuranceCoverComponent[]>();
  for (const row of componentResult.rows) {
    const component: InsuranceCoverComponent = {
      id: String(row.id),
      componentType: text(row.component_type) as InsuranceCoverComponent['componentType'],
      componentKey: text(row.component_key),
      label: text(row.label),
      selectionStatus: text(row.selection_status) as InsuranceCoverComponent['selectionStatus'],
      territory: text(row.territory),
      effectiveFrom: dateOnly(row.effective_from),
      effectiveTo: dateOnly(row.effective_to),
      conditionsNotes: text(row.conditions_notes),
      financialTerms: termsByComponent.get(String(row.id)) ?? [],
      provenance: provenance(row),
      version: integer(row.version),
    };
    const assessmentId = String(row.assessment_id);
    componentsByAssessment.set(assessmentId, [...(componentsByAssessment.get(assessmentId) ?? []), component]);
  }

  const schedulesBySection = new Map<string, InsuranceScheduleItem[]>();
  for (const row of scheduleResult.rows) {
    const item: InsuranceScheduleItem = {
      id: String(row.id), sectionId: String(row.section_id), itemReference: text(row.item_reference),
      itemLabel: text(row.item_label), itemDescription: text(row.item_description), treatment: text(row.treatment) as InsuranceScheduleItem['treatment'],
      effectiveFrom: dateOnly(row.effective_from), effectiveTo: dateOnly(row.effective_to),
      assetIds: scheduleAssets.get(String(row.id)) ?? [], exposureIds: scheduleExposures.get(String(row.id)) ?? [],
      locationIds: scheduleLocations.get(String(row.id)) ?? [], partyIds: scheduleParties.get(String(row.id)) ?? [],
      financialTerms: termsBySchedule.get(String(row.id)) ?? [], provenance: provenance(row), version: integer(row.version),
    };
    const sectionId = String(row.section_id);
    schedulesBySection.set(sectionId, [...(schedulesBySection.get(sectionId) ?? []), item]);
  }

  const sectionsByPolicy = new Map<string, InsurancePolicySection[]>();
  for (const row of sectionResult.rows) {
    const section: InsurancePolicySection = {
      id: String(row.id), policyId: String(row.policy_id), canonicalCoverKey: nullableText(row.canonical_cover_key),
      actualSectionLabel: text(row.actual_section_label), sectionNumberReference: text(row.section_number_reference),
      wordingEditionReference: text(row.wording_edition_reference), status: text(row.section_status) as InsurancePolicySection['status'],
      effectiveFrom: dateOnly(row.effective_from), effectiveTo: dateOnly(row.effective_to), provenance: provenance(row),
      version: integer(row.version), scheduleItems: schedulesBySection.get(String(row.id)) ?? [],
    };
    const policyId = String(row.policy_id);
    sectionsByPolicy.set(policyId, [...(sectionsByPolicy.get(policyId) ?? []), section]);
  }

  const policies: InsurancePolicy[] = policyResult.rows.map((row) => ({
    id: String(row.id), insurerName: text(row.insurer_name), productName: text(row.product_name), policyNumber: text(row.policy_number),
    status: text(row.policy_status) as InsurancePolicy['status'], inceptionDate: dateOnly(row.inception_date), effectiveFrom: dateOnly(row.effective_from),
    effectiveTo: dateOnly(row.effective_to), renewalDate: dateOnly(row.renewal_date), evidenceStatus: text(row.evidence_status) as InsurancePolicy['evidenceStatus'],
    provenance: provenance(row), version: integer(row.version), sections: sectionsByPolicy.get(String(row.id)) ?? [],
  }));

  const assessments: InsuranceCoverAssessment[] = assessmentResult.rows.map((row) => ({
    id: String(row.id), canonicalCoverKey: nullableText(row.canonical_cover_key), coverLabel: text(row.cover_label_snapshot), catalogueVersion: text(row.catalogue_version),
    exposureStatus: text(row.exposure_status) as InsuranceCoverAssessment['exposureStatus'], currentCoverPosition: text(row.current_cover_position) as InsuranceCurrentCoverPosition,
    placementStage: text(row.placement_stage) as InsurancePlacementStage, systemSuggestionRuleId: text(row.system_suggestion_rule_id),
    systemSuggestionRationale: text(row.system_suggestion_rationale), brokerRationale: text(row.broker_rationale), dismissalReason: text(row.dismissal_reason),
    assetIds: assessmentAssets.get(String(row.id)) ?? [], exposureIds: assessmentExposures.get(String(row.id)) ?? [],
    locationIds: assessmentLocations.get(String(row.id)) ?? [], partyIds: assessmentParties.get(String(row.id)) ?? [],
    sectionIds: assessmentSections.get(String(row.id)) ?? [], scheduleItemIds: assessmentSchedules.get(String(row.id)) ?? [],
    components: componentsByAssessment.get(String(row.id)) ?? [], financialTerms: termsByAssessment.get(String(row.id)) ?? [],
    provenance: provenance(row), version: integer(row.version),
  }));

  const currentCoverCounts: InsuranceWorkspaceData['overview']['currentCoverCounts'] = {
    unknown: 0, not_recorded: 0, confirmed_included: 0, confirmed_excluded: 0, not_applicable: 0, covered_elsewhere: 0,
  };
  const placementCounts: InsuranceWorkspaceData['overview']['placementCounts'] = {};
  assessments.forEach((assessment) => {
    currentCoverCounts[assessment.currentCoverPosition] += 1;
    placementCounts[assessment.placementStage] = (placementCounts[assessment.placementStage] ?? 0) + 1;
  });

  const exposures: InsuranceExposure[] = exposureResult.rows.map((row) => ({
    id: String(row.id), exposureType: text(row.exposure_type), label: text(row.label), description: text(row.description),
    exposureStatus: text(row.exposure_status) as InsuranceExposure['exposureStatus'], dismissalReason: text(row.dismissal_reason),
    assetIds: exposureAssets.get(String(row.id)) ?? [], locationIds: exposureLocations.get(String(row.id)) ?? [],
    partyIds: exposureParties.get(String(row.id)) ?? [], provenance: provenance(row), version: integer(row.version),
  }));

  const riskObjects: InsuranceRiskObject[] = riskResult.rows.map((row) => ({
    id: String(row.id), workspaceAssetId: row.workspace_asset_id ? String(row.workspace_asset_id) : null,
    objectType: text(row.object_type), objectLabel: text(row.object_label), useDescription: text(row.use_description),
    locationId: row.location_id ? String(row.location_id) : null, classificationStatus: text(row.classification_status) as InsuranceRiskObject['classificationStatus'],
    provenance: provenance(row), version: integer(row.version),
  }));

  const informationRequests: InsuranceInformationRequest[] = requestResult.rows.map((row) => ({
    id: String(row.id), question: text(row.question), reason: text(row.reason), relatedEntityType: text(row.related_entity_type),
    relatedEntityId: row.related_entity_id ? String(row.related_entity_id) : null, status: text(row.status) as InsuranceInformationRequest['status'],
    response: text(row.response), requestedAtIso: iso(row.requested_at) ?? new Date().toISOString(), resolvedAtIso: iso(row.resolved_at), version: integer(row.version),
  }));

  const notes: InsuranceNote[] = noteResult.rows.map((row) => ({
    id: String(row.id), noteType: text(row.note_type) as InsuranceNote['noteType'], relatedEntityType: text(row.related_entity_type),
    relatedEntityId: row.related_entity_id ? String(row.related_entity_id) : null, body: text(row.body),
    createdAtIso: iso(row.created_at) ?? new Date().toISOString(), version: integer(row.version),
  }));

  const evidenceLinks = new Map<string, InsuranceEvidence['links']>();
  for (const row of evidenceLinkResult.rows) {
    const evidenceId = String(row.evidence_id);
    evidenceLinks.set(evidenceId, [...(evidenceLinks.get(evidenceId) ?? []), {
      entityType: text(row.entity_type) as InsuranceEvidence['links'][number]['entityType'],
      entityId: String(row.entity_id),
    }]);
  }
  const evidence: InsuranceEvidence[] = evidenceResult.rows.map((row) => ({
    id: String(row.id), evidenceType: text(row.evidence_type) as InsuranceEvidence['evidenceType'],
    label: text(row.label), existingSharedReference: text(row.existing_shared_reference),
    sourceReference: text(row.source_reference), notes: text(row.notes),
    links: evidenceLinks.get(String(row.id)) ?? [],
    createdAtIso: iso(row.created_at) ?? new Date().toISOString(),
  }));

  const suggestions: InsuranceSuggestion[] = suggestionResult.rows.map((row) => ({
    id: String(row.id), workspaceAssetId: row.workspace_asset_id ? String(row.workspace_asset_id) : null,
    exposureId: row.exposure_id ? String(row.exposure_id) : null, suggestedRiskObjectType: text(row.suggested_risk_object_type),
    suggestedCoverKey: nullableText(row.suggested_cover_key), ruleId: text(row.rule_id), ruleVersion: text(row.rule_version),
    rationale: text(row.rationale), confidence: text(row.confidence) as InsuranceSuggestion['confidence'],
    missingQuestions: stringArray(row.missing_questions), decision: (nullableText(row.decision) as InsuranceSuggestion['decision']),
    decisionRationale: text(row.decision_rationale),
  }));

  const metric = metricResult.rows[0] ?? {};
  const importedShareIds = new Set(revisionResult.rows.map((row) => String(row.source_share_id)));
  const availableSnapshotShares = (await listAssetLeadsForUser(brokerUserId))
    .filter((lead) => lead.partnerUserId === brokerUserId && lead.ownerUserId === String(workspace.owner_user_id) && isSharedInsuranceRegister(lead) && !importedShareIds.has(lead.id))
    .map((lead) => {
      const snapshot = sharedRegisterSnapshot(lead);
      return { id: lead.id, createdAtIso: lead.createdAtIso, assetCount: snapshot?.assetCount ?? 0, ownerMessage: lead.ownerMessage || '' };
    });
  return {
    schemaVersion: 1,
    catalogueVersion: text(workspace.catalogue_version) || INSURANCE_CATALOGUE_VERSION,
    id: workspaceId,
    workspaceId,
    shareId: String(workspace.source_lead_id),
    clientName: text(workspace.client_name),
    clientMeta: text(workspace.client_meta),
    clientLogoUrl: text(workspace.client_logo_url),
    ownerMessage: text(workspace.owner_message),
    reviewStatus: (text(workspace.review_status) || 'not_started') as InsuranceReviewStatus,
    snapshotGeneratedAtIso: iso(workspace.snapshot_generated_at),
    snapshotReference: text(workspace.snapshot_reference),
    assetCount: integer(workspace.asset_count),
    totalRegisterValue: numberValue(workspace.total_register_value),
    totalReplacementValue: numberValue(workspace.total_replacement_value),
    lastReviewedAtIso: iso(workspace.last_reviewed_at),
    createdAtIso: iso(workspace.created_at) ?? new Date().toISOString(),
    updatedAtIso: iso(workspace.updated_at) ?? new Date().toISOString(),
    version: integer(workspace.workspace_version),
    segments: stringArray(workspace.client_segments) as InsuranceClientSegment[],
    industryProfiles: industryResult.rows.map((row) => text(row.industry_key) as InsuranceIndustryProfileKey),
    snapshotRevisions: revisionResult.rows.map((row) => ({ id: String(row.id), revision: integer(row.revision), sourceShareId: String(row.source_share_id), hash: text(row.source_snapshot_hash), generatedAtIso: iso(row.source_generated_at), importedAtIso: iso(row.imported_at) ?? new Date().toISOString(), ownerAuthorisationReference: text(row.owner_authorisation_reference), assetCount: integer(row.asset_count) })),
    availableSnapshotShares,
    latestSnapshotDiffs: diffResult.rows.map((row) => ({ id: String(row.id), sourceAssetKey: text(row.source_asset_key), changeType: text(row.change_type) as 'added' | 'removed' | 'materially_changed', changedFields: stringArray(row.changed_fields) })),
    locations: locationResult.rows.map((row): InsuranceLocation => ({ id: String(row.id), label: text(row.label), addressText: text(row.address_text), latitude: decimal(row.latitude), longitude: decimal(row.longitude), occupancyUse: text(row.occupancy_use), isUnknown: Boolean(row.is_unknown), version: integer(row.version), assetIds: stringArray(row.asset_ids) })),
    riskObjects,
    exposures,
    parties: partyResult.rows.map((row): InsuranceParty => ({ id: String(row.id), partyType: text(row.party_type) as InsuranceParty['partyType'], displayName: text(row.display_name), registrationOrIdReference: text(row.registration_or_id_reference), roles: roles.get(String(row.id)) ?? [], version: integer(row.version) })),
    evidence,
    policies,
    assessments,
    informationRequests,
    notes,
    suggestions,
    assets: assetResult.rows.map(mapWorkspaceAsset),
    reports: reportResult.rows.map(mapReport),
    overview: {
      locationCount: locationResult.rows.filter((row) => !row.is_unknown).length,
      assetCount: integer(revisionResult.rows[0]?.asset_count ?? workspace.asset_count),
      nonAssetExposureCount: exposures.filter((exposure) => exposure.assetIds.length === 0).length,
      reviewedAssessmentCount: assessments.filter((assessment) => assessment.placementStage !== 'not_assessed').length,
      unassessedAssessmentCount: assessments.filter((assessment) => assessment.placementStage === 'not_assessed').length,
      currentCoverCounts,
      placementCounts,
      openInformationRequestCount: informationRequests.filter((request) => ['open', 'sent_to_client', 'answered'].includes(request.status)).length,
      missingSumInsuredCount: integer(metric.missing_sum_insured_count),
      replacementValueDifferenceCount: integer(metric.replacement_difference_count),
    },
  };
}

async function runCommand(
  brokerUserId: string,
  workspaceId: string,
  callback: (client: PoolClient) => Promise<void>,
): Promise<InsuranceWorkspaceData> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await ownedWorkspace(client, brokerUserId, workspaceId, true);
    await callback(client);
    await touchWorkspace(client, workspaceId);
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getInsuranceWorkspace(brokerUserId, workspaceId);
}

async function updateRow(input: {
  client: PoolClient;
  table: string;
  workspaceId: string;
  id: string;
  expectedVersion: number | undefined;
  assignments: string;
  values: unknown[];
}): Promise<DbRow> {
  const expected = requireExpectedVersion(input.id, input.expectedVersion) as number;
  const beforeResult = await input.client.query<DbRow>(
    `select * from ${input.table} where id = $1::uuid and workspace_id = $2::uuid limit 1`,
    [input.id, input.workspaceId],
  );
  const result = await input.client.query<DbRow>(
    `update ${input.table} set ${input.assignments}, version = version + 1, updated_at = now()
     where id = $${input.values.length + 1}::uuid and workspace_id = $${input.values.length + 2}::uuid
       and version = $${input.values.length + 3}
     returning *`,
    [...input.values, input.id, input.workspaceId, expected],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_CONFLICT');
  return { ...result.rows[0], __insurance_before: beforeResult.rows[0] ?? null };
}

function beforeForAudit(row: DbRow): unknown {
  return row.__insurance_before ?? undefined;
}

export async function executeInsuranceCommand(input: {
  brokerUserId: string;
  workspaceId: string;
  command: InsuranceCommand;
}): Promise<InsuranceWorkspaceData> {
  const { brokerUserId, workspaceId, command } = input;

  if (command.operation === 'update_profile') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const before = await ownedWorkspace(client, brokerUserId, workspaceId);
      const updated = await client.query<DbRow>(
        `update insurance_workspaces set client_segments = $1::text[],
           last_reviewed_at = now(), updated_at = now()
         where id = $2::uuid and broker_user_id = $3 and workspace_version = $4 returning *`,
        [command.segments, workspaceId, brokerUserId, command.expectedVersion],
      );
      if (!updated.rows[0]) throw new Error('INSURANCE_CONFLICT');
      await client.query('delete from insurance_workspace_industries where workspace_id = $1::uuid', [workspaceId]);
      for (const industry of command.industryProfiles) {
        await client.query(
          `insert into insurance_workspace_industries
            (workspace_id, industry_key, source_type, human_confirmed_by, human_confirmed_at)
           values ($1::uuid, $2, 'broker_recorded', $3, now())`,
          [workspaceId, industry, brokerUserId],
        );
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'workspace_profile', entityId: workspaceId, action: 'updated', before: { clientSegments: before.client_segments, version: before.workspace_version }, after: command });
    });
  }

  if (command.operation === 'save_location') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_locations', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'label = $1, address_text = $2, occupancy_use = $3, latitude = $4, longitude = $5, source_type = $6, updated_by_user_id = $7', values: [command.label, command.addressText || null, command.occupancyUse || null, command.latitude, command.longitude, 'broker_recorded', brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_locations (workspace_id, label, address_text, occupancy_use, latitude, longitude, source_type, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4, $5, $6, 'broker_recorded', $7, $7) returning *`, [workspaceId, command.label, command.addressText || null, command.occupancyUse || null, command.latitude, command.longitude, brokerUserId]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'location', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_risk_object') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      if (command.locationId) await assertWorkspaceIds(client, workspaceId, [command.locationId], 'location');
      const row = await updateRow({
        client, table: 'insurance_risk_objects', workspaceId, id: command.id, expectedVersion: command.expectedVersion,
        assignments: 'object_type = $1, object_label = $2, use_description = $3, location_id = $4::uuid, classification_status = $5, source_type = $6, extraction_method = $7, human_confirmed_by = case when $5 = \'human_confirmed\' then $8 else null end, human_confirmed_at = case when $5 = \'human_confirmed\' then now() else null end',
        values: [command.objectType, command.objectLabel, command.useDescription || null, command.locationId, command.classificationStatus, 'broker_recorded', 'manual', brokerUserId],
      });
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'risk_object', entityId: String(row.id), action: 'updated', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_party') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_parties', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'party_type = $1, display_name = $2, registration_or_id_reference = $3, source_type = $4, updated_by_user_id = $5', values: [command.partyType, command.displayName, command.registrationOrIdReference || null, 'broker_recorded', brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_parties (workspace_id, party_type, display_name, registration_or_id_reference, source_type, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4, 'broker_recorded', $5, $5) returning *`, [workspaceId, command.partyType, command.displayName, command.registrationOrIdReference || null, brokerUserId]);
        row = result.rows[0];
      }
      const partyId = String(row.id);
      await client.query('delete from insurance_party_roles where workspace_id = $1::uuid and party_id = $2::uuid', [workspaceId, partyId]);
      for (const role of command.roles) {
        await client.query(`insert into insurance_party_roles (workspace_id, party_id, role_key, role_context) values ($1::uuid, $2::uuid, $3, $4)`, [workspaceId, partyId, role.roleKey, role.context || null]);
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'party', entityId: partyId, action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_exposure') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_exposures', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'exposure_type = $1, label = $2, description = $3, exposure_status = $4, dismissal_reason = $5, source_type = $6, extraction_method = $7, human_confirmed_by = $8, human_confirmed_at = now(), updated_by_user_id = $8', values: [command.exposureType, command.label, command.description || null, command.exposureStatus, command.dismissalReason || null, 'broker_recorded', 'manual', brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_exposures (workspace_id, exposure_type, label, description, exposure_status, dismissal_reason, source_type, extraction_method, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4, $5, $6, 'broker_recorded', 'manual', $7, now(), $7, $7) returning *`, [workspaceId, command.exposureType, command.label, command.description || null, command.exposureStatus, command.dismissalReason || null, brokerUserId]);
        row = result.rows[0];
      }
      const exposureId = String(row.id);
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_exposure_assets', ownerColumn: 'exposure_id', ownerId: exposureId, targetColumn: 'workspace_asset_id', target: 'asset', ids: command.assetIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_exposure_locations', ownerColumn: 'exposure_id', ownerId: exposureId, targetColumn: 'location_id', target: 'location', ids: command.locationIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_exposure_parties', ownerColumn: 'exposure_id', ownerId: exposureId, targetColumn: 'party_id', target: 'party', ids: command.partyIds ?? [] });
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'exposure', entityId: exposureId, action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_policy') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      let row: DbRow;
      const confirmation = command.sourceType === 'policy_schedule' || command.sourceType === 'insurer_confirmed' ? brokerUserId : null;
      const evidenceStatus = command.sourceReference ? (command.sourceType === 'insurer_confirmed' ? 'verified' : 'referenced') : 'not_supplied';
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_policies', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'insurer_name = $1, product_name = $2, policy_number = $3, policy_status = $4, inception_date = $5::date, effective_from = $6::date, effective_to = $7::date, renewal_date = $8::date, source_type = $9, source_reference = $10, evidence_status = $11, human_confirmed_by = $12, human_confirmed_at = case when $12 is null then null else now() end, updated_by_user_id = $13', values: [command.insurerName || null, command.productName || null, command.policyNumber || null, command.status, command.inceptionDate || null, command.effectiveFrom || null, command.effectiveTo || null, command.renewalDate || null, command.sourceType, command.sourceReference || null, evidenceStatus, confirmation, brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_policies (workspace_id, insurer_name, product_name, policy_number, policy_status, inception_date, effective_from, effective_to, renewal_date, source_type, source_reference, evidence_status, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9::date, $10, $11, $12, $13, case when $13 is null then null else now() end, $14, $14) returning *`, [workspaceId, command.insurerName || null, command.productName || null, command.policyNumber || null, command.status, command.inceptionDate || null, command.effectiveFrom || null, command.effectiveTo || null, command.renewalDate || null, command.sourceType, command.sourceReference || null, evidenceStatus, confirmation, brokerUserId]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'policy', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_section') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      await assertWorkspaceIds(client, workspaceId, [command.policyId], 'policy');
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_policy_sections', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'policy_id = $1::uuid, canonical_cover_key = $2, actual_section_label = $3, section_number_reference = $4, wording_edition_reference = $5, section_status = $6, effective_from = $7::date, effective_to = $8::date, source_type = $9, source_reference = $10, human_confirmed_by = $11, human_confirmed_at = now(), updated_by_user_id = $11', values: [command.policyId, command.canonicalCoverKey, command.actualSectionLabel, command.sectionNumberReference || null, command.wordingEditionReference || null, command.status, command.effectiveFrom || null, command.effectiveTo || null, command.sourceType, command.sourceReference || null, brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_policy_sections (workspace_id, policy_id, canonical_cover_key, actual_section_label, section_number_reference, wording_edition_reference, section_status, effective_from, effective_to, source_type, source_reference, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12, now(), $12, $12) returning *`, [workspaceId, command.policyId, command.canonicalCoverKey, command.actualSectionLabel, command.sectionNumberReference || null, command.wordingEditionReference || null, command.status, command.effectiveFrom || null, command.effectiveTo || null, command.sourceType, command.sourceReference || null, brokerUserId]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'policy_section', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_schedule_item') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const section = await client.query('select 1 from insurance_policy_sections where id = $1::uuid and workspace_id = $2::uuid', [command.sectionId, workspaceId]);
      if (!section.rowCount) throw new Error('INSURANCE_CROSS_WORKSPACE_LINK');
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_schedule_items', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'section_id = $1::uuid, item_reference = $2, item_label = $3, item_description = $4, treatment = $5, source_type = $6, source_reference = $7, human_confirmed_by = $8, human_confirmed_at = now(), updated_by_user_id = $8', values: [command.sectionId, command.itemReference || null, command.itemLabel, command.itemDescription || null, command.treatment, command.sourceType, command.sourceReference || null, brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_schedule_items (workspace_id, section_id, item_reference, item_label, item_description, treatment, source_type, source_reference, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, now(), $9, $9) returning *`, [workspaceId, command.sectionId, command.itemReference || null, command.itemLabel, command.itemDescription || null, command.treatment, command.sourceType, command.sourceReference || null, brokerUserId]);
        row = result.rows[0];
      }
      const itemId = String(row.id);
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_schedule_item_assets', ownerColumn: 'schedule_item_id', ownerId: itemId, targetColumn: 'workspace_asset_id', target: 'asset', ids: command.assetIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_schedule_item_exposures', ownerColumn: 'schedule_item_id', ownerId: itemId, targetColumn: 'exposure_id', target: 'exposure', ids: command.exposureIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_schedule_item_locations', ownerColumn: 'schedule_item_id', ownerId: itemId, targetColumn: 'location_id', target: 'location', ids: command.locationIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_schedule_item_parties', ownerColumn: 'schedule_item_id', ownerId: itemId, targetColumn: 'party_id', target: 'party', ids: command.partyIds ?? [] });
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'schedule_item', entityId: itemId, action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_assessment') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const definition = command.canonicalCoverKey ? INSURANCE_COVER_BY_KEY[command.canonicalCoverKey] : null;
      const label = command.coverLabel || definition?.label;
      if (!label) throw new Error('INSURANCE_COVER_LABEL_REQUIRED');
      const confirmed = command.sourceType !== 'system_suggestion' ? brokerUserId : null;
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_cover_assessments', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'canonical_cover_key = $1, cover_label_snapshot = $2, catalogue_version = $3, exposure_status = $4, current_cover_position = $5, placement_stage = $6, broker_rationale = $7, dismissal_reason = $8, source_type = $9, source_reference = $10, extraction_method = $11, human_confirmed_by = $12, human_confirmed_at = case when $12 is null then null else now() end, updated_by_user_id = $13', values: [command.canonicalCoverKey, label, INSURANCE_CATALOGUE_VERSION, command.exposureStatus, command.currentCoverPosition, command.placementStage, command.brokerRationale || null, command.dismissalReason || null, command.sourceType, command.sourceReference || null, command.sourceType === 'system_suggestion' ? 'deterministic_rule' : 'manual', confirmed, brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_cover_assessments (workspace_id, canonical_cover_key, cover_label_snapshot, catalogue_version, exposure_status, current_cover_position, placement_stage, broker_rationale, dismissal_reason, source_type, source_reference, extraction_method, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, case when $13 is null then null else now() end, $14, $14) returning *`, [workspaceId, command.canonicalCoverKey, label, INSURANCE_CATALOGUE_VERSION, command.exposureStatus, command.currentCoverPosition, command.placementStage, command.brokerRationale || null, command.dismissalReason || null, command.sourceType, command.sourceReference || null, command.sourceType === 'system_suggestion' ? 'deterministic_rule' : 'manual', confirmed, brokerUserId]);
        row = result.rows[0];
      }
      const assessmentId = String(row.id);
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_assets', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'workspace_asset_id', target: 'asset', ids: command.assetIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_exposures', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'exposure_id', target: 'exposure', ids: command.exposureIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_locations', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'location_id', target: 'location', ids: command.locationIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_parties', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'party_id', target: 'party', ids: command.partyIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_sections', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'section_id', target: 'section', ids: command.sectionIds ?? [] });
      await replaceLinks({ client, workspaceId, linkTable: 'insurance_assessment_schedule_items', ownerColumn: 'assessment_id', ownerId: assessmentId, targetColumn: 'schedule_item_id', target: 'schedule_item', ids: command.scheduleItemIds ?? [] });
      if (command.placementStage === 'information_required') {
        const question = definition?.underwritingQuestions[0]?.question || `What information is still needed to decide ${label}?`;
        await client.query(
          `insert into insurance_information_requests
            (workspace_id, question, reason, related_entity_type, related_entity_id, status,
             source_type, source_reference, requested_by_user_id)
           select $1::uuid, $2, $3, 'assessment', $4::uuid, 'open', 'system_suggestion', $5, $6
           where not exists (
             select 1 from insurance_information_requests
             where workspace_id = $1::uuid and related_entity_type = 'assessment'
               and related_entity_id = $4::uuid and status not in ('resolved', 'not_applicable')
           )`,
          [workspaceId, question, `Needed to complete the ${label} cover decision.`, assessmentId, `assessment:${assessmentId}`, brokerUserId],
        );
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'cover_assessment', entityId: assessmentId, action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_component') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const assessment = await client.query('select 1 from insurance_cover_assessments where id = $1::uuid and workspace_id = $2::uuid', [command.assessmentId, workspaceId]);
      if (!assessment.rowCount) throw new Error('INSURANCE_CROSS_WORKSPACE_LINK');
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_cover_components', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'assessment_id = $1::uuid, component_type = $2, component_key = $3, label = $4, selection_status = $5, territory = $6, effective_from = $7::date, effective_to = $8::date, conditions_notes = $9, source_type = $10, source_reference = $11, extraction_method = $12, human_confirmed_by = $13, human_confirmed_at = now(), updated_by_user_id = $13', values: [command.assessmentId, command.componentType, command.componentKey || null, command.label, command.selectionStatus, command.territory || null, command.effectiveFrom || null, command.effectiveTo || null, command.conditionsNotes || null, command.sourceType, command.sourceReference || null, 'manual', brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_cover_components (workspace_id, assessment_id, component_type, component_key, label, selection_status, territory, effective_from, effective_to, conditions_notes, source_type, source_reference, extraction_method, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12, 'manual', $13, now(), $13, $13) returning *`, [workspaceId, command.assessmentId, command.componentType, command.componentKey || null, command.label, command.selectionStatus, command.territory || null, command.effectiveFrom || null, command.effectiveTo || null, command.conditionsNotes || null, command.sourceType, command.sourceReference || null, brokerUserId]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'cover_component', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_financial_term') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      if (command.assessmentId) await assertWorkspaceIds(client, workspaceId, [command.assessmentId], 'assessment');
      if (command.componentId) await assertWorkspaceIds(client, workspaceId, [command.componentId], 'component');
      if (command.scheduleItemId) await assertWorkspaceIds(client, workspaceId, [command.scheduleItemId], 'schedule_item');
      let row: DbRow;
      const hasMonetaryAmount = command.amount !== null && command.amount !== undefined && command.amount !== '';
      const vatBasis = hasMonetaryAmount ? command.vatBasis || 'unknown' : 'not_applicable';
      const values = [command.assessmentId ?? null, command.componentId ?? null, command.scheduleItemId ?? null, command.termType, command.amount, command.percentage, command.timeValue, command.timeUnit || null, command.currency, command.valuationBasis || null, command.limitType || null, vatBasis, command.valuationDate || null, command.effectiveFrom || null, command.effectiveTo || null, command.sourceType, command.sourceReference || null, 'manual', brokerUserId];
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_financial_terms', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'assessment_id = $1::uuid, component_id = $2::uuid, schedule_item_id = $3::uuid, term_type = $4, amount = $5, percentage = $6, time_value = $7, time_unit = $8, currency = $9, valuation_basis = $10, limit_type = $11, vat_basis = $12, valuation_date = $13::date, effective_from = $14::date, effective_to = $15::date, source_type = $16, source_reference = $17, extraction_method = $18, human_confirmed_by = $19, human_confirmed_at = now(), updated_by_user_id = $19', values });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_financial_terms (workspace_id, assessment_id, component_id, schedule_item_id, term_type, amount, percentage, time_value, time_unit, currency, valuation_basis, limit_type, vat_basis, valuation_date, effective_from, effective_to, source_type, source_reference, extraction_method, human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id) values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::date, $15::date, $16::date, $17, $18, $19, $20, now(), $20, $20) returning *`, [workspaceId, ...values]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'financial_term', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_information_request') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      if (command.relatedEntityType && command.relatedEntityId) await assertWorkspaceIds(client, workspaceId, [command.relatedEntityId], command.relatedEntityType as LinkTarget);
      let row: DbRow;
      const resolved = ['resolved', 'not_applicable'].includes(command.status ?? 'open');
      if (command.id) {
        const current = await client.query<DbRow>('select status from insurance_information_requests where id = $1::uuid and workspace_id = $2::uuid limit 1', [command.id, workspaceId]);
        const allowedTransitions: Record<string, string[]> = {
          open: ['open', 'sent_to_client', 'answered', 'resolved', 'not_applicable'],
          sent_to_client: ['sent_to_client', 'answered', 'resolved', 'not_applicable'],
          answered: ['answered', 'sent_to_client', 'resolved', 'not_applicable'],
          resolved: ['resolved', 'open'],
          not_applicable: ['not_applicable', 'open'],
        };
        if (!current.rows[0] || !allowedTransitions[text(current.rows[0].status)]?.includes(command.status ?? 'open')) throw new Error('INSURANCE_INVALID_STATE_TRANSITION');
        row = await updateRow({ client, table: 'insurance_information_requests', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'question = $1, reason = $2, related_entity_type = $3, related_entity_id = $4::uuid, status = $5, response = $6, resolved_by_user_id = $7, resolved_at = case when $7 is null then null else now() end', values: [command.question, command.reason, command.relatedEntityType || null, command.relatedEntityId, command.status, command.response || null, resolved ? brokerUserId : null] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_information_requests (workspace_id, question, reason, related_entity_type, related_entity_id, status, response, source_type, requested_by_user_id, resolved_by_user_id, resolved_at) values ($1::uuid, $2, $3, $4, $5::uuid, $6, $7, 'broker_recorded', $8, $9, case when $9 is null then null else now() end) returning *`, [workspaceId, command.question, command.reason, command.relatedEntityType || null, command.relatedEntityId, command.status, command.response || null, brokerUserId, resolved ? brokerUserId : null]);
        row = result.rows[0];
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'information_request', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: beforeForAudit(row), after: command });
    });
  }

  if (command.operation === 'save_note') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      if (command.relatedEntityType && command.relatedEntityId) await assertWorkspaceIds(client, workspaceId, [command.relatedEntityId], command.relatedEntityType as LinkTarget);
      let row: DbRow;
      if (command.id) {
        row = await updateRow({ client, table: 'insurance_notes', workspaceId, id: command.id, expectedVersion: command.expectedVersion, assignments: 'note_type = $1, related_entity_type = $2, related_entity_id = $3::uuid, body = $4, updated_by_user_id = $5', values: [command.noteType, command.relatedEntityType || null, command.relatedEntityId, command.body, brokerUserId] });
      } else {
        const result = await client.query<DbRow>(`insert into insurance_notes (workspace_id, note_type, related_entity_type, related_entity_id, body, created_by_user_id, updated_by_user_id) values ($1::uuid, $2, $3, $4::uuid, $5, $6, $6) returning *`, [workspaceId, command.noteType, command.relatedEntityType || null, command.relatedEntityId, command.body, brokerUserId]);
        row = result.rows[0];
      }
      const rawBefore = row.__insurance_before as DbRow | null | undefined;
      const safeBefore = rawBefore ? { ...rawBefore, body: text(rawBefore.note_type) === 'private_broker' ? '[private note body stored separately]' : rawBefore.body } : undefined;
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'insurance_note', entityId: String(row.id), action: command.id ? 'updated' : 'created', before: safeBefore, after: { ...command, body: command.noteType === 'private_broker' ? '[private note body stored separately]' : command.body } });
    });
  }

  if (command.operation === 'save_evidence') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      if (command.entityType && command.entityId) {
        await assertWorkspaceIds(client, workspaceId, [command.entityId], command.entityType);
      }
      const result = await client.query<DbRow>(
        `insert into insurance_evidence
          (workspace_id, evidence_type, label, existing_shared_reference, source_reference, notes, created_by_user_id)
         values ($1::uuid, $2, $3, $4, $5, $6, $7) returning *`,
        [workspaceId, command.evidenceType, command.label, command.existingSharedReference || null, command.sourceReference || null, command.notes || null, brokerUserId],
      );
      const evidenceId = String(result.rows[0].id);
      if (command.entityType && command.entityId) {
        await client.query(
          `insert into insurance_evidence_links (workspace_id, evidence_id, entity_type, entity_id)
           values ($1::uuid, $2::uuid, $3, $4::uuid)`,
          [workspaceId, evidenceId, command.entityType, command.entityId],
        );
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'evidence', entityId: evidenceId, action: 'created', after: command });
    });
  }

  if (command.operation === 'ingest_snapshot_revision') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const workspace = await ownedWorkspace(client, brokerUserId, workspaceId);
      if (integer(workspace.workspace_version) !== command.expectedVersion) throw new Error('INSURANCE_CONFLICT');
      const leads = await listAssetLeadsForUser(brokerUserId);
      const lead = leads.find((candidate) => candidate.id === command.shareId
        && candidate.partnerUserId === brokerUserId
        && candidate.ownerUserId === String(workspace.owner_user_id)
        && isSharedInsuranceRegister(candidate));
      if (!lead) throw new Error('INSURANCE_SHARE_NOT_FOUND');
      const snapshot = sharedRegisterSnapshot(lead);
      if (!snapshot) throw new Error('INSURANCE_SNAPSHOT_MISSING');
      const snapshotHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
      const existing = await client.query('select 1 from insurance_snapshot_revisions where workspace_id = $1::uuid and (source_share_id = $2::uuid or source_snapshot_hash = $3)', [workspaceId, command.shareId, snapshotHash]);
      if (existing.rowCount) throw new Error('INSURANCE_SNAPSHOT_ALREADY_IMPORTED');
      const previousResult = await client.query<DbRow>('select id, revision from insurance_snapshot_revisions where workspace_id = $1::uuid order by revision desc limit 1', [workspaceId]);
      const previous = previousResult.rows[0];
      const nextRevision = integer(previous?.revision) + 1;
      const revisionResult = await client.query<DbRow>(
        `insert into insurance_snapshot_revisions
          (workspace_id, revision, source_share_id, source_snapshot_hash, source_generated_at,
           imported_by_user_id, owner_authorisation_reference, asset_count, snapshot_json)
         values ($1::uuid, $2, $3::uuid, $4, $5::timestamptz, $6, $7, $8, $9::jsonb)
         returning id`,
        [workspaceId, nextRevision, command.shareId, snapshotHash, snapshot.generatedAtIso, brokerUserId, `owner-authorised-share:${command.shareId}`, snapshot.assetCount, JSON.stringify(snapshot)],
      );
      const revisionId = String(revisionResult.rows[0].id);
      const nextAssets = new Map<string, { title: string; hash: string; snapshot: Record<string, unknown> }>();
      for (const [index, asset] of snapshot.assets.entries()) {
        const sourceKey = text(asset.id) || `snapshot-asset-${index + 1}`;
        const assetSnapshot = asset as unknown as Record<string, unknown>;
        const title = text(asset.title) || [text(asset.brandName), text(asset.modelName ?? asset.typedModelName)].filter(Boolean).join(' ') || 'Untitled asset';
        const hash = createHash('sha256').update(JSON.stringify(assetSnapshot)).digest('hex');
        nextAssets.set(sourceKey, { title, hash, snapshot: assetSnapshot });
        await client.query(
          `insert into insurance_snapshot_assets
            (workspace_id, snapshot_revision_id, source_asset_key, title, snapshot_hash, snapshot_json)
           values ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)`,
          [workspaceId, revisionId, sourceKey, title, hash, JSON.stringify(assetSnapshot)],
        );
      }
      const previousAssets = new Map<string, { hash: string; snapshot: Record<string, unknown> }>();
      if (previous?.id) {
        const rows = await client.query<DbRow>('select source_asset_key, snapshot_hash, snapshot_json from insurance_snapshot_assets where snapshot_revision_id = $1::uuid', [previous.id]);
        rows.rows.forEach((row) => previousAssets.set(text(row.source_asset_key), { hash: text(row.snapshot_hash), snapshot: row.snapshot_json as Record<string, unknown> }));
      }
      const allKeys = new Set([...previousAssets.keys(), ...nextAssets.keys()]);
      for (const sourceKey of allKeys) {
        const before = previousAssets.get(sourceKey);
        const after = nextAssets.get(sourceKey);
        const changeType = !before ? 'added' : !after ? 'removed' : before.hash !== after.hash ? 'materially_changed' : null;
        if (!changeType) continue;
        const changedFields = before && after
          ? [...new Set([...Object.keys(before.snapshot), ...Object.keys(after.snapshot)])].filter((key) => JSON.stringify(before.snapshot[key]) !== JSON.stringify(after.snapshot[key]))
          : [];
        await client.query(
          `insert into insurance_snapshot_diffs
            (workspace_id, from_revision_id, to_revision_id, source_asset_key, change_type, before_hash, after_hash, changed_fields)
           values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8::jsonb)
           on conflict (to_revision_id, source_asset_key, change_type) do nothing`,
          [workspaceId, previous?.id ?? null, revisionId, sourceKey, changeType, before?.hash ?? null, after?.hash ?? null, JSON.stringify(changedFields)],
        );
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'snapshot_revision', entityId: revisionId, action: 'owner_authorised_revision_imported', after: { shareId: command.shareId, revision: nextRevision, snapshotHash, assetCount: snapshot.assetCount } });
    });
  }

  if (command.operation === 'refresh_suggestions') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const workspace = await ownedWorkspace(client, brokerUserId, workspaceId);
      const industriesResult = await client.query<{ industry_key: InsuranceIndustryProfileKey }>('select industry_key from insurance_workspace_industries where workspace_id = $1::uuid', [workspaceId]);
      const values: unknown[] = [workspaceId];
      let filter = '';
      if (command.assetIds?.length) {
        await assertWorkspaceIds(client, workspaceId, command.assetIds, 'asset');
        values.push(command.assetIds);
        filter = 'and id = any($2::uuid[])';
      }
      const assets = await client.query<DbRow>(`select id, snapshot_json from insurance_workspace_assets where workspace_id = $1::uuid ${filter}`, values);
      for (const asset of assets.rows) {
        const ownerFacts = asset.snapshot_json && typeof asset.snapshot_json === 'object' ? asset.snapshot_json as Record<string, unknown> : {};
        const riskContext = await client.query<DbRow>(
          `select string_agg(nullif(use_description, ''), ' | ' order by updated_at) as use_description
           from insurance_risk_objects
           where workspace_id = $1::uuid and workspace_asset_id = $2::uuid`,
          [workspaceId, String(asset.id)],
        );
        const exposureContext = await client.query<DbRow>(
          `select coalesce(array_agg(distinct e.exposure_type) filter (where e.exposure_type is not null), array[]::text[]) as exposure_types
           from insurance_exposure_assets ea
           join insurance_exposures e on e.id = ea.exposure_id and e.workspace_id = ea.workspace_id
           where ea.workspace_id = $1::uuid and ea.workspace_asset_id = $2::uuid`,
          [workspaceId, String(asset.id)],
        );
        await insertClassificationSuggestions(client, {
          workspaceId,
          workspaceAssetId: String(asset.id),
          ownerFacts,
          segments: stringArray(workspace.client_segments) as InsuranceClientSegment[],
          industries: industriesResult.rows.map((row) => row.industry_key),
          useDescription: text(riskContext.rows[0]?.use_description),
          exposureTypes: stringArray(exposureContext.rows[0]?.exposure_types),
        });
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'classification_suggestion', action: 'refreshed', after: { assetIds: command.assetIds ?? 'all', ruleVersion: INSURANCE_CLASSIFICATION_RULE_VERSION } });
    });
  }

  if (command.operation === 'decide_suggestion' || command.operation === 'decide_suggestions') {
    return runCommand(brokerUserId, workspaceId, async (client) => {
      const suggestionIds = command.operation === 'decide_suggestion' ? [command.suggestionId] : command.suggestionIds;
      const suggestionResult = await client.query<DbRow>(
        'select * from insurance_classification_suggestions where workspace_id = $1::uuid and id = any($2::uuid[]) for update',
        [workspaceId, suggestionIds],
      );
      if (suggestionResult.rows.length !== suggestionIds.length) throw new Error('INSURANCE_SUGGESTION_NOT_FOUND');

      for (const suggestion of suggestionResult.rows) {
        await client.query(
          `insert into insurance_suggestion_decisions
            (workspace_id, suggestion_id, decision, rationale, decided_by_user_id)
           values ($1::uuid, $2::uuid, $3, $4, $5)
           on conflict (workspace_id, suggestion_id) do update set
             decision = excluded.decision, rationale = excluded.rationale,
             decided_by_user_id = excluded.decided_by_user_id, decided_at = now(), version = insurance_suggestion_decisions.version + 1`,
          [workspaceId, suggestion.id, command.decision, command.rationale, brokerUserId],
        );
      }

      const assessmentIdsByCover = new Map<string, string>();
      if (command.decision === 'accepted_for_assessment' || command.decision === 'information_required') {
        const suggestionsByCover = new Map<string, DbRow[]>();
        for (const suggestion of suggestionResult.rows) {
          const coverKey = text(suggestion.suggested_cover_key);
          if (!coverKey) continue;
          suggestionsByCover.set(coverKey, [...(suggestionsByCover.get(coverKey) ?? []), suggestion]);
        }

        for (const [coverKey, suggestions] of suggestionsByCover) {
          const definition = INSURANCE_COVER_BY_KEY[coverKey];
          if (!definition) continue;
          const existingAssessment = await client.query<DbRow>(
            `select id, placement_stage from insurance_cover_assessments
             where workspace_id = $1::uuid and canonical_cover_key = $2
             order by created_at limit 1`,
            [workspaceId, coverKey],
          );
          let assessmentId = existingAssessment.rows[0] ? String(existingAssessment.rows[0].id) : '';
          if (assessmentId && command.decision === 'information_required' && ['not_assessed', 'area_to_consider'].includes(text(existingAssessment.rows[0].placement_stage))) {
            await client.query(
              `update insurance_cover_assessments
               set placement_stage = 'information_required', updated_by_user_id = $3, updated_at = now(), version = version + 1
               where workspace_id = $1::uuid and id = $2::uuid`,
              [workspaceId, assessmentId, brokerUserId],
            );
          }
          if (!assessmentId) {
            const strongest = [...suggestions].sort((left, right) => {
              const rank = { high: 3, medium: 2, low: 1 } as const;
              return (rank[text(right.confidence) as keyof typeof rank] ?? 0) - (rank[text(left.confidence) as keyof typeof rank] ?? 0);
            })[0];
            const rationales = [...new Set(suggestions.map((suggestion) => text(suggestion.rationale)).filter(Boolean))].join(' ');
            const assessmentResult = await client.query<DbRow>(
              `insert into insurance_cover_assessments
                (workspace_id, canonical_cover_key, cover_label_snapshot, catalogue_version,
                 exposure_status, current_cover_position, placement_stage,
                 system_suggestion_rule_id, system_suggestion_rationale,
                 source_type, source_reference, confidence, extraction_method,
                 human_confirmed_by, human_confirmed_at, created_by_user_id, updated_by_user_id,
                 migration_source_key)
               values ($1::uuid, $2, $3, $4, 'discovered', 'unknown', $5,
                       $6, $7, 'system_suggestion', $8, $9, 'deterministic_rule', $10, now(), $10, $10, $11)
               on conflict (workspace_id, migration_source_key) do update set
                 system_suggestion_rationale = excluded.system_suggestion_rationale,
                 confidence = excluded.confidence,
                 updated_at = now()
               returning id`,
              [workspaceId, coverKey, definition.label, INSURANCE_CATALOGUE_VERSION, command.decision === 'information_required' ? 'information_required' : 'area_to_consider', text(strongest.rule_id), rationales, `suggestion-group:${coverKey}`, text(strongest.confidence), brokerUserId, `suggestion-group:${coverKey}`],
            );
            assessmentId = String(assessmentResult.rows[0].id);
          }
          assessmentIdsByCover.set(coverKey, assessmentId);
          for (const suggestion of suggestions) {
            if (suggestion.workspace_asset_id) {
              await client.query('insert into insurance_assessment_assets (workspace_id, assessment_id, workspace_asset_id) values ($1::uuid, $2::uuid, $3::uuid) on conflict do nothing', [workspaceId, assessmentId, suggestion.workspace_asset_id]);
            }
            if (suggestion.exposure_id) {
              await client.query('insert into insurance_assessment_exposures (workspace_id, assessment_id, exposure_id) values ($1::uuid, $2::uuid, $3::uuid) on conflict do nothing', [workspaceId, assessmentId, suggestion.exposure_id]);
            }
          }
        }
      }

      if (command.decision === 'information_required') {
        const coverLabels = new Map<string, string>();
        suggestionResult.rows.forEach((suggestion) => {
          const coverKey = text(suggestion.suggested_cover_key);
          if (coverKey && INSURANCE_COVER_BY_KEY[coverKey]) coverLabels.set(coverKey, INSURANCE_COVER_BY_KEY[coverKey].label);
        });
        const suggestedQuestions = suggestionResult.rows.flatMap((suggestion) => stringArray(suggestion.missing_questions));
        const fallbackQuestions = [...coverLabels.keys()].map((coverKey) =>
          INSURANCE_COVER_BY_KEY[coverKey]?.underwritingQuestions[0]?.question || `What information is still needed to decide ${INSURANCE_COVER_BY_KEY[coverKey]?.label || 'this cover area'}?`,
        );
        const questions = [...new Set(suggestedQuestions.length ? suggestedQuestions : fallbackQuestions)];
        for (const question of questions) {
          const singleAssessmentId = assessmentIdsByCover.size === 1 ? [...assessmentIdsByCover.values()][0] : null;
          const singleAssetId = !singleAssessmentId && suggestionResult.rows.length === 1 && suggestionResult.rows[0].workspace_asset_id
            ? String(suggestionResult.rows[0].workspace_asset_id)
            : null;
          const relatedEntityType = singleAssessmentId ? 'assessment' : singleAssetId ? 'asset' : null;
          const relatedEntityId = singleAssessmentId || singleAssetId;
          await client.query(
            `insert into insurance_information_requests
              (workspace_id, question, reason, related_entity_type, related_entity_id, status,
               source_type, source_reference, requested_by_user_id)
             select $1::uuid, $2, $3, $4, $5::uuid, 'open', 'system_suggestion', $6, $7
             where not exists (
               select 1 from insurance_information_requests
               where workspace_id = $1::uuid and lower(question) = lower($2)
                 and status not in ('resolved', 'not_applicable')
             )`,
            [workspaceId, question, `Needed to decide ${[...coverLabels.values()].join(', ') || 'an insurance area to consider'}.`, relatedEntityType, relatedEntityId, `suggestion-group:${suggestionIds.join(',')}`, brokerUserId],
          );
        }
      }
      await audit(client, { workspaceId, actorUserId: brokerUserId, entityType: 'classification_suggestion', entityId: suggestionIds.length === 1 ? suggestionIds[0] : undefined, action: suggestionIds.length === 1 ? 'decision_recorded' : 'bulk_decision_recorded', after: command });
    });
  }

  throw new Error('INSURANCE_UNKNOWN_OPERATION');
}

export async function listInsurancePortfolio(brokerUserId: string): Promise<InsurancePortfolioItem[]> {
  const leads = (await listAssetLeadsForUser(brokerUserId)).filter(
    (lead) => lead.partnerUserId === brokerUserId && isSharedInsuranceRegister(lead),
  );
  if (!leads.length) return [];
  const result = await getDb().query<DbRow>(
    `select w.*,
       (select count(distinct aa.workspace_asset_id)::int
        from insurance_assessment_assets aa
        join insurance_cover_assessments ca on ca.id = aa.assessment_id and ca.workspace_id = aa.workspace_id
        where aa.workspace_id = w.id and ca.placement_stage <> 'not_assessed') as completed_asset_count,
       (select count(distinct aa.workspace_asset_id)::int
        from insurance_assessment_assets aa
        join insurance_cover_assessments ca on ca.id = aa.assessment_id and ca.workspace_id = aa.workspace_id
        where aa.workspace_id = w.id and ca.current_cover_position = 'confirmed_included') as included_asset_count,
       (select count(*)::int from insurance_policies p where p.workspace_id = w.id and p.policy_status = 'current') as current_policy_count,
       (select count(*)::int from insurance_information_requests r where r.workspace_id = w.id and r.status in ('open', 'sent_to_client', 'answered')) as open_question_count,
       (select min(coalesce(p.renewal_date, p.effective_to)) from insurance_policies p where p.workspace_id = w.id and p.policy_status = 'current') as nearest_renewal_date
     from insurance_workspaces w
     where w.broker_user_id = $1 and w.source_lead_id = any($2::uuid[])
     order by w.updated_at desc`,
    [brokerUserId, leads.map((lead) => lead.id)],
  );
  const storedByLead = new Map(result.rows.map((row) => [String(row.source_lead_id), row]));
  return leads.map((lead) => {
    const snapshot = sharedRegisterSnapshot(lead);
    const stored = storedByLead.get(lead.id);
    const assetCount = stored ? integer(stored.asset_count) : snapshot?.assetCount ?? 0;
    const completedAssetCount = stored ? integer(stored.completed_asset_count) : 0;
    return {
      id: stored ? String(stored.id) : lead.id,
      shareId: lead.id,
      clientName: stored ? text(stored.client_name) : lead.ownerBusinessName || lead.ownerName || snapshot?.ownerName || 'Aim4price client',
      clientMeta: stored ? text(stored.client_meta) : snapshot?.ownerMeta || [lead.ownerProvince, lead.ownerTownCity].filter(Boolean).join(' · '),
      clientLogoUrl: stored ? text(stored.client_logo_url) : snapshot?.logoUrl ?? '',
      ownerMessage: stored ? text(stored.owner_message) : lead.ownerMessage,
      reviewStatus: (stored ? text(stored.review_status) : 'not_started') as InsuranceReviewStatus,
      snapshotGeneratedAtIso: stored ? iso(stored.snapshot_generated_at) : iso(snapshot?.generatedAtIso),
      snapshotReference: stored ? text(stored.snapshot_reference) : snapshotReference(lead, snapshot?.generatedAtIso ?? lead.createdAtIso),
      assetCount,
      totalRegisterValue: stored ? numberValue(stored.total_register_value) : snapshot?.totalValue ?? 0,
      totalReplacementValue: stored ? numberValue(stored.total_replacement_value) : snapshot?.totalReplacementValue ?? 0,
      lastReviewedAtIso: stored ? iso(stored.last_reviewed_at) : null,
      createdAtIso: stored ? iso(stored.created_at) ?? lead.createdAtIso : lead.createdAtIso,
      updatedAtIso: stored ? iso(stored.updated_at) ?? lead.updatedAtIso : lead.updatedAtIso,
      completedAssetCount,
      includedAssetCount: stored ? integer(stored.included_asset_count) : 0,
      outstandingAssetCount: Math.max(0, assetCount - completedAssetCount),
      currentPolicyCount: stored ? integer(stored.current_policy_count) : 0,
      openQuestionCount: stored ? integer(stored.open_question_count) : 0,
      nearestRenewalDateIso: stored ? iso(stored.nearest_renewal_date) : null,
    };
  });
}

export async function deleteInsuranceShare(input: { brokerUserId: string; shareId: string }): Promise<void> {
  const lead = await findSharedLead(input.brokerUserId, input.shareId);
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await client.query(
      'delete from insurance_snapshot_revisions where source_share_id = $1::uuid',
      [lead.id],
    );
    await client.query(
      'delete from insurance_workspaces where source_lead_id = $1::uuid and broker_user_id = $2',
      [lead.id, input.brokerUserId],
    );
    const deleted = await client.query(
      'delete from asset_leads where id = $1::uuid and partner_user_id = $2 returning id',
      [lead.id, input.brokerUserId],
    );
    if (!deleted.rowCount) throw new Error('INSURANCE_SHARE_NOT_FOUND');
    await client.query(
      `insert into access_audit_events
        (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json)
       values ($1, $2, 'insurance_register_deleted', 'asset_lead', $3, $4::jsonb)`,
      [lead.ownerUserId, input.brokerUserId, lead.id, JSON.stringify({ clientName: lead.ownerBusinessName || lead.ownerName })],
    );
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

export async function listInsuranceReportSnapshots(brokerUserId: string, workspaceId: string) {
  const workspace = await getInsuranceWorkspace(brokerUserId, workspaceId);
  return workspace.reports;
}
