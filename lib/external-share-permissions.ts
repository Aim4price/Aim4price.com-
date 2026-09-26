export const EXTERNAL_SHARE_OPTIONS = [
    { key: 'reports', label: 'Reports', description: 'Choose reports & timelines' },
    { key: 'replacementPrice', label: 'Update replacement price', description: 'Send a proposed price for your approval.' },
    { key: 'serialNumber', label: 'Update serial number', description: 'Send a corrected serial for your approval.' },
    { key: 'documents', label: 'Invoices & quotes', description: 'For review' },
] as const;
export type ExternalSharePermission = typeof EXTERNAL_SHARE_OPTIONS[number]['key'];
export type ExternalSharePermissions = Record<ExternalSharePermission, boolean>;
export const EMPTY_EXTERNAL_PERMISSIONS: ExternalSharePermissions = { reports: false, replacementPrice: false, serialNumber: false, documents: false };
export function normalizeExternalPermissions(value: unknown): ExternalSharePermissions {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return Object.fromEntries(EXTERNAL_SHARE_OPTIONS.map(({ key }) => [key, input[key] === true])) as ExternalSharePermissions;
}
export function sharedEnquiryReturnTo(value: unknown): string | null {
    return typeof value === 'string' && /^\/asset-share\/[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
