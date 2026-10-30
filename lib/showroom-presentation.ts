import type { MarketplaceListing } from './marketplace';

type Listing = Pick<MarketplaceListing, 'title' | 'yearModel' | 'hours' | 'usageUnit' | 'lifeWorkedPercent' | 'conditionLabel'>;
const missing = /^(?:year|usage|condition)\s+(?:not set|unknown|n\/?a)$/i;

/** Only remove generated trailing metadata, preserving the seller's actual title. */
export function showroomListingTitle(listing: Listing): string {
  const parts = listing.title.split(/\s*·\s*/);
  const compact = (value: string) => value.replace(/[\s,]/g, '').toLowerCase();
  const metadata = new Set([
    String(listing.yearModel || ''), listing.conditionLabel || '',
    `${listing.hours} ${listing.usageUnit}`, `${listing.lifeWorkedPercent}%`, `${listing.lifeWorkedPercent}% worked`,
  ].map(compact));
  while (parts.length > 1 && (missing.test(parts[parts.length - 1]) || metadata.has(compact(parts[parts.length - 1])))) parts.pop();
  let title = parts.join(' · ').trim();
  if (listing.yearModel > 0 && title.startsWith(`${listing.yearModel} `)) title = title.slice(5).trim();
  return title || listing.title;
}

export function showroomListingDetails(listing: Listing): string {
  const value = listing.usageUnit === 'percent' ? listing.lifeWorkedPercent : listing.hours;
  const usage = typeof value === 'number' && Number.isFinite(value) && value > 0
    ? listing.usageUnit === 'percent' ? `${Math.round(value)}% worked` : `${Math.round(value).toLocaleString('en-US').replace(/,/g, ' ')} ${listing.usageUnit}`
    : '';
  const condition = listing.conditionLabel && !missing.test(listing.conditionLabel) ? listing.conditionLabel : '';
  return [listing.yearModel > 0 ? listing.yearModel : '', usage, condition].filter(Boolean).join(' · ');
}
