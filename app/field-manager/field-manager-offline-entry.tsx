'use client';
import { useEffect, useState } from 'react';
export default function FieldManagerOfflineEntry() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update(); window.addEventListener('online', update); window.addEventListener('offline', update);
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/field-manager-sw.js', { scope: '/field-manager' }).catch(() => {});
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  return offline ? <p role="status" style={{ margin: 0, padding: '12px 18px', background: '#e5f0e8', color: '#163e2c' }}>You’re offline. <a href="/field-manager/offline.html">Open saved assets and work</a></p> : null;
}
