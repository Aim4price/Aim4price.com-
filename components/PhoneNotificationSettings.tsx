'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PUSH_APPS, PUSH_CATEGORIES, DEFAULT_PUSH_PREFERENCES, type PushApp, type PushCategory, type PushPreferences, type AccountPushPreferences } from '../lib/push-policy';
import styles from './PhoneNotificationSettings.module.css';
export default function PhoneNotificationSettings({ app, modal = false }: { app: PushApp; modal?: boolean }) {
  const config = PUSH_APPS[app];
  const [preferences,setPreferences] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [categories,setCategories] = useState<PushCategory[]>([]);
  const [enabled,setEnabled] = useState(false);
  const [accountSettings,setAccountSettings] = useState<AccountPushPreferences>({enabled:true,preferences:DEFAULT_PUSH_PREFERENCES});
  const [publicKey,setPublicKey] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const [error,setError] = useState('');
  const [support,setSupport] = useState<'ready'|'install'|'unsupported'|'blocked'>('ready');
  const api = useCallback(async (body?: object) => {
    const response = await fetch('/api/app-notifications',{method:body?'POST':'GET',credentials:'include',cache:'no-store',
      headers:{'Content-Type':'application/json','x-aim4price-client-realm':app},body:body?JSON.stringify(body):undefined});
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Please try again.');
    return payload;
  },[app]);
  const load = useCallback(async () => {
    setLoading(true);setError('');
    try {
      const data = await api();
      setPreferences(data.preferences);setAccountSettings(data.accountSettings);setCategories(data.categories);setPublicKey(data.publicKey);
      let active = false;
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.getRegistration(config.root);
        active = Boolean(await registration?.pushManager.getSubscription());
      }
      setEnabled(Boolean(data.enabled && active && 'Notification' in window && Notification.permission === 'granted'));
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & {standalone?:boolean}).standalone);
      setSupport(ios && !standalone ? 'install' : !('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)
        ? 'unsupported' : Notification.permission === 'denied' ? 'blocked' : 'ready');
    } catch(e) {setError((e as Error).message);} finally {setLoading(false);}
  },[api,config.root]);
  useEffect(()=>{void load();},[load]);
  async function togglePhone() {
    if(busy)return;setBusy(true);setError('');setMessage('');
    try {
      if (enabled) {
        await api({action:'disable'});
        setEnabled(false);
        const registration=await navigator.serviceWorker.getRegistration(config.root);
        await (await registration?.pushManager.getSubscription())?.unsubscribe();
        setMessage('Phone notifications off.');
      } else {
        // Permission request stays directly inside the user's tap for iOS.
        const permission=await Notification.requestPermission();
        if(permission!=='granted') {setSupport(permission==='denied'?'blocked':'ready');throw new Error('Allow notifications to receive phone alerts.');}
        const registration=await navigator.serviceWorker.register(config.worker,{scope:config.root,updateViaCache:'none'});
        if(!registration.active) await new Promise<void>((resolve,reject)=>{
          const worker=registration.installing||registration.waiting;
          const timer=setTimeout(()=>reject(new Error('Please try again once the app is ready.')),10000);
          if(!worker){clearTimeout(timer);resolve();return;}
          worker.addEventListener('statechange',()=>{if(worker.state==='activated'){clearTimeout(timer);resolve();}});
        });
        // New subscription on each explicit enable prevents retaining a previous account's binding.
        await (await registration.pushManager.getSubscription())?.unsubscribe();
        const key=Uint8Array.from(atob(publicKey.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));
        const subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
        try {await api({action:'enable',subscription:subscription.toJSON()});}
        catch(e){await subscription.unsubscribe();throw e;}
        const confirmed = await api();
        if (!confirmed.enabled) { await subscription.unsubscribe(); throw new Error('Phone registration was not saved. Sign in again and retry.'); }
        setEnabled(true);setMessage('Phone notifications on.');
      }
    } catch(e){setError((e as Error).message);} finally {setBusy(false);}
  }
  async function toggleCategory(category:PushCategory) {
    if(busy)return;setBusy(true);setError('');setMessage('');
    const next={...preferences,[category]:!preferences[category]};
    try{await api({action:'preferences',preferences:next});setPreferences(next);setMessage('Saved.');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function test(){setBusy(true);setError('');setMessage('');try{await api({action:'test'});setMessage('Test notification sent.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className={modal?styles.modalPanel:styles.panel} aria-busy={loading||busy}>
    {!modal ? <><img className={styles.logo} src="/brand/aim4price-mark-white.png" alt="Aim4price" /><h1>Notifications</h1></> : null}
    {loading?<p role="status">Loading notifications…</p>:<>
      <button type="button" role="switch" aria-checked={enabled} className={styles.row} disabled={busy||!publicKey||(!enabled&&(support!=='ready'||!accountSettings.enabled))} onClick={()=>void togglePhone()}>
        <span>Phone alerts</span><span className={enabled?styles.on:styles.off}>{enabled?'On':'Off'}</span>
      </button>
      {support==='install'?<p>Add to Home Screen, then open the app.</p>:null}
      {support==='blocked'?<p>Allow notifications in your phone settings.</p>:null}
      {support==='unsupported'?<p>Phone alerts aren’t supported in this browser.</p>:null}
      {support!=='ready'?<button type="button" className={styles.button} disabled={busy} onClick={()=>void load()}>Check again</button>:null}
      {!accountSettings.enabled ? <p>Alerts are off in Desktop settings.</p> : null}
      <div className={styles.categories}>
        {categories.map(category=><button key={category} type="button" className={styles.row} role="switch" aria-checked={preferences[category]&&accountSettings.enabled&&accountSettings.preferences[category]} disabled={busy||!accountSettings.enabled||!accountSettings.preferences[category]} onClick={()=>void toggleCategory(category)}>
          <span>{PUSH_CATEGORIES[category]}{!accountSettings.preferences[category]?<small className={styles.managed}>Off in Desktop</small>:null}</span><span className={preferences[category]&&accountSettings.enabled&&accountSettings.preferences[category]?styles.on:styles.off}>{preferences[category]&&accountSettings.enabled&&accountSettings.preferences[category]?'On':'Off'}</span>
        </button>)}
      </div>
      <button className={styles.button} type="button" onClick={()=>void test()} disabled={busy||!enabled||!accountSettings.enabled}>Send test notification</button>
      {!enabled && support==='ready' && accountSettings.enabled ? <p>Turn on Phone alerts to send a test.</p> : null}
      {!modal ? <Link className={styles.button} href={config.root+'/notifications'}>View notifications</Link> : null}
    </>}
    {message ? <p role="status" className={styles.message}>{message}</p> : null}
    {error?<div role="alert"><p>{error}</p><button type="button" className={styles.button} disabled={busy} onClick={()=>void load()}>Try again</button></div>:null}
  </section>;
}
