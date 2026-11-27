export const ACCOUNT_DOCUMENT_CATEGORIES = [
  'business',
  'insurance',
  'finance',
  'licence',
  'tax-accounting',
  'ownership',
  'contract',
  'warranty',
  'other',
] as const;

export type AccountDocumentCategory = (typeof ACCOUNT_DOCUMENT_CATEGORIES)[number];

export function isAccountDocumentCategory(value: unknown): value is AccountDocumentCategory {
  return typeof value === 'string'
    && ACCOUNT_DOCUMENT_CATEGORIES.includes(value.trim().toLowerCase() as AccountDocumentCategory);
}

export const ACCOUNT_DOCUMENT_CATEGORY_LABELS: Record<AccountDocumentCategory, string> = {
  business: 'Company & legal',
  insurance: 'Insurance',
  finance: 'Finance',
  licence: 'Licences & permits',
  'tax-accounting': 'Accounting & tax',
  ownership: 'Ownership',
  contract: 'Contracts',
  warranty: 'Warranties',
  other: 'Other',
};

export const ACCOUNT_DOCUMENT_TYPES = [
  {
    value: 'licence-disc',
    scope: 'asset',
    label: 'Licence disc',
    category: 'licence',
    keywords: ['vehicle licence', 'renewal'],
  },
  {
    value: 'registration-certificate',
    scope: 'asset',
    label: 'Registration certificate / NaTIS',
    category: 'licence',
    keywords: ['registration', 'natis', 'rc1'],
  },
  {
    value: 'roadworthy-certificate',
    scope: 'asset',
    label: 'Roadworthy / certificate of fitness',
    category: 'licence',
    keywords: ['roadworthy', 'cof', 'fitness'],
  },
  {
    value: 'operating-permit',
    scope: 'both',
    label: 'Operating permit',
    category: 'licence',
    keywords: ['permit', 'licence'],
  },
  {
    value: 'insurance-policy',
    scope: 'both',
    label: 'Insurance policy',
    category: 'insurance',
    keywords: ['policy', 'cover'],
  },
  {
    value: 'insurance-schedule',
    scope: 'both',
    label: 'Insurance schedule / certificate',
    category: 'insurance',
    keywords: ['schedule', 'certificate of insurance'],
  },
  {
    value: 'insurance-claim',
    scope: 'both',
    label: 'Insurance claim document',
    category: 'insurance',
    keywords: ['claim', 'loss', 'damage'],
  },
  {
    value: 'finance-agreement',
    scope: 'both',
    label: 'Finance agreement',
    category: 'finance',
    keywords: ['credit agreement', 'loan'],
  },
  {
    value: 'finance-statement',
    scope: 'both',
    label: 'Finance statement',
    category: 'finance',
    keywords: ['statement', 'balance'],
  },
  {
    value: 'settlement-letter',
    scope: 'both',
    label: 'Settlement letter',
    category: 'finance',
    keywords: ['settlement', 'paid up'],
  },
  {
    value: 'invoice-proof-of-purchase',
    scope: 'asset',
    label: 'Invoice / proof of purchase',
    category: 'ownership',
    keywords: ['invoice', 'purchase', 'receipt'],
  },
  {
    value: 'ownership-certificate',
    scope: 'asset',
    label: 'Ownership certificate',
    category: 'ownership',
    keywords: ['ownership', 'title'],
  },
  {
    value: 'service-record',
    scope: 'asset',
    label: 'Service invoice / service record',
    category: 'other',
    keywords: ['service', 'maintenance', 'repair'],
  },
  {
    value: 'inspection-report',
    scope: 'asset',
    label: 'Inspection report',
    category: 'other',
    keywords: ['inspection', 'assessment'],
  },
  {
    value: 'valuation-report',
    scope: 'asset',
    label: 'Valuation report',
    category: 'other',
    keywords: ['valuation', 'appraisal'],
  },
  {
    value: 'warranty-certificate',
    scope: 'asset',
    label: 'Warranty certificate',
    category: 'warranty',
    keywords: ['warranty', 'guarantee'],
  },
  {
    value: 'contract-agreement',
    scope: 'both',
    label: 'Contract / agreement',
    category: 'contract',
    keywords: ['contract', 'agreement'],
  },
  {
    value: 'company-registration',
    scope: 'general',
    label: 'Company registration document',
    category: 'business',
    keywords: ['company', 'registration', 'cipc'],
  },
  {
    value: 'tax-document',
    scope: 'general',
    label: 'Tax document',
    category: 'tax-accounting',
    keywords: ['tax', 'sars', 'vat'],
  },
  {
    value: 'accounting-record',
    scope: 'general',
    label: 'Accounting record / report',
    category: 'tax-accounting',
    keywords: ['accounting', 'financial report'],
  },
  {
    value: 'other',
    scope: 'both',
    label: 'Other document',
    category: 'other',
    keywords: ['other'],
  },
] as const satisfies ReadonlyArray<{
  value: string;
  scope: 'general' | 'asset' | 'both';
  label: string;
  category: AccountDocumentCategory;
  keywords: readonly string[];
}>;

export type AccountDocumentType = (typeof ACCOUNT_DOCUMENT_TYPES)[number]['value'];

export function getAccountDocumentType(value: unknown) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return ACCOUNT_DOCUMENT_TYPES.find((option) => option.value === normalized) ?? null;
}

export function isAccountDocumentType(value: unknown): value is AccountDocumentType {
  return getAccountDocumentType(value) !== null;
}

export function getAccountDocumentTypeLabel(value: unknown): string | null {
  return getAccountDocumentType(value)?.label ?? null;
}

export function getAccountDocumentTypeCategory(value: unknown): AccountDocumentCategory | null {
  return getAccountDocumentType(value)?.category ?? null;
}
