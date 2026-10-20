'use client';
import DateInput from '../DateInput';
import DeleteAllHistoryDialog,{HistoryDeleteIcon} from './DeleteAllHistoryDialog';
import AssetMovementHistory from './AssetMovementHistory';
import {useEffect,useMemo,useState,useRef} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import AssetLocationHistoryMap from './AssetLocationHistoryMap';
import ReportDownloadFlow from '../ReportDownloadFlow';
import {createPortal} from '../WebsitePortal';
import {downloadAssetMapReport} from '../../lib/asset-map-download';
import styles from './AssetLocationHistoryDialog.module.css';
type Entry={id:string;latitude:number;longitude:number;note:string;actor:string;accuracy:number|null;recordedAt:string;capturedAt:string|null;source:string};
const date=(value:string)=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
export default function AssetLocationHistoryDialog({assetId,title,onClose,initialTab}:{assetId:string;title:string;onClose:()=>void;initialTab?:'observations'|'movement'}){
 const [snapshotAt,setSnapshotAt]=useState(''),[deleteAllSnapshot,setDeleteAllSnapshot]=useState<string|null>(null);
 const [deleteEntry,setDeleteEntry]=useState<Entry|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 async function confirmDelete(){
  if(!deleteEntry||deleting)return;
  setDeleting(true);setDeleteError('');
  try{
   const response=await fetch(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({entryId:deleteEntry.id})}`,{method:'DELETE'});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Could not delete this entry.');
   setDeleteEntry(null);setSelectedRecord(null);setRetry(value=>value+1);
  }catch(e){setDeleteError(e instanceof Error?e.message:'Please try again.');}finally{setDeleting(false);}
 }
 const records=useRef(new Map<string,HTMLLIElement>());
 const [selectedRecord,setSelectedRecord]=useState<string|null>(null);
 function selectRecord(index:number){const item=items[index];if(!item)return;setSelectedRecord(item.id);const node=records.current.get(item.id);node?.focus({preventScroll:true});const body=node?.closest('[data-location-history]')?.parentElement;if(node&&body)body.scrollTo({top:body.scrollTop+node.getBoundingClientRect().top-body.getBoundingClientRect().top-16,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 const [exportEntry,setExportEntry]=useState<Entry|null>(null);
 const [tab,setTab]=useState<'observations'|'movement'>(initialTab||'observations');
 const [tabChosen,setTabChosen]=useState(Boolean(initialTab));
 useEffect(()=>{if(tabChosen)return;const c=new AbortController();fetch(`/api/asset-register/${encodeURIComponent(assetId)}/tracking`,{signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{if(!c.signal.aborted&&d?.device)setTab('movement');}).catch(()=>{});return()=>c.abort();},[assetId,tabChosen]);
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[truncated,setTruncated]=useState(false),[retry,setRetry]=useState(0),[exportOpen,setExportOpen]=useState(false);
 const points=useMemo(()=>items.map(item=>({latitude:item.latitude,longitude:item.longitude,label:`${date(item.recordedAt)} · ${item.source}${item.note?' · '+item.note:''}`})),[items]);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setItems([]);setSnapshotAt('');
  fetch(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to})}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load location history.');if(controller.signal.aborted)return;setItems(data.items);setTruncated(data.truncated);setSnapshotAt(data.snapshotAt);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
 },[assetId,from,to,retry]);
 const historyTabs=<div className={styles.historyTypeField}><span>History type</span><div className={styles.historySwitch} role="group" aria-label="History type"><button type="button" aria-pressed={tab==='observations'} onClick={()=>{setTabChosen(true);setTab('observations');}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>Saved locations</button><button type="button" aria-pressed={tab==='movement'} onClick={()=>{setTabChosen(true);setTab('movement');}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="M7 5h8a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h8"/></svg>Tracking</button></div></div>;
 if(deleteAllSnapshot)return <DeleteAllHistoryDialog title={title} kind="locations" endpoint={`/api/asset-register/${encodeURIComponent(assetId)}/locations`} snapshotAt={deleteAllSnapshot} onClose={()=>setDeleteAllSnapshot(null)} onDeleted={()=>{setDeleteAllSnapshot(null);setSelectedRecord(null);setItems([]);setRetry(n=>n+1);}}/>;
 if(deleteEntry)return <AssetAccessSettingsDialog locationLayout title="Delete location entry?" assetTitle={title} onClose={()=>{if(!deleting)setDeleteEntry(null);}}>
  <div className={styles.deleteConfirm}>
   <span className={styles.deleteIcon} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg></span>
   <strong>Are you sure you want to delete this entry?</strong>
   <div className={styles.deleteRecord}><strong>{date(deleteEntry.recordedAt)}</strong><span>{deleteEntry.note&&!/^GPS\s/i.test(deleteEntry.note)?deleteEntry.note:'Saved position'} · {deleteEntry.latitude.toFixed(5)}, {deleteEntry.longitude.toFixed(5)}</span></div>
   <p>It will be removed from location history and its reports.<br/>The asset’s current map position and other activity stay unchanged.</p>
   {deleteError&&<p role="alert" className={styles.deleteError}>{deleteError}</p>}
   <div className={styles.confirmActions}><button type="button" disabled={deleting} onClick={()=>setDeleteEntry(null)}>Cancel</button><button type="button" className={styles.deleteButton} disabled={deleting} onClick={()=>void confirmDelete()}>{deleting?'Deleting…':'Delete entry'}</button></div>
  </div>
 </AssetAccessSettingsDialog>;
 if(exportOpen)return createPortal(<ReportDownloadFlow title={exportEntry?"Download location record":"Download location history"} allLabel={title} assets={[{id:assetId,title,meta:exportEntry?`Location record · ${date(exportEntry.recordedAt)}`:`Location history · ${from||'All dates'} to ${to||'today'} · South African time`}]} lockedAssetId={assetId} skipTimeline instantDownload onClose={()=>setExportOpen(false)} onDownload={selection=>downloadAssetMapReport(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to,format:selection.format,...(exportEntry?{entryId:exportEntry.id}:{})})}`,selection.format)}/>,document.body);
 return <AssetAccessSettingsDialog title="Location history" assetTitle={title} onClose={onClose} footer={tab==='observations'?<div className={styles.downloadBar}><span>{items.length} saved locations</span><button type="button" disabled={busy||!!error||!items.length||truncated} onClick={()=>{setExportEntry(null);setExportOpen(true);}} aria-haspopup="dialog">Download history</button></div>:undefined}>
  <div className={styles.content} data-location-history>
   {tab==='movement'?<AssetMovementHistory assetId={assetId} title={title} historyTabs={historyTabs}/>:<>
   <div className={styles.historyToolbar}><div className={styles.filters}><label>From<DateInput value={from} max={to||undefined} onValueChange={value=>setFrom(value)}/></label><label>To<DateInput value={to} min={from||undefined} onValueChange={value=>setTo(value)}/></label></div>{historyTabs}</div>
   <div className={styles.historyActions}><button type="button" className={styles.deleteAllAction} disabled={busy||!!error||!snapshotAt} aria-haspopup="dialog" aria-label="Delete all saved locations" onClick={()=>setDeleteAllSnapshot(snapshotAt)}><HistoryDeleteIcon/>Delete all</button></div>
   {busy?<p role="status">Loading location history…</p>:error?<div role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:<>
    {truncated&&<p role="status">Showing the latest 2 000 records. Narrow the dates for a complete report.</p>}
    {items.length?<><AssetLocationHistoryMap points={points} onSelectPoint={selectRecord}/><div className={styles.legend}><span>● Latest in selected period</span><span>● Earlier observations</span><strong>{items.length.toLocaleString()} {items.length===1?'record':'records'}</strong></div>
    <ol className={styles.list}>{items.map((item,index)=><li key={item.id} ref={node=>{if(node)records.current.set(item.id,node);else records.current.delete(item.id);}} tabIndex={-1} data-selected={selectedRecord===item.id} aria-label={`Location record ${index+1}`}><div className={styles.row}><strong><span className={styles.recordNumber}>{index+1}</span>{date(item.recordedAt)}</strong><span className={styles.badge}>{item.source}</span></div><div className={styles.recordBody}><div><p>{item.note&&!/^GPS\s/i.test(item.note)?item.note:'Saved position'}</p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</a><small>Recorded by: {item.actor}{item.accuracy!==null?` · Reported accuracy: ${Math.round(item.accuracy)} m`:''}</small></div><div className={styles.recordActions}><button type="button" aria-haspopup="dialog" aria-label={`Download location record ${index+1}`} onClick={()=>{setExportEntry(item);setExportOpen(true);}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>Download record</button><button type="button" className={styles.deleteAction} aria-haspopup="dialog" aria-label={`Delete location record ${index+1}`} onClick={()=>{setDeleteError('');setDeleteEntry(item);}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6m4-6v6"/></svg>Delete</button></div></div></li>)}</ol></>:<div className={styles.empty}><strong>No location records in this period.</strong><p>Choose different dates or save a location using Update location.</p></div>}
   </>}
   <p className={styles.disclaimer}>These are recorded observations, not continuous tracking. Manual pins and device readings do not independently verify the asset’s presence. Historical records may have no recorded name or source.</p>
  </>}
  </div>
 </AssetAccessSettingsDialog>;
}

