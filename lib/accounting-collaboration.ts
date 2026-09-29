import { getDb } from './db';
import { getAssetRegisterItemById, listAssetRegisterItems } from './asset-register-db';
import { getAssetRegisterForUser } from './asset-registers';

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
