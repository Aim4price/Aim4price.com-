type SearchParamValue = string | string[] | undefined;

const INTERNAL_RETURN_BASE = 'https://return.aim4price.invalid';

export function readSingleSearchParam(value: SearchParamValue): string {
  return String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim();
}

export function normalizeInternalReturnPath(value: SearchParamValue): string {
  const candidate = readSingleSearchParam(value).slice(0, 2048);

  if (!candidate.startsWith('/') || candidate.startsWith('//')) return '';
  if (/[\u0000-\u001f\u007f]/.test(candidate)) return '';

  try {
    const resolved = new URL(candidate, INTERNAL_RETURN_BASE);
    const expectedOrigin = new URL(INTERNAL_RETURN_BASE).origin;

    if (resolved.origin !== expectedOrigin) return '';

    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return '';
  }
}
