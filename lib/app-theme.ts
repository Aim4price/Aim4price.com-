export type AppTheme = 'light' | 'dark';
export const APP_THEME_EVENT = 'aim4price-app-theme-change';
export const APP_THEME_KEY_PREFIX = 'aim4price-app-theme:';
const memory = new Map<string, AppTheme>();

export function appThemeRoot(pathname: string): string | null {
  return pathname.match(/^\/(owner-app|dealer|middleman|field-manager)(?:\/|$)/)?.[1] ?? null;
}

export function readAppTheme(root: string): AppTheme {
  const remembered = memory.get(root);
  if (remembered) return remembered;
  try {
    const saved = localStorage.getItem(APP_THEME_KEY_PREFIX + root);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* Private browsing may disable storage. Keep the in-session choice. */ }
  return 'light';
}

export function clearAppThemeMemory(root?: string) {
  if (root) memory.delete(root);
  else memory.clear();
}

export function applyAppTheme(root: string | null) {
  const html = document.documentElement;
  if (root) html.dataset.appTheme = readAppTheme(root);
  else delete html.dataset.appTheme;
  window.dispatchEvent(new Event(APP_THEME_EVENT));
}

export function setAppTheme(root: string, theme: AppTheme) {
  memory.set(root, theme);
  try { localStorage.setItem(APP_THEME_KEY_PREFIX + root, theme); } catch { /* Optional persistence. */ }
  applyAppTheme(root);
}

// Use the same app-specific preference before React mounts, including direct links.
export const APP_THEME_SCRIPT = `(function(){var root=location.pathname.match(/^\\/(owner-app|dealer|middleman|field-manager)(?:\\/|$)/);if(!root)return;var theme='light';try{if(localStorage.getItem('${APP_THEME_KEY_PREFIX}'+root[1])==='dark')theme='dark';}catch(e){}document.documentElement.dataset.appTheme=theme;})();`;
