'use client';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import styles from './page.module.css';
type Client={userId:string;name:string;email:string;accountType?:string};
const initials=(name:string)=>name.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join('').toUpperCase()||'?';
export default function AccountPicker({clients,value,disabled,onChange}:{clients:Client[];value:string;disabled:boolean;onChange:(id:string)=>void}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),root=useRef<HTMLDivElement>(null),input=useRef<HTMLInputElement>(null);
 const selected=clients.find(client=>client.userId===value);
 const terms=search.trim().toLowerCase().split(/\s+/).filter(Boolean);
 const matches=clients.filter(client=>terms.every(term=>`${client.name} ${client.email} ${client.accountType??''}`.toLowerCase().includes(term)));
 useEffect(()=>{if(!open)return;const close=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node)){setOpen(false);setSearch('');}};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
 function close(){setOpen(false);setSearch('');}
 function choose(id:string){onChange(id);close();trigger.current?.focus();}
 function keys(event:KeyboardEvent<HTMLDivElement>){
  if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close();trigger.current?.focus();return;}
  if(!open){if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();setOpen(true);}return;}
  const options=Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[data-account-option]')??[]);
  const index=options.indexOf(document.activeElement as HTMLButtonElement);
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();const next=index<0?(event.key==='ArrowDown'?0:options.length-1):Math.max(0,Math.min(options.length-1,index+(event.key==='ArrowDown'?1:-1)));
   options[next]?.focus();options[next]?.scrollIntoView({block:'nearest'});
  }else if(index>=0&&(event.key==='Home'||event.key==='End')){event.preventDefault();const next=event.key==='Home'?0:options.length-1;options[next]?.focus();}
  else if(event.key==='Enter'&&document.activeElement===input.current&&matches.length===1){event.preventDefault();choose(matches[0].userId);}
 }
 const chevron=<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
 const check=<svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
 return <div ref={root} className={styles.picker} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))close();}} onKeyDown={keys}>
  <span className={styles.pickerLabel}>Billing account</span>
  <button type="button" ref={trigger} className={styles.pickerTrigger} aria-label="Choose billing account" aria-expanded={open} aria-controls={open?id:undefined} disabled={disabled} onClick={()=>{if(open)close();else setOpen(true);}}>
   <span className={styles.accountAvatar} aria-hidden="true">{selected?initials(selected.name):'All'}</span>
   <span className={styles.accountIdentity}><strong>{selected?.name||'All accounts'}</strong><small>{selected?.email||'View invoices across all accounts'}</small></span>
   <span className={styles.pickerChevron} data-open={open}>{chevron}</span>
  </button>
  {open?<div id={id} className={styles.pickerMenu} role="region" aria-label="Billing accounts">
   <div className={styles.pickerSearch}><svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.7"/><path d="m12 12 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg><input ref={input} autoFocus type="search" aria-label="Search billing accounts" placeholder="Search name, email or account type" value={search} onChange={event=>setSearch(event.target.value)}/>{search?<button type="button" className={styles.clearSearch} aria-label="Clear account search" onClick={()=>{setSearch('');input.current?.focus();}}>×</button>:null}</div>
   <div className={styles.pickerOptions}>
    <button type="button" data-account-option aria-pressed={!value} className={styles.allAccountsOption} onClick={()=>choose('')}><span className={styles.accountAvatar} aria-hidden="true">All</span><span className={styles.accountIdentity}><strong>All accounts</strong><small>View all invoices</small></span>{!value?<span className={styles.selectedCheck}>{check}</span>:null}</button>
    <p className={styles.pickerResultCount} role="status">{matches.length} {matches.length===1?'account':'accounts'}{search?' found':''}</p>
    {matches.map(client=><button type="button" data-account-option key={client.userId} aria-pressed={value===client.userId} onClick={()=>choose(client.userId)}><span className={styles.accountAvatar} aria-hidden="true">{initials(client.name)}</span><span className={styles.accountIdentity}><strong>{client.name}</strong><small>{client.email}</small>{client.accountType?<span className={styles.accountType}>{client.accountType.replace(/[_-]/g,' ')}</span>:null}</span>{value===client.userId?<span className={styles.selectedCheck}>{check}</span>:null}</button>)}
    {!matches.length?<div className={styles.pickerEmpty}><strong>No matching accounts.</strong><p>Try another name or email address.</p></div>:null}
   </div>
  </div>:null}
 </div>;
}
