/** Public estimates only. Changing these rates does not alter existing billing agreements. */
export const ownerHosting = [
  { range: '1–25', monthly: 9900, annually: 99900 },
  { range: '26–100', monthly: 19900, annually: 199900 },
  { range: '101–300', monthly: 39900, annually: 399900 },
] as const;
export function hostedRegisterBand(assets: number) {
  if (!Number.isSafeInteger(assets) || assets < 0 || assets > 300) throw new RangeError('Review custom client hosting before invoicing.');
  return assets <= 25 ? 0 : assets <= 100 ? 1 : 2;
}
export const businessHosting = { monthly: 19900, annually: 199900 } as const;
export const adminRetainers = [
  { hours: 2, cents: 39900 }, { hours: 5, cents: 89900 }, { hours: 10, cents: 159900 },
] as const;
export type HostingAudience = 'owner' | 'dealer' | 'business' | 'middleman';
export type HostingPeriod = 'monthly' | 'annually';
export function rand(cents: number) {
  const [whole, fraction] = (cents / 100).toFixed(cents % 100 ? 2 : 0).split('.');
  return `R${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${fraction ? `.${fraction}` : ''}`;
}
export function clientCount(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(10000, Math.max(0, Math.floor(number))) : 0;
}
export function hostingEstimate(audience: HostingAudience, period: HostingPeriod, ownerBand: number, clients: readonly number[], adminIndex: number) {
  const partner = audience === 'dealer' || audience === 'business';
  const base = audience === 'middleman' ? 0 : partner ? businessHosting[period] : ownerHosting[ownerBand]?.[period] ?? 0;
  const clientHosting = partner ? ownerHosting.reduce((sum, band, index) => sum + clientCount(clients[index] ?? 0) * band[period] / 4, 0) : 0;
  const admin = adminRetainers[adminIndex]?.cents ?? 0;
  return { base, clientHosting, hosting: base + clientHosting, admin, monthlyTotal: period === 'monthly' ? base + clientHosting + admin : null, customOwner: audience === 'owner' && !ownerHosting[ownerBand] };
}
export const assetSaleFees = [
  ['Up to R50 000', 'R2 500*'], ['Over R50 000 to R100 000', 'R5 000'],
  ['Over R100 000 to R300 000', 'R15 000'], ['Over R300 000 to R500 000', 'R25 000'],
  ['Over R500 000 to R1 million', 'R35 000'], ['Over R1 million to R2 million', 'R50 000'],
  ['Over R2 million to R5 million', 'R75 000'], ['Over R5 million to R10 million', 'R100 000'],
  ['Over R10 million', 'Agreed upfront'],
] as const;
