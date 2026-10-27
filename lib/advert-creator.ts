import type { AdVatLabel } from './ad-studio';

export type AdvertDetails = {
  title: string; year: string; usage: string; usageUnit: 'hours' | 'km' | 'percent' | 'none';
  condition: string; askingPrice: string; vatLabel: AdVatLabel; location: string;
  description: string; contactName: string; phone: string; email: string; businessName: string;
};
export type AdvertEstimate = {
  id: string; title: string; year: string; usage: string; usageUnit: AdvertDetails['usageUnit'];
  condition: string; valueExVat: number; createdAt: string;
};
export function estimateMatchesAdvert(estimate: AdvertEstimate | null, details: AdvertDetails): boolean {
  return Boolean(estimate && Number.isFinite(estimate.valueExVat) && estimate.valueExVat > 0
    && estimate.title === details.title && estimate.year === details.year
    && estimate.usage === details.usage && estimate.usageUnit === details.usageUnit
    && estimate.condition === details.condition);
}
export function advertDetailsError(details: AdvertDetails): string {
  if (!details.title.trim()) return 'Enter the machinery title.';
  if (!Number.isFinite(Number(details.askingPrice)) || Number(details.askingPrice) <= 0) return 'Enter an asking price greater than zero.';
  if (details.year && (!/^\d{4}$/.test(details.year) || Number(details.year) < 1900 || Number(details.year) > new Date().getFullYear() + 1)) return 'Enter a valid year, or leave it blank.';
  if (details.usageUnit !== 'none' && details.usage && (!Number.isFinite(Number(details.usage)) || Number(details.usage) < 0 || (details.usageUnit === 'percent' && Number(details.usage) > 100))) return 'Enter valid usage for the selected unit.';
  if (!details.contactName.trim() || !details.phone.trim()) return 'Enter a contact name and phone number.';
  return '';
}
