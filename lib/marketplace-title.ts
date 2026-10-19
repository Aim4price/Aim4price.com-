/** Omitted titles preserve existing adverts; supplied titles must be usable. */
export function normalizeMarketplaceTitle(value: unknown): string | undefined {
  if (typeof value === 'undefined') return undefined;
  if (typeof value !== 'string') throw new Error('Enter a listing title.');
  const title = value.replace(/\s+/g, ' ').trim();
  if (!title) throw new Error('Enter a listing title.');
  if (title.length > 160) throw new Error('Keep the listing title to 160 characters or fewer.');
  return title;
}
