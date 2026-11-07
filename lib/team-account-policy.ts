import { CLIENT_TEAM_PERMISSIONS, EMPTY_TEAM_PERMISSIONS, OWNER_TEAM_PERMISSIONS, TEAM_PERMISSION_GROUPS, TEAM_TEMPLATES, normalizeTeamPermissions, type TeamPermission, type TeamPermissions } from './team-access-policy';

export type TeamAccountKind = 'owner' | 'dealer' | 'business';
export function teamAccountKind(type: string, subtype?: string | null): TeamAccountKind | null {
  // Existing Middleman grants retain their asset-only behavior; no client features are added.
  if (type === 'dealer' && (subtype || '').toLowerCase().includes('middleman')) return 'owner';
  return type === 'owner' || type === 'dealer' || type === 'business' ? type : null;
}
const preset = (label: string, detail: string, keys: readonly TeamPermission[]) => ({ label, detail, permissions: normalizeTeamPermissions({ ...EMPTY_TEAM_PERMISSIONS, ...Object.fromEntries(keys.map(key => [key, true])) }) });
const commercialManager = preset('Manager', 'Business assets and assigned client work. Client values, contacts and enquiry responses are included. Billing, publishing, sharing and user administration stay with the account holder.', [...OWNER_TEAM_PERMISSIONS.map(p => p.key), ...CLIENT_TEAM_PERMISSIONS.map(p => p.key)]);
export const DEALER_TEAM_TEMPLATES = {
  viewer: preset('View only', 'Read selected stock and assigned client assets. Values and contact details stay hidden.', ['viewClientWork']),
  sales: preset('Sales', 'Assigned enquiries and client contacts. Accept, quote or decline enquiries. Stock values and client values stay hidden until enabled separately.', ['viewPhotos', 'viewClientWork', 'viewClientContacts', 'manageClientEnquiries']),
  technician: preset('Technician', 'Usage, maintenance and uploads for selected business assets; read assigned client assets.', ['updateUsage', 'viewMaintenance', 'completeMaintenance', 'viewPhotos', 'uploadPhotos', 'uploadDocuments', 'viewClientWork']),
  parts: preset('Parts desk', 'Read assigned client assets and contacts; view photos and upload documents for selected business assets.', ['viewPhotos', 'uploadDocuments', 'viewClientWork', 'viewClientContacts']),
  manager: commercialManager,
};
export const BUSINESS_TEAM_TEMPLATES = {
  viewer: preset('View only', 'Read selected business assets and assigned client work. Values and contact details stay hidden.', ['viewClientWork']),
  staff: preset('Staff', 'Update business asset records and handle assigned enquiries. Financial access stays off.', ['editDetails', 'updateUsage', 'viewMaintenance', 'viewPhotos', 'uploadPhotos', 'uploadDocuments', 'viewClientWork', 'viewClientContacts', 'manageClientEnquiries']),
  manager: commercialManager,
};
export function teamTemplates(kind: TeamAccountKind) { return kind === 'owner' ? TEAM_TEMPLATES : kind === 'dealer' ? DEALER_TEAM_TEMPLATES : BUSINESS_TEAM_TEMPLATES; }
export function teamPermissionGroups(kind: TeamAccountKind) {
  return kind === 'owner' ? TEAM_PERMISSION_GROUPS : [...TEAM_PERMISSION_GROUPS, { label: 'Client work', keys: CLIENT_TEAM_PERMISSIONS.map(p => p.key) }];
}
export function accountTeamPermissions(value: unknown, kind: TeamAccountKind): TeamPermissions {
  const permissions = normalizeTeamPermissions(value);
  if (kind === 'owner') for (const permission of CLIENT_TEAM_PERMISSIONS) permissions[permission.key] = false;
  return permissions;
}
