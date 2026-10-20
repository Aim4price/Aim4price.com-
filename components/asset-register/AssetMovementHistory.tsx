'use client';
import DateInput from '../DateInput';
import DeleteAllHistoryDialog,{HistoryDeleteIcon} from './DeleteAllHistoryDialog';
import {useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import AssetLocationHistoryMap from './AssetLocationHistoryMap';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import {createPortal} from '../WebsitePortal';
import ReportDownloadFlow from '../ReportDownloadFlow';
import {downloadAssetMapReport} from '../../lib/asset-map-download';
import type {MovementReport} from '../../lib/asset-movement-report';
import type {TrackingJourney as TrackingSessionEntry} from '../../lib/asset-tracking-journeys';
type TrackingSessionPage={items:TrackingSessionEntry[];nextBefore:string|null;snapshotAt:string};
import styles from './AssetTrackingPanel.module.css';
import historyStyles from './AssetLocationHistoryDialog.module.css';
const date=(v:string)=>new Date(v).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
const dayLabel=(v:string)=>new Date(v+'T12:00:00+02:00').toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg',day:'numeric',month:'long',year:'numeric'});
const time=(v:string)=>new Date(v).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'});
function Icon({type}:{type:'route'|'download'|'delete'|'refresh'|'calendar'}){return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{type==='calendar'?<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18M8 15h2m4 0h2m-8 3h2"/></>:type==='route'?<><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8"/></>:<path d={type==='download'?'M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4':type==='delete'?'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6':'M3 12a9 9 0 0 1 9-9c2.5 0 4.9 1 6.7 2.8L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9c-2.5 0-4.9-1-6.7-2.8L3 16M8 16H3v5'}/>}</svg>;}
type SelectedEntry={entry:TrackingSessionEntry;snapshotAt:string};
export default function AssetMovementHistory({assetId,title='Asset',historyTabs}:{assetId:string;title?:string;historyTabs?:ReactNode}){
 const [from,setFrom]=useState(()=>new Date(Date.now()-6*86400000+7200000).toISOString().slice(0,10)),[to,setTo]=useState(()=>new Date(Date.now()+7200000).toISOString().slice(0,10));
 const [page,setPage]=useState<TrackingSessionPage|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 const [expanded,setExpanded]=useState<SelectedEntry|null>(null),[exportEntry,setExportEntry]=useState<SelectedEntry|null>(null),[deleteEntry,setDeleteEntry]=useState<SelectedEntry|null>(null);
 const [deleteAllSnapshot,setDeleteAllSnapshot]=useState<string|null>(null);
 const [deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState(''),[loadingMore,setLoadingMore]=useState(false);
 const generation=useRef(0),moreAbort=useRef<AbortController|null>(null);
 const endpoint=`/api/asset-register/${encodeURIComponent(assetId)}/tracking/history`;
 const url=`${endpoint}?${new URLSearchParams({view:'journeys',from,to})}`;
 useEffect(()=>{const c=new AbortController();generation.current++;moreAbort.current?.abort();setLoadingMore(false);setBusy(true);setError('');
  fetch(url,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load tracking history.');if(!c.signal.aborted)setPage(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>{c.abort();moreAbort.current?.abort();};
 },[url,revision]);
 useEffect(()=>{if(expanded||deleteEntry||deleteAllSnapshot||exportEntry||loadingMore||(page?.items.length||0)>30)return;const timer=setInterval(()=>{if(document.visibilityState==='visible')setRevision(n=>n+1);},60000);return()=>clearInterval(timer);},[expanded,deleteEntry,deleteAllSnapshot,exportEntry,loadingMore,page?.items.length]);
 function changeDates(value:string,which:'from'|'to'){setPage(null);setExpanded(null);if(which==='from')setFrom(value);else setTo(value);}
 async function loadMore(){
  if(!page?.nextBefore||loadingMore)return;const current=generation.current,c=new AbortController();moreAbort.current=c;setLoadingMore(true);setError('');
  try{const r=await fetch(url+'&'+new URLSearchParams({before:page.nextBefore,snapshotAt:page.snapshotAt}),{signal:c.signal,cache:'no-store'}),d:TrackingSessionPage&{error?:string}=await r.json();if(!r.ok)throw Error(d.error||'Could not load earlier entries.');if(current===generation.current&&!c.signal.aborted)setPage(previous=>previous?{...d,items:[...previous.items,...d.items]}:d);}
  catch(e){if(!c.signal.aborted)setError(e instanceof Error?e.message:'Please try again.');}finally{if(current===generation.current)setLoadingMore(false);}
 }
 const entryUrl=(selected:SelectedEntry)=>`${endpoint}?${new URLSearchParams({from:selected.entry.from,to:selected.entry.to,deviceId:selected.entry.deviceId,sessionId:selected.entry.sessionId,startAt:selected.entry.startAt,endAt:selected.entry.endAt,...(selected.entry.contextAt?{contextAt:selected.entry.contextAt}:{}),snapshotAt:selected.snapshotAt})}`;
 async function confirmDelete(){
  if(!deleteEntry||deleting)return;setDeleting(true);setDeleteError('');
  try{const r=await fetch(entryUrl(deleteEntry),{method:'DELETE'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not delete this entry.');setPage(null);setExpanded(null);setDeleteEntry(null);setRevision(n=>n+1);}
  catch(e){setDeleteError(e instanceof Error?e.message:'Please try again.');}finally{setDeleting(false);}
 }
 return <section className={historyStyles.trackingHistory} aria-label="Saved tracking history">
  {exportEntry&&createPortal(<ReportDownloadFlow title="Download tracking report" allLabel={title} assets={[{id:assetId,title,meta:`Tracking · ${date(exportEntry.entry.firstCapturedAt)} – ${date(exportEntry.entry.lastCapturedAt)}`}]} lockedAssetId={assetId} skipTimeline instantDownload onClose={()=>setExportEntry(null)} onDownload={selection=>downloadAssetMapReport(entryUrl(exportEntry)+'&format='+selection.format,selection.format)}/>,document.body)}
  {deleteAllSnapshot&&<DeleteAllHistoryDialog title={title} kind="tracking" endpoint={endpoint} snapshotAt={deleteAllSnapshot} onClose={()=>setDeleteAllSnapshot(null)} onDeleted={()=>{generation.current++;moreAbort.current?.abort();setLoadingMore(false);setPage(null);setExpanded(null);setDeleteAllSnapshot(null);setRevision(n=>n+1);}}/>}
  {deleteEntry&&<AssetAccessSettingsDialog locationLayout title="Delete tracking record?" assetTitle={title} onClose={()=>{if(!deleting)setDeleteEntry(null);}}><div className={historyStyles.deleteConfirm}>
   <span className={historyStyles.deleteIcon}><Icon type="delete"/></span><strong>Delete this tracking record?</strong>
   <div className={historyStyles.deleteRecord}><strong>{dayLabel(deleteEntry.entry.day)}</strong><span>{deleteEntry.entry.readings.toLocaleString()} readings · {time(deleteEntry.entry.firstCapturedAt)} – {time(deleteEntry.entry.lastCapturedAt)}</span></div>
   <p>These readings will be removed from tracking history and reports.<br/>Your connected phone, current map position and new readings stay unchanged.</p>
   {deleteError&&<p role="alert" className={historyStyles.deleteError}>{deleteError}</p>}
   <div className={historyStyles.confirmActions}><button type="button" disabled={deleting} onClick={()=>setDeleteEntry(null)}>Cancel</button><button type="button" className={historyStyles.deleteButton} disabled={deleting} onClick={()=>void confirmDelete()}>{deleting?'Deleting…':'Delete entry'}</button></div>
  </div></AssetAccessSettingsDialog>}
  <div className={historyStyles.historyToolbar}><div className={historyStyles.filters}><label>From<DateInput value={from} max={to||undefined} onValueChange={value=>changeDates(value,'from')}/></label><label>To<DateInput value={to} min={from||undefined} onValueChange={value=>changeDates(value,'to')}/></label></div>{historyTabs}</div>
  <div className={historyStyles.trackingListHeading}><div className={historyStyles.recordedHeading}><h3>Journeys & stops {page&&<span className={historyStyles.dayCount}>{page.items.length}{page.nextBefore?'+':''}</span>}</h3><p>Newest first · South African time</p></div><div className={historyStyles.historyActions}><button type="button" className={historyStyles.deleteAllAction} disabled={busy||loadingMore||!!error||!page?.snapshotAt} aria-haspopup="dialog" aria-label="Delete all tracking history" onClick={()=>{if(page)setDeleteAllSnapshot(page.snapshotAt);}}><HistoryDeleteIcon/>Delete all</button><button type="button" className={historyStyles.refreshButton} aria-busy={busy||loadingMore} disabled={busy||loadingMore} onClick={()=>{setExpanded(null);setRevision(n=>n+1);}}><span className={historyStyles.refreshIcon}><Icon type="refresh"/></span>{busy||loadingMore?'Refreshing…':'Refresh'}</button></div></div>
  {error&&<p role="alert" className={styles.error}>{error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Try again</button></p>}
  {busy&&!page?<p role="status">Loading tracking history…</p>:page&&<>
   {page.items.length?<ol className={`${historyStyles.list} ${historyStyles.trackingList}`}>{page.items.map((entry,index)=>{
    const selected={entry,snapshotAt:page.snapshotAt},isOpen=expanded?.entry.id===entry.id;
    return <li key={entry.id} data-selected={isOpen} aria-label={`Tracking session ${date(entry.firstCapturedAt)}`}>
     <div className={historyStyles.trackingEntryRow}>
      <div className={historyStyles.trackingEntryIdentity}><span className={historyStyles.sessionNumber}>{index+1}</span><div><strong>{entry.kind==='journey'?'Journey':entry.kind==='stationary'?'Stationary':'Location readings'} · {dayLabel(entry.day)}</strong><span>{entry.readings.toLocaleString()} GPS {entry.readings===1?'point':'points'}{entry.kind==='journey'?' · '+entry.distanceKm.toFixed(2)+' km':''}{entry.gapBeforeSeconds>0?' · '+duration(entry.gapBeforeSeconds)+' GPS gap before this record':''}</span></div></div>
      <dl className={historyStyles.trackingEntryTimes}><div><dt>First point</dt><dd>{time(entry.firstCapturedAt)}</dd></div><div><dt>Last point</dt><dd>{entry.from===entry.to?time(entry.lastCapturedAt):date(entry.lastCapturedAt)}</dd></div></dl>
      <div className={historyStyles.recordActions}>
       <button type="button" className={historyStyles.viewRouteAction} aria-expanded={isOpen} aria-controls={`tracking-route-${entry.id}`} onClick={()=>setExpanded(isOpen?null:selected)}><Icon type="route"/>{isOpen?'Close details':entry.kind==='journey'?'View journey':'View details'}</button>
       <button type="button" aria-haspopup="dialog" aria-label={`Download tracking report ${date(entry.firstCapturedAt)}`} onClick={()=>setExportEntry(selected)}><Icon type="download"/>Download report</button>
       <button type="button" className={`${historyStyles.deleteAction} ${historyStyles.trackingDeleteAction}`} aria-haspopup="dialog" aria-label={`Delete tracking session ${date(entry.firstCapturedAt)}`} title="Delete entry" onClick={()=>{setDeleteError('');setDeleteEntry(selected);}}><Icon type="delete"/></button>
      </div>
     </div>
     {isOpen&&<div id={`tracking-route-${entry.id}`} className={historyStyles.trackingRoute}><TrackingRoute key={entryUrl(expanded)} url={entryUrl(expanded)}/></div>}
    </li>;
   })}</ol>:<div className={historyStyles.empty}><strong>No tracking entries in this period.</strong><p>Choose different dates, or activate the connected phone to start recording.</p></div>}
   <div className={historyStyles.trackingListFooter}><span>Journeys split after 15 minutes stopped. Signal gaps start a separate record. Routes cover the selected dates. Widen the dates if a journey crosses the boundary.</span>{page.nextBefore&&<button type="button" disabled={loadingMore||busy} onClick={()=>void loadMore()}>{loadingMore?'Loading…':'Load earlier entries'}</button>}</div>
  </>}
 </section>;
}
const duration=(seconds:number)=>{const minutes=Math.round(seconds/60);return minutes>=60?`${Math.floor(minutes/60)} h ${minutes%60} min`:`${minutes} min`;};
function TrackingRoute({url}:{url:string}){
 const [report,setReport]=useState<MovementReport|null>(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{const c=new AbortController();setError('');fetch(url,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load this route.');if(!c.signal.aborted)setReport(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[url,retry]);
 const points=useMemo(()=>(report?.readings||[]).map(p=>({...p,label:`${date(p.capturedAt)} · ${p.speedKmh===null?'Speed unavailable':p.speedKmh.toFixed(1)+' km/h'} · Accuracy ${Math.round(p.accuracy)} m`})),[report]);
 const stops=useMemo(()=>(report?.stops||[]).map((s,i)=>({...s,label:`Stop ${i+1} · ${Math.round(s.seconds/60)} min · ${date(s.from)} to ${date(s.to)}`})),[report]);
 if(error)return <p role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></p>;
 if(!report)return <p role="status">Loading route…</p>;
 return <>
  {(report.gapSeconds>0||points.length<2)&&<div className={historyStyles.coverageWarning} role="note"><strong>{points.length<2?'Not enough readings to measure movement':'Partial tracking coverage'}</strong><span>{points.length<2?'One GPS point shows a location, not a journey.':`${duration(report.gapSeconds)} unobserved between usable readings. Distance and time cover recorded portions only.`}</span></div>}
  {points.length>=2&&report.gapSeconds===0&&<p className={historyStyles.coverageGood}>GPS coverage · No gaps detected between these readings</p>}
  <div className={historyStyles.trackingStats}>{[[report.distanceKm.toFixed(2)+' km','Recorded distance'],[duration(report.movingSeconds),'Moving time'],[duration(report.stationarySeconds),'Stationary time'],[report.averageMovingKmh.toFixed(1)+' km/h','Average moving speed']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
  {points.length>0?<AssetLocationHistoryMap points={points} routeSegments={report.segments} stops={stops}/>:<p>No readings remain in this entry. Refresh history.</p>}
  <div className={styles.routeLegend}><span>● Start / End</span><span>● Recorded GPS dots</span><span>● Stops: 15+ minutes</span></div>
  {stops.length>0&&<details><summary>Observed stops ({stops.length})</summary><div className={historyStyles.trackingStops}>{stops.map((s,i)=><p key={s.from}><strong>Stop {i+1} · {Math.round(s.seconds/60)} min</strong><br/>{date(s.from)} – {date(s.to)}</p>)}</div></details>}
  <details className={historyStyles.traceDetails}><summary>Recording details</summary><p>{report.readings.length} usable readings · {report.rejectedReadings||0} excluded readings</p><p>First: {report.readings[0]?date(report.readings[0].capturedAt):'No usable location'}<br/>Last: {report.readings.at(-1)?date(report.readings.at(-1)!.capturedAt):'No usable location'}</p>{report.gaps?.map(g=><p key={g.from}>{date(g.from)} – {date(g.to)} · {g.reason}</p>)}<p>The Excel report includes original coordinates, accuracy, capture/upload times and reading IDs.</p></details>
  <p className={historyStyles.disclaimer}>GPS estimates · {Math.round(report.gapSeconds/60)} minutes unobserved. Moving time is not engine or working hours. Lines join recorded dots; missing periods and separate sessions are not joined.{points.length>5000?' The map samples dots; reports retain all readings.':''}</p>
 </>;
}
