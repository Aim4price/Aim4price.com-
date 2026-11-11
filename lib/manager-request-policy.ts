import { teamWorkspacePermission, isTeamDocumentRead } from './team-workspace-policy';
import type { TeamPermissions } from './team-access-policy';
/** Support sessions must not make arbitrary owner-only endpoints available to app staff. */
export function managerRequestAllowed(path: string, method: string, permissions: TeamPermissions): boolean {
  if (!path.startsWith('/api/')) return true;
  // These routes resolve the current app identity and enforce asset/action permissions themselves.
  if (path === '/api/team-workspaces' || path.startsWith('/api/team-workspaces/')) return true;
  if (/^\/api\/owner-app\/(session|assets|operations|fuel|overview|attention|notifications|offline)(\/|$)/.test(path)) return true;
  if (/^\/api\/app-offline\/owner(\/|$)/.test(path)) return true;
  if (/^\/api\/scan\/(assets|uploads)(\/|$)/.test(path)) return true;
  if (/^\/api\/fuel-scan\/storage\//.test(path)) return true;
  if (isTeamDocumentRead(path, method)) return true;
  const permission = teamWorkspacePermission(path, method);
  return Boolean(permission && permissions[permission]);
}
