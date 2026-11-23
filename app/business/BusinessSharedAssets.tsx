'use client';
import FilterFlow, {FilterQuestion} from '../../components/FilterFlow';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState, useTransition, type ReactNode} from 'react';
import type {listReceivedSharedEnquiries} from '../../lib/guest-leads';
import {WorkspaceTitlePanel, workspaceStyles} from '../../components/WorkspacePrimitives';
import RecipientAssetSummary from '../../components/leads/RecipientAssetSummary';
import SharedAssetStatus, {type SharedStatus} from '../../components/leads/SharedAssetStatus';
import SharedUmbrellaSummary from '../../components/leads/SharedUmbrellaSummary';
import asset from '../asset-register/page.module.css';
import lead from '../leads/page.module.css';
import card from '../leads/shared-assets.module.css';

type Share = Awaited<ReturnType<typeof listReceivedSharedEnquiries>>[number];
const receivedDate = new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Johannesburg'});

const defaults = {year: '', month: '', status: 'all' as SharedStatus, kind: 'All'};
const periodFormat = new Intl.DateTimeFormat('en-GB', {month:'2-digit', year:'numeric', timeZone:'Africa/Johannesburg'});
const monthNames = new Intl.DateTimeFormat('en-GB', {month:'long', timeZone:'UTC'});
const months = Array.from({length:12}, (_, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: monthNames.format(Date.UTC(2000, i, 1)),
}));

export default function BusinessSharedAssets({shares,notice,selection,detail}:{shares:Share[];notice:string;selection?:{token:string;assetId:string};detail?:ReactNode}) {
  const router = useRouter();
  const [refreshing,startTransition] = useTransition();
  const [applied,setApplied] = useState(defaults);
  const [draft,setDraft] = useState<typeof defaults | null>(null);
  const {status, kind} = applied;
  const [query,setQuery] = useState('');
  const [open,setOpen] = useState<Set<string>>(new Set(selection ? [selection.token] : []));
  useEffect(()=>{
    const refresh = () => router.refresh();
    refresh();
    window.addEventListener('pageshow',refresh);
    window.addEventListener('focus',refresh);
    return () => {window.removeEventListener('pageshow',refresh);window.removeEventListener('focus',refresh);};
  },[router]);
  const years = new Set<string>();
  const periodShares = shares.filter(share => {
    const [month, year] = periodFormat.format(new Date(share.created_at)).split('/');
    years.add(year);
    return (!applied.year || applied.year === year) && (!applied.month || applied.month === month);
  });
  const members = periodShares.flatMap(share=>share.assets);
  const viewed = members.filter(member=>member.viewed).length;
  const needle = query.trim().toLowerCase();
  const rows = periodShares.flatMap(share=>{
    const group = Boolean(share.umbrella) || share.assets.length > 1;
    if ((kind==='Umbrellas' && !group) || (kind==='Individual assets' && group)) return [];
    const assets = share.assets.filter(item=>
      (status==='all' || item.viewed===(status==='viewed')) &&
      [share.sender,share.umbrella,item.title,item.serial].some(field=>field?.toLowerCase().includes(needle)));
    return assets.length ? [{share,assets,group}] : [];
  });
  const individualCount = rows.filter(row=>!row.group).length;
  const umbrellaCount = rows.length-individualCount;
  const assetCount = rows.reduce((count,row)=>count+row.assets.length,0);
  function memberCard(share:Share,item:Share['assets'][number],date:string) {
    if (selection?.token === share.token && selection.assetId === item.id) return <div key={item.id}>{detail}</div>;
    const href = item.id ? '/business?'+new URLSearchParams({share:share.token,asset:item.id}) : '/asset-share/'+share.token+'?open=1';
    return <article key={item.id || item.title} className={card.frame}><RecipientAssetSummary title={item.title} sender={share.sender} date={date}
      pills={item.serial ? [item.serial] : []} action={<Link prefetch={false} scroll={false} href={href} className={card.toggle} aria-label={'Open '+item.title}>Open</Link>}/></article>;
  }
  return <main className={`${asset.page} ${workspaceStyles.page} ${lead.leadsPage} ${lead.dealerOwnerParity} ${lead.dealerDesktopLeads}`}>
    <section className={`${asset.shell} ${workspaceStyles.shell}`}><section id="received-enquiries" className={`${asset.registerPanel} ${lead.leadsRegisterPanel}`}>
      <WorkspaceTitlePanel title="Shared Assets" helpTopic="sharedEnquiries"/>
      {notice ? <p role="status" className={asset.notice}>{notice}</p> : <>
        <SharedAssetStatus statusFilter={status} chooseLeadStatusFilter={status=>setApplied(previous=>({...previous,status}))} newLeadCount={members.length-viewed} viewedLeadCount={viewed} total={members.length}/>
        <div className={`${asset.toolbar} ${workspaceStyles.controlsRow} ${lead.leadSearchToolbar}`}>
          <label className={`${asset.searchWrap} ${workspaceStyles.searchField}`}><input className={asset.searchInput} type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search shared assets" placeholder="Search sender, umbrella, asset or serial"/></label>
          <div className={lead.leadToolbarActions}><button type="button" className={`${card.toggle} ${card.secondary}`} disabled={refreshing} onClick={()=>startTransition(()=>router.refresh())}>{refreshing?'Refreshing…':'Refresh'}</button>
            <button type="button" className={`${asset.secondaryButton} ${workspaceStyles.actionButton} ${workspaceStyles.actionMint} ${lead.leadFilterButton} ${asset.filterTriggerButton}`} aria-haspopup="dialog" aria-expanded={draft !== null} onClick={()=>setDraft(applied)}>
              <svg className={asset.buttonIcon} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M6 12h12M9 18h6"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/></svg>
              Filter shared assets
            </button></div>
        </div>
        <div className={`${lead.leadResultSummary} ${lead.leadResultSummaryDealer}`}><strong>{assetCount} shared {assetCount===1?'asset':'assets'} · {individualCount} individual {individualCount===1?'asset':'assets'} · {umbrellaCount} {umbrellaCount===1?'umbrella':'umbrellas'}</strong></div>
        <div className={lead.leadStack}>{rows.map(({share,assets,group})=>{
          const date=receivedDate.format(new Date(share.created_at));
          if (!group) return <div key={share.token}>{memberCard(share,assets[0],date)}</div>;
          const expanded=open.has(share.token);
          const panelId='group-'+share.token;
          const toggle=()=>setOpen(previous=>{const next=new Set(previous);if(next.has(share.token))next.delete(share.token);else next.add(share.token);return next;});
          return <div key={share.token} className={asset.assetList}><div className={`${asset.assetGroupHeaderRow} ${card.frame}`}>
            <SharedUmbrellaSummary title={share.title} titles={assets.map(member=>member.title)} sender={share.sender} date={date} expanded={expanded} toggle={toggle} panelId={panelId}/>
          </div><div id={panelId} hidden={!expanded} className={asset.assetList}>{expanded && assets.map((member,i)=><div key={member.id || i} className={`${asset.assetCardRow} ${asset.assetGroupMemberRow} ${i === assets.length-1 ? asset.assetGroupMemberRowLast : ''}`}>{memberCard(share,member,date)}</div>)}</div></div>;
        })}</div>
        {!rows.length && <p className={asset.emptyState}>{shares.length?'No assets match your search or filters.':'Assets shared with your business will appear here.'}</p>}
      </>}
    </section></section>
    {draft && <FilterFlow overview title="Filter shared assets" onClose={()=>setDraft(null)}
      onClear={()=>{setApplied(defaults);setDraft(defaults);}}
      onApply={()=>{setApplied(draft);setDraft(null);}}>
      <FilterQuestion label="Year" value={draft.year} options={[{value:'',label:'All years'}, ...Array.from(years).sort().reverse().map(year=>({value:year,label:year}))]} onChange={year=>setDraft({...draft,year})}/>
      <FilterQuestion label="Month" value={draft.month} options={[{value:'',label:'All months'}, ...months]} onChange={month=>setDraft({...draft,month})}/>
      <FilterQuestion label="Status" value={draft.status} options={[{value:'all',label:'All shared'},{value:'new',label:'New'},{value:'viewed',label:'Viewed'}]} onChange={status=>setDraft({...draft,status:status as SharedStatus})}/>
      <FilterQuestion label="Share type" value={draft.kind} options={['All','Individual assets','Umbrellas'].map(kind=>({value:kind,label:kind}))} onChange={kind=>setDraft({...draft,kind})}/>
    </FilterFlow>}
  </main>;
}
