// Capture, scheduling, login and fuel-storage flows keep their own Back/Save controls.
export function fieldManagerNavigationSection(pathname: string): 'home' | 'assets' | 'work' | 'more' | null {
  const path = pathname.replace(/\/$/, '');
  if (['/field-manager', '/field-manager/overview', '/field-manager/notifications'].includes(path)) return 'home';
  if (path === '/field-manager/assets') return 'assets';
  if (['/field-manager/work', '/field-manager/diesel', '/field-manager/report-problem'].includes(path)) return 'work';
  if (path === '/field-manager/more') return 'more';
  return null;
}
