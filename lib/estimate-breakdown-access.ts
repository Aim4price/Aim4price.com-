/** This exception is for authenticated desktop identities, never account roles. */
export function canUseEstimateBreakdown(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === 'kallageldenhuys@gmail.com';
}
