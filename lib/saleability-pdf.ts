export const SALEABILITY_PDF_PLAN_SESSION_KEY = 'aim4price.saleability.pdf-plan.v1';

export type SaleabilityPdfPlanSnapshot = {
  assetTitle: string;
  valuationExVat: number;
  saleabilityPriceExVat: number;
};

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeTitle(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function createSaleabilityPdfPlanSnapshot(input: {
  assetTitle: string;
  valuationExVat: number;
  saleabilityPriceExVat: number;
}): SaleabilityPdfPlanSnapshot | null {
  const assetTitle = String(input.assetTitle ?? '').replace(/\s+/g, ' ').trim();
  const valuationExVat = finiteNumber(input.valuationExVat);
  const saleabilityPriceExVat = finiteNumber(input.saleabilityPriceExVat);

  if (!assetTitle || valuationExVat === null || valuationExVat < 0 || saleabilityPriceExVat === null || saleabilityPriceExVat < 0) {
    return null;
  }

  return { assetTitle, valuationExVat, saleabilityPriceExVat };
}

export function parseSaleabilityPdfPlanSnapshot(raw: string | null): SaleabilityPdfPlanSnapshot | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return createSaleabilityPdfPlanSnapshot({
      assetTitle: String(parsed.assetTitle ?? ''),
      valuationExVat: Number(parsed.valuationExVat),
      saleabilityPriceExVat: Number(parsed.saleabilityPriceExVat),
    });
  } catch {
    return null;
  }
}

export function saleabilityPdfPlanMatchesEstimate(
  snapshot: SaleabilityPdfPlanSnapshot,
  machineTitle: unknown,
  selectedValueExVat: unknown,
): boolean {
  const selectedValue = finiteNumber(selectedValueExVat);
  if (selectedValue === null) return false;

  return normalizeTitle(snapshot.assetTitle) === normalizeTitle(machineTitle)
    && Math.abs(snapshot.valuationExVat - selectedValue) <= 1;
}

export function formatSaleabilityPdfPrice(value: number): string {
  const rounded = Math.round(value);
  const formatted = String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${rounded < 0 ? '-' : ''}R ${formatted} excl. VAT`;
}
