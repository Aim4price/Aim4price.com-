type LicenceAsset = { isLicensed?: boolean | null; specsJson?: Record<string, unknown> | null };

export function licenceShareRenewalDate(asset: LicenceAsset): string {
  const specs = asset.specsJson ?? {};
  return String(specs.licenseRenewalDate || specs.license_renewal_date || specs.licenceRenewalDate || specs.licence_renewal_date || '').trim();
}

export function licenceShareMissingDetails(asset: LicenceAsset): string[] {
  const missing: string[] = [];
  if (!asset.isLicensed) missing.push('Licensed status');
  const date = licenceShareRenewalDate(asset);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) missing.push('Valid renewal / expiry date');
  return missing;
}
