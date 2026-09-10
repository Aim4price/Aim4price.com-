'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AppHeader from '../../../components/AppHeader';
import { DEFAULT_PUSH_PREFERENCES, PUSH_CATEGORIES, type PushCategory, type AccountPushPreferences } from '../../../lib/push-policy';
import accountStyles from '../page.module.css';
import styles from './page.module.css';
export default function DesktopNotificationSettings() {
  const [settings,setSettings] = useState<AccountPushPreferences>({enabled:true,preferences:DEFAULT_PUSH_PREFERENCES});
  const [categories,setCategories] = useState<PushCategory[]>([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [message,setMessage] = useState('');
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
  async function save(next: AccountPushPreferences) {
    if (saving) return;
    setSaving(true);setError('');setMessage('');
    try {
      const response = await fetch('/api/account/notifications',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(next)});
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'Could not save notification settings.');
      setSettings(next);setMessage('Notification settings saved.');
    } catch(e) {setError((e as Error).message);} finally {setSaving(false);}
  }
  return <main className={accountStyles.page}>
    <AppHeader active="none" />
    <div className={styles.content}>
      <Link href="/account" className={styles.back}>← Back to Account</Link>
      <section className={styles.panel} aria-busy={loading||saving}>
        <header className={styles.heading}><span className={styles.icon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg></span>
          <div><h1>Notifications</h1><p>Choose the phone alerts for your account.</p></div></header>
        {loading ? <p role="status">Loading notifications…</p> : categories.length ? <>
          <button className={styles.row} type="button" role="switch" aria-checked={settings.enabled} disabled={saving} onClick={()=>void save({...settings,enabled:!settings.enabled})}>
            <span>Phone notifications<small>All app logins on this account</small></span><span className={settings.enabled?styles.on:styles.off}>{settings.enabled?'On':'Off'}</span>
          </button>
          <div className={styles.categories}>{categories.map(category=><button key={category} className={styles.row} type="button" role="switch" aria-checked={settings.preferences[category]} disabled={saving||!settings.enabled}
            onClick={()=>void save({...settings,preferences:{...settings.preferences,[category]:!settings.preferences[category]}})}>
            <span>{PUSH_CATEGORIES[category]}</span><span className={settings.preferences[category]?styles.on:styles.off}>{settings.preferences[category]?'On':'Off'}</span>
          </button>)}</div>
          <p className={styles.hint}>Each phone must allow notifications in its app. App users can turn off additional alerts in Notifications → Settings.</p>
          <p className={styles.hint}>Your in-app and desktop inboxes stay available when phone alerts are off.</p>
        </> : null}
        <p className={styles.message} role="status">{saving?'Saving…':message}</p>
        {error?<div role="alert"><p>{error}</p><button className={styles.retry} type="button" disabled={saving||loading} onClick={()=>void load()}>Try again</button></div>:null}
      </section>
    </div>
  </main>;
}
