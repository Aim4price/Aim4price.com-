/** Pricing APIs and saved amounts remain ex VAT; this is display conversion only. */
export function pricingVatAmount(valueExVat: number, included: boolean): number {
  return included ? Math.round(valueExVat * 1.15) : valueExVat;
}
export function pricingInputExVat(value: number, included: boolean): number {
  return included ? Math.round(value / 1.15) : value;
}
