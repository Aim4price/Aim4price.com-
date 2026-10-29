import type { AdVatLabel } from './ad-studio';

export type AdvertDetails = {
  title: string; year: string; usage: string; usageUnit: 'hours' | 'km' | 'percent' | 'none';
  condition: string; askingPrice: string; vatLabel: AdVatLabel; location: string;
  description: string; contactName: string; phone: string; email: string; businessName: string;
};
export type AdvertEstimate = {
  id: string; title: string; year: string; usage: string; usageUnit: AdvertDetails['usageUnit'];
  condition: string; valueExVat: number; createdAt: string;
  realisticSellingPriceExVat?: number; sellingPriceNeedsReview?: boolean;
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

export type AdvertFieldErrors = Partial<Record<keyof AdvertDetails | 'photos', string>>;
export function advertStepErrors(details: AdvertDetails, step: 1 | 2, photoCount = 0): AdvertFieldErrors {
  const errors: AdvertFieldErrors = {};
  if (step === 1) {
    if (!details.title.trim()) errors.title = 'Enter the listing title.';
    if (!Number.isFinite(Number(details.askingPrice)) || Number(details.askingPrice) <= 0) errors.askingPrice = 'Enter an asking price greater than zero.';
    if (details.year && (!/^\d{4}$/.test(details.year) || Number(details.year) < 1900 || Number(details.year) > new Date().getFullYear() + 1)) errors.year = 'Enter a valid year, or leave it blank.';
    if (details.usageUnit !== 'none' && details.usage && (!Number.isFinite(Number(details.usage)) || Number(details.usage) < 0 || (details.usageUnit === 'percent' && Number(details.usage) > 100))) errors.usage = 'Enter valid usage for the selected unit.';
  } else {
    if (!photoCount) errors.photos = 'Add at least one photo.';
    if (!details.contactName.trim()) errors.contactName = 'Enter a contact name.';
    if (!details.phone.trim()) errors.phone = 'Enter a phone number.';
    if (details.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(details.email.trim())) errors.email = 'Enter a valid email address, or leave it blank.';
  }
  return errors;
}
