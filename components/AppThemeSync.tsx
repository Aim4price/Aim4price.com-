'use client';

import { useLayoutEffect } from 'react';
import { usePathname } from 'next/navigation';
import { APP_THEME_EVENT, APP_THEME_KEY_PREFIX, appThemeRoot, applyAppTheme, clearAppThemeMemory } from '../lib/app-theme';

/** Keep the document theme (and body portals) in step with client-side navigation. */
export default function AppThemeSync() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    const root = appThemeRoot(pathname || '/');
    applyAppTheme(root);
    const metas = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'));
    const original = metas.map(meta => meta.content);
    function updateBrowserColour() {
      metas.forEach((meta, index) => {
        meta.content = root && document.documentElement.dataset.appTheme === 'dark' ? '#14251f' : original[index];
      });
    }
    function storage(event: StorageEvent) {
      if (event.key === null) clearAppThemeMemory();
      else if (event.key.startsWith(APP_THEME_KEY_PREFIX)) clearAppThemeMemory(event.key.slice(APP_THEME_KEY_PREFIX.length));
      if (root && (event.key === null || event.key === APP_THEME_KEY_PREFIX + root)) applyAppTheme(root);
    }
    updateBrowserColour();
    window.addEventListener('storage', storage);
    window.addEventListener(APP_THEME_EVENT, updateBrowserColour);
    return () => {
      window.removeEventListener('storage', storage);
      window.removeEventListener(APP_THEME_EVENT, updateBrowserColour);
      metas.forEach((meta, index) => { meta.content = original[index]; });
    };
  }, [pathname]);
  return null;
}
