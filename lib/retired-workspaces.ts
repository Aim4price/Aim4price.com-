/** Compatibility boundary only: retired roles become ordinary service businesses. */
export const RETIRED_WORKSPACE_TYPES = new Set(['insurance', 'finance', 'accounting', 'accountant', 'licensing']);
export function retiredBusinessSubtype(accountType: unknown, accountSubtype: unknown): string | null {
  const type = String(accountType ?? '').trim().toLowerCase();
  const subtype = String(accountSubtype ?? '').trim().toLowerCase();
  if (type === 'accounting' || type === 'accountant' || (type === 'finance' && subtype === 'accountant')) return 'accounting-services';
  if (type === 'finance') return 'finance-services';
  if (type === 'insurance') return 'insurance-services';
  if (type === 'licensing') return 'licensing-services';
  return null;
}
export function isRetiredAssistanceAccount(user: { id?: unknown; email?: unknown }): boolean {
  return String(user.id ?? '').startsWith('aim4price-assistance-')
    || ['insurance@aim4price.com', 'finance@aim4price.com', 'licensing@aim4price.com', 'accounting@aim4price.com', 'dealers@aim4price.com'].includes(String(user.email ?? '').trim().toLowerCase());
}
export function isSupportedSignupAccountType(value: unknown): boolean {
  return ['owner', 'dealer', 'business', 'middleman'].includes(String(value ?? 'owner').trim().toLowerCase());
}
