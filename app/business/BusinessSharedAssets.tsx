'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';
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

export default function BusinessSharedAssets({shares,notice}:{shares:Share[];notice:string}) {
  const router = useRouter();
  const [refreshing,startTransition] = useTransition();
  const [status,setStatus] = useState<SharedStatus>('all');
  const [query,setQuery] = useState('');
  const [kind,setKind] = useState('All');
  const [filters,setFilters] = useState(false);
  const [open,setOpen] = useState<Set<string>>(new Set());
  useEffect(()=>{
    const refresh = () => router.refresh();
    refresh();
    window.addEventListener('pageshow',refresh);
    window.addEventListener('focus',refresh);
    return () => {window.removeEventListener('pageshow',refresh);window.removeEventListener('focus',refresh);};
  },[router]);
  const members = shares.flatMap(share=>share.assets);
  const viewed = members.filter(member=>member.viewed).length;
  const needle = query.trim().toLowerCase();
  const rows = shares.flatMap(share=>{
    const group = Boolean(share.umbrella) || share.assets.length > 1;
    if ((kind==='Umbrellas' && !group) || (kind==='Individual assets' && group)) return [];
    const assets = share.assets.filter(item=>
      (status==='all' || item.viewed===(status==='viewed')) &&
      [share.sender,share.umbrella,item.title,item.serial].some(field=>field?.toLowerCase().includes(needle)));
    return assets.length ? [{share,assets,group}] : [];
  });
  function memberCard(share:Share,item:Share['assets'][number],date:string) {
    const href = '/asset-share/'+share.token+'?open=1'+(item.id ? '&asset='+encodeURIComponent(item.id)+'#asset-'+item.id : '');
    return <article key={item.id || item.title} className={card.frame}><RecipientAssetSummary title={item.title} sender={share.sender} date={date}
      pills={item.serial ? [item.serial] : []} action={<Link prefetch={false} href={href} className={card.toggle} aria-label={'Open '+item.title}>Open</Link>}/></article>;
  }
  return <main className={`${asset.page} ${workspaceStyles.page} ${lead.leadsPage} ${lead.dealerOwnerParity} ${lead.dealerDesktopLeads}`}>
    <section className={`${asset.shell} ${workspaceStyles.shell}`}><section id="received-enquiries" className={`${asset.registerPanel} ${lead.leadsRegisterPanel}`}>
      <WorkspaceTitlePanel title="Shared Assets" helpTopic="sharedEnquiries"/>
      {notice ? <p role="status" className={asset.notice}>{notice}</p> : <>
        <SharedAssetStatus statusFilter={status} chooseLeadStatusFilter={setStatus} newLeadCount={members.length-viewed} viewedLeadCount={viewed} total={members.length}/>
        <div className={`${asset.toolbar} ${workspaceStyles.controlsRow} ${lead.leadSearchToolbar}`}>
          <label className={`${asset.searchWrap} ${workspaceStyles.searchField}`}><input className={asset.searchInput} type="search" value={query} onChange={e=>setQuery(e.target.value)} aria-label="Search shared assets" placeholder="Search sender, umbrella, asset or serial"/></label>
          <div className={lead.leadToolbarActions}><button type="button" className={`${card.toggle} ${card.secondary}`} disabled={refreshing} onClick={()=>startTransition(()=>router.refresh())}>{refreshing?'Refreshing…':'Refresh'}</button>
            <button type="button" className={`${card.toggle} ${card.secondary}`} aria-expanded={filters} aria-controls="share-filters" onClick={()=>setFilters(!filters)}>Filter{kind==='All'?'':' · '+kind}</button></div>
        </div>
        {filters && <div id="share-filters" role="group" aria-label="Filter by share type" className={card.actions}>{['All','Individual assets','Umbrellas'].map(type=><button type="button" key={type} aria-pressed={kind===type} className={`${card.toggle} ${kind===type?'':card.secondary}`} onClick={()=>setKind(type)}>{type}</button>)}</div>}
        <div className={lead.leadStack}>{rows.map(({share,assets,group})=>{
          const date=receivedDate.format(new Date(share.created_at));
          if (!group) return <div key={share.token}>{memberCard(share,assets[0],date)}</div>;
          const expanded=open.has(share.token);
          const panelId='group-'+share.token;
          const toggle=()=>setOpen(previous=>{const next=new Set(previous);if(next.has(share.token))next.delete(share.token);else next.add(share.token);return next;});
          return <div key={share.token} className={asset.assetList}><div className={card.frame}>
            <SharedUmbrellaSummary title={share.title} titles={assets.map(member=>member.title)} sender={share.sender} date={date} expanded={expanded} toggle={toggle} panelId={panelId}/>
          </div><div id={panelId} hidden={!expanded} className={asset.assetList}>{expanded && assets.map((member,i)=><div key={member.id || i} className={`${asset.assetCardRow} ${asset.assetGroupMemberRow}`}>{memberCard(share,member,date)}</div>)}</div></div>;
        })}</div>
        {!rows.length && <p className={asset.emptyState}>{shares.length?'No assets match your search or filters.':'Assets shared with your business will appear here.'}</p>}
      </>}
    </section></section>
  </main>;
}
