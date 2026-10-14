/** Slider amounts are rounded in the displayed VAT basis; exact typed prices stay untouched. */
export const REPLACEMENT_SLIDER_STEP = 5_000;

export function replacementSliderAmount(displayAmount: number): number {
  return Math.max(0, Math.round(displayAmount / REPLACEMENT_SLIDER_STEP) * REPLACEMENT_SLIDER_STEP);
}

export function replacementSliderMaximum(displayMaximum: number): number {
  return Math.max(REPLACEMENT_SLIDER_STEP, Math.ceil(displayMaximum / REPLACEMENT_SLIDER_STEP) * REPLACEMENT_SLIDER_STEP);
}
