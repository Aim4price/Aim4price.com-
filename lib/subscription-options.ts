/** Public pricing choices; legacy links still lead to a current account option. */
export type PricingAudience = 'owner' | 'free-business' | 'business';

export function pricingAudience(value?: string): PricingAudience | null {
  if (value === 'owner') return 'owner';
  if (value === 'business' || value === 'paid-business' || value === 'dealer') return 'business';
  if (value === 'free-business' || value === 'middleman') return 'free-business';
  return null;
}
