import { getAssetRegisterItemById } from './asset-register-db';
import { ensureDealerMaintenanceTrackerTables } from './dealer-maintenance-tracker';
import { getDb } from './db';
import {
  calculateMyInvoiceSummary,
  createMyInvoice,
  deleteDealerMyInvoice,
  ensureMyInvoiceTables,
  listMyInvoices,
  mapMyInvoiceAssetOption,
  updateMyInvoice,
  type MyInvoiceActorContext,
  type MyInvoiceAssetOption,
  type MyInvoiceDraftInput,
  type MyInvoiceListFilters,
  type MyInvoiceRecord,
  type MyInvoiceSummary,
} from './my-invoices';
import { ensurePartnerAccessTables } from './partner-access';

export type DealerCostActor = {
  dealerUserId: string;
  dealerStaffId: string;
  displayName: string;
  supplierName: string;
};

export type DealerCostAssetOption = MyInvoiceAssetOption & {
  ownerUserId: string;
  ownerName: string;
};

export type DealerCostsData = {
  assets: DealerCostAssetOption[];
  invoices: MyInvoiceRecord[];
  summary: MyInvoiceSummary;
};

type DealerCostAssetRef = {
  owner_user_id: string;
  asset_register_item_id: string;
  owner_name: string | null;
};

type DealerCostInvoiceRef = {
  owner_user_id: string;
  asset_register_item_id: string;
};

function asText(value: unknown): string {
  return String(value ?? '').trim();
}

function actorContext(actor: DealerCostActor): MyInvoiceActorContext {
  return {
    dealerUserId: actor.dealerUserId,
    dealerStaffId: actor.dealerStaffId || null,
    displayName: actor.displayName,
  };
}

async function ensureDealerCostDependencies(): Promise<void> {
  await Promise.all([
    ensureMyInvoiceTables(),
    ensurePartnerAccessTables(),
    ensureDealerMaintenanceTrackerTables(),
  ]);
}

async function listDealerCostAssetRefs(
  dealerUserId: string,
  assetId?: string | null,
): Promise<DealerCostAssetRef[]> {
  await ensureDealerCostDependencies();

  const values: unknown[] = [dealerUserId];
  const assetClause = asText(assetId)
    ? `and shared.asset_register_item_id = $2::uuid`
    : '';
  if (assetClause) values.push(asText(assetId));

  const result = await getDb().query<DealerCostAssetRef>(
    `
      with shared_assets as (
        select lead.owner_user_id, lead.asset_register_item_id
        from public.asset_leads lead
        where lead.partner_user_id = $1

        union

        select access.owner_user_id, access.asset_register_item_id
        from public.dealer_maintenance_access access
        where access.dealer_user_id = $1
          and access.is_active = true
      )
      select distinct
        shared.owner_user_id,
        shared.asset_register_item_id::text,
        coalesce(
          nullif(owner.business_name, ''),
          nullif(owner.display_name, ''),
          nullif(owner_user.name, ''),
          'Asset owner'
        ) as owner_name
      from shared_assets shared
      inner join public.asset_register_items asset
        on asset.id = shared.asset_register_item_id
       and asset.user_id = shared.owner_user_id
      left join public.account_profiles owner
        on owner.user_id = shared.owner_user_id
      left join public."user" owner_user
        on owner_user.id = shared.owner_user_id
      where true
        ${assetClause}
      order by owner_name asc, shared.asset_register_item_id asc
    `,
    values,
  );

  return result.rows;
}

export async function listDealerCostAssets(dealerUserId: string): Promise<DealerCostAssetOption[]> {
  const refs = await listDealerCostAssetRefs(dealerUserId);
  const assets = await Promise.all(
    refs.map(async (ref) => {
      const asset = await getAssetRegisterItemById(ref.owner_user_id, ref.asset_register_item_id);
      if (!asset) return null;

      return {
        ...mapMyInvoiceAssetOption(asset),
        ownerUserId: ref.owner_user_id,
        ownerName: asText(ref.owner_name) || 'Asset owner',
      } satisfies DealerCostAssetOption;
    }),
  );

  return assets
    .filter((asset): asset is DealerCostAssetOption => Boolean(asset))
    .sort((left, right) => (
      left.ownerName.localeCompare(right.ownerName)
      || left.title.localeCompare(right.title)
    ));
}

export async function getDealerCostAssetAccess(
  dealerUserId: string,
  assetId: string,
): Promise<DealerCostAssetRef | null> {
  const refs = await listDealerCostAssetRefs(dealerUserId, assetId);
  return refs[0] ?? null;
}

export async function listDealerCostsData(
  dealerUserId: string,
  filters: MyInvoiceListFilters = {},
): Promise<DealerCostsData> {
  const assets = await listDealerCostAssets(dealerUserId);
  const allowedAssetIds = new Set(assets.map((asset) => asset.id));

  if (filters.assetId && !allowedAssetIds.has(filters.assetId)) {
    return { assets, invoices: [], summary: calculateMyInvoiceSummary([]) };
  }

  const ownerUserIds = Array.from(new Set(
    assets
      .filter((asset) => !filters.assetId || asset.id === filters.assetId)
      .map((asset) => asset.ownerUserId),
  ));

  const invoiceGroups = await Promise.all(
    ownerUserIds.map((ownerUserId) => listMyInvoices(ownerUserId, {
      ...filters,
      createdByDealerUserId: dealerUserId,
    })),
  );
  const invoices = invoiceGroups
    .flat()
    .filter((invoice) => allowedAssetIds.has(invoice.assetId))
    .sort((left, right) => {
      const leftTime = Date.parse(left.invoiceDate || left.createdAtIso) || 0;
      const rightTime = Date.parse(right.invoiceDate || right.createdAtIso) || 0;
      return rightTime - leftTime;
    });

  return {
    assets,
    invoices,
    summary: calculateMyInvoiceSummary(invoices),
  };
}

function withDefaultSupplier(input: MyInvoiceDraftInput, supplierName: string): MyInvoiceDraftInput {
  return asText(input.supplierName)
    ? input
    : { ...input, supplierName };
}

export async function createDealerCost(
  actor: DealerCostActor,
  input: MyInvoiceDraftInput,
) {
  const assetId = asText(input.assetId);
  const access = assetId ? await getDealerCostAssetAccess(actor.dealerUserId, assetId) : null;
  if (!access) throw new Error('DEALER_COST_ASSET_FORBIDDEN');

  return createMyInvoice(
    access.owner_user_id,
    withDefaultSupplier(input, actor.supplierName),
    actorContext(actor),
  );
}

async function getDealerCostInvoiceRef(
  dealerUserId: string,
  invoiceId: string,
): Promise<DealerCostInvoiceRef | null> {
  await ensureMyInvoiceTables();
  const result = await getDb().query<DealerCostInvoiceRef>(
    `
      select
        user_id as owner_user_id,
        asset_register_item_id::text
      from public.asset_invoices
      where id = $1::uuid
        and created_by_dealer_user_id = $2
      limit 1
    `,
    [invoiceId, dealerUserId],
  );
  return result.rows[0] ?? null;
}

export async function updateDealerCost(
  actor: DealerCostActor,
  invoiceId: string,
  input: MyInvoiceDraftInput,
) {
  const existing = await getDealerCostInvoiceRef(actor.dealerUserId, invoiceId);
  if (!existing) throw new Error('INVOICE_NOT_FOUND');

  const assetId = asText(input.assetId) || existing.asset_register_item_id;
  const access = await getDealerCostAssetAccess(actor.dealerUserId, assetId);
  if (!access || access.owner_user_id !== existing.owner_user_id) {
    throw new Error('DEALER_COST_ASSET_FORBIDDEN');
  }

  return updateMyInvoice(
    existing.owner_user_id,
    invoiceId,
    withDefaultSupplier({ ...input, assetId }, actor.supplierName),
    actorContext(actor),
  );
}

export async function deleteDealerCost(
  actor: DealerCostActor,
  invoiceId: string,
): Promise<boolean> {
  const existing = await getDealerCostInvoiceRef(actor.dealerUserId, invoiceId);
  if (!existing) return false;

  const access = await getDealerCostAssetAccess(actor.dealerUserId, existing.asset_register_item_id);
  if (!access || access.owner_user_id !== existing.owner_user_id) {
    throw new Error('DEALER_COST_ASSET_FORBIDDEN');
  }

  return deleteDealerMyInvoice(existing.owner_user_id, invoiceId, actor.dealerUserId);
}
