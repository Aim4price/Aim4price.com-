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
export default function AssetLocationHistoryDialog({assetId,title,onClose}:{assetId:string;title:string;onClose:()=>void}){
 const [tab,setTab]=useState<'observations'|'movement'>('observations');
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[truncated,setTruncated]=useState(false),[retry,setRetry]=useState(0),[exportOpen,setExportOpen]=useState(false);
 const points=useMemo(()=>items.map(item=>({latitude:item.latitude,longitude:item.longitude,label:`${date(item.recordedAt)} · ${item.source}${item.note?' · '+item.note:''}`})),[items]);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setItems([]);
  fetch(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to})}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load location history.');if(controller.signal.aborted)return;setItems(data.items);setTruncated(data.truncated);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
 },[assetId,from,to,retry]);
 if(exportOpen)return createPortal(<ReportDownloadFlow title="Download location history" allLabel={title} assets={[{id:assetId,title,meta:`Location history · ${from||'All dates'} to ${to||'today'} · South African time`}]} lockedAssetId={assetId} skipTimeline instantDownload onClose={()=>setExportOpen(false)} onDownload={selection=>downloadAssetMapReport(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to,format:selection.format})}`,selection.format)}/>,document.body);
 return <AssetAccessSettingsDialog title="Location history" assetTitle={title} onClose={onClose}>
  <div className={styles.content}>
   <div className={`${trackingStyles.panel} ${trackingStyles.tabs}`} role="group" aria-label="History type"><button type="button" aria-pressed={tab==='observations'} onClick={()=>setTab('observations')}>Saved locations</button><button type="button" aria-pressed={tab==='movement'} onClick={()=>setTab('movement')}>Movement</button></div>
   {tab==='movement'?<AssetMovementHistory assetId={assetId}/>:<>
   <div className={styles.summary}><strong>Every recorded position, in one place.</strong><p>Review saved locations and export a report for your records. Dates use South African time.</p></div>
   <div className={styles.filters}><label>From<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label><button type="button" onClick={()=>setExportOpen(true)} disabled={busy||!!error||!items.length||truncated} aria-haspopup="dialog">Download history report</button></div>
   {busy?<p role="status">Loading location history…</p>:error?<div role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:<>
    {truncated&&<p role="status">Showing the latest 2 000 records. Narrow the dates for a complete report.</p>}
    {items.length?<><AssetLocationHistoryMap points={points}/><div className={styles.legend}><span>● Latest in selected period</span><span>● Earlier observations</span><strong>{items.length.toLocaleString()} {items.length===1?'record':'records'}</strong></div>
    <ol className={styles.list}>{items.map((item,index)=><li key={item.id}><div className={styles.row}><strong>#{index+1} · {date(item.recordedAt)}</strong><span className={styles.badge}>{item.source}</span></div><p>{item.note&&!/^GPS\s/i.test(item.note)?item.note:'Saved position'}</p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</a><small>Recorded by: {item.actor}{item.accuracy!==null?` · Reported accuracy: ${Math.round(item.accuracy)} m`:''}</small></li>)}</ol></>:<div className={styles.empty}><strong>No location records in this period.</strong><p>Choose different dates or save a location using Update location.</p></div>}
   </>}
   <p className={styles.disclaimer}>These are recorded observations, not continuous tracking. Manual pins and device readings do not independently verify the asset’s presence. Historical records may have no recorded name or source.</p>
  </>}
  </div>
 </AssetAccessSettingsDialog>;
}

