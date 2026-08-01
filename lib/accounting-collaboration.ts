import { getDb } from './db';
import { getAssetRegisterItemById, listAssetRegisterItems } from './asset-register-db';
import { getAssetRegisterForUser } from './asset-registers';
import {
  getAccountantRegisterAccess,
  getAccountantRegisterData,
  type AccountantRegisterAccess,
} from './accountant-workspace';

export type FinanceLinkRole = 'directly_financed' | 'financed_acquisition' | 'collateral_only';
export type FinanceAgreementStatus = 'draft' | 'active' | 'settled' | 'refinanced' | 'cancelled';
export type FinanceAgreementScope = 'complete' | 'partial' | 'unknown';
export type CommitmentFrequency = 'monthly' | 'quarterly' | 'six_monthly' | 'annual';

export type FinanceAgreementAssetLink = {
  id: string;
  assetId: string;
  assetTitle: string;
  linkRole: FinanceLinkRole;
  originalAmountAllocation: number | null;
  settlementAllocation: number | null;
  allocationDate: string;
  allocationNote: string;
};

export type FinanceAgreementRecord = {
  id: string;
  agreementName: string;
  referenceNumber: string;
  financierName: string;
  agreementType: string;
  agreementStatus: FinanceAgreementStatus;
  agreementScope: FinanceAgreementScope;
  startDate: string;
  maturityDate: string;
  originalAmount: number | null;
  instalment: number | null;
  instalmentFrequency: CommitmentFrequency | '';
  balloon: number | null;
  balloonDate: string;
  interestRate: number | null;
  outstandingBalance: number | null;
  latestBalanceDate: string;
  settlementAmount: number | null;
  settlementDate: string;
  sourceReference: string;
  securityDescription: string;
  financeNote: string;
  links: FinanceAgreementAssetLink[];
};

export type RecurringCommitmentRecord = {
  id: string;
  description: string;
  category: string;
  amount: number;
  frequency: CommitmentFrequency;
  startDate: string;
  endDate: string;
  renewalDate: string;
  status: 'active' | 'ended' | 'cancelled';
  sourceReference: string;
  note: string;
  annualAmount: number;
  assets: Array<{ assetId: string; assetTitle: string; annualAllocation: number | null; allocationNote: string }>;
};

export type AccountingAttentionItem = {
  key: string;
  severity: 'information' | 'review' | 'attention';
  title: string;
  message: string;
  assetId?: string;
  assetTitle?: string;
  agreementId?: string;
};

export type AccountingReviewStatus = 'waiting_for_owner' | 'deferred' | 'reviewed' | 'resolved';

type AgreementRow = {
  id: string;
  agreement_name: string;
  agreement_reference: string | null;
  financier_name: string | null;
  agreement_type: string | null;
  agreement_status: FinanceAgreementStatus;
  agreement_scope: FinanceAgreementScope;
  start_date: string | null;
  maturity_date: string | null;
  original_amount: string | number | null;
  instalment_amount: string | number | null;
  instalment_frequency: CommitmentFrequency | null;
  balloon_amount: string | number | null;
  balloon_date: string | null;
  interest_rate: string | number | null;
  source_reference: string | null;
  security_description: string | null;
  accountant_note: string | null;
  outstanding_balance: string | number | null;
  outstanding_balance_date: string | null;
  settlement_amount: string | number | null;
  settlement_valid_date: string | null;
};

type LinkRow = {
  id: string;
  finance_agreement_id: string;
  asset_register_item_id: string;
  asset_title: string;
  link_role: FinanceLinkRole;
  original_amount_allocation: string | number | null;
  settlement_allocation: string | number | null;
  allocation_date: string | null;
  allocation_note: string | null;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || text(value) === '') return null;
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function dateOrNull(value: unknown): string | null {
  const normalized = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function dateText(value: unknown): string {
  return text(value).slice(0, 10);
}

function allowedValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const normalized = text(value) as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

function annualise(amount: number, frequency: CommitmentFrequency): number {
  const multiplier = frequency === 'monthly' ? 12 : frequency === 'quarterly' ? 4 : frequency === 'six_monthly' ? 2 : 1;
  return Math.round(amount * multiplier * 100) / 100;
}

async function requireAsset(access: AccountantRegisterAccess, assetId: string) {
  const asset = await getAssetRegisterItemById(access.ownerUserId, assetId);
  const register = asset?.registerId ? await getAssetRegisterForUser(access.ownerUserId, asset.registerId) : null;
  if (!asset || !register) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
  return asset;
}

async function requireAccountantAccess(accountantUserId: string, shareId: string, requireWrite = false) {
  const access = await getAccountantRegisterAccess({ accountantUserId, shareId });
  if (requireWrite && !access.allowDirectUpdates) throw new Error('ACCOUNTANT_READ_ONLY');
  return access;
}

async function writeAudit(
  access: AccountantRegisterAccess,
  actorUserId: string,
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>,
) {
  await getDb().query(
    `insert into public.access_audit_events
       (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
     values ($1, $2, $3, $4, $5, $6::jsonb, now())`,
    [access.ownerUserId, actorUserId, eventType, entityType, entityId, JSON.stringify({ registerId: access.registerId, ...metadata })],
  );
}

export async function listFinanceAgreements(ownerUserId: string): Promise<FinanceAgreementRecord[]> {
  const [agreementResult, linkResult] = await Promise.all([
    getDb().query<AgreementRow>(
      `select a.id::text, a.agreement_name, a.agreement_reference, a.financier_name, a.agreement_type,
              a.agreement_status, a.agreement_scope, a.start_date::text, a.maturity_date::text,
              a.original_amount, a.instalment_amount, a.instalment_frequency, a.balloon_amount,
              a.balloon_date::text, a.interest_rate, a.source_reference, a.security_description,
              a.accountant_note, snapshot.outstanding_balance, snapshot.outstanding_balance_date::text,
              snapshot.settlement_amount, snapshot.settlement_valid_date::text
       from public.asset_finance_agreements a
       left join lateral (
         select s.outstanding_balance, s.outstanding_balance_date, s.settlement_amount, s.settlement_valid_date
         from public.asset_finance_agreement_snapshots s
         where s.owner_user_id = a.owner_user_id and s.finance_agreement_id = a.id
         order by s.created_at desc limit 1
       ) snapshot on true
       where a.owner_user_id = $1
       order by case a.agreement_status when 'active' then 0 when 'draft' then 1 else 2 end, a.updated_at desc`,
      [ownerUserId],
    ),
    getDb().query<LinkRow>(
      `select link.id::text, link.finance_agreement_id::text, link.asset_register_item_id::text,
              asset.title as asset_title, link.link_role, link.original_amount_allocation,
              link.settlement_allocation, link.allocation_date::text, link.allocation_note
       from public.asset_finance_agreement_assets link
       join public.asset_register_items asset on asset.id = link.asset_register_item_id and asset.user_id = link.owner_user_id
       where link.owner_user_id = $1
       order by asset.title asc`,
      [ownerUserId],
    ),
  ]);

  const links = new Map<string, FinanceAgreementAssetLink[]>();
  for (const row of linkResult.rows) {
    const list = links.get(row.finance_agreement_id) ?? [];
    list.push({
      id: row.id,
      assetId: row.asset_register_item_id,
      assetTitle: row.asset_title,
      linkRole: row.link_role,
      originalAmountAllocation: numberOrNull(row.original_amount_allocation),
      settlementAllocation: numberOrNull(row.settlement_allocation),
      allocationDate: dateText(row.allocation_date),
      allocationNote: text(row.allocation_note),
    });
    links.set(row.finance_agreement_id, list);
  }

  return agreementResult.rows.map((row) => ({
    id: row.id,
    agreementName: row.agreement_name,
    referenceNumber: text(row.agreement_reference),
    financierName: text(row.financier_name),
    agreementType: text(row.agreement_type),
    agreementStatus: row.agreement_status,
    agreementScope: row.agreement_scope,
    startDate: dateText(row.start_date),
    maturityDate: dateText(row.maturity_date),
    originalAmount: numberOrNull(row.original_amount),
    instalment: numberOrNull(row.instalment_amount),
    instalmentFrequency: row.instalment_frequency ?? '',
    balloon: numberOrNull(row.balloon_amount),
    balloonDate: dateText(row.balloon_date),
    interestRate: numberOrNull(row.interest_rate),
    outstandingBalance: numberOrNull(row.outstanding_balance),
    latestBalanceDate: dateText(row.outstanding_balance_date),
    settlementAmount: numberOrNull(row.settlement_amount),
    settlementDate: dateText(row.settlement_valid_date),
    sourceReference: text(row.source_reference),
    securityDescription: text(row.security_description),
    financeNote: text(row.accountant_note),
    links: links.get(row.id) ?? [],
  }));
}

export async function listFinanceAgreementsForAccountant(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
}) {
  const access = await requireAccountantAccess(input.accountantUserId, input.shareId);
  await requireAsset(access, input.assetId);
  const agreements = await listFinanceAgreements(access.ownerUserId);
  return {
    agreements,
    linkedAgreementIds: agreements.filter((agreement) => agreement.links.some((link) => link.assetId === input.assetId)).map((agreement) => agreement.id),
  };
}

export async function saveFinanceAgreementForAccountant(input: {
  accountantUserId: string;
  shareId: string;
  assetId: string;
  body: Record<string, unknown>;
}) {
  const access = await requireAccountantAccess(input.accountantUserId, input.shareId, true);
  const asset = await requireAsset(access, input.assetId);
  const body = input.body;
  const status = allowedValue(body.agreementStatus, ['draft', 'active', 'settled', 'refinanced', 'cancelled'] as const, 'draft');
  const scope = allowedValue(body.agreementScope, ['complete', 'partial', 'unknown'] as const, 'unknown');
  const linkRole = allowedValue(body.linkRole, ['directly_financed', 'financed_acquisition', 'collateral_only'] as const, 'directly_financed');
  const frequency = text(body.instalmentFrequency)
    ? allowedValue(body.instalmentFrequency, ['monthly', 'quarterly', 'six_monthly', 'annual'] as const, 'monthly')
    : null;
  const financeType = text(body.financeType);
  const requestedLinkedAssetIds = Array.isArray(body.linkedAssetIds)
    ? body.linkedAssetIds.map((value) => text(value)).filter(Boolean)
    : [];
  const linkedAssetIds = financeType === 'bulk_group'
    ? Array.from(new Set([asset.id, ...requestedLinkedAssetIds]))
    : [asset.id];
  if (financeType === 'bulk_group' && linkedAssetIds.length < 2) {
    throw new Error('ACCOUNTANT_BULK_FINANCE_REQUIRES_MULTIPLE_ASSETS');
  }
  const linkedAssets = await Promise.all(linkedAssetIds.map(async (assetId) => {
    const linkedAsset = await requireAsset(access, assetId);
    if (linkedAsset.registerId !== access.registerId) throw new Error('ACCOUNTANT_ASSET_NOT_FOUND');
    return linkedAsset;
  }));
  const agreementName = text(body.agreementName) || text(body.referenceNumber) || `${asset.title} finance`;
  const requestedAgreementId = text(body.agreementId);

  let agreementId = requestedAgreementId;
  if (agreementId) {
    const existing = await getDb().query<{ id: string }>(
      `select id::text from public.asset_finance_agreements where id = $1::uuid and owner_user_id = $2 limit 1`,
      [agreementId, access.ownerUserId],
    );
    if (!existing.rows[0]) throw new Error('ACCOUNTANT_FINANCE_AGREEMENT_NOT_FOUND');
    await getDb().query(
      `update public.asset_finance_agreements set
         agreement_name = $3, agreement_reference = $4, financier_name = $5, agreement_type = $6,
         agreement_status = $7, agreement_scope = $8, start_date = $9::date, maturity_date = $10::date,
         original_amount = $11, instalment_amount = $12, instalment_frequency = $13,
         balloon_amount = $14, balloon_date = $15::date, interest_rate = $16,
         source_reference = $17, security_description = $18, accountant_note = $19,
         updated_by_user_id = $2, updated_at = now()
       where id = $1::uuid and owner_user_id = $20`,
      [agreementId, input.accountantUserId, agreementName, text(body.referenceNumber) || null,
        text(body.financierName) || null, financeType || null, status, scope,
        dateOrNull(body.startDate), dateOrNull(body.endDate), numberOrNull(body.originalAmount),
        numberOrNull(body.instalment), frequency, numberOrNull(body.balloon), dateOrNull(body.balloonDate),
        numberOrNull(body.interestRate), text(body.sourceReference) || null,
        text(body.securityDescription) || null, text(body.financeNote) || null, access.ownerUserId],
    );
  } else {
    const created = await getDb().query<{ id: string }>(
      `insert into public.asset_finance_agreements
         (owner_user_id, agreement_name, agreement_reference, financier_name, agreement_type,
          agreement_status, agreement_scope, start_date, maturity_date, original_amount,
          instalment_amount, instalment_frequency, balloon_amount, balloon_date, interest_rate,
          source_reference, security_description, accountant_note, created_by_user_id,
          updated_by_user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11, $12, $13,
               $14::date, $15, $16, $17, $18, $19, $19, now(), now())
       returning id::text`,
      [access.ownerUserId, agreementName, text(body.referenceNumber) || null, text(body.financierName) || null,
        financeType || null, status, scope, dateOrNull(body.startDate), dateOrNull(body.endDate),
        numberOrNull(body.originalAmount), numberOrNull(body.instalment), frequency, numberOrNull(body.balloon),
        dateOrNull(body.balloonDate), numberOrNull(body.interestRate), text(body.sourceReference) || null,
        text(body.securityDescription) || null, text(body.financeNote) || null, input.accountantUserId],
    );
    agreementId = created.rows[0]?.id ?? '';
  }
  if (!agreementId) throw new Error('ACCOUNTANT_FINANCE_AGREEMENT_NOT_SAVED');

  const hasSnapshot = ['outstandingBalance', 'latestBalanceDate', 'settlementAmount', 'settlementDate']
    .some((key) => text(body[key]));
  if (hasSnapshot) {
    await getDb().query(
      `insert into public.asset_finance_agreement_snapshots
         (owner_user_id, finance_agreement_id, outstanding_balance, outstanding_balance_date,
          settlement_amount, settlement_valid_date, recorded_by_user_id, source_reference, created_at)
       values ($1, $2::uuid, $3, $4::date, $5, $6::date, $7, $8, now())`,
      [access.ownerUserId, agreementId, numberOrNull(body.outstandingBalance), dateOrNull(body.latestBalanceDate),
        numberOrNull(body.settlementAmount), dateOrNull(body.settlementDate), input.accountantUserId,
        text(body.sourceReference) || null],
    );
  }

  await getDb().query(
    `delete from public.asset_finance_agreement_assets link
     using public.asset_register_items linked_asset
     where link.owner_user_id = $1
       and link.finance_agreement_id = $2::uuid
       and linked_asset.id = link.asset_register_item_id
       and linked_asset.user_id = $1
       and linked_asset.register_id = $3::uuid
       and not (link.asset_register_item_id = any($4::uuid[]))`,
    [access.ownerUserId, agreementId, access.registerId, linkedAssetIds],
  );

  await Promise.all(linkedAssets.map((linkedAsset) => {
    const isCurrentAsset = linkedAsset.id === asset.id;
    return getDb().query(
      `insert into public.asset_finance_agreement_assets
         (owner_user_id, finance_agreement_id, asset_register_item_id, link_role,
          original_amount_allocation, settlement_allocation, allocation_date, allocation_note,
          created_at, updated_at)
       values ($1, $2::uuid, $3::uuid, $4, $5, $6, $7::date, $8, now(), now())
       on conflict (finance_agreement_id, asset_register_item_id) do update
         set link_role = excluded.link_role, original_amount_allocation = excluded.original_amount_allocation,
             settlement_allocation = excluded.settlement_allocation, allocation_date = excluded.allocation_date,
             allocation_note = excluded.allocation_note, updated_at = now()`,
      [access.ownerUserId, agreementId, linkedAsset.id, isCurrentAsset ? linkRole : 'financed_acquisition',
        isCurrentAsset ? numberOrNull(body.originalAmountAllocation) : null,
        isCurrentAsset ? numberOrNull(body.settlementAllocation) : null,
        dateOrNull(body.allocationDate), isCurrentAsset ? text(body.allocationNote) || null : null],
    );
  }));

  await writeAudit(access, input.accountantUserId, requestedAgreementId ? 'finance_agreement_updated' : 'finance_agreement_created',
    'asset_finance_agreement', agreementId, {
      assetId: asset.id,
      assetTitle: asset.title,
      agreementName,
      linkRole,
      linkedAssetIds,
    });
  return listFinanceAgreementsForAccountant(input);
}

export async function listRecurringCommitments(ownerUserId: string, assetIds?: Set<string> | null): Promise<RecurringCommitmentRecord[]> {
  const result = await getDb().query<{
    id: string; description: string; category: string; amount: string | number; frequency: CommitmentFrequency;
    start_date: string; end_date: string | null; renewal_date: string | null; status: 'active' | 'ended' | 'cancelled';
    source_reference: string | null; note: string | null;
  }>(
    `select id::text, description, category, amount, frequency, start_date::text, end_date::text,
            renewal_date::text, status, source_reference, note
     from public.asset_recurring_commitments where owner_user_id = $1
     order by case status when 'active' then 0 else 1 end, coalesce(renewal_date, end_date) asc nulls last, updated_at desc`,
    [ownerUserId],
  );
  const links = await getDb().query<{
    recurring_commitment_id: string; asset_register_item_id: string; asset_title: string;
    annual_allocation: string | number | null; allocation_note: string | null;
  }>(
    `select link.recurring_commitment_id::text, link.asset_register_item_id::text, asset.title as asset_title,
            link.annual_allocation, link.allocation_note
     from public.asset_recurring_commitment_assets link
     join public.asset_register_items asset on asset.id = link.asset_register_item_id and asset.user_id = link.owner_user_id
     where link.owner_user_id = $1 order by asset.title asc`,
    [ownerUserId],
  );
  const linksByCommitment = new Map<string, RecurringCommitmentRecord['assets']>();
  for (const link of links.rows) {
    if (assetIds && !assetIds.has(link.asset_register_item_id)) continue;
    const current = linksByCommitment.get(link.recurring_commitment_id) ?? [];
    current.push({ assetId: link.asset_register_item_id, assetTitle: link.asset_title,
      annualAllocation: numberOrNull(link.annual_allocation), allocationNote: text(link.allocation_note) });
    linksByCommitment.set(link.recurring_commitment_id, current);
  }
  return result.rows.flatMap((row) => {
    const assets = linksByCommitment.get(row.id) ?? [];
    if (assetIds && !assets.length) return [];
    const amount = numberOrNull(row.amount) ?? 0;
    return [{ id: row.id, description: row.description, category: row.category, amount,
      frequency: row.frequency, startDate: dateText(row.start_date), endDate: dateText(row.end_date),
      renewalDate: dateText(row.renewal_date), status: row.status, sourceReference: text(row.source_reference),
      note: text(row.note), annualAmount: annualise(amount, row.frequency), assets }];
  });
}

export async function saveRecurringCommitment(input: {
  ownerUserId: string;
  actorUserId: string;
  registerId?: string | null;
  body: Record<string, unknown>;
}) {
  const description = text(input.body.description);
  const amount = numberOrNull(input.body.amount);
  const frequency = allowedValue(input.body.frequency, ['monthly', 'quarterly', 'six_monthly', 'annual'] as const, 'monthly');
  const status = allowedValue(input.body.status, ['active', 'ended', 'cancelled'] as const, 'active');
  const assetIds = Array.isArray(input.body.assetIds) ? [...new Set(input.body.assetIds.map(text).filter(Boolean))] : [];
  if (!description || amount === null || !dateOrNull(input.body.startDate) || !assetIds.length) {
    throw new Error('RECURRING_COMMITMENT_REQUIRED');
  }
  const assets = await listAssetRegisterItems(input.ownerUserId, input.registerId || undefined);
  const allowedAssetIds = new Set(assets.map((asset) => asset.id));
  if (assetIds.some((assetId) => !allowedAssetIds.has(assetId))) throw new Error('RECURRING_COMMITMENT_ASSET_INVALID');
  const created = await getDb().query<{ id: string }>(
    `insert into public.asset_recurring_commitments
       (owner_user_id, description, category, amount, frequency, start_date, end_date, renewal_date,
        status, source_reference, note, created_by_user_id, updated_by_user_id, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6::date, $7::date, $8::date, $9, $10, $11, $12, $12, now(), now())
     returning id::text`,
    [input.ownerUserId, description, text(input.body.category) || 'other', amount, frequency,
      dateOrNull(input.body.startDate), dateOrNull(input.body.endDate), dateOrNull(input.body.renewalDate), status,
      text(input.body.sourceReference) || null, text(input.body.note) || null, input.actorUserId],
  );
  const commitmentId = created.rows[0]?.id;
  if (!commitmentId) throw new Error('RECURRING_COMMITMENT_NOT_SAVED');
  for (const assetId of assetIds) {
    await getDb().query(
      `insert into public.asset_recurring_commitment_assets
         (owner_user_id, recurring_commitment_id, asset_register_item_id, created_at)
       values ($1, $2::uuid, $3::uuid, now())`,
      [input.ownerUserId, commitmentId, assetId],
    );
  }
  await getDb().query(
    `insert into public.access_audit_events
       (owner_user_id, actor_user_id, event_type, entity_type, entity_id, metadata_json, created_at)
     values ($1, $2, 'recurring_commitment_created', 'asset_recurring_commitment', $3, $4::jsonb, now())`,
    [input.ownerUserId, input.actorUserId, commitmentId, JSON.stringify({ description, assetIds, amount, frequency })],
  );
  return commitmentId;
}

export async function saveAccountingReviewDecision(input: {
  accountantUserId: string;
  shareId: string;
  issueKey: unknown;
  issueStatus: unknown;
  severity?: unknown;
  assetId?: unknown;
  agreementId?: unknown;
  note?: unknown;
  deferredUntil?: unknown;
}) {
  const access = await requireAccountantAccess(input.accountantUserId, input.shareId);
  const issueKey = text(input.issueKey);
  const issueStatus = allowedValue(input.issueStatus,
    ['waiting_for_owner', 'deferred', 'reviewed', 'resolved'] as const, 'reviewed');
  const severity = allowedValue(input.severity, ['information', 'review', 'attention'] as const, 'review');
  const assetId = text(input.assetId);
  const agreementId = text(input.agreementId);
  if (!issueKey) throw new Error('ACCOUNTING_REVIEW_KEY_REQUIRED');
  if (assetId) await requireAsset(access, assetId);
  if (agreementId) {
    const agreement = await getDb().query<{ id: string }>(
      `select id::text from public.asset_finance_agreements where owner_user_id = $1 and id = $2::uuid limit 1`,
      [access.ownerUserId, agreementId],
    );
    if (!agreement.rows[0]) throw new Error('ACCOUNTANT_FINANCE_AGREEMENT_NOT_FOUND');
  }
  await getDb().query(
    `insert into public.asset_accounting_review_items
       (owner_user_id, register_id, asset_register_item_id, finance_agreement_id, issue_key,
        issue_status, severity, note, deferred_until, reviewed_by_user_id, reviewed_at, created_at, updated_at)
     values ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::date, $10, now(), now(), now())
     on conflict (owner_user_id, register_id, issue_key) do update
       set issue_status = excluded.issue_status, severity = excluded.severity, note = excluded.note,
           deferred_until = excluded.deferred_until, reviewed_by_user_id = excluded.reviewed_by_user_id,
           reviewed_at = now(), updated_at = now()`,
    [access.ownerUserId, access.registerId, assetId || null, agreementId || null, issueKey, issueStatus,
      severity, text(input.note) || null, issueStatus === 'deferred' ? dateOrNull(input.deferredUntil) : null,
      input.accountantUserId],
  );
  await writeAudit(access, input.accountantUserId, 'accounting_review_status_updated', 'asset_accounting_review_item', issueKey, {
    issueStatus, severity, assetId: assetId || null, agreementId: agreementId || null,
    deferredUntil: issueStatus === 'deferred' ? dateOrNull(input.deferredUntil) : null,
  });
}

function daysUntil(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function daysSince(value: string): number | null {
  const until = daysUntil(value);
  return until === null ? null : -until;
}

export async function buildAccountantFinancialSummary(input: { accountantUserId: string; shareId: string }) {
  const data = await getAccountantRegisterData(input.accountantUserId, input.shareId);
  const agreements = await listFinanceAgreements(data.access.ownerUserId);
  const assetIds = new Set(data.items.map((item) => item.id));
  const commitments = await listRecurringCommitments(data.access.ownerUserId, assetIds);
  const activeAgreements = agreements.filter((agreement) => agreement.agreementStatus === 'active');
  const items: AccountingAttentionItem[] = [];

  const agreementIdsByAsset = new Map<string, string[]>();
  for (const agreement of agreements) for (const link of agreement.links) {
    agreementIdsByAsset.set(link.assetId, [...(agreementIdsByAsset.get(link.assetId) ?? []), agreement.id]);
  }

  const duplicateIdentity = new Map<string, typeof data.items>();
  for (const asset of data.items) {
    if (asset.isFinanced && !(agreementIdsByAsset.get(asset.id)?.length)) {
      items.push({ key: `finance-unlinked:${asset.id}`, severity: 'attention', title: 'Financed asset is not linked',
        message: 'Link the asset to a Finance Agreement.', assetId: asset.id, assetTitle: asset.title });
    }
    if (!asset.accountingValue) {
      items.push({ key: `book-value-missing:${asset.id}`, severity: 'information', title: 'Accounting Book Value missing',
        message: 'No current Accounting Book Value has been recorded.', assetId: asset.id, assetTitle: asset.title });
    } else if ((daysSince(asset.accountingValue.asAtDate) ?? 0) > 366) {
      items.push({ key: `book-value-stale:${asset.id}`, severity: 'review', title: 'Accounting Book Value is outdated',
        message: `The current value is dated ${asset.accountingValue.asAtDate}.`, assetId: asset.id, assetTitle: asset.title });
    }
    const identity = [asset.serialNumber, asset.licenseRegistrationNumber,
      ...['vin', 'serialNumber', 'serial_number', 'registrationNumber', 'registration_number'].map((key) => asset.specsJson[key])]
      .map((value) => text(value).toLowerCase().replace(/[^a-z0-9]/g, '')).find(Boolean);
    if (identity) duplicateIdentity.set(identity, [...(duplicateIdentity.get(identity) ?? []), asset]);
  }
  for (const duplicates of duplicateIdentity.values()) {
    if (duplicates.length < 2) continue;
    duplicates.forEach((asset) => items.push({ key: `duplicate-identity:${asset.id}`, severity: 'attention',
      title: 'Possible duplicate asset identity', message: `The same VIN, serial or registration appears on ${duplicates.length} assets.`,
      assetId: asset.id, assetTitle: asset.title }));
  }

  for (const agreement of activeAgreements) {
    if (!agreement.settlementAmount || !agreement.settlementDate || (daysSince(agreement.settlementDate) ?? 0) > 180) {
      items.push({ key: `settlement-stale:${agreement.id}`, severity: 'review', title: 'Settlement amount needs review',
        message: 'The agreement has no settlement amount or it is more than 180 days old.', agreementId: agreement.id });
    }
    const maturityDays = daysUntil(agreement.maturityDate);
    if (maturityDays !== null && maturityDays >= 0 && maturityDays <= 90) {
      items.push({ key: `maturity:${agreement.id}`, severity: 'attention', title: 'Finance agreement nearing maturity',
        message: `${agreement.agreementName} matures in ${maturityDays} days.`, agreementId: agreement.id });
    }
    if (agreement.agreementScope !== 'complete') {
      items.push({ key: `scope:${agreement.id}`, severity: 'information', title: 'Finance agreement coverage is incomplete',
        message: 'Confirm whether every financed item is represented in Aim4price.', agreementId: agreement.id });
    }
    for (const link of agreement.links) {
      if (link.linkRole === 'collateral_only' || link.settlementAllocation === null) continue;
      const asset = data.items.find((item) => item.id === link.assetId);
      if (asset && link.settlementAllocation > asset.value) {
        items.push({ key: `negative-equity:${asset.id}:${agreement.id}`, severity: 'attention', title: 'Finance exceeds market value',
          message: 'The recorded settlement allocation exceeds the latest Aim4price Market Value.', assetId: asset.id,
          assetTitle: asset.title, agreementId: agreement.id });
      }
    }
  }
  for (const commitment of commitments) {
    const renewalDays = daysUntil(commitment.renewalDate || commitment.endDate);
    if (commitment.status === 'active' && renewalDays !== null && renewalDays >= 0 && renewalDays <= 30) {
      items.push({ key: `commitment-renewal:${commitment.id}`, severity: 'review', title: 'Recurring commitment nearing renewal',
        message: `${commitment.description} is due within ${renewalDays} days.` });
    }
  }

  const reviewResult = await getDb().query<{
    issue_key: string; issue_status: string; deferred_until: string | null;
  }>(
    `select issue_key, issue_status, deferred_until::text
     from public.asset_accounting_review_items
     where owner_user_id = $1 and register_id = $2::uuid`,
    [data.access.ownerUserId, data.register.id],
  );
  const reviewByKey = new Map(reviewResult.rows.map((row) => [row.issue_key, row]));
  const visibleItems = items.filter((item) => {
    const review = reviewByKey.get(item.key);
    if (!review) return true;
    if (review.issue_status === 'resolved' || review.issue_status === 'reviewed') return false;
    if (review.issue_status === 'deferred' && review.deferred_until && (daysUntil(dateText(review.deferred_until)) ?? -1) >= 0) return false;
    return true;
  });

  const totalMarketValue = data.items.reduce((sum, asset) => sum + Number(asset.value || 0), 0);
  const totalReplacementValue = data.items.reduce((sum, asset) => sum + Number(asset.replacementPriceExVat || 0), 0);
  const assetsWithBookValue = data.items.filter((asset) => asset.accountingValue);
  const totalAccountingBookValue = assetsWithBookValue.reduce((sum, asset) => sum + Number(asset.accountingValue?.carryingValue || 0), 0);
  const totalFinanceSettlement = activeAgreements.reduce((sum, agreement) => sum + Number(agreement.settlementAmount || 0), 0);
  const annualRecurringCommitments = commitments.filter((item) => item.status === 'active').reduce((sum, item) => sum + item.annualAmount, 0);
  const annualFinanceCommitments = activeAgreements.reduce((sum, agreement) => {
    if (!agreement.instalment || !agreement.instalmentFrequency) return sum;
    return sum + annualise(agreement.instalment, agreement.instalmentFrequency);
  }, 0);
  const severity = visibleItems.some((item) => item.severity === 'attention') ? 'attention_required'
    : visibleItems.some((item) => item.severity === 'information') ? 'needs_information'
      : visibleItems.length ? 'accountant_review' : 'up_to_date';

  return {
    access: data.access,
    register: data.register,
    summary: {
      activeAssetCount: data.items.length,
      totalMarketValue,
      marketValueCoverage: data.items.filter((asset) => Number(asset.value || 0) > 0).length,
      totalReplacementValue,
      replacementValueCoverage: data.items.filter((asset) => Number(asset.replacementPriceExVat || 0) > 0).length,
      totalAccountingBookValue,
      accountingBookValueCoverage: assetsWithBookValue.length,
      totalFinanceSettlement,
      estimatedNetAssetEquity: totalMarketValue - totalFinanceSettlement,
      annualRecurringCommitments,
      annualFinanceCommitments,
      financeAgreementCount: activeAgreements.length,
      dataStatus: severity,
      partial: assetsWithBookValue.length !== data.items.length || activeAgreements.some((agreement) => agreement.agreementScope !== 'complete'),
    },
    agreements,
    commitments,
    attentionItems: visibleItems,
  };
}
