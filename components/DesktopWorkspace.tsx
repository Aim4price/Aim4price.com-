'use client';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useLeadDialog } from './leads/useLeadDialog';
import type { DesktopWorkspace } from '../lib/desktop-workspace';
import type { TeamPermission } from '../lib/team-access-policy';
import { teamWorkspacePermission, isTeamDocumentRead } from '../lib/team-workspace-policy';
const Context = createContext<DesktopWorkspace | null>(null);
export function DesktopWorkspaceProvider({ workspace, children }: { workspace: DesktopWorkspace | null; children: ReactNode }) {
  return <Context.Provider value={workspace}>{children}</Context.Provider>;
}
export function desktopUrl(url: string, membershipId?: string) {
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  const value = new URL(url, 'https://aim4price.invalid');
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/owner-app')) {
    const pages: Record<string, string> = { '/fuel': 'workspace/fuel', '/my-invoices': 'workspace/costs', '/budgets': 'workspace/budgets', '/asset-map': 'workspace/map', '/documents': 'workspace/documents', '/maintenance': 'workspace/maintenance', '/asset-register': 'assets', '/team/access': 'more', '/account': 'more' };
    if (pages[value.pathname]) value.pathname = '/owner-app/' + pages[value.pathname];
  }
  if (membershipId) value.searchParams.set('desktopMembershipId', membershipId);
  return `${value.pathname}${value.search}${value.hash}`;
}
export function desktopPageAllowed(path: string, permissions?: DesktopWorkspace['permissions']) {
  if (['/', '/valuation', '/marketplace', '/asset-register', '/account', '/team/access', '/documents'].includes(path)) return true;
  if (path === '/parts' || path.startsWith('/parts/')) return Boolean(permissions?.viewParts);
  if (path.startsWith('/marketplace/')) return true;
  const key: Record<string, TeamPermission> = { '/maintenance': 'viewMaintenance', '/fuel': 'viewFuel', '/my-invoices': 'viewCosts', '/asset-map': 'viewMap', '/budgets': 'viewBudgets' };
  return Boolean(key[path] && permissions?.[key[path]]);
}
export function useDesktopWorkspace() { return useContext(Context); }
export function useDesktopControls() {
  const workspace = useDesktopWorkspace();
  const [unavailable, setUnavailable] = useState(false);
  const can = (permission: TeamPermission) => !workspace || workspace.permissions[permission];
  const allow = (permission: TeamPermission) => { const allowed = can(permission); if (!allowed) setUnavailable(true); return allowed; };
  const url = (value: string) => desktopUrl(value, workspace?.membershipId);
  const request: typeof fetch = async (input, init) => {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const path = new URL(raw, window.location.origin).pathname;
    const permission = teamWorkspacePermission(path, init?.method || 'GET');
    if (workspace && !isTeamDocumentRead(path, init?.method || 'GET') && (!permission || !workspace.permissions[permission]) && !(path === '/api/maintenance' && init?.method === 'POST' && workspace.permissions.scheduleMaintenance)) {
      if ((init?.method || 'GET') !== 'GET') setUnavailable(true);
      return new Response(JSON.stringify({ ok: false, error: 'Not available with your permissions.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    return fetch(typeof input === 'string' ? url(input) : input, init);
  };
  const dialog = unavailable ? <UnavailableDialog onClose={() => setUnavailable(false)} /> : null;
  return { workspace, can, allow, url, request, dialog, unavailable: () => setUnavailable(true) };
}
function UnavailableDialog({onClose}: {onClose: () => void}) {
  const ref = useLeadDialog(onClose);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previous; }; }, []);
  return <div className="desktopPermissionBackdrop" role="presentation" onClick={onClose}><section ref={ref} tabIndex={-1} className="desktopPermissionDialog" role="dialog" aria-modal="true" aria-labelledby="desktop-permission-title" onClick={event => event.stopPropagation()}><button type="button" data-modal-close="true" aria-label="Close" onClick={onClose} autoFocus>×</button><h2 id="desktop-permission-title">Not available</h2><p>Your account holder has not enabled this action for your login.</p><button type="button" onClick={onClose}>Got it</button></section></div>;
}
