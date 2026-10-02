export const EXTERNAL_SHARE_OPTIONS = [
    { key: 'addPhotos', label: 'Add photos', description: 'Add photos to the live asset.' },
    { key: 'addCosts', label: 'Add costs', description: 'Record costs and supporting documents.' },
    { key: 'reports', label: 'Reports', description: 'Choose reports & timelines' },
    { key: 'replacementPrice', label: 'Update replacement price', description: 'Update the asset replacement price.' },
    { key: 'serialNumber', label: 'Update serial number', description: 'Update the asset serial number.' },
    { key: 'loggedProblems', label: 'Logged Problems', description: 'View logged problems for this asset.' },
    { key: 'maintenanceReports', label: 'Maintenance Reports', description: 'View current maintenance and download reports.' },
    { key: 'costOfOwnership', label: 'Cost of Ownership', description: 'View current ownership costs and VAT.' },
    { key: 'maintenanceSchedules', label: 'Create Maintenance Schedules', description: 'Create active maintenance schedules.' },
    { key: 'documents', label: 'Invoices & quotes', description: 'For review' },
] as const;
export type ExternalSharePermission = typeof EXTERNAL_SHARE_OPTIONS[number]['key'] | 'allReports';
export type ExternalSharePermissions = Record<'reports' | 'replacementPrice' | 'serialNumber' | 'documents', boolean> & Partial<Record<ExternalSharePermission, boolean>> & { directUpdates?: boolean; allReports?: boolean };
export const EMPTY_EXTERNAL_PERMISSIONS: ExternalSharePermissions = { addPhotos:false, addCosts:false, reports: false, replacementPrice: false, serialNumber: false, documents: false, loggedProblems: false, maintenanceReports: false, costOfOwnership: false, maintenanceSchedules: false };
export function normalizeExternalPermissions(value: unknown): ExternalSharePermissions {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return { ...Object.fromEntries(EXTERNAL_SHARE_OPTIONS.map(({ key }) => [key, input[key] === true])), directUpdates: input.directUpdates === true, allReports: input.allReports === true } as ExternalSharePermissions;
}
export function sharedEnquiryReturnTo(value: unknown): string | null {
    return typeof value === 'string' && /^\/asset-share\/[A-Za-z0-9_-]{43}(?:\?open=1)?$/.test(value) ? value : null;
}

/** Photos and live reports are always part of newly created asset links. */
export function assetLinkPermissions(value: unknown = {}): ExternalSharePermissions {
  return {...normalizeExternalPermissions(value),allReports:true,reports:true,maintenanceReports:true,costOfOwnership:true,directUpdates:true};
}
