/** Compact modal context only. Keep full metadata in cards, exports and emails. */
export function assetModalUsage(metadata?: string | null): string {
  const text = String(metadata ?? '').trim();
  const usage = text.split(/\s*[•·]\s*/).find(part => /^(?:Current\s+)?Usage:\s*/i.test(part));
  if (usage) return usage.replace(/^(?:Current\s+)?Usage:\s*/i, '').trim();
  // Group summaries and workflow descriptions are not individual asset metadata.
  if (/(?:Year Model|Year Built|Condition|Size):/i.test(text) || text === 'No key details saved yet') return '';
  return text;
}
