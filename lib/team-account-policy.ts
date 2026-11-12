import { PARTS_TEAM_PERMISSIONS, CLIENT_TEAM_PERMISSIONS, EMPTY_TEAM_PERMISSIONS, OWNER_TEAM_PERMISSIONS, TEAM_PERMISSION_GROUPS, TEAM_TEMPLATES, normalizeTeamPermissions, type TeamPermission, type TeamPermissions } from './team-access-policy';

export type TeamAccountKind = 'owner' | 'dealer' | 'business';
export function teamAccountKind(type: string, subtype?: string | null): TeamAccountKind | null {
  // Middleman accounts use app access only, including accounts stored as a Dealer subtype.
  if (type === 'dealer' && (subtype || '').toLowerCase().includes('middleman')) return null;
  return type === 'owner' || type === 'dealer' || type === 'business' ? type : null;
}
const preset = (label: string, detail: string, keys: readonly TeamPermission[]) => ({ label, detail, permissions: normalizeTeamPermissions({ ...EMPTY_TEAM_PERMISSIONS, ...Object.fromEntries(keys.map(key => [key, true])) }) });
const commercialManager = preset('Operations manager', 'Assigned operations and enquiries. Financial information, exports and destructive actions require separate permission.', [...OWNER_TEAM_PERMISSIONS.filter(p => TEAM_TEMPLATES.manager.permissions[p.key]).map(p => p.key), 'viewClientWork', 'viewClientContacts', 'manageClientEnquiries']);
export const DEALER_TEAM_TEMPLATES = {
  viewer: preset('View only', 'Read selected stock and assigned client assets. Values and contact details stay hidden.', ['viewClientWork']),
  sales: preset('Sales', 'Assigned enquiries and client contacts. Accept, mark quoted or decline enquiries. Stock values and client values stay hidden until enabled separately.', ['viewPhotos', 'viewClientWork', 'viewClientContacts', 'manageClientEnquiries']),
  technician: preset('Technician', 'Usage, maintenance and uploads for selected business assets; read assigned client assets.', ['updateUsage', 'viewMaintenance', 'recordMaintenance', 'completeMaintenance', 'viewPhotos', 'uploadPhotos', 'uploadDocuments', 'viewClientWork']),
  parts: preset('Parts desk', 'View and update assigned Parts Stocklists, including selling prices. Sharing, membership and account administration stay with the account holder.', ['viewParts', 'manageParts']),
  manager: commercialManager,
};
export const BUSINESS_TEAM_TEMPLATES = {
  viewer: preset('View only', 'Read assigned client work. Values and contact details stay hidden.', ['viewClientWork']),
  staff: preset('Staff', 'Handle assigned enquiries and view client contacts. Shared values require separate permission.', ['viewClientWork', 'viewClientContacts', 'manageClientEnquiries']),
  manager: preset('Operations manager', 'Manage assigned client enquiries. Shared values remain a separate choice; account administration stays with the account holder.', ['viewClientWork','viewClientContacts','manageClientEnquiries']),
};
export function teamTemplates(kind: TeamAccountKind) { return kind === 'owner' ? TEAM_TEMPLATES : kind === 'dealer' ? DEALER_TEAM_TEMPLATES : BUSINESS_TEAM_TEMPLATES; }
export function teamPermissionGroups(kind: TeamAccountKind) {
  if (kind === 'business') return [{label:'Client work', keys:CLIENT_TEAM_PERMISSIONS.map(p=>p.key)}];
  return kind === 'owner' ? TEAM_PERMISSION_GROUPS : [...TEAM_PERMISSION_GROUPS, { label: 'Client work', keys: CLIENT_TEAM_PERMISSIONS.map(p => p.key) }, ...(kind === 'dealer' ? [{label:'Parts Stock', keys:PARTS_TEAM_PERMISSIONS.map(p=>p.key)}] : [])];
}
export function accountTeamPermissions(value: unknown, kind: TeamAccountKind): TeamPermissions {
  const permissions = normalizeTeamPermissions(value);
  if (kind === 'owner') for (const permission of CLIENT_TEAM_PERMISSIONS) permissions[permission.key] = false;
  if (kind === 'business') for (const permission of OWNER_TEAM_PERMISSIONS) permissions[permission.key] = false;
  if (kind !== 'dealer') for (const permission of PARTS_TEAM_PERMISSIONS) permissions[permission.key] = false;
  return permissions;
}
