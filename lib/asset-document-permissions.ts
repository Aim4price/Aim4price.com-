export type AssetDocumentCategory =
  | 'licensing'
  | 'insurance'
  | 'finance'
  | 'accounting'
  | 'other';

export type CategorizedAssetDocument = {
  category?: unknown;
  documentCategory?: unknown;
  documentType?: unknown;
  [key: string]: unknown;
};

const DOCUMENT_CATEGORIES = new Set<AssetDocumentCategory>([
  'licensing',
  'insurance',
  'finance',
  'accounting',
  'other',
]);

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeAssetDocumentCategory(value: unknown): AssetDocumentCategory {
  const normalized = asText(value).toLowerCase().replace(/[\s-]+/g, '_');

  if (['licence', 'license', 'licensing', 'natis', 'registration'].includes(normalized)) {
    return 'licensing';
  }
  if (['insurance', 'insured', 'policy'].includes(normalized)) {
    return 'insurance';
  }
  if (['finance', 'financing', 'financed', 'bank'].includes(normalized)) {
    return 'finance';
  }
  if (['accountant', 'accounting'].includes(normalized)) {
    return 'accounting';
  }

  return DOCUMENT_CATEGORIES.has(normalized as AssetDocumentCategory)
    ? normalized as AssetDocumentCategory
    : 'other';
}

export function normalizeAssetDocumentType(value: unknown): string {
  const normalized = asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized.slice(0, 80) || 'other';
}

export function assetDocumentCategory(document: CategorizedAssetDocument): AssetDocumentCategory {
  return normalizeAssetDocumentCategory(document.category ?? document.documentCategory);
}

export function assetDocumentCategoryLabel(value: unknown): string {
  const category = normalizeAssetDocumentCategory(value);
  if (category === 'licensing') return 'Licence';
  if (category === 'insurance') return 'Insurance';
  if (category === 'finance') return 'Finance';
  if (category === 'accounting') return 'Accounting';
  return 'Other';
}

export function allowedAssetDocumentCategories(
  accountRole: unknown,
  accountSubtype?: unknown,
): ReadonlySet<AssetDocumentCategory> {
  const role = asText(accountRole).toLowerCase();
  const subtype = asText(accountSubtype).toLowerCase().replace(/[\s_]+/g, '-');

  if (role === 'owner' || (role === 'finance' && subtype === 'accountant')) {
    return DOCUMENT_CATEGORIES;
  }
  if (role === 'finance') return new Set<AssetDocumentCategory>(['finance']);
  if (role === 'insurance') return new Set<AssetDocumentCategory>(['insurance']);
  if (role === 'licensing') return new Set<AssetDocumentCategory>(['licensing']);
  return new Set<AssetDocumentCategory>();
}

export function filterAssetDocumentsForRole<T extends CategorizedAssetDocument>(
  documents: readonly T[],
  accountRole: unknown,
  accountSubtype?: unknown,
): T[] {
  const allowed = allowedAssetDocumentCategories(accountRole, accountSubtype);
  if (!allowed.size) return [];
  return documents.filter((document) => allowed.has(assetDocumentCategory(document)));
}
