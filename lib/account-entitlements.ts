/** Free Business identity and business approval do not confer Desktop access. */
export function hasDesktopAccess(profile: {accountType: string; accountStatus: string}): boolean {
 return ['owner', 'dealer'].includes(profile.accountType) && profile.accountStatus === 'active';
}
