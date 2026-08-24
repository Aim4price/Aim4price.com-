import { ensureAssetTransferSchema, type Aim4priceSaleInfluence, type AssetTransferStatus } from './asset-transfers';
import { getDb } from './db';

export type AdminAssetSaleRow = {
  id: string;
  assetId: string;
  assetTitle: string;
  assetDescription: string;
  sellerUserId: string;
  sellerName: string;
  soldDate: string;
  amountExVat: number | null;
  aim4priceInfluence: Aim4priceSaleInfluence | 'unknown';
  transferStatus: AssetTransferStatus | 'not_requested';
  buyerUserId: string | null;
  note: string;
  createdAtIso: string;
};

export type AdminAssetSalesReport = {
  generatedAtIso: string;
  metrics: {
    totalSold: number;
    helpedByAim4price: number;
    notHelpedByAim4price: number;
    influenceUnknown: number;
    helpRatePercent: number;
    transferredAccounts: number;
    pendingTransfers: number;
  };
  sales: AdminAssetSaleRow[];
};

type SaleRow = {
  id: string;
  asset_register_item_id: string;
  owner_user_id: string;
  seller_user_id: string | null;
  buyer_user_id: string | null;
  effective_date: string;
  amount_ex_vat: string | number | null;
  note: string | null;
  actor_name: string | null;
  actor_organisation: string | null;
  asset_snapshot_json: unknown;
  aim4price_sale_influence: string | null;
  transfer_status: string | null;
  offer_status: string | null;
  offer_expires_at: string | null;
  profile_business_name: string | null;
  profile_display_name: string | null;
  created_at: string;
};

function text(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function money(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || text(value) === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : null;
}

function object(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

function influence(value: unknown): AdminAssetSaleRow['aim4priceInfluence'] {
  const normalized = text(value).toLowerCase();
  return normalized === 'yes' || normalized === 'no' || normalized === 'unsure' ? normalized : 'unknown';
}

function transferStatus(row: SaleRow): AdminAssetSaleRow['transferStatus'] {
  const saved = text(row.offer_status || row.transfer_status).toLowerCase();
  if (saved === 'claimed' || saved === 'cancelled') return saved;
  if (saved === 'pending') {
    return row.offer_expires_at && new Date(row.offer_expires_at).getTime() <= Date.now() ? 'expired' : 'pending';
  }
  return 'not_requested';
}

export async function getAdminAssetSalesReport(): Promise<AdminAssetSalesReport> {
  await ensureAssetTransferSchema();
  const result = await getDb().query<SaleRow>(
    `select
       event.id::text,
       event.asset_register_item_id::text,
       event.owner_user_id,
       offer.seller_user_id,
       offer.buyer_user_id,
       event.effective_date::text,
       event.amount_ex_vat,
       event.note,
       event.actor_name,
       event.actor_organisation,
       event.asset_snapshot_json,
       event.aim4price_sale_influence,
       event.transfer_status,
       offer.status as offer_status,
       offer.expires_at::text as offer_expires_at,
       profile.business_name as profile_business_name,
       profile.display_name as profile_display_name,
       event.created_at::text
     from public.asset_lifecycle_events event
     left join public.asset_transfer_offers offer on offer.id = event.transfer_offer_id
     left join public.account_profiles profile
       on profile.user_id = coalesce(offer.seller_user_id, event.owner_user_id)
     where event.event_type = 'disposed' and event.reason = 'sold'
     order by event.effective_date desc, event.created_at desc
     limit 5000`,
  );

  const sales = result.rows.map<AdminAssetSaleRow>((row) => {
    const snapshot = object(row.asset_snapshot_json);
    const brandModel = [text(snapshot.brandName), text(snapshot.modelName)].filter(Boolean).join(' ');
    const year = text(snapshot.yearModel);
    return {
      id: row.id,
      assetId: row.asset_register_item_id,
      assetTitle: text(snapshot.title) || 'Asset',
      assetDescription: [brandModel, year].filter(Boolean).join(' · '),
      sellerUserId: text(row.seller_user_id || row.owner_user_id),
      sellerName: text(row.profile_business_name || row.profile_display_name || row.actor_organisation || row.actor_name) || 'Unknown account',
      soldDate: row.effective_date,
      amountExVat: money(row.amount_ex_vat),
      aim4priceInfluence: influence(row.aim4price_sale_influence),
      transferStatus: transferStatus(row),
      buyerUserId: text(row.buyer_user_id) || null,
      note: text(row.note),
      createdAtIso: row.created_at,
    };
  });
  const helpedByAim4price = sales.filter((sale) => sale.aim4priceInfluence === 'yes').length;
  const notHelpedByAim4price = sales.filter((sale) => sale.aim4priceInfluence === 'no').length;
  const influenceUnknown = sales.length - helpedByAim4price - notHelpedByAim4price;
  const answered = helpedByAim4price + notHelpedByAim4price;

  return {
    generatedAtIso: new Date().toISOString(),
    metrics: {
      totalSold: sales.length,
      helpedByAim4price,
      notHelpedByAim4price,
      influenceUnknown,
      helpRatePercent: answered ? Math.round((helpedByAim4price / answered) * 1000) / 10 : 0,
      transferredAccounts: sales.filter((sale) => sale.transferStatus === 'claimed').length,
      pendingTransfers: sales.filter((sale) => sale.transferStatus === 'pending' || sale.transferStatus === 'expired').length,
    },
    sales,
  };
}
