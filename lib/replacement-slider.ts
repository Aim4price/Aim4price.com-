/** Slider amounts are rounded in the displayed VAT basis; exact typed prices stay untouched. */
export const REPLACEMENT_SLIDER_STEP = 5_000;

export function replacementSliderAmount(displayAmount: number): number {
  return Math.max(0, Math.round(displayAmount / REPLACEMENT_SLIDER_STEP) * REPLACEMENT_SLIDER_STEP);
}

export function replacementSliderMaximum(displayMaximum: number): number {
  return Math.max(REPLACEMENT_SLIDER_STEP, Math.ceil(displayMaximum / REPLACEMENT_SLIDER_STEP) * REPLACEMENT_SLIDER_STEP);
}

/** Extend the scale around a committed manual amount, without rounding that amount. */
export function replacementSliderRange(amount: number | null, min: number, max: number, step: number) {
  if (amount === null || !Number.isFinite(amount) || amount < 0 || (amount >= min && amount <= max)) return { min, max };
  const increment = Math.max(1, step);
  return {
    min: Math.max(0, Math.floor(amount * .5 / increment) * increment),
    max: Math.max(increment, Math.ceil(amount * 1.5 / increment) * increment),
  };
}
