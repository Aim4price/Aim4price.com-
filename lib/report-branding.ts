/** Report branding is independent of whether logos are shown on register cards. */
export function selectReportLogoUrl(
  businessLogoUrl: unknown,
  register: { logoUrls?: readonly string[] } | null | undefined,
): string {
  const businessLogo = typeof businessLogoUrl === 'string' ? businessLogoUrl.trim() : '';
  return businessLogo || register?.logoUrls?.find((url) => url.trim())?.trim() || '';
}
