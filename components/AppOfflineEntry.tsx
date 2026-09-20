'use client';
import { useEffect, useState } from 'react';
import { prepareOfflineMutationIdentity, getLegacyAppOfflineCount } from '../lib/offline-mutation-queue';
export default function AppOfflineEntry({ appRoot, worker }: { appRoot: string; worker: string }) {
  const [offline, setOffline] = useState(false);
  const [legacyCount, setLegacyCount] = useState(0);
  useEffect(() => {
    const update = () => { setOffline(!navigator.onLine); if (navigator.onLine) void prepareOfflineMutationIdentity(); };
    void getLegacyAppOfflineCount().then(setLegacyCount);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register(worker, { scope: appRoot, updateViaCache: 'none' }).catch(() => {});
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [appRoot, worker]);
  return <>{legacyCount > 0 ? <p role="status" style={{ margin: 0, padding: '12px 18px', background: '#fff4db', color: '#674c14' }}>{legacyCount} older phone-saved update{legacyCount === 1 ? '' : 's'} need account verification before syncing. They remain on this phone. Keep this browser’s data until they have been reviewed.</p> : null}{offline ? <p role="status" style={{ margin: 0, padding: '12px 18px', background: '#e5f0e8', color: '#163e2c' }}>You’re offline. <a href={`${appRoot}/offline.html`}>Open saved work</a></p> : null}</>;
}
