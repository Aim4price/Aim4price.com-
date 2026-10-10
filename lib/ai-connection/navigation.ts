/** Narrow admin OAuth continuation; the consent page validates every OAuth parameter again. */
export function adminAiReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 4096 || !value.startsWith('/admin/ai-connect') || /[\\\x00-\x20]/.test(value)) return null;
  try {
    const url = new URL(value, 'https://aim4price.com');
    return url.origin === 'https://aim4price.com' && url.pathname === '/admin/ai-connect' && !url.hash ? url.pathname + url.search : null;
  } catch { return null; }
}
