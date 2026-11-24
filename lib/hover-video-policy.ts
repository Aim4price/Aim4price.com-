import { workspaceCards } from './workspace-navigation';
import { isMiddlemanAccountSubtype } from './middleman-account';

export type HoverAudience = 'dealer' | 'business';
export const hoverCards = workspaceCards('business', false, '/business');
export const maxRecordingBytes = 25 * 1024 * 1024;

export function hoverAudience(profile: {accountType: string; accountSubtype: string; accountStatus: string}): HoverAudience | null {
  if (profile.accountStatus !== 'active') return null;
  if (profile.accountType === 'business') return 'business';
  return profile.accountType === 'dealer' && !isMiddlemanAccountSubtype(profile.accountSubtype) ? 'dealer' : null;
}

export function validHoverTarget(audience: string | null, card: string | null) {
  return (audience === 'dealer' || audience === 'business') && hoverCards.some(item => item.key === card);
}
