'use client';
import AdminSelect from "../../../components/AdminSelect";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SharingSettings from './settings';
import styles from './sharing.module.css';
type Account={user_id:string;name:string;email:string;plan:string;account_status:string;assets:number;opens:number;uploads:number;bytes:string;contributions:number;emails:number;failed:number;sessions:number;last_activity:string|null};
const size=(bytes:string)=>{const n=Number(bytes);return n>=1048576?`${(n/1048576).toFixed(1)} MB`:n>=1024?`${(n/1024).toFixed(1)} KB`:`${n} B`;};
const activityDate = new Intl.DateTimeFormat('en-GB', {
 day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', timeZone:'Africa/Johannesburg',
});
export default function SharingUsage({accounts,period,adminId}:{accounts:Account[];period:'month'|'all';adminId:string}) {
 const [search,setSearch]=useState(''),[plan,setPlan]=useState('all'),[selected,setSelected]=useState<string|null>(null),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const router=useRouter();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(selected)dialog.current?.showModal();},[selected]);
 const visible=accounts.filter(a=>(plan==='all'||a.plan===plan)&&`${a.name} ${a.email}`.toLowerCase().includes(search.toLowerCase()));
 const account=accounts.find(a=>a.user_id===selected);
 async function signOut(){if(!account||busy)return;setBusy(true);setNotice('');try{const response=await fetch('/api/admin/sharing',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'sign-out',userId:account.user_id})});const result=await response.json();if(!response.ok)throw Error(result.error);setNotice('User signed out. Their account and usage history are unchanged.');setConfirm(false);router.refresh();}catch(error){setNotice(error instanceof Error?error.message:'Please try again.');}finally{setBusy(false);}}
 return <>
  <section className={styles.panel} aria-label="Account usage">
   <header className={styles.tableHeading}>
    <h2>Account activity</h2>
    <nav aria-label="Usage period" className={styles.period}><Link aria-current={period==='month'?'page':undefined} href="/admin/sharing">This month</Link><Link aria-current={period==='all'?'page':undefined} href="/admin/sharing?period=all">All time</Link></nav>
   </header>
   <div className={styles.toolbar}>
    <label>Find an account<input type="search" placeholder="Business name or email" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <label>Account access<AdminSelect value={plan} onChange={e=>setPlan(e.target.value)}>
     <option value="all">All accounts</option><option value="free">Free sharing</option><option value="paid-business">Paid Business</option><option value="desktop">Desktop</option>
    </AdminSelect></label>
   </div>
   <div className={styles.resultCount} aria-live="polite">{visible.length} {visible.length===1?'account':'accounts'}</div>
   <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Account activity results">
    <table><thead><tr><th>Account</th><th>Access</th><th>Assets received</th><th>Link opens</th><th>Changes</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead>
     <tbody>{visible.map(a=><tr key={a.user_id}>
      <td><strong>{a.name||a.email}</strong>{a.name && a.name!==a.email && <small>{a.email}</small>}</td>
      <td><span className={styles.plan}>{a.plan==='free'?'Free sharing':a.plan==='paid-business'?'Paid Business':'Desktop'}</span></td>
      <td>{a.assets}</td><td>{a.opens}</td><td>{a.contributions}</td>
      <td><button className={styles.button} aria-haspopup="dialog" onClick={()=>{setSelected(a.user_id);setConfirm(false);setNotice('');}}>View activity</button></td>
     </tr>)}</tbody>
    </table>
   </div>
   {!visible.length&&<p className={styles.empty}>No accounts match your search.</p>}
  </section>
  {account&&<dialog ref={dialog} className={styles.manage} aria-label="Manage sharing account" onCancel={()=>setSelected(null)}><div className={styles.manageHeading}><div><h2>{account.name||account.email}</h2><p>{account.email}</p></div><button className={styles.button} onClick={()=>setSelected(null)} data-modal-close="true" aria-label="Close dialog">Close</button></div>
   <section className={styles.activitySummary}>
    <h3>{period==='month'?'This month':'All time'}</h3>
    <dl className={styles.metrics}>
     <div><dt>Assets received</dt><dd>{account.assets}</dd></div>
     <div><dt>Link opens</dt><dd>{account.opens}</dd></div>
     <div><dt>Changes</dt><dd>{account.contributions}</dd></div>
     <div><dt>Uploads</dt><dd>{account.uploads}</dd></div>
     <div><dt>Uploaded size</dt><dd>{size(account.bytes)}</dd></div>
     <div><dt>Emails sent</dt><dd>{account.emails}</dd></div>
    </dl>
    {account.failed>0 && <p className={styles.failed}>Failed emails · {account.failed}</p>}
   </section>
   <dl className={styles.sessionInfo}>
    <div><dt>Last sharing activity</dt><dd>{account.last_activity?activityDate.format(new Date(account.last_activity)):'None yet'}</dd></div>
    <div><dt>Current website sessions</dt><dd>{account.sessions}</dd></div>
   </dl>
   <div className={styles.actions}><div><h3>Sign out user</h3><p>End their website sessions. They can sign in again.</p></div>{account.user_id!==adminId?<button className={styles.button} disabled={busy} onClick={()=>setConfirm(true)}>Sign out user</button>:<span>Your current account</span>}</div>
   {confirm&&<div className={styles.confirm}><p>Sign out <strong>{account.email}</strong> on all website browsers?</p><button className={styles.danger} disabled={busy} onClick={()=>void signOut()}>{busy?'Signing out…':'Confirm sign out'}</button><button className={styles.button} disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button></div>}
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
   {account.plan==='free'&&<details className={styles.upgrade}><summary>Activate Desktop after subscription</summary><SharingSettings accountId={account.user_id}/></details>}
  </dialog>}
 </>;
}
