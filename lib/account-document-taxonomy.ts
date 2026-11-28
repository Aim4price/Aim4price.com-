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
    description: 'Annual renewal',
    keywords: ['vehicle licence', 'renewal'],
  },
  {
    value: 'registration-certificate',
    scope: 'asset',
    label: 'Registration certificate / NaTIS',
    category: 'licence',
    description: 'NaTIS records',
    keywords: ['registration', 'natis', 'rc1'],
  },
  {
    value: 'roadworthy-certificate',
    scope: 'asset',
    label: 'Roadworthy / certificate of fitness',
    category: 'licence',
    description: 'Road safety',
    keywords: ['roadworthy', 'cof', 'fitness'],
  },
  {
    value: 'operating-permit',
    scope: 'both',
    label: 'Operating permit',
    category: 'licence',
    description: 'Operating rights',
    keywords: ['permit', 'licence'],
  },
  {
    value: 'insurance-policy',
    scope: 'both',
    label: 'Insurance policy',
    category: 'insurance',
    description: 'Cover terms',
    keywords: ['policy', 'cover'],
  },
  {
    value: 'insurance-schedule',
    scope: 'both',
    label: 'Insurance schedule / certificate',
    category: 'insurance',
    description: 'Insured items',
    keywords: ['schedule', 'certificate of insurance'],
  },
  {
    value: 'insurance-claim',
    scope: 'both',
    label: 'Insurance claim document',
    category: 'insurance',
    description: 'Loss or damage',
    keywords: ['claim', 'loss', 'damage'],
  },
  {
    value: 'finance-agreement',
    scope: 'both',
    label: 'Finance agreement',
    category: 'finance',
    description: 'Loan terms',
    keywords: ['credit agreement', 'loan'],
  },
  {
    value: 'finance-statement',
    scope: 'both',
    label: 'Finance statement',
    category: 'finance',
    description: 'Loan balance',
    keywords: ['statement', 'balance'],
  },
  {
    value: 'settlement-letter',
    scope: 'both',
    label: 'Settlement letter',
    category: 'finance',
    description: 'Settlement amount',
    keywords: ['settlement', 'paid up'],
  },
  {
    value: 'invoice-proof-of-purchase',
    scope: 'asset',
    label: 'Invoice / proof of purchase',
    category: 'ownership',
    description: 'Invoices and receipts',
    keywords: ['invoice', 'purchase', 'receipt'],
  },
  {
    value: 'ownership-certificate',
    scope: 'asset',
    label: 'Ownership certificate',
    category: 'ownership',
    description: 'Registered owner',
    keywords: ['ownership', 'title'],
  },
  {
    value: 'service-record',
    scope: 'asset',
    label: 'Service invoice / service record',
    category: 'other',
    description: 'Work carried out',
    keywords: ['service', 'maintenance', 'repair'],
  },
  {
    value: 'inspection-report',
    scope: 'asset',
    label: 'Inspection report',
    category: 'other',
    description: 'Condition checks',
    keywords: ['inspection', 'assessment'],
  },
  {
    value: 'valuation-report',
    scope: 'asset',
    label: 'Valuation report',
    category: 'other',
    description: 'Assessed value',
    keywords: ['valuation', 'appraisal'],
  },
  {
    value: 'warranty-certificate',
    scope: 'asset',
    label: 'Warranty certificate',
    category: 'warranty',
    description: 'Warranty cover',
    keywords: ['warranty', 'guarantee'],
  },
  {
    value: 'contract-agreement',
    scope: 'both',
    label: 'Contract / agreement',
    category: 'contract',
    description: 'Agreed terms',
    keywords: ['contract', 'agreement'],
  },
  {
    value: 'company-registration',
    scope: 'general',
    label: 'Company registration document',
    category: 'business',
    description: 'CIPC records',
    keywords: ['company', 'registration', 'cipc'],
  },
  {
    value: 'tax-document',
    scope: 'general',
    label: 'Tax document',
    category: 'tax-accounting',
    description: 'SARS and VAT',
    keywords: ['tax', 'sars', 'vat'],
  },
  {
    value: 'accounting-record',
    scope: 'general',
    label: 'Accounting record / report',
    category: 'tax-accounting',
    description: 'Financial records',
    keywords: ['accounting', 'financial report'],
  },
  {
    value: 'other',
    scope: 'both',
    label: 'Other document',
    category: 'other',
    description: 'Unlisted documents',
    keywords: ['other'],
  },
] as const satisfies ReadonlyArray<{
  value: string;
  scope: 'general' | 'asset' | 'both';
  label: string;
  category: AccountDocumentCategory;
  description: string;
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
