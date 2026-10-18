'use client';
import AssetMovementHistory from './AssetMovementHistory';
import trackingStyles from './AssetTrackingPanel.module.css';
import {useEffect,useMemo,useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import AssetLocationHistoryMap from './AssetLocationHistoryMap';
import ReportDownloadFlow from '../ReportDownloadFlow';
import {createPortal} from '../WebsitePortal';
import {downloadAssetMapReport} from '../../lib/asset-map-download';
import styles from './AssetLocationHistoryDialog.module.css';
type Entry={id:string;latitude:number;longitude:number;note:string;actor:string;accuracy:number|null;recordedAt:string;capturedAt:string|null;source:string};
const date=(value:string)=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
export default function AssetLocationHistoryDialog({assetId,title,onClose,initialTab}:{assetId:string;title:string;onClose:()=>void;initialTab?:'observations'|'movement'}){
 const [exportEntry,setExportEntry]=useState<Entry|null>(null);
 const [tab,setTab]=useState<'observations'|'movement'>(initialTab||'observations');
 const [tabChosen,setTabChosen]=useState(Boolean(initialTab));
 useEffect(()=>{if(tabChosen)return;const c=new AbortController();fetch(`/api/asset-register/${encodeURIComponent(assetId)}/tracking`,{signal:c.signal}).then(r=>r.ok?r.json():null).then(d=>{if(!c.signal.aborted&&d?.device)setTab('movement');}).catch(()=>{});return()=>c.abort();},[assetId,tabChosen]);
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[truncated,setTruncated]=useState(false),[retry,setRetry]=useState(0),[exportOpen,setExportOpen]=useState(false);
 const points=useMemo(()=>items.map(item=>({latitude:item.latitude,longitude:item.longitude,label:`${date(item.recordedAt)} · ${item.source}${item.note?' · '+item.note:''}`})),[items]);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setItems([]);
  fetch(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to})}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load location history.');if(controller.signal.aborted)return;setItems(data.items);setTruncated(data.truncated);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
 },[assetId,from,to,retry]);
 if(exportOpen)return createPortal(<ReportDownloadFlow title={exportEntry?"Download location record":"Download location history"} allLabel={title} assets={[{id:assetId,title,meta:exportEntry?`Location record · ${date(exportEntry.recordedAt)}`:`Location history · ${from||'All dates'} to ${to||'today'} · South African time`}]} lockedAssetId={assetId} skipTimeline instantDownload onClose={()=>setExportOpen(false)} onDownload={selection=>downloadAssetMapReport(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to,format:selection.format,...(exportEntry?{entryId:exportEntry.id}:{})})}`,selection.format)}/>,document.body);
 return <AssetAccessSettingsDialog title="Location history" assetTitle={title} onClose={onClose} footer={tab==='observations'?<div className={styles.downloadBar}><span>{items.length} saved locations</span><button type="button" disabled={busy||!!error||!items.length||truncated} onClick={()=>{setExportEntry(null);setExportOpen(true);}} aria-haspopup="dialog">Download history</button></div>:undefined}>
  <div className={styles.content} data-location-history>
   <div className={`${trackingStyles.panel} ${trackingStyles.tabs}`} role="group" aria-label="History type"><button type="button" aria-pressed={tab==='observations'} onClick={()=>{setTabChosen(true);setTab('observations');}}>Saved locations</button><button type="button" aria-pressed={tab==='movement'} onClick={()=>{setTabChosen(true);setTab('movement');}}>Movement</button></div>
   {tab==='movement'?<AssetMovementHistory assetId={assetId} title={title}/>:<>
   <div className={styles.summary}><strong>Saved locations</strong><p>Newest first · South African time</p></div>
   <div className={styles.filters}><label>From<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label></div>
   {busy?<p role="status">Loading location history…</p>:error?<div role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:<>
    {truncated&&<p role="status">Showing the latest 2 000 records. Narrow the dates for a complete report.</p>}
    {items.length?<><AssetLocationHistoryMap points={points}/><div className={styles.legend}><span>● Latest in selected period</span><span>● Earlier observations</span><strong>{items.length.toLocaleString()} {items.length===1?'record':'records'}</strong></div>
    <ol className={styles.list}>{items.map((item,index)=><li key={item.id}><div className={styles.row}><strong><span className={styles.recordNumber}>{index+1}</span>{date(item.recordedAt)}</strong><span className={styles.badge}>{item.source}</span></div><p>{item.note&&!/^GPS\s/i.test(item.note)?item.note:'Saved position'}</p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</a><small>Recorded by: {item.actor}{item.accuracy!==null?` · Reported accuracy: ${Math.round(item.accuracy)} m`:''}</small><div className={styles.recordActions}><button type="button" aria-haspopup="dialog" aria-label={`Download location record ${index+1}`} onClick={()=>{setExportEntry(item);setExportOpen(true);}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/></svg>Download record</button></div></li>)}</ol></>:<div className={styles.empty}><strong>No location records in this period.</strong><p>Choose different dates or save a location using Update location.</p></div>}
   </>}
   <p className={styles.disclaimer}>These are recorded observations, not continuous tracking. Manual pins and device readings do not independently verify the asset’s presence. Historical records may have no recorded name or source.</p>
  </>}
  </div>
 </AssetAccessSettingsDialog>;
}

