/** This exception is for authenticated desktop identities, never account roles. */
export function canUseEstimateBreakdown(email: string | null | undefined): boolean {
  return ['kallageldenhuys@gmail.com', 'aim4price@gmail.com'].includes(
    (email ?? '').trim().toLowerCase(),
  );
}
