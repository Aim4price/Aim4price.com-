/** Shared page-to-API scope rules for the register and its overview. */
const COMBINED_REGISTER_ID = '__combined_asset_registers__';

export function registerIdFromLocation(location: { pathname: string; search: string }): string {
  const params = new URLSearchParams(location.search);
  if (params.get('scope')?.trim().toLowerCase() === 'combined') return COMBINED_REGISTER_ID;

  const registerId = params.get('registerId')?.trim();
  if (registerId) return registerId;

  return location.pathname === '/asset-register' && !params.has('dealerView')
    ? COMBINED_REGISTER_ID
    : '';
}

export function buildAssetRegisterApiUrl(registerId?: string | null): string {
  const cleanedRegisterId = String(registerId ?? '').trim();

  if (cleanedRegisterId === COMBINED_REGISTER_ID) {
    return '/api/asset-register?scope=combined';
  }

  if (!cleanedRegisterId) {
    return '/api/asset-register';
  }

  const params = new URLSearchParams({ registerId: cleanedRegisterId });
  return `/api/asset-register?${params.toString()}`;
}

