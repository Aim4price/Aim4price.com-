/** An approved value is an anchor on the existing depreciation curve, not another
 * replacement price. Applying a ratio avoids depreciating its past life twice. */
export type ApprovedValueBaseline = {
  version: 1; amount: number; modelValue: number | null; date: string;
  actorId: string; actorName: string; reason: string; eventId: string;
  usage: number | null; condition: string; replacementPrice: number | null;
};
export function readApprovedValueBaseline(specs: Record<string, unknown> | null | undefined): ApprovedValueBaseline | null {
  const b = specs?.approved_value_baseline as ApprovedValueBaseline | undefined;
  return b?.version === 1 && Number.isFinite(b.amount) && b.amount >= 0 &&
    (b.modelValue === null || (Number.isFinite(b.modelValue) && b.modelValue > 0)) ? b : null;
}
export function applyApprovedValueBaseline(rawValue: number, specs: Record<string, unknown> | null | undefined): number {
  const b = readApprovedValueBaseline(specs);
  if (!b || b.modelValue === null) return Math.round(rawValue);
  return Math.max(0, Math.round(b.amount * rawValue / b.modelValue));
}
