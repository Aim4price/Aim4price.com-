import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { getDb } from './db';
import { generalCoversForProfile, optionsForCategory, suggestInsuranceCategory } from './insurance-option-config';
import { listAssetLeadsForUser, updateAssetLeadStatus, type AssetLead } from './partner-access';
import { isSharedInsuranceRegister, sharedRegisterSnapshot, type SharedRegisterAsset } from './shared-register-prototype';
import type {
  CurrentInsuranceStatus,
  InsuranceAssetReview,
  InsuranceClientProfile,
  InsuranceGeneralCoverReview,
  InsuranceOptionReview,
  InsuranceOptionStatus,
  InsurancePortfolioItem,
  InsuranceRecommendationStatus,
  InsuranceReportSnapshotSummary,
  InsuranceReviewStatus,
  InsuranceWorkspaceAsset,
  InsuranceWorkspaceData,
} from './insurance-workspace-types';

type DbRow = Record<string, unknown>;

const CLIENT_PROFILES = new Set<InsuranceClientProfile>([
  'unclassified', 'domestic', 'commercial', 'agricultural', 'transport', 'construction', 'industrial', 'other',
]);
const REVIEW_STATUSES = new Set<InsuranceReviewStatus>(['not_started', 'in_progress', 'completed']);
const CURRENT_STATUSES = new Set<CurrentInsuranceStatus>(['insured', 'not_insured', 'unknown', 'not_applicable', 'covered_elsewhere']);
const OPTION_STATUSES = new Set<InsuranceOptionStatus>(['included', 'excluded', 'unknown', 'not_applicable']);
const RECOMMENDATION_STATUSES = new Set<InsuranceRecommendationStatus>(['review', 'include', 'exclude', 'information_required', 'not_applicable']);

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function optionalText(value: unknown, maxLength = 4000): string | null {
  return text(value).slice(0, maxLength) || null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
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

function iso(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function jsonHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  const candidate = text(value) as T;
  return allowed.has(candidate) ? candidate : fallback;
}

function initialInsuranceStatus(asset: SharedRegisterAsset): CurrentInsuranceStatus {
  const specs = record(asset.specsJson);
  const raw = text(specs.insuranceStatus ?? specs.insurance_status).toLowerCase().replace(/[\s-]+/g, '_');
  if (['yes', 'insured', 'true'].includes(raw)) return 'insured';
  if (['no', 'not_insured', 'uninsured', 'false'].includes(raw)) return 'not_insured';
  if (['not_applicable', 'n_a', 'na'].includes(raw)) return 'not_applicable';
  if (['covered_elsewhere', 'elsewhere'].includes(raw)) return 'covered_elsewhere';
  return 'unknown';
}

function assetTitle(asset: SharedRegisterAsset): string {
  return text(asset.title) || [text(asset.brandName), text(asset.modelName ?? asset.typedModelName)].filter(Boolean).join(' ') || 'Untitled asset';
}

function assetKind(asset: SharedRegisterAsset): string {
  return text(asset.equipmentFamilyLabel) || text(asset.kind) || 'Asset';
}

function assetLocation(asset: SharedRegisterAsset): string {
  const specs = record(asset.specsJson);
  return text(asset.lastKnownLocationText) || text(specs.location ?? specs.assetLocation) || '';
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

function snapshotReference(lead: AssetLead, generatedAtIso: string): string {
  const date = new Date(generatedAtIso);
  const datePart = Number.isNaN(date.getTime()) ? lead.createdAtIso.slice(0, 10) : date.toISOString().slice(0, 10);
  return `REG-${datePart.replace(/-/g, '')}-${lead.id.slice(0, 8).toUpperCase()}`;
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
         total_register_value, total_replacement_value)
       values ($1::uuid, $2, $3, $4::timestamptz, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
      for (const [index, asset] of snapshot.assets.entries()) {
        const categoryKey = suggestInsuranceCategory(asset);
        const assetResult = await client.query<DbRow>(
          `insert into insurance_workspace_assets
            (workspace_id, source_asset_key, source_asset_id, sort_order, title, asset_kind_snapshot,
             category_key, location_text, register_value, replacement_value, main_photo_url,
             snapshot_json, snapshot_hash)
           values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
           returning id`,
          [
            workspaceId,
            sourceAssetKey(asset, index),
            text(asset.id) || null,
            index,
            assetTitle(asset),
            assetKind(asset),
            categoryKey,
            assetLocation(asset) || null,
            registerValue(asset),
            replacementValue(asset),
            text(asset.photoUrl) || null,
            JSON.stringify(asset),
            jsonHash(asset),
          ],
        );
        const workspaceAssetId = String(assetResult.rows[0].id);
        const reviewResult = await client.query<DbRow>(
          `insert into insurance_asset_reviews
            (workspace_asset_id, category_key, current_insurance_status)
           values ($1::uuid, $2, $3) returning id`,
          [workspaceAssetId, categoryKey, initialInsuranceStatus(asset)],
        );
        const reviewId = String(reviewResult.rows[0].id);
        for (const option of optionsForCategory(categoryKey)) {
          await client.query(
            `insert into insurance_asset_option_reviews
              (asset_review_id, option_key, option_label_snapshot)
             values ($1::uuid, $2, $3)`,
            [reviewId, option.key, option.label],
          );
        }
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

function mapOption(row: DbRow): InsuranceOptionReview {
  return {
    key: text(row.option_key),
    label: text(row.option_label_snapshot),
    status: enumValue(row.option_status, OPTION_STATUSES, 'unknown'),
    exclusionReasonKey: text(row.exclusion_reason_key),
    note: text(row.note),
    amountValue: nullableNumber(row.amount_value),
    textValue: text(row.text_value),
  };
}

function emptyReview(categoryKey: string): InsuranceAssetReview {
  return {
    categoryKey,
    currentInsuranceStatus: 'unknown',
    insurerName: '',
    policyNumber: '',
    policySectionKey: '',
    policySectionLabel: '',
    scheduleDescription: '',
    renewalDate: '',
    coverBasis: '',
    sumInsured: null,
    vatBasis: '',
    excessText: '',
    schedulingTreatment: '',
    specialConditions: '',
    recommendationStatus: 'review',
    recommendationReasonKey: '',
    recommendationNote: '',
    informationRequiredNote: '',
    reviewStatus: 'not_started',
    reviewedAtIso: null,
    options: optionsForCategory(categoryKey).map((option) => ({
      key: option.key, label: option.label, status: 'unknown', exclusionReasonKey: '', note: '', amountValue: null, textValue: '',
    })),
  };
}

function mapReview(row: DbRow | undefined, options: InsuranceOptionReview[], categoryKey: string): InsuranceAssetReview {
  if (!row) return emptyReview(categoryKey);
  return {
    categoryKey: text(row.review_category_key) || categoryKey,
    currentInsuranceStatus: enumValue(row.current_insurance_status, CURRENT_STATUSES, 'unknown'),
    insurerName: text(row.insurer_name),
    policyNumber: text(row.policy_number),
    policySectionKey: text(row.policy_section_key),
    policySectionLabel: text(row.policy_section_label),
    scheduleDescription: text(row.schedule_description),
    renewalDate: row.renewal_date ? String(row.renewal_date).slice(0, 10) : '',
    coverBasis: text(row.cover_basis),
    sumInsured: nullableNumber(row.sum_insured),
    vatBasis: ['inclusive', 'exclusive', 'unknown'].includes(text(row.vat_basis))
      ? (text(row.vat_basis) as InsuranceAssetReview['vatBasis']) : '',
    excessText: text(row.excess_text),
    schedulingTreatment: ['individual', 'grouped', 'blanket', 'not_applicable'].includes(text(row.scheduling_treatment))
      ? (text(row.scheduling_treatment) as InsuranceAssetReview['schedulingTreatment']) : '',
    specialConditions: text(row.special_conditions),
    recommendationStatus: enumValue(row.recommendation_status, RECOMMENDATION_STATUSES, 'review'),
    recommendationReasonKey: text(row.recommendation_reason_key),
    recommendationNote: text(row.recommendation_note),
    informationRequiredNote: text(row.information_required_note),
    reviewStatus: enumValue(row.asset_review_status, REVIEW_STATUSES, 'not_started'),
    reviewedAtIso: iso(row.reviewed_at),
    options,
  };
}

function mapWorkspaceAsset(row: DbRow, options: InsuranceOptionReview[]): InsuranceWorkspaceAsset {
  const snapshot = record(row.snapshot_json);
  const categoryKey = text(row.category_key) || 'other';
  return {
    id: String(row.id),
    sourceAssetKey: text(row.source_asset_key),
    title: text(row.title),
    kind: text(row.asset_kind_snapshot) || 'Asset',
    categoryKey,
    location: text(row.location_text),
    registerValue: numberValue(row.register_value),
    replacementValue: numberValue(row.replacement_value),
    photoUrl: text(row.main_photo_url),
    serialNumber: text(snapshot.serialNumber),
    registrationNumber: text(snapshot.licenseRegistrationNumber),
    yearModel: nullableNumber(snapshot.yearModel),
    condition: text(snapshot.condition),
    snapshot,
    review: mapReview(row, options, categoryKey),
  };
}

function mapGeneralCover(row: DbRow): InsuranceGeneralCoverReview {
  return {
    key: text(row.cover_key),
    label: text(row.cover_label_snapshot),
    status: enumValue(row.cover_status, OPTION_STATUSES, 'unknown'),
    insurerName: text(row.insurer_name),
    policyNumber: text(row.policy_number),
    policySectionLabel: text(row.policy_section_label),
    limitAmount: nullableNumber(row.limit_amount),
    exclusionReasonKey: text(row.exclusion_reason_key),
    recommendationStatus: enumValue(row.recommendation_status, RECOMMENDATION_STATUSES, 'review'),
    recommendationNote: text(row.recommendation_note),
    notes: text(row.notes),
    reviewedAtIso: iso(row.reviewed_at),
  };
}

function mapReport(row: DbRow): InsuranceReportSnapshotSummary {
  return {
    id: String(row.id),
    type: text(row.report_type) === 'detailed' ? 'detailed' : 'summary',
    revision: Math.max(1, Math.round(numberValue(row.revision))),
    reference: text(row.report_reference),
    filename: text(row.filename),
    generatedAtIso: iso(row.generated_at) ?? new Date().toISOString(),
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

  const [assetResult, optionResult, coverResult, reportResult] = await Promise.all([
    db.query<DbRow>(
      `select a.*, r.id as review_id, r.category_key as review_category_key,
              r.current_insurance_status, r.insurer_name, r.policy_number, r.policy_section_key,
              r.policy_section_label, r.schedule_description, r.renewal_date, r.cover_basis,
              r.sum_insured, r.vat_basis, r.excess_text, r.scheduling_treatment,
              r.special_conditions, r.recommendation_status, r.recommendation_reason_key,
              r.recommendation_note, r.information_required_note,
              r.review_status as asset_review_status, r.reviewed_at
       from insurance_workspace_assets a
       left join insurance_asset_reviews r on r.workspace_asset_id = a.id
       where a.workspace_id = $1::uuid
       order by a.sort_order, a.title`,
      [workspaceId],
    ),
    db.query<DbRow>(
      `select o.*, r.workspace_asset_id
       from insurance_asset_option_reviews o
       join insurance_asset_reviews r on r.id = o.asset_review_id
       join insurance_workspace_assets a on a.id = r.workspace_asset_id
       where a.workspace_id = $1::uuid
       order by o.option_label_snapshot`,
      [workspaceId],
    ),
    db.query<DbRow>('select * from insurance_general_cover_reviews where workspace_id = $1::uuid order by cover_label_snapshot', [workspaceId]),
    db.query<DbRow>('select * from insurance_report_snapshots where workspace_id = $1::uuid order by generated_at desc', [workspaceId]),
  ]);

  const optionMap = new Map<string, InsuranceOptionReview[]>();
  for (const optionRow of optionResult.rows) {
    const assetId = String(optionRow.workspace_asset_id);
    optionMap.set(assetId, [...(optionMap.get(assetId) ?? []), mapOption(optionRow)]);
  }
  const assets = assetResult.rows.map((row) => mapWorkspaceAsset(row, optionMap.get(String(row.id)) ?? []));
  const storedCovers = new Map(coverResult.rows.map((row) => [text(row.cover_key), mapGeneralCover(row)]));
  const clientProfile = enumValue(workspace.client_profile, CLIENT_PROFILES, 'unclassified');
  const generalCovers = generalCoversForProfile(clientProfile).map((definition) =>
    storedCovers.get(definition.key) ?? {
      key: definition.key,
      label: definition.label,
      status: 'unknown' as const,
      insurerName: '', policyNumber: '', policySectionLabel: '', limitAmount: null,
      exclusionReasonKey: '', recommendationStatus: 'review' as const, recommendationNote: '', notes: '', reviewedAtIso: null,
    },
  );

  return {
    id: String(workspace.id),
    shareId: String(workspace.source_lead_id),
    clientName: text(workspace.client_name),
    clientMeta: text(workspace.client_meta),
    clientLogoUrl: text(workspace.client_logo_url),
    ownerMessage: text(workspace.owner_message),
    clientProfile,
    reviewStatus: enumValue(workspace.review_status, REVIEW_STATUSES, 'not_started'),
    snapshotGeneratedAtIso: iso(workspace.snapshot_generated_at),
    snapshotReference: text(workspace.snapshot_reference),
    assetCount: Math.round(numberValue(workspace.asset_count)),
    totalRegisterValue: numberValue(workspace.total_register_value),
    totalReplacementValue: numberValue(workspace.total_replacement_value),
    lastReviewedAtIso: iso(workspace.last_reviewed_at),
    createdAtIso: iso(workspace.created_at) ?? new Date().toISOString(),
    updatedAtIso: iso(workspace.updated_at) ?? new Date().toISOString(),
    assets,
    generalCovers,
    reports: reportResult.rows.map(mapReport),
  };
}

export async function listInsurancePortfolio(brokerUserId: string): Promise<InsurancePortfolioItem[]> {
  const leads = (await listAssetLeadsForUser(brokerUserId)).filter(
    (lead) => lead.partnerUserId === brokerUserId && isSharedInsuranceRegister(lead),
  );
  if (!leads.length) return [];
  const result = await getDb().query<DbRow>(
    `select w.*,
       (select count(*)::int from insurance_workspace_assets a
        join insurance_asset_reviews r on r.workspace_asset_id = a.id
        where a.workspace_id = w.id and r.review_status = 'completed') as completed_asset_count,
       (select count(*)::int from insurance_workspace_assets a
        join insurance_asset_reviews r on r.workspace_asset_id = a.id
        where a.workspace_id = w.id and r.recommendation_status = 'include') as included_asset_count
     from insurance_workspaces w
     where w.broker_user_id = $1 and w.source_lead_id = any($2::uuid[])
     order by w.updated_at desc`,
    [brokerUserId, leads.map((lead) => lead.id)],
  );
  const storedByLead = new Map(result.rows.map((row) => [String(row.source_lead_id), row]));
  return leads.map((lead) => {
    const snapshot = sharedRegisterSnapshot(lead);
    const stored = storedByLead.get(lead.id);
    const assetCount = stored ? Math.round(numberValue(stored.asset_count)) : snapshot?.assetCount ?? 0;
    const completedAssetCount = stored ? Math.round(numberValue(stored.completed_asset_count)) : 0;
    return {
      id: stored ? String(stored.id) : lead.id,
      shareId: lead.id,
      clientName: stored ? text(stored.client_name) : lead.ownerBusinessName || lead.ownerName || snapshot?.ownerName || 'Aim4price client',
      clientMeta: stored ? text(stored.client_meta) : snapshot?.ownerMeta || [lead.ownerProvince, lead.ownerTownCity].filter(Boolean).join(' · '),
      clientLogoUrl: stored ? text(stored.client_logo_url) : snapshot?.logoUrl ?? '',
      ownerMessage: stored ? text(stored.owner_message) : lead.ownerMessage,
      clientProfile: stored ? enumValue(stored.client_profile, CLIENT_PROFILES, 'unclassified') : 'unclassified',
      reviewStatus: stored ? enumValue(stored.review_status, REVIEW_STATUSES, 'not_started') : 'not_started',
      snapshotGeneratedAtIso: stored ? iso(stored.snapshot_generated_at) : iso(snapshot?.generatedAtIso),
      snapshotReference: stored ? text(stored.snapshot_reference) : snapshotReference(lead, snapshot?.generatedAtIso ?? lead.createdAtIso),
      assetCount,
      totalRegisterValue: stored ? numberValue(stored.total_register_value) : snapshot?.totalValue ?? 0,
      totalReplacementValue: stored ? numberValue(stored.total_replacement_value) : snapshot?.totalReplacementValue ?? 0,
      lastReviewedAtIso: stored ? iso(stored.last_reviewed_at) : null,
      createdAtIso: stored ? iso(stored.created_at) ?? lead.createdAtIso : lead.createdAtIso,
      updatedAtIso: stored ? iso(stored.updated_at) ?? lead.updatedAtIso : lead.updatedAtIso,
      completedAssetCount,
      includedAssetCount: stored ? Math.round(numberValue(stored.included_asset_count)) : 0,
      outstandingAssetCount: Math.max(0, assetCount - completedAssetCount),
    };
  });
}

async function ownedWorkspaceRow(client: PoolClient, brokerUserId: string, workspaceId: string): Promise<DbRow> {
  const result = await client.query<DbRow>(
    'select * from insurance_workspaces where id = $1::uuid and broker_user_id = $2 for update',
    [workspaceId, brokerUserId],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_WORKSPACE_NOT_FOUND');
  return result.rows[0];
}

export async function updateInsuranceWorkspace(input: {
  brokerUserId: string;
  workspaceId: string;
  changes: Record<string, unknown>;
}): Promise<InsuranceWorkspaceData> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const before = await ownedWorkspaceRow(client, input.brokerUserId, input.workspaceId);
    const profile = enumValue(input.changes.clientProfile ?? before.client_profile, CLIENT_PROFILES, 'unclassified');
    const status = enumValue(input.changes.reviewStatus ?? before.review_status, REVIEW_STATUSES, 'not_started');
    await client.query(
      `update insurance_workspaces
       set client_profile = $1, review_status = $2,
           last_reviewed_at = now(), completed_at = case when $2 = 'completed' then coalesce(completed_at, now()) else null end,
           updated_at = now()
       where id = $3::uuid and broker_user_id = $4`,
      [profile, status, input.workspaceId, input.brokerUserId],
    );
    await audit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.brokerUserId,
      entityType: 'workspace',
      entityId: input.workspaceId,
      action: 'updated',
      before: { clientProfile: before.client_profile, reviewStatus: before.review_status },
      after: { clientProfile: profile, reviewStatus: status },
    });
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
}

async function ownedAssetReview(client: PoolClient, brokerUserId: string, workspaceId: string, workspaceAssetId: string) {
  const result = await client.query<DbRow>(
    `select r.*, a.workspace_id, a.category_key as asset_category_key
     from insurance_asset_reviews r
     join insurance_workspace_assets a on a.id = r.workspace_asset_id
     join insurance_workspaces w on w.id = a.workspace_id
     where r.workspace_asset_id = $1::uuid and a.workspace_id = $2::uuid and w.broker_user_id = $3
     for update`,
    [workspaceAssetId, workspaceId, brokerUserId],
  );
  if (!result.rows[0]) throw new Error('INSURANCE_ASSET_NOT_FOUND');
  return result.rows[0];
}

export async function saveInsuranceAssetReview(input: {
  brokerUserId: string;
  workspaceId: string;
  workspaceAssetId: string;
  review: Record<string, unknown>;
  options?: unknown;
}): Promise<InsuranceWorkspaceData> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const before = await ownedAssetReview(client, input.brokerUserId, input.workspaceId, input.workspaceAssetId);
    const categoryKey = text(input.review.categoryKey) || text(before.category_key) || 'other';
    const currentStatus = enumValue(input.review.currentInsuranceStatus, CURRENT_STATUSES, 'unknown');
    const recommendationStatus = enumValue(input.review.recommendationStatus, RECOMMENDATION_STATUSES, 'review');
    const reviewStatus = enumValue(input.review.reviewStatus, REVIEW_STATUSES, 'in_progress');
    const vatBasis = ['inclusive', 'exclusive', 'unknown'].includes(text(input.review.vatBasis)) ? text(input.review.vatBasis) : null;
    const scheduling = ['individual', 'grouped', 'blanket', 'not_applicable'].includes(text(input.review.schedulingTreatment))
      ? text(input.review.schedulingTreatment) : null;
    const reviewResult = await client.query<DbRow>(
      `update insurance_asset_reviews
       set category_key = $1, current_insurance_status = $2, insurer_name = $3,
           policy_number = $4, policy_section_key = $5, policy_section_label = $6,
           schedule_description = $7, renewal_date = $8::date, cover_basis = $9,
           sum_insured = $10, vat_basis = $11, excess_text = $12,
           scheduling_treatment = $13, special_conditions = $14,
           recommendation_status = $15, recommendation_reason_key = $16,
           recommendation_note = $17, information_required_note = $18,
           review_status = $19, reviewed_by_user_id = $20, reviewed_at = now(),
           version = version + 1, updated_at = now()
       where workspace_asset_id = $21::uuid returning id`,
      [
        categoryKey,
        currentStatus,
        optionalText(input.review.insurerName, 240),
        optionalText(input.review.policyNumber, 160),
        optionalText(input.review.policySectionKey, 160),
        optionalText(input.review.policySectionLabel, 240),
        optionalText(input.review.scheduleDescription),
        text(input.review.renewalDate) || null,
        optionalText(input.review.coverBasis, 240),
        nullableNumber(input.review.sumInsured),
        vatBasis,
        optionalText(input.review.excessText, 1000),
        scheduling,
        optionalText(input.review.specialConditions, 8000),
        recommendationStatus,
        optionalText(input.review.recommendationReasonKey, 160),
        optionalText(input.review.recommendationNote, 8000),
        optionalText(input.review.informationRequiredNote, 8000),
        reviewStatus,
        input.brokerUserId,
        input.workspaceAssetId,
      ],
    );
    await client.query('update insurance_workspace_assets set category_key = $1 where id = $2::uuid', [categoryKey, input.workspaceAssetId]);
    const reviewId = String(reviewResult.rows[0].id);
    const submittedOptions = Array.isArray(input.options) ? input.options.map(record) : [];
    const allowedOptions = new Map(optionsForCategory(categoryKey).map((definition) => [definition.key, definition]));
    await client.query(
      'delete from insurance_asset_option_reviews where asset_review_id = $1::uuid and not (option_key = any($2::text[]))',
      [reviewId, [...allowedOptions.keys()]],
    );
    for (const option of submittedOptions) {
      const definition = allowedOptions.get(text(option.key));
      if (!definition) continue;
      await client.query(
        `insert into insurance_asset_option_reviews
          (asset_review_id, option_key, option_label_snapshot, option_status, exclusion_reason_key,
           note, amount_value, text_value, updated_by_user_id)
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (asset_review_id, option_key) do update set
           option_label_snapshot = excluded.option_label_snapshot,
           option_status = excluded.option_status,
           exclusion_reason_key = excluded.exclusion_reason_key,
           note = excluded.note,
           amount_value = excluded.amount_value,
           text_value = excluded.text_value,
           updated_by_user_id = excluded.updated_by_user_id,
           updated_at = now()`,
        [
          reviewId,
          definition.key,
          definition.label,
          enumValue(option.status, OPTION_STATUSES, 'unknown'),
          optionalText(option.exclusionReasonKey, 160),
          optionalText(option.note, 4000),
          nullableNumber(option.amountValue),
          optionalText(option.textValue, 1000),
          input.brokerUserId,
        ],
      );
    }
    await client.query(
      `update insurance_workspaces set review_status = case when review_status = 'not_started' then 'in_progress' else review_status end,
       last_reviewed_at = now(), updated_at = now() where id = $1::uuid`,
      [input.workspaceId],
    );
    await audit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.brokerUserId,
      entityType: 'asset_review',
      entityId: reviewId,
      action: 'saved',
      before,
      after: { ...input.review, options: submittedOptions },
    });
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
}

export async function bulkUpdateInsuranceAssets(input: {
  brokerUserId: string;
  workspaceId: string;
  assetIds: string[];
  changes: Record<string, unknown>;
}): Promise<InsuranceWorkspaceData> {
  const assetIds = [...new Set(input.assetIds.map(text).filter(Boolean))].slice(0, 500);
  if (!assetIds.length) throw new Error('INSURANCE_BULK_ASSETS_REQUIRED');
  const client = await getDb().connect();
  try {
    await client.query('begin');
    await ownedWorkspaceRow(client, input.brokerUserId, input.workspaceId);
    const fields: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    };
    if ('insurerName' in input.changes) add('insurer_name', optionalText(input.changes.insurerName, 240));
    if ('policyNumber' in input.changes) add('policy_number', optionalText(input.changes.policyNumber, 160));
    if ('policySectionLabel' in input.changes) add('policy_section_label', optionalText(input.changes.policySectionLabel, 240));
    if ('reviewStatus' in input.changes) add('review_status', enumValue(input.changes.reviewStatus, REVIEW_STATUSES, 'in_progress'));
    if (!fields.length) throw new Error('INSURANCE_BULK_CHANGES_REQUIRED');
    values.push(input.brokerUserId, input.workspaceId, assetIds);
    await client.query(
      `update insurance_asset_reviews r set ${fields.join(', ')}, reviewed_by_user_id = $${values.length - 2},
         reviewed_at = now(), version = version + 1, updated_at = now()
       from insurance_workspace_assets a, insurance_workspaces w
       where r.workspace_asset_id = a.id and a.workspace_id = w.id
         and w.broker_user_id = $${values.length - 2} and w.id = $${values.length - 1}::uuid
         and a.id = any($${values.length}::uuid[])`,
      values,
    );
    await client.query('update insurance_workspaces set review_status = $1, last_reviewed_at = now(), updated_at = now() where id = $2::uuid', ['in_progress', input.workspaceId]);
    await audit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.brokerUserId,
      entityType: 'asset_review',
      action: 'bulk_updated',
      after: { assetIds, changes: input.changes },
    });
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
}

export async function saveInsuranceGeneralCovers(input: {
  brokerUserId: string;
  workspaceId: string;
  covers: unknown;
}): Promise<InsuranceWorkspaceData> {
  const client = await getDb().connect();
  try {
    await client.query('begin');
    const workspace = await ownedWorkspaceRow(client, input.brokerUserId, input.workspaceId);
    const profile = enumValue(workspace.client_profile, CLIENT_PROFILES, 'unclassified');
    const definitions = new Map<string, { key: string; label: string }>(
      generalCoversForProfile(profile).map((cover) => [cover.key, { key: cover.key, label: cover.label }]),
    );
    const covers = Array.isArray(input.covers) ? input.covers.map(record) : [];
    for (const cover of covers) {
      const definition = definitions.get(text(cover.key));
      if (!definition) continue;
      await client.query(
        `insert into insurance_general_cover_reviews
          (workspace_id, cover_key, cover_label_snapshot, cover_status, insurer_name, policy_number,
           policy_section_label, limit_amount, exclusion_reason_key, recommendation_status,
           recommendation_note, notes, reviewed_by_user_id, reviewed_at)
         values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, now())
         on conflict (workspace_id, cover_key) do update set
           cover_label_snapshot = excluded.cover_label_snapshot,
           cover_status = excluded.cover_status,
           insurer_name = excluded.insurer_name,
           policy_number = excluded.policy_number,
           policy_section_label = excluded.policy_section_label,
           limit_amount = excluded.limit_amount,
           exclusion_reason_key = excluded.exclusion_reason_key,
           recommendation_status = excluded.recommendation_status,
           recommendation_note = excluded.recommendation_note,
           notes = excluded.notes,
           reviewed_by_user_id = excluded.reviewed_by_user_id,
           reviewed_at = now(), updated_at = now()`,
        [
          input.workspaceId,
          definition.key,
          definition.label,
          enumValue(cover.status, OPTION_STATUSES, 'unknown'),
          optionalText(cover.insurerName, 240),
          optionalText(cover.policyNumber, 160),
          optionalText(cover.policySectionLabel, 240),
          nullableNumber(cover.limitAmount),
          optionalText(cover.exclusionReasonKey, 160),
          enumValue(cover.recommendationStatus, RECOMMENDATION_STATUSES, 'review'),
          optionalText(cover.recommendationNote, 8000),
          optionalText(cover.notes, 8000),
          input.brokerUserId,
        ],
      );
    }
    await client.query("update insurance_workspaces set review_status = case when review_status = 'not_started' then 'in_progress' else review_status end, last_reviewed_at = now(), updated_at = now() where id = $1::uuid", [input.workspaceId]);
    await audit(client, {
      workspaceId: input.workspaceId,
      actorUserId: input.brokerUserId,
      entityType: 'general_cover',
      action: 'saved',
      after: { covers },
    });
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
  return getInsuranceWorkspace(input.brokerUserId, input.workspaceId);
}

export async function listInsuranceReportSnapshots(brokerUserId: string, workspaceId: string) {
  const workspace = await getInsuranceWorkspace(brokerUserId, workspaceId);
  return workspace.reports;
}
