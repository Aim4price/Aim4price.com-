'use client';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_PUSH_PREFERENCES, PUSH_CATEGORIES, type PushCategory, type AccountPushPreferences } from '../../../lib/push-policy';
import accountStyles from '../page.module.css';
import styles from './page.module.css';
export default function DesktopNotificationSettings({ onClose, onSaved, onBusyChange }: { onClose: () => void; onSaved: () => void; onBusyChange: (busy: boolean) => void }) {
  const [settings,setSettings] = useState<AccountPushPreferences>({enabled:true,preferences:DEFAULT_PUSH_PREFERENCES});
  const [categories,setCategories] = useState<PushCategory[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const load = useCallback(async()=>{
    setLoading(true);setError('');
    try {
      const response = await fetch('/api/account/notifications',{credentials:'include',cache:'no-store'});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not load notification settings.');
      setSettings({enabled:data.enabled,preferences:data.preferences});setCategories(data.categories);
    } catch(e) {setError((e as Error).message);} finally {setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  async function save() {
    if (saving) return;
    setSaving(true);onBusyChange(true);setError('');
    try {
      const response = await fetch('/api/account/notifications',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(settings)});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save notification settings.');
      onBusyChange(false);onSaved();
    } catch(e) {setError((e as Error).message);} finally {setSaving(false);onBusyChange(false);}
  }
  return <form className={`${accountStyles.compactEditForm} ${styles.form}`} aria-busy={loading||saving} onSubmit={event=>{event.preventDefault();void save();}}>
      <div className={styles.options}>
        {loading ? <p role="status">Loading notifications…</p> : categories.length ? <>
          <button className={styles.row} type="button" role="switch" aria-checked={settings.enabled} disabled={saving} onClick={()=>setSettings({...settings,enabled:!settings.enabled})}>
            <span>Phone notifications<small>All app logins on this account</small></span><span className={settings.enabled?styles.on:styles.off}>{settings.enabled?'On':'Off'}</span>
          </button>
          <div className={styles.categories}>{categories.map(category=><button key={category} className={styles.row} type="button" role="switch" aria-checked={settings.preferences[category]} disabled={saving||!settings.enabled}
            onClick={()=>setSettings({...settings,preferences:{...settings.preferences,[category]:!settings.preferences[category]}})}>
            <span>{PUSH_CATEGORIES[category]}</span><span className={settings.preferences[category]?styles.on:styles.off}>{settings.preferences[category]?'On':'Off'}</span>
          </button>)}</div>
        </> : null}

        {error?<div role="alert"><p>{error}</p><button className={styles.retry} type="button" disabled={saving||loading} onClick={()=>void load()}>Try again</button></div>:null}
      </div>
      <div className={accountStyles.marketplaceActions}>
        <button type="button" className={accountStyles.ghostButton} disabled={saving} onClick={onClose}>Cancel</button>
        <button type="submit" className={accountStyles.primaryButton} disabled={loading||saving||!categories.length}>{saving?'Saving…':'Save notifications'}</button>
      </div>
  </form>;
}
