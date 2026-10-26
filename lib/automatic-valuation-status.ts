export function automaticValuationPending(specs: Record<string, unknown>) {
  return specs.automaticValuationStatus === 'pending' || specs.automaticValuationStatus === 'retrying';
}
export function automaticValuationLabel(specs: Record<string, unknown>) {
  if (specs.automaticValuationStatus === 'needs_details') return 'Check asset details';
  if (specs.automaticValuationStatus === 'pending') return 'Value update queued';
  if (specs.automaticValuationStatus === 'retrying') return 'Value update retrying';
  return 'Value needs updating';
}
export const AUTOMATIC_VALUATION_NOTICE = 'Your details are saved. The previous value is shown until the update succeeds.';
