import { costCategories } from './cost-categories.ts';

function codedTokens(description: string) {
  return description.toUpperCase().split(/[\s,;]+/).flatMap(token => {
    const category = costCategories.find(item => token.startsWith(item.code + '-'));
    const serial = category && token.slice(category.code.length + 1);
    return category && serial ? [{category, serial}] : [];
  });
}

export function categoryForLine(description: string) {
  const labels = new Set(codedTokens(description).map(token => token.category.label));
  return labels.size === 1 ? Array.from(labels)[0] : null;
}

// Preserve punctuation and leading zeroes. A labelled serial also supports purely numeric serials.
export function assetForLine(description: string, assets: {title: string; serialNumber?: string | null}[]) {
  const label = /(?:^|\s)(?:S\/N|SERIAL(?:\s+(?:NO\.?|NUMBER))?|VIN)(?:\s*[:#]\s*|\s+)([^\s,;]+)/gi;
  const serials = Array.from(description.matchAll(label), match => match[1].toUpperCase());
  const tokens = description.toUpperCase().split(/[\s,;]+/);
  serials.push(...codedTokens(description).map(token => token.serial));
  const hits = assets.filter(asset => {
    const serial = asset.serialNumber?.trim().toUpperCase();
    if (!serial) return false;
    return serials.includes(serial) || (/[A-Z]/.test(serial) && /[0-9]/.test(serial) && tokens.includes(serial));
  });
  if (hits.length !== 1 || serials.some(s => s !== hits[0].serialNumber?.trim().toUpperCase())) return null;
  return hits[0].title;
}
