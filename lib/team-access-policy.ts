/** Explicit allow-lists: never pass owner records or their arbitrary JSON to team clients. */
export const OWNER_TEAM_PERMISSIONS = [
    { key: 'viewValues', label: 'View asset values', detail: 'Current, replacement and insured values. No finance balances or costs.' },
    { key: 'editDetails', label: 'Edit asset details', detail: 'Title, brand, model, year and condition.' },
    { key: 'updateUsage', label: 'Update usage', detail: 'Increase hours, kilometres or lifetime worked.' },
    { key: 'viewMaintenance', label: 'View maintenance', detail: 'Schedules and completion details. Financial fields are excluded.' },
    { key: 'completeMaintenance', label: 'Complete maintenance', detail: 'Mark scheduled work done; cannot delete or change schedules.' },
    { key: 'exportMaintenance', label: 'Download maintenance reports', detail: 'The owner’s maintenance PDF for accessible assets.' },
    { key: 'uploadDocuments', label: 'Upload documents', detail: 'Attach documents to accessible assets for owner review.' },
    { key: 'viewPhotos', label: 'View photos', detail: 'Photos can contain visible sensitive information.' },
    { key: 'uploadPhotos', label: 'Add photos', detail: 'Upload photos without changing or deleting existing ones.' },
    { key: 'viewFuel', label: 'View fuel quantities', detail: 'Fuel entries, usage and consumption for accessible assets.' },
    { key: 'viewFuelCosts', label: 'View fuel prices', detail: 'Prices per litre, VAT and fuel amounts. Separate from asset values.' },
    { key: 'viewFuelStorage', label: 'View fuel tanks', detail: 'All business tanks and their stock levels. Tank access is separate from asset access.' },
    { key: 'addFuel', label: 'Add fuel entries', detail: 'Record fuel slips for accessible assets or permitted tanks.' },
    { key: 'editFuel', label: 'Correct fuel entries', detail: 'Correct existing fuel slips within this person’s access.' },
    { key: 'voidFuel', label: 'Void fuel entries', detail: 'Void entries while retaining their history.' },
    { key: 'manageFuelStorage', label: 'Manage fuel tanks', detail: 'Create, edit and archive tanks. QR codes and access PINs stay with the account holder.' },
    { key: 'exportFuel', label: 'Download fuel reports', detail: 'The owner’s fuel report, limited to accessible records. Hidden prices stay hidden.' },
    { key: 'viewFuelDocuments', label: 'Open fuel documents', detail: 'Original slips for accessible entries, including any prices printed on them.' },
    { key: 'viewCostDocuments', label: 'Open cost documents', detail: 'Original invoices for accessible assets, including all printed prices.' },
    { key: 'viewBudgets', label: 'View budgets', detail: 'Budgets and spending progress for accessible assets. Includes fuel spending.' },
    { key: 'manageBudgets', label: 'Manage budgets', detail: 'Create, change and delete budgets within this person’s asset access.' },
    { key: 'viewCosts', label: 'View costs', detail: 'Invoices and cost-of-ownership totals for accessible assets.' },
    { key: 'addCosts', label: 'Add cost records', detail: 'Record costs against accessible assets.' },
    { key: 'editCosts', label: 'Edit cost records', detail: 'Correct existing cost records within their asset access.' },
    { key: 'deleteCosts', label: 'Delete cost records', detail: 'Remove cost records for accessible assets.' },
    { key: 'exportCosts', label: 'Download cost reports', detail: 'The owner’s cost-of-ownership PDF, using accessible assets and permitted data.' },
    { key: 'viewMap', label: 'View asset map', detail: 'Current locations of accessible assets. Does not grant tracking-device administration.' },
    { key: 'updateLocation', label: 'Update asset locations', detail: 'Set the current location of accessible assets.' },
    { key: 'exportMap', label: 'Download map reports', detail: 'The owner’s map report for accessible assets. Hidden values stay hidden.' },
    { key: 'exportAssets', label: 'Download register reports', detail: 'PDF reports and summaries of permitted assets. Values follow their viewing permission.' },
] as const;
export const CLIENT_TEAM_PERMISSIONS = [
    { key: 'viewClientWork', label: 'View assigned client work', detail: 'Selected enquiries and assets shared with this business. Does not grant access to other client assets.' },
    { key: 'viewClientContacts', label: 'View client contact details', detail: 'Contact details supplied with the selected enquiries.' },
    { key: 'viewClientValues', label: 'View shared client values', detail: 'Only values the client included. Separate from values of business-owned assets.' },
    { key: 'manageClientEnquiries', label: 'Update enquiry status', detail: 'Accept, quote or decline selected enquiries. Cannot close, delete or re-share them.' },
] as const;
export const TEAM_PERMISSIONS = [...OWNER_TEAM_PERMISSIONS, ...CLIENT_TEAM_PERMISSIONS] as const;
export type TeamPermission = typeof TEAM_PERMISSIONS[number]['key'];
export type TeamPermissions = Record<TeamPermission, boolean>;
export const EMPTY_TEAM_PERMISSIONS = Object.fromEntries(TEAM_PERMISSIONS.map(p => [p.key, false])) as TeamPermissions;
export const TEAM_TEMPLATES = {
    viewer: { label: 'View only', detail: 'Read permitted asset details.', permissions: { ...EMPTY_TEAM_PERMISSIONS } },
    operator: { label: 'Operator', detail: 'Update usage and view photos.', permissions: { ...EMPTY_TEAM_PERMISSIONS, updateUsage: true, viewPhotos: true } },
    workshop: { label: 'Workshop', detail: 'Usage, maintenance and uploads.', permissions: { ...EMPTY_TEAM_PERMISSIONS, updateUsage: true, viewMaintenance: true, completeMaintenance: true, viewPhotos: true, uploadPhotos: true, uploadDocuments: true } },
    office: { label: 'Office', detail: 'Maintain records; values stay hidden.', permissions: { ...EMPTY_TEAM_PERMISSIONS, editDetails: true, updateUsage: true, viewMaintenance: true, completeMaintenance: true, uploadDocuments: true, viewPhotos: true, uploadPhotos: true, exportAssets: true } },
    manager: { label: 'Manager', detail: 'All listed permissions, including fuel, costs, maps and reports. General documents are chosen separately; fuel and cost originals are included.', permissions: { ...EMPTY_TEAM_PERMISSIONS, ...Object.fromEntries(OWNER_TEAM_PERMISSIONS.map(p => [p.key, true])) } as TeamPermissions },
} as const;
export const TEAM_PERMISSION_GROUPS = [
    { label: 'Asset register', keys: ['viewValues', 'editDetails', 'updateUsage', 'viewPhotos', 'uploadPhotos', 'exportAssets'] },
    { label: 'Maintenance', keys: ['viewMaintenance', 'completeMaintenance', 'exportMaintenance'] },
    { label: 'Fuel ledger', keys: ['viewFuel', 'viewFuelCosts', 'viewFuelStorage', 'addFuel', 'editFuel', 'voidFuel', 'manageFuelStorage', 'viewFuelDocuments', 'exportFuel'] },
    { label: 'Costs', keys: ['viewCosts', 'addCosts', 'editCosts', 'deleteCosts', 'viewCostDocuments', 'viewBudgets', 'manageBudgets', 'exportCosts'] },
    { label: 'Asset map', keys: ['viewMap', 'updateLocation', 'exportMap'] },
    { label: 'Documents', keys: ['uploadDocuments'] },
] as const;
/** Dependencies are explicit, shared by the editor and server, and never inferred for stored grants. */
export const TEAM_PERMISSION_DEPENDENCIES: Partial<Record<TeamPermission, readonly TeamPermission[]>> = {
    viewClientContacts: ['viewClientWork'], viewClientValues: ['viewClientWork'], manageClientEnquiries: ['viewClientWork'],
    completeMaintenance: ['viewMaintenance'], exportMaintenance: ['viewMaintenance'],
    viewFuelCosts: ['viewFuel'], viewFuelStorage: ['viewFuel'],
    addFuel: ['viewFuel', 'viewFuelCosts'], editFuel: ['viewFuel', 'viewFuelCosts'], voidFuel: ['viewFuel', 'viewFuelCosts'],
    manageFuelStorage: ['viewFuel', 'viewFuelStorage'], exportFuel: ['viewFuel'],
    viewFuelDocuments: ['viewFuel'], viewCostDocuments: ['viewCosts'],
    viewBudgets: ['viewCosts', 'viewFuel', 'viewFuelCosts'], manageBudgets: ['viewCosts', 'viewFuel', 'viewFuelCosts', 'viewBudgets'],
    addCosts: ['viewCosts'], editCosts: ['viewCosts'], deleteCosts: ['viewCosts'], exportCosts: ['viewCosts'],
    updateLocation: ['viewMap'], exportMap: ['viewMap'],
};
export type TeamDocumentAccess = 'none' | 'selected' | 'all';
export function teamDocumentAccessLabel(mode: TeamDocumentAccess = 'selected', selected = 0, excluded = 0) {
    if (mode === 'none') return 'No document access';
    if (mode === 'all') return excluded ? `All in-scope documents except ${excluded} excluded` : 'All current and future in-scope documents';
    return selected ? `${selected} approved document${selected === 1 ? '' : 's'}` : 'No documents approved';
}
export function updateTeamPermission(permissions: TeamPermissions, key: TeamPermission, enabled: boolean): TeamPermissions {
    const next = { ...permissions, [key]: enabled };
    if (enabled) for (const required of TEAM_PERMISSION_DEPENDENCIES[key] || []) next[required] = true;
    return normalizeTeamPermissions(next);
}
export type TeamGrant = {
    clientWorkIds?: string[];
    username?: string;
    managedLogin?: boolean;
    id: string;
    ownerId: string;
    email: string;
    displayName: string;
    memberUserId: string | null;
    status: 'pending' | 'active' | 'revoked';
    scope: 'all' | 'selected';
    registerIds: string[];
    assetIds: string[];
    documentIds: string[];
    documentAccess?: TeamDocumentAccess;
    excludedDocumentIds?: string[];
    permissions: TeamPermissions;
    expiresAt: string | null;
    version: number;
};
export type TeamActor = {
    username?: string;
    managedGrantId?: string;
    id: string;
    email: string;
    emailVerified: boolean;
    name?: string | null;
};
export class TeamAccessError extends Error {
    constructor(message: string, public status = 403) { super(message); }
}
export function normalizeTeamPermissions(value: unknown): TeamPermissions {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    const result = { ...EMPTY_TEAM_PERMISSIONS };
    for (const { key } of TEAM_PERMISSIONS)
        result[key] = input[key] === true;
    for (const [key, required] of Object.entries(TEAM_PERMISSION_DEPENDENCIES))
        if (required.some(dependency => !result[dependency])) result[key as TeamPermission] = false;
    return result;
}
export function teamGrantIsLive(grant: TeamGrant, actor: TeamActor, now = Date.now()): boolean {
    return grant.status === 'active' && (actor.managedGrantId ? grant.managedLogin === true && grant.id === actor.managedGrantId : !grant.managedLogin && grant.memberUserId === actor.id)
        && (actor.managedGrantId ? (grant.username || grant.email) === (actor.username || actor.email).trim().toLowerCase() : grant.email === actor.email.trim().toLowerCase())
        && (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now);
}
export function teamCanAccessAsset(grant: Pick<TeamGrant, 'scope' | 'registerIds' | 'assetIds'>, asset: {
    id: string;
    registerId?: string | null;
}): boolean {
    return grant.scope === 'all' || grant.assetIds.includes(asset.id) || Boolean(asset.registerId && grant.registerIds.includes(asset.registerId));
}
export function assertTeamPermission(grant: TeamGrant, permission: TeamPermission) {
    if (!grant.permissions[permission])
        throw new TeamAccessError('You do not have permission for this action.');
}
export type TeamAsset = {
    registerLogoUrls?: string[];
    registerShowLogos?: boolean;
    id: string;
    registerId: string | null;
    registerName: string;
    title: string;
    brand: string;
    model: string;
    year: number | null;
    serial: string;
    registration: string;
    condition: string;
    usage: number | null;
    usageMetric: string;
    photoCount: number;
    kind?: string;
    includeInRegisterTotal?: boolean;
    registerIncludedInCombinedTotals?: boolean;
    values?: {
        current: number;
        replacement: number | null;
        insured: number | null;
    };
};
export function projectTeamAsset(asset: {
    id: string;
    registerId: string | null;
    title: string;
    brandName: string;
    modelName: string;
    yearModel: number | null;
    serialNumber: string;
    licenseRegistrationNumber: string;
    condition: string;
    kind?: string;
    specsJson?: Record<string, unknown>;
    photos: string[];
    value: number;
    replacementPriceExVat: number | null;
    insuredValueExVat: number | null;
}, grant: TeamGrant, registerName: string, usage: {
    value: number | null;
    metric: string;
}): TeamAsset {
    const result: TeamAsset = {
        includeInRegisterTotal: asset.specsJson?.includeInRegisterTotal !== false,
        kind: asset.kind, id: asset.id, registerId: asset.registerId, registerName, title: asset.title, brand: asset.brandName, model: asset.modelName,
        year: asset.yearModel, serial: asset.serialNumber, registration: asset.licenseRegistrationNumber, condition: asset.condition,
        usage: usage.value, usageMetric: usage.metric, photoCount: grant.permissions.viewPhotos ? asset.photos.length : 0,
    };
    if (grant.permissions.viewValues)
        result.values = { current: asset.value, replacement: asset.replacementPriceExVat, insured: asset.insuredValueExVat };
    return result;
}
export function validateTeamPatch(body: Record<string, unknown>, grant: TeamGrant) {
    const patch: {
        title?: string;
        brand?: string;
        model?: string;
        yearModel?: number | null;
        condition?: string;
        usage?: number;
    } = {};
    if (Object.keys(body).some(key => !['title', 'brand', 'model', 'yearModel', 'condition', 'usage'].includes(key)))
        throw new TeamAccessError('Unsupported asset field.', 400);
    for (const key of ['title', 'brand', 'model', 'yearModel', 'condition'] as const) {
        if (!(key in body))
            continue;
        assertTeamPermission(grant, 'editDetails');
        if (key === 'yearModel') {
            if (body[key] !== null && (!Number.isInteger(body[key]) || Number(body[key]) < 1900 || Number(body[key]) > new Date().getFullYear() + 1))
                throw new TeamAccessError('Enter a valid year or leave it blank.', 400);
            patch.yearModel = body[key] as number | null;
        }
        else {
            if (typeof body[key] !== 'string' || String(body[key]).length > 180 || (key === 'title' && !String(body[key]).trim()))
                throw new TeamAccessError('Enter valid asset details.', 400);
            if (key === 'condition' && !['excellent', 'good', 'fair', 'poor'].includes(String(body[key])))
                throw new TeamAccessError('Choose a valid condition.', 400);
            patch[key] = String(body[key]).trim();
        }
    }
    if ('usage' in body) {
        assertTeamPermission(grant, 'updateUsage');
        if (typeof body.usage !== 'number' || !Number.isFinite(body.usage) || body.usage < 0)
            throw new TeamAccessError('Enter a valid usage reading.', 400);
        patch.usage = body.usage;
    }
    if (!Object.keys(patch).length)
        throw new TeamAccessError('No changes supplied.', 400);
    return patch;
}
/** Full email addresses retain personal-account sign-in; @business usernames use desktop sign-in. */
export function isEmailLogin(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
export function isDesktopUsername(value: string): boolean {
    return value.length >= 3 && value.length <= 40
        && /^[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9_-]*)?$/.test(value);
}
