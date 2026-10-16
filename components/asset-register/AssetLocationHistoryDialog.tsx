'use client';
import {useEffect,useRef,useState} from 'react';
import AssetAccessSettingsDialog from './AssetAccessSettingsDialog';
import {loadLeaflet} from '../../lib/asset-location-map';
import styles from './AssetLocationHistoryDialog.module.css';
type Entry={id:string;latitude:number;longitude:number;note:string;actor:string;accuracy:number|null;recordedAt:string;capturedAt:string|null;source:string};
const date=(value:string)=>new Date(value).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
export default function AssetLocationHistoryDialog({assetId,title,onClose}:{assetId:string;title:string;onClose:()=>void}){
 const [from,setFrom]=useState(''),[to,setTo]=useState(''),[items,setItems]=useState<Entry[]>([]),[busy,setBusy]=useState(true),[error,setError]=useState(''),[truncated,setTruncated]=useState(false),[retry,setRetry]=useState(0),[mapError,setMapError]=useState('');
 const node=useRef<HTMLDivElement>(null);
 useEffect(()=>{const controller=new AbortController();setBusy(true);setError('');setItems([]);
  fetch(`/api/asset-register/${encodeURIComponent(assetId)}/locations?${new URLSearchParams({from,to})}`,{signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'Could not load location history.');if(controller.signal.aborted)return;setItems(data.items);setTruncated(data.truncated);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});return()=>controller.abort();
 },[assetId,from,to,retry]);
 useEffect(()=>{if(!node.current||!items.length||busy)return;let cancelled=false;let map:any;setMapError('');
  loadLeaflet().then(L=>{if(cancelled||!node.current)return;map=L.map(node.current);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:19}).addTo(map);
   items.forEach((item,index)=>{const label=document.createElement('div');label.textContent=`${date(item.recordedAt)} · ${item.source}${item.note?' · '+item.note:''}`;L.circleMarker([item.latitude,item.longitude],{radius:index===0?9:6,color:index===0?'#135b45':'#367b9c',fillColor:index===0?'#29a779':'#68a6c5',fillOpacity:.8,weight:2}).addTo(map).bindPopup(label);});
   map.fitBounds(items.map(item=>[item.latitude,item.longitude]),{padding:[24,24],maxZoom:16});
  }).catch(()=>{if(!cancelled)setMapError('Map tiles are unavailable. All recorded coordinates are listed below.');});return()=>{cancelled=true;map?.remove();};
 },[items,busy]);
 function download(){const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';const rows=[['Asset location history',title],['Period (South Africa)',from||'All dates',to||'All dates'],['Scope',truncated?'First 2000 records; narrow the date range':'All records in selected range'],['Evidence','Recorded observations only; does not establish continuous presence or independent verification.'],[],['Recorded at (SAST)','Captured at (SAST; device supplied)','Latitude','Longitude','Source','Reported accuracy (m)','Recorded by','Location note'],...items.map(i=>[date(i.recordedAt),i.capturedAt?date(i.capturedAt):'',i.latitude,i.longitude,i.source,i.accuracy,i.actor,i.note])];const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`asset-location-history-${assetId}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <AssetAccessSettingsDialog title="Location history" assetTitle={title} onClose={onClose}>
  <div className={styles.content}>
   <div className={styles.summary}><strong>Every recorded position, in one place.</strong><p>Review saved locations and export a report for your records. Dates use South African time.</p></div>
   <div className={styles.filters}><label>From<input type="date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/></label><button type="button" onClick={download} disabled={busy||!!error||!items.length}>Download report · CSV</button></div>
   {busy?<p role="status">Loading location history…</p>:error?<div role="alert">{error} <button type="button" onClick={()=>setRetry(n=>n+1)}>Try again</button></div>:<>
    {truncated&&<p role="status">Showing the latest 2 000 records. Narrow the dates for a complete report.</p>}
    {items.length?<><div ref={node} className={styles.map} aria-label="Recorded asset locations"/>{mapError&&<p role="status">{mapError}</p>}<div className={styles.legend}><span>● Latest in selected period</span><span>● Earlier observations</span><strong>{items.length.toLocaleString()} records</strong></div>
    <ol className={styles.list}>{items.map(item=><li key={item.id}><div className={styles.row}><strong>{date(item.recordedAt)}</strong><span className={styles.badge}>{item.source}</span></div><p>{item.note&&!/^GPS\s/i.test(item.note)?item.note:'Saved position'}</p><a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</a><small>Recorded by: {item.actor}{item.accuracy!==null?` · Reported accuracy: ${Math.round(item.accuracy)} m`:''}</small></li>)}</ol></>:<div className={styles.empty}><strong>No location records in this period.</strong><p>Choose different dates or save a location using Update location.</p></div>}
   </>}
   <p className={styles.disclaimer}>These are recorded observations, not continuous tracking. Manual pins and device readings do not independently verify the asset’s presence. Historical records may have no recorded name or source.</p>
  </div>
 </AssetAccessSettingsDialog>;
}
