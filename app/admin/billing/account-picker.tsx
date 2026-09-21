'use client';
import { useId, useRef, useState } from 'react';
import styles from './page.module.css';
export default function AccountPicker({clients,value,disabled,onChange}:{clients:{userId:string;name:string;email:string}[];value:string;disabled:boolean;onChange:(id:string)=>void}) {
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const id=useId(),trigger=useRef<HTMLButtonElement>(null);
 const selected=clients.find(client=>client.userId===value);
 const matches=clients.filter(client=>`${client.name} ${client.email}`.toLowerCase().includes(search.trim().toLowerCase()));
 function choose(id:string){onChange(id);setOpen(false);setSearch('');trigger.current?.focus();}
 return <div className={styles.picker} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
  <span className={styles.pickerLabel}>Account</span><button ref={trigger} className={styles.pickerTrigger} aria-label="Choose billing account" aria-expanded={open} aria-controls={id} disabled={disabled} onClick={()=>setOpen(!open)}><span><strong>{selected?.name||'All accounts'}</strong><small>{selected?.email||'Choose an account to create an invoice'}</small></span><span aria-hidden="true">⌄</span></button>
  {open?<div id={id} className={styles.pickerMenu} role="region" aria-label="Billing accounts"><input autoFocus type="search" aria-label="Search billing accounts" placeholder="Search name or email…" value={search} onChange={event=>setSearch(event.target.value)}/><div className={styles.pickerOptions}><button aria-pressed={!value} onClick={()=>choose('')}>All accounts</button>{matches.map(client=><button key={client.userId} aria-pressed={value===client.userId} onClick={()=>choose(client.userId)}><strong>{client.name}</strong><small>{client.email}</small></button>)}{!matches.length?<p>No matching accounts.</p>:null}</div></div>:null}
 </div>;
}
