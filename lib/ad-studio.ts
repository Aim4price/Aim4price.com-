export const AD_TEMPLATE_OPTIONS = [
  {
    id: 'showcase',
    name: 'Showcase',
    description: 'Large equipment photo with a clean information panel.',
  },
  {
    id: 'price-focus',
    name: 'Price focus',
    description: 'Makes the asking price the strongest part of the advert.',
  },
  {
    id: 'photo-first',
    name: 'Photo first',
    description: 'Keeps the equipment image dominant with compact details.',
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'A familiar dealer layout with strong borders and contact details.',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'A restrained layout for premium or newer equipment.',
  },
] as const;

export type AdTemplateId = (typeof AD_TEMPLATE_OPTIONS)[number]['id'];
export type AdLanguage = 'en' | 'af';
export type AdVatLabel = 'plus-vat' | 'vat-included' | 'no-vat';

export type AdBrandSnapshot = {
  brandKitId?: string;
  name: string;
  templateId: AdTemplateId;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  website: string;
  language: AdLanguage;
  vatLabel: AdVatLabel;
};

export type AdBrandKit = AdBrandSnapshot & {
  id: string;
  isDefault: boolean;
  createdAtIso: string;
  updatedAtIso: string;
};

export type SaveAdBrandKitInput = Partial<AdBrandSnapshot> & {
  id?: string | null;
  isDefault?: boolean | null;
};

export const DEFAULT_AD_BRAND_COLORS = {
  primary: '#165340',
  secondary: '#0d3329',
  accent: '#f2b84b',
} as const;

const TEMPLATE_IDS = new Set<string>(AD_TEMPLATE_OPTIONS.map((option) => option.id));
const LANGUAGES = new Set<AdLanguage>(['en', 'af']);
const VAT_LABELS = new Set<AdVatLabel>(['plus-vat', 'vat-included', 'no-vat']);
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const IMAGE_DATA_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=\s]+$/i;

function asText(value: unknown, maximumLength = 240): string {
  return typeof value === 'string' ? value.trim().slice(0, maximumLength) : '';
}

export function normalizeAdTemplateId(value: unknown): AdTemplateId {
  const normalized = asText(value, 40);
  return TEMPLATE_IDS.has(normalized) ? (normalized as AdTemplateId) : 'showcase';
}

export function normalizeAdLanguage(value: unknown): AdLanguage {
  const normalized = asText(value, 10).toLowerCase() as AdLanguage;
  return LANGUAGES.has(normalized) ? normalized : 'en';
}

export function normalizeAdVatLabel(value: unknown): AdVatLabel {
  const normalized = asText(value, 30).toLowerCase() as AdVatLabel;
  return VAT_LABELS.has(normalized) ? normalized : 'plus-vat';
}

export function normalizeAdColor(value: unknown, fallback: string): string {
  const normalized = asText(value, 7);
  return HEX_COLOR_PATTERN.test(normalized) ? normalized.toUpperCase() : fallback;
}

export function normalizeAdLogoUrl(value: unknown): string {
  const normalized = asText(value, 3_000_000);
  if (!normalized) return '';
  if (IMAGE_DATA_PATTERN.test(normalized)) return normalized.replace(/\s+/g, '');
  if (normalized.startsWith('/') || normalized.startsWith('https://')) return normalized;
  return '';
}

export function normalizeAdBrandSnapshot(
  value: unknown,
  options: { exposeContact?: boolean } = {},
): AdBrandSnapshot | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const exposeContact = options.exposeContact !== false;

  return {
    brandKitId: asText(record.brandKitId ?? record.brand_kit_id, 120) || undefined,
    name: asText(record.name, 100) || 'Default style',
    templateId: normalizeAdTemplateId(record.templateId ?? record.template_id),
    logoUrl: normalizeAdLogoUrl(record.logoUrl ?? record.logo_url),
    primaryColor: normalizeAdColor(record.primaryColor ?? record.primary_color, DEFAULT_AD_BRAND_COLORS.primary),
    secondaryColor: normalizeAdColor(record.secondaryColor ?? record.secondary_color, DEFAULT_AD_BRAND_COLORS.secondary),
    accentColor: normalizeAdColor(record.accentColor ?? record.accent_color, DEFAULT_AD_BRAND_COLORS.accent),
    businessName: asText(record.businessName ?? record.business_name, 160),
    contactName: exposeContact ? asText(record.contactName ?? record.contact_name, 120) : '',
    phone: exposeContact ? asText(record.phone, 80) : '',
    email: exposeContact ? asText(record.email, 220) : '',
    website: exposeContact ? asText(record.website, 300) : '',
    language: normalizeAdLanguage(record.language),
    vatLabel: normalizeAdVatLabel(record.vatLabel ?? record.vat_label),
  };
}

export function sanitizeAdBrandKitInput(input: unknown): AdBrandSnapshot {
  const normalized = normalizeAdBrandSnapshot(input);
  return normalized ?? {
    name: 'Default style',
    templateId: 'showcase',
    logoUrl: '',
    primaryColor: DEFAULT_AD_BRAND_COLORS.primary,
    secondaryColor: DEFAULT_AD_BRAND_COLORS.secondary,
    accentColor: DEFAULT_AD_BRAND_COLORS.accent,
    businessName: '',
    contactName: '',
    phone: '',
    email: '',
    website: '',
    language: 'en',
    vatLabel: 'plus-vat',
  };
}

export function toAdBrandSnapshot(kit: AdBrandKit): AdBrandSnapshot {
  return {
    brandKitId: kit.id,
    name: kit.name,
    templateId: kit.templateId,
    logoUrl: kit.logoUrl,
    primaryColor: kit.primaryColor,
    secondaryColor: kit.secondaryColor,
    accentColor: kit.accentColor,
    businessName: kit.businessName,
    contactName: kit.contactName,
    phone: kit.phone,
    email: kit.email,
    website: kit.website,
    language: kit.language,
    vatLabel: kit.vatLabel,
  };
}
