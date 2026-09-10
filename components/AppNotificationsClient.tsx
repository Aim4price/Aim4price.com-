'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PUSH_APPS, PUSH_CATEGORIES, type PushApp } from '../lib/push-policy';
import type { PushEvent } from '../lib/push-events';
import styles from '../app/owner-app/owner-app.module.css';
import local from './AppNotifications.module.css';
export default function AppNotificationsClient({app}:{app:Exclude<PushApp,'owner'>}) {
  const [items,setItems]=useState<PushEvent[]>([]),[view,setView]=useState<'active'|'history'>('active');
  const [category,setCategory]=useState('all'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const requestVersion=useRef(0);
  const load=useCallback(async()=>{
    const version=++requestVersion.current;
    try {
      const r=await fetch('/api/app-notifications/inbox',{cache:'no-store',credentials:'include',headers:{'x-aim4price-client-realm':app}});
      const data=await r.json();
      if(r.status===401){window.location.replace(PUSH_APPS[app].root+'/login');return;}
      if(!r.ok||!data.ok||data.app!==app)throw Error(data.error||'Could not load notifications.');
      if(version===requestVersion.current){setItems(data.notifications);setError('');}
    }catch(e){if(version===requestVersion.current)setError(e instanceof Error?e.message:'Could not load notifications.');}
    finally{if(version===requestVersion.current)setLoading(false);}
  },[app]);
  useEffect(()=>{
    if(new URLSearchParams(window.location.search).get('category')==='listings')setCategory('listings');
    void load();const refresh=()=>{if(document.visibilityState==='visible')void load();};
    const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{requestVersion.current++;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[load]);
  async function mark(ids:string[]) {
    if(busy)return;setBusy(true);setError('');requestVersion.current++;
    try{
      for(let i=0;i<ids.length;i+=250){
        const r=await fetch('/api/app-notifications/inbox',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json','x-aim4price-client-realm':app},body:JSON.stringify({action:'mark_read',notificationIds:ids.slice(i,i+250)})});
        if(!r.ok)throw Error('Could not mark notifications read. Please try again.');
      }
      setItems(current=>current.map(item=>ids.includes(item.id)?{...item,isRead:true}:item));
      window.dispatchEvent(new Event('aim4price-notifications-updated'));
    }catch(e){setError(e instanceof Error?e.message:'Could not update notifications.');}
    finally{setBusy(false);}
  }
  const active=items.filter(item=>!item.isRead),history=items.filter(item=>item.isRead);
  const visible=(view==='active'?active:history).filter(item=>category==='all'||item.category===category);
  return <div className={`${styles.content} ${styles.notificationContent}`}>
    <section className={styles.notificationIntro}><div className={styles.ownerPageIntro}><h1 className={styles.ownerPageTitle}>Notifications</h1><p className={styles.ownerPageSubtitle}>Opportunities and updates.</p></div></section>
    <section className={styles.notificationWorkspace} aria-label="Notification controls">
      <div className={`${styles.notificationTabs} ${styles.notificationTabsTwo}`}>
        <button type="button" aria-pressed={view==='active'} className={view==='active'?styles.notificationTabActive:''} onClick={()=>setView('active')}>Active <strong>{active.length}</strong></button>
        <button type="button" aria-pressed={view==='history'} className={view==='history'?styles.notificationTabActive:''} onClick={()=>setView('history')}>History <strong>{history.length}</strong></button>
      </div>
      <label className={local.filter}>Show<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All updates</option>{Object.entries(PUSH_CATEGORIES).filter(([key])=>items.some(item=>item.category===key)).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      {view==='active'&&visible.length>0?<div className={styles.notificationBulkActions}><button type="button" disabled={busy} onClick={()=>void mark(visible.map(item=>item.id))}>{busy?'Saving…':'Mark shown as read'}</button></div>:null}
    </section>
    {error?<p className={local.error} role="alert">{error} <button type="button" onClick={()=>void load()}>Retry</button></p>:null}
    <section className={styles.notificationSection} aria-label="Notifications" aria-busy={loading}>
      {loading?<p className={styles.notificationEmpty}>Loading notifications…</p>:visible.length?<div className={styles.notificationList}>
        {visible.map(item=><article key={item.id} className={`${styles.notificationCard} ${item.isRead?styles.notificationCardHistory:styles.notificationCardNew}`}>
          <time className={styles.notificationCardTime} dateTime={item.createdAtIso}>{new Date(item.createdAtIso).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time>
          <h3>{item.title}</h3><p>{item.body}</p>
          <div className={local.actions}><Link href={item.href} prefetch={false}>Open</Link>{!item.isRead?<button type="button" disabled={busy} onClick={()=>void mark([item.id])}>Mark read</button>:null}</div>
        </article>)}
      </div>:<p className={styles.notificationEmpty}>{view==='active'?'You’re all caught up.':'Read notifications will appear here.'}</p>}
    </section>
  </div>;
}
