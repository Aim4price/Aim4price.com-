export const MIDDLEMAN_ACCOUNT_SUBTYPES = new Set([
  'equipment-middleman',
  'middleman',
  'machinery-middleman',
]);

export function isMiddlemanAccountSubtype(value: unknown): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-');
  return MIDDLEMAN_ACCOUNT_SUBTYPES.has(normalized);
}
