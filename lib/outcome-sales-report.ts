import type { AdminAssetOutcomeRow } from './admin-asset-sales';
import type { AdminMarketplaceOutcomeRow } from './admin-marketplace-shared';

export type SaleRow = {
  id: string; ownerId: string; owner: string; asset: string; date: string;
  outcome: string; sold: boolean; helped: string; amount: number | null;
};

const date = (value: string) => new Date(value).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', year: 'numeric', month: 'short', day: '2-digit' });
export function registerRow(row: AdminAssetOutcomeRow): SaleRow {
  return { id: row.id, ownerId: row.sourceUserId, owner: row.sourceName, asset: row.assetTitle,
    date: date(row.outcomeDate), outcome: {sold:'Sold', traded_in:'Traded', scrapped:'Scrapped'}[row.outcome],
    sold: row.outcome === 'sold', helped: {yes:'Yes', no:'No', unsure:'Not sure', unknown:'Not recorded'}[row.aim4priceInfluence], amount: row.amountExVat };
}
export function marketplaceRow(row: AdminMarketplaceOutcomeRow): SaleRow {
  return { id: row.outcomeId, ownerId: row.accountUserId, owner: row.sellerLabel, asset: row.title,
    date: date(row.closedAtIso), outcome: {sold:'Sold', traded:'Traded', no_longer_available:'Unavailable', decided_not_to_sell:'Decided not to sell', created_by_mistake:'Created by mistake', other:'Other'}[row.reason],
    sold: row.reason === 'sold', helped: row.aim4priceHelped ? 'Yes' : 'No', amount: row.finalSalePriceExVat };
}

export function saleTotals(rows: SaleRow[]) {
  let sold = 0, assisted = 0, soldCents = 0, assistedCents = 0, missing = 0;
  for (const row of rows) {
    if (!row.sold) continue;
    sold++;
    if (row.helped === 'Yes') assisted++;
    if (row.amount === null || !Number.isFinite(row.amount) || row.amount < 0) { missing++; continue; }
    const cents = Math.round(row.amount * 100);
    soldCents += cents;
    if (row.helped === 'Yes') assistedCents += cents;
  }
  return {sold, assisted, soldValue: soldCents / 100, assistedValue: assistedCents / 100, missing};
}
export const saleMoney = (value: number) => new Intl.NumberFormat('en-ZA', {style:'currency', currency:'ZAR'}).format(value);
