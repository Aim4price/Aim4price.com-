import { workspaceCards } from './workspace-navigation';

export type HoverAudience = 'owner' | 'business';
export const hoverCards = {
  owner: workspaceCards('owner', false, '/business'),
  business: workspaceCards('business', false, '/business'),
};
export const maxRecordingBytes = 25 * 1024 * 1024;

export function hoverAudience(profile: {accountType: string; accountStatus: string}): HoverAudience | null {
  if (profile.accountStatus !== 'active') return null;
  const { accountType } = profile;
  return accountType === 'owner' || accountType === 'business' ? accountType : null;
}

export function validHoverTarget(audience: string | null, card: string | null) {
  return (audience === 'owner' || audience === 'business') && hoverCards[audience].some(item => item.key === card);
}
