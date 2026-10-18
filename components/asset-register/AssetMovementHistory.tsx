'use client';
import {useEffect,useMemo,useState} from 'react';
import AssetLocationHistoryMap from './AssetLocationHistoryMap';
import {createPortal} from '../WebsitePortal';
import ReportDownloadFlow from '../ReportDownloadFlow';
import {downloadAssetMapReport} from '../../lib/asset-map-download';
import type {MovementReport} from '../../lib/asset-movement-report';
import styles from './AssetTrackingPanel.module.css';
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const offsetDate=(days:number)=>new Date(Date.parse(today()+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
const date=(v:string)=>new Date(v).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg',dateStyle:'medium',timeStyle:'short'});
export default function AssetMovementHistory({assetId,title='Asset'}:{assetId:string;title?:string}){
 const [from,setFrom]=useState(today),[to,setTo]=useState(today),[preset,setPreset]=useState('Today');
 const [report,setReport]=useState<MovementReport|null>(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[exportOpen,setExportOpen]=useState(false);
 const url=`/api/asset-register/${encodeURIComponent(assetId)}/tracking/history?${new URLSearchParams({from,to})}`;
 useEffect(()=>{const c=new AbortController();setBusy(true);setReport(null);setError('');fetch(url,{signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'Could not load movement.');if(!c.signal.aborted)setReport(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setBusy(false);});return()=>c.abort();},[url,revision]);
 const points=useMemo(()=>(report?.readings||[]).map(p=>({...p,label:`${date(p.capturedAt)} · ${p.speedKmh===null?'Speed unavailable':p.speedKmh.toFixed(1)+' km/h'} · Accuracy ${Math.round(p.accuracy)} m`})),[report]);
 const stops=useMemo(()=>(report?.stops||[]).map((s,i)=>({...s,label:`Stop ${i+1} · ${Math.round(s.seconds/60)} min · ${date(s.from)} to ${date(s.to)}`})),[report]);
 return <section className={styles.panel}>
  {exportOpen&&createPortal(<ReportDownloadFlow title="Download movement report" allLabel={title} assets={[{id:assetId,title,meta:`Movement · ${from} to ${to} · South African time`}]} lockedAssetId={assetId} skipTimeline instantDownload onClose={()=>setExportOpen(false)} onDownload={selection=>downloadAssetMapReport(url+'&format='+selection.format,selection.format)}/>,document.body)}
  <div className={styles.actions} role="group" aria-label="Movement period">{['Today','Yesterday','Last 7 days','Custom'].map(label=><button type="button" key={label} aria-pressed={preset===label} onClick={()=>{setPreset(label);if(label!=='Custom'){setFrom(offsetDate(label==='Yesterday'?-1:label==='Last 7 days'?-6:0));setTo(offsetDate(label==='Yesterday'?-1:0));}}}>{label}</button>)}</div>
  <div className={styles.filters}><label>From<input type="date" value={from} max={to} onChange={e=>{setPreset('Custom');setFrom(e.target.value);}}/></label><label>To<input type="date" value={to} min={from} onChange={e=>{setPreset('Custom');setTo(e.target.value);}}/></label><button type="button" disabled={busy} onClick={()=>setRevision(n=>n+1)}>Refresh</button><button type="button" aria-haspopup="dialog" disabled={busy||!report?.readings.length} onClick={()=>setExportOpen(true)}>Download report</button></div>
  <p className={styles.notice}>Choose up to 31 days. Dates and times use South African time.</p>
  {busy?<p role="status">Loading movement…</p>:error?<p role="alert" className={styles.error}>{error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Try again</button></p>:report&&<>
   <div className={styles.stats}>{[[report.distanceKm.toFixed(2)+' km','Recorded distance'],[(report.movingSeconds/3600).toFixed(2)+' h','Moving time'],[(report.stationarySeconds/3600).toFixed(2)+' h','Stationary time'],[report.averageMovingKmh.toFixed(1)+' km/h','Average moving speed']].map(([value,label])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
   {points.length?<><AssetLocationHistoryMap points={points} routeSegments={report.segments} stops={stops}/><div className={styles.routeLegend}><span>● Start / End</span><span>● Recorded GPS dots</span><span>● Numbered stops: 15+ minutes</span></div><p className={styles.notice}>{points.length.toLocaleString()} readings · {Math.round(report.gapSeconds/60)} minutes unobserved between readings. {points.length>5000?'The map displays a sample of dots; exports retain all readings.':''}</p>
   {stops.length>0&&<details className={styles.setupDetails}><summary>Observed stops ({stops.length})</summary><ol className={styles.stopList}>{stops.map((s,i)=><li key={s.from}><strong>Stop {i+1} · {Math.round(s.seconds/60)} min</strong><span>{date(s.from)} – {date(s.to)}</span></li>)}</ol></details>}</>:<div className={styles.emptyState}><strong>No movement recorded for these dates</strong><p>Choose another period, or connect a phone through Update location → Tracking device.</p></div>}
   <p className={styles.notice}>GPS estimates. Moving time is not engine or working hours; stopped does not mean the engine is off. Lines join recorded points. Missing periods and separate sessions are not joined.</p>
  </>}
 </section>;
}
