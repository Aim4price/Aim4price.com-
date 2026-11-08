// Only browsing screens expose global navigation. Forms keep their own Back/Save controls.
export function ownerNavigationSection(pathname: string): 'home' | 'assets' | 'work' | 'more' | null {
  const path = pathname.replace(/\/$/, '');
  if (path === '/owner-app' || path === '/owner-app/attention' || path === '/owner-app/notifications') return 'home';
  if (path === '/owner-app/assets' || /^\/owner-app\/assets\/[^/]+(?:\/details)?$/.test(path) && !path.endsWith('/add')) return 'assets';
  if (['/owner-app/operations', '/owner-app/operations/maintenance', '/owner-app/operations/fuel', '/owner-app/operations/fuel/storage', '/owner-app/report-problem'].includes(path)) return 'work';
  if (['/owner-app/more', '/owner-app/account', '/owner-app/discovery', '/owner-app/marketplace'].includes(path)) return 'more';
  return null;
}
