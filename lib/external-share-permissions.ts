export const EXTERNAL_SHARE_OPTIONS = [
  {key:'history',label:'History',description:'Read permitted asset activity.'},
    {key:'suggestValue',label:'Current value access',description:'Update manual values; suggest Aim4price values for owner approval.'},
    { key: 'updateDetails', label: 'Update details', description: 'Title, asset details, paperwork and documents (no invoices).' },
    { key: 'location', label: 'Location access', description: 'View and update the asset location.' },
    { key: 'yearModel', label: 'Update year', description: 'Change the asset year.' },
    { key: 'usage', label: 'Update usage', description: 'Update hours or kilometres.' },
    { key: 'condition', label: 'Update condition', description: 'Update the asset condition.' },
    { key: 'addMaintenance', label: 'Add maintenance', description: 'Record completed work.' },

    { key: 'addPhotos', label: 'Add photos', description: 'Add photos to the live asset.' },
    { key: 'addCosts', label: 'Add costs', description: 'Record costs and supporting documents.' },
    { key: 'reports', label: 'Reports', description: 'Choose reports & timelines' },
    { key: 'replacementPrice', label: 'Update replacement price', description: 'Update manual replacement prices; Aim4price prices need owner approval.' },
    { key: 'serialNumber', label: 'Update serial number', description: 'Update the asset serial number.' },
    { key: 'loggedProblems', label: 'Log problems', description: 'Log a problem or view logged problems.' },
    { key: 'maintenanceReports', label: 'Maintenance Reports', description: 'View current maintenance and download reports.' },
    { key: 'costOfOwnership', label: 'Cost of Ownership', description: 'View current ownership costs and VAT.' },
    { key: 'maintenanceSchedules', label: 'Create Maintenance Schedules', description: 'Create active maintenance schedules.' },
    { key: 'documents', label: 'Invoices & quotes', description: 'For review' },
] as const;
export type ExternalSharePermission = typeof EXTERNAL_SHARE_OPTIONS[number]['key'] | 'allReports';
export type ExternalSharePermissions = Record<'reports' | 'replacementPrice' | 'serialNumber' | 'documents', boolean> & Partial<Record<ExternalSharePermission, boolean>> & { directUpdates?: boolean; allReports?: boolean };
export const EMPTY_EXTERNAL_PERMISSIONS: ExternalSharePermissions = { history:false,suggestValue:false,updateDetails:false,location:false,yearModel:false,usage:false,condition:false,addMaintenance:false,addPhotos:false, addCosts:false, reports: false, replacementPrice: false, serialNumber: false, documents: false, loggedProblems: false, maintenanceReports: false, costOfOwnership: false, maintenanceSchedules: false };
export function normalizeExternalPermissions(value: unknown): ExternalSharePermissions {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    return { ...Object.fromEntries(EXTERNAL_SHARE_OPTIONS.map(({ key }) => [key, input[key] === true])), directUpdates: input.directUpdates === true, allReports: input.allReports === true } as ExternalSharePermissions;
}
export function sharedEnquiryReturnTo(value: unknown): string | null {
    if (typeof value === 'string' && /^\/maintenance-reminder\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return value;
    if (typeof value === 'string' && /^\/value-review\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(value)) return value;
    return typeof value === 'string' && /^\/asset-share\/[A-Za-z0-9_-]{43}(?:\?open=1)?$/.test(value) ? value : null;
}

/** Photos and general reports are included; maintenance and costs require explicit selection. */
export function assetLinkPermissions(value: unknown = {}): ExternalSharePermissions {
  return {...normalizeExternalPermissions(value),allReports:true,reports:true,directUpdates:true};
}

/** Keep only the viewing access explicitly selected by the owner. */
export function readOnlyAssetLinkPermissions(value: Partial<ExternalSharePermissions> = {}): ExternalSharePermissions {
  const selected = normalizeExternalPermissions(value);
  return {...assetLinkPermissions(), history:selected.history, maintenanceReports:selected.maintenanceReports, costOfOwnership:selected.costOfOwnership};
}
