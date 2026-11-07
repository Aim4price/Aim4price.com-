import { TeamAccessError, type TeamGrant, type TeamPermissions } from './team-access-policy';

export type TeamClientAsset = { title: string; serialNumber: string; year: number | null; usage: string; condition: string; values?: { current: number | null; replacement: number | null } };
export type TeamClientWork = { id: string; title: string; client: string; kind: 'enquiry' | 'shared-assets'; status: string; assets: TeamClientAsset[]; contact?: { name: string; email: string; phone: string }; canRespond: boolean };
export function clientWorkSelected(grant: Pick<TeamGrant, 'clientWorkIds' | 'permissions'>, id: string) {
  return grant.permissions.viewClientWork && (grant.clientWorkIds || []).includes(id);
}
export function projectClientAsset(asset: { title: string; serialNumber: string; yearModel: number | null; usage: string; condition: string; valueExVat: number | null; replacementPriceExVat: number | null }, permissions: TeamPermissions): TeamClientAsset {
  const safe: TeamClientAsset = { title: asset.title, serialNumber: asset.serialNumber, year: asset.yearModel, usage: asset.usage, condition: asset.condition };
  if (permissions.viewClientValues) safe.values = { current: asset.valueExVat, replacement: asset.replacementPriceExVat };
  return safe;
}
export function clientEnquiryStatus(value: unknown): 'viewed' | 'accepted' | 'quoted' | 'declined' {
  if (!['viewed', 'accepted', 'quoted', 'declined'].includes(String(value))) throw new TeamAccessError('Choose viewed, accepted, quoted or declined.', 400);
  return value as 'viewed' | 'accepted' | 'quoted' | 'declined';
}
