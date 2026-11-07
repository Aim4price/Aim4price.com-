import { cookies } from 'next/headers';
import { TEAM_LOGIN_COOKIE } from './team-login';
import { getAnyServerSession } from './auth-session';
import { cache } from 'react';
import { getManagedTeamActor } from './team-login';
import { loadTeamScope } from './team-access';
import type { TeamPermissions } from './team-access-policy';
export type DesktopWorkspace = { membershipId: string; managedLogin: boolean; name: string; accountType: string; accountSubtype?: string | null; logoUrl?: string | null; permissions: TeamPermissions; displayName: string };
/** An explicit membership must belong to the signed-in actor. Never accept a caller-supplied owner ID. */
export const getDesktopScope = cache(async (membershipId?: string) => {
  // Most page requests are ordinary owner/public requests: no session/database lookup is needed here.
  if (!membershipId && !cookies().get(TEAM_LOGIN_COOKIE)?.value) return null;
  if (!membershipId && (await getAnyServerSession())?.user?.id) return null;
  const id = membershipId || (await getManagedTeamActor())?.managedGrantId;
  return id ? loadTeamScope(id) : null;
});
export function desktopWorkspace(scope: NonNullable<Awaited<ReturnType<typeof getDesktopScope>>>): DesktopWorkspace {
  return { membershipId: scope.grant.id, managedLogin: Boolean(scope.grant.managedLogin), name: scope.businessName, accountType: scope.accountType,
    accountSubtype: scope.accountSubtype, logoUrl: scope.logoUrl, permissions: scope.grant.permissions, displayName: scope.grant.displayName };
}
