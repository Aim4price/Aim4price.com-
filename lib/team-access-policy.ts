/** Explicit allow-lists: never pass owner records or their arbitrary JSON to team clients. */
export const TEAM_PERMISSIONS = [
    { key: 'viewValues', label: 'View asset values', detail: 'Current, replacement and insured values. No finance balances or costs.' },
    { key: 'editDetails', label: 'Edit asset details', detail: 'Title, brand, model, year and condition.' },
    { key: 'updateUsage', label: 'Update usage', detail: 'Increase hours, kilometres or lifetime worked.' },
    { key: 'viewMaintenance', label: 'View maintenance', detail: 'Schedules and completion details. Financial fields are excluded.' },
    { key: 'completeMaintenance', label: 'Complete maintenance', detail: 'Mark scheduled work done; cannot delete or change schedules.' },
    { key: 'uploadDocuments', label: 'Upload documents', detail: 'Attach documents to accessible assets for owner review.' },
    { key: 'viewPhotos', label: 'View photos', detail: 'Photos can contain visible sensitive information.' },
    { key: 'uploadPhotos', label: 'Add photos', detail: 'Upload photos without changing or deleting existing ones.' },
    { key: 'exportAssets', label: 'Export asset list', detail: 'CSV containing only the fields this person may see.' },
] as const;
export type TeamPermission = typeof TEAM_PERMISSIONS[number]['key'];
export type TeamPermissions = Record<TeamPermission, boolean>;
export const EMPTY_TEAM_PERMISSIONS = Object.fromEntries(TEAM_PERMISSIONS.map(p => [p.key, false])) as TeamPermissions;
export const TEAM_TEMPLATES = {
    viewer: { label: 'View only', permissions: { ...EMPTY_TEAM_PERMISSIONS } },
    workshop: { label: 'Workshop', permissions: { ...EMPTY_TEAM_PERMISSIONS, updateUsage: true, viewMaintenance: true, completeMaintenance: true, viewPhotos: true, uploadPhotos: true, uploadDocuments: true } },
    office: { label: 'Office administrator', permissions: { ...EMPTY_TEAM_PERMISSIONS, editDetails: true, updateUsage: true, viewMaintenance: true, completeMaintenance: true, uploadDocuments: true, viewPhotos: true, uploadPhotos: true, exportAssets: true } },
} as const;
export type TeamGrant = {
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
    permissions: TeamPermissions;
    expiresAt: string | null;
    version: number;
};
export type TeamActor = {
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
    if (!result.viewMaintenance)
        result.completeMaintenance = false;
    return result;
}
export function teamGrantIsLive(grant: TeamGrant, actor: TeamActor, now = Date.now()): boolean {
    return actor.emailVerified === true && grant.status === 'active' && grant.memberUserId === actor.id
        && grant.email === actor.email.trim().toLowerCase()
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
    photos: string[];
    value: number;
    replacementPriceExVat: number | null;
    insuredValueExVat: number | null;
}, grant: TeamGrant, registerName: string, usage: {
    value: number | null;
    metric: string;
}): TeamAsset {
    const result: TeamAsset = {
        id: asset.id, registerId: asset.registerId, registerName, title: asset.title, brand: asset.brandName, model: asset.modelName,
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
export function teamCsv(assets: TeamAsset[], includeValues: boolean): string {
    const cell = (value: unknown) => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, "'$&").replaceAll('"', '""') + '"';
    const headers = ['Asset', 'Register', 'Brand', 'Model', 'Year', 'Serial / VIN', 'Registration', 'Condition', 'Usage', 'Usage unit', ...(includeValues ? ['Current value excl. VAT', 'Replacement value excl. VAT', 'Insured value excl. VAT'] : [])];
    return '\uFEFF' + [headers, ...assets.map(a => [a.title, a.registerName, a.brand, a.model, a.year, a.serial, a.registration, a.condition, a.usage, a.usageMetric, ...(includeValues ? [a.values?.current, a.values?.replacement, a.values?.insured] : [])])].map(row => row.map(cell).join(',')).join('\r\n');
}
