'use client';
import {useEffect,useId,useState} from 'react';
import {suggestedDailyUsage,usageToday,validUsageDate,validWorkingDays} from '../../lib/average-usage-math';
import styles from './AssetAverageUsage.module.css';
type Usage={mode:string;enabled:boolean;metric:string;reading:number|null;estimated:boolean;baselineValue:number|null;baselineAt:string|null;dailyUsage:number|null;workingDays:number[];yearModel:number|null;events?:{id:string;action:string;reading:number;metric:string;created_at:string}[]};
const number=(n:number|null)=>n==null?'Not recorded':n.toLocaleString('en-ZA',{maximumFractionDigits:2});
const labels=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export default function AssetAverageUsage({assetId}:{assetId:string}) {
  const id=useId(),[usage,setUsage]=useState<Usage|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('');
  const [reading,setReading]=useState(''),[date,setDate]=useState(usageToday()),[daily,setDaily]=useState(''),[days,setDays]=useState([1,2,3,4,5]),[serviceDate,setServiceDate]=useState('');
  const [editing,setEditing]=useState(false),[suggest,setSuggest]=useState(false);
  const endpoint=`/api/asset-register/${encodeURIComponent(assetId)}/average-usage`;
  function fill(data:Usage){setUsage(data);setReading('');setDate(usageToday());setDaily(String(data.dailyUsage??''));setDays(data.workingDays);setServiceDate(data.yearModel&&data.yearModel<new Date().getFullYear()?`${data.yearModel}-01-01`:'');}
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);fill(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint]);
  async function save(action:'enable'|'pause'|'confirm') {
    if(busy)return;setBusy(true);setError('');setSuccess('');
    try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reading:reading.trim()===''?null:Number(reading),readingDate:date,dailyUsage:daily.trim()===''?null:Number(daily),workingDays:days})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save average usage.');fill(data);setEditing(false);setSuccess(action==='pause'?'Average usage paused.':action==='confirm'?'Actual reading saved.':'Average usage enabled.');window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated',{detail:{assetId}}));
    } catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
  }
  if(!usage)return <p role={error?'alert':'status'}>{error||'Loading average usage…'}</p>;
  if(!['hours','km'].includes(usage.metric))return null;
  const active=usage.mode==='average'&&usage.enabled,configured=usage.mode==='average';
  const validReading=reading.trim()!==''&&Number.isFinite(Number(reading))&&Number(reading)>=0&&Number(reading)<1e12&&validUsageDate(date);
  const valid=validReading&&daily.trim()!==''&&Number(daily)>0&&Number(daily)<=(usage.metric==='hours'?24:10000)&&validWorkingDays(days);
  const suggestion=validReading&&validUsageDate(serviceDate,date)?suggestedDailyUsage(Number(reading),serviceDate,date,days):null;
  return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
    <div className={styles.heading}><div><h4 id={`${id}-heading`}>Average usage</h4><p>Estimate {usage.metric==='km'?'kilometres':'hours'} between actual meter readings.</p></div><span className={styles.badge}>{active?'On':configured?'Paused':'Off'}</span></div>
    <div className={styles.summary}><div><span>{usage.estimated?'Estimated current usage':'Current meter reading'}</span><strong>{number(usage.reading)} {usage.metric}</strong></div>{usage.baselineAt&&<div><span>Last confirmed reading</span><strong>{number(usage.baselineValue)} {usage.metric}</strong><small>{new Date(usage.baselineAt).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</small></div>}</div>
    <p>Fuel, service and manual meter readings take priority. Each confirmed reading restarts the estimate. Authorised dealers and businesses can correct it through their existing Update usage permission.</p>
    {active&&!editing?<><p>{number(usage.dailyUsage)} {usage.metric} per working day · {days.map(d=>labels[d].slice(0,3)).join(', ')}.</p><div className={styles.actions}><button onClick={()=>setEditing(true)} disabled={busy}>Correct reading or change average</button><button onClick={()=>void save('pause')} disabled={busy}>{busy?'Saving…':'Pause estimates'}</button></div></>:<form className={styles.form} onSubmit={e=>{e.preventDefault();if(valid)void save('enable');}}>
      <div className={styles.fields}><label htmlFor={`${id}-reading`}>Actual meter reading ({usage.metric})<input id={`${id}-reading`} type="number" min="0" max="999999999999" step="0.01" inputMode="decimal" required value={reading} onChange={e=>setReading(e.target.value)} placeholder="Read the asset’s meter" disabled={busy}/><small>Enter an actual reading, even if it is below the estimate.</small></label>
      <label htmlFor={`${id}-date`}>Reading date<input id={`${id}-date`} type="date" min="1900-01-01" max={usageToday()} required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/><small>The date this reading was taken.</small></label></div>
      <label htmlFor={`${id}-daily`}>Average {usage.metric} per working day<input id={`${id}-daily`} type="number" min="0.0001" max={usage.metric==='hours'?24:10000} step="0.0001" inputMode="decimal" required value={daily} onChange={e=>setDaily(e.target.value)} placeholder={usage.metric==='hours'?'For example, 8':'For example, 100'} disabled={busy}/></label>
      <fieldset disabled={busy}><legend>Working days</legend><div className={styles.days}>{[1,2,3,4,5,6,0].map(day=><label key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(e.target.checked?[...days,day].sort():days.filter(d=>d!==day))}/>{labels[day]}</label>)}</div><small>Usage is added for completed working days. Pause when the asset is not in use.</small></fieldset>
      <button className={styles.suggest} type="button" onClick={()=>setSuggest(!suggest)} aria-expanded={suggest}>Help calculate my average</button>
      {suggest&&<div className={styles.help}><label htmlFor={`${id}-service`}>Estimated date first put into use<input id={`${id}-service`} type="date" min="1900-01-01" max={date} value={serviceDate} onChange={e=>setServiceDate(e.target.value)} disabled={busy}/></label><p>We divide total usage by the selected working days since this date. The model year only supplies a starting date—adjust it if needed. This assumes the meter started at zero and is a lifetime average, which may differ from current use.</p>{suggestion!==null&&suggestion>0?<button type="button" disabled={busy||suggestion>(usage.metric==='hours'?24:10000)} onClick={()=>setDaily(String(suggestion))}>Use {number(suggestion)} {usage.metric} per working day</button>:<p>Enter the actual reading and an earlier start date to calculate a suggestion.</p>}</div>}
      {usage.mode==='tracking'&&usage.enabled&&<p className={styles.notice}>Enabling average usage will replace GPS-based usage estimation for this asset. Location tracking continues.</p>}
      <div className={styles.actions}>{active&&<button type="button" disabled={busy} onClick={()=>setEditing(false)}>Cancel</button>}{configured&&<button type="button" disabled={busy||!validReading} onClick={()=>void save('confirm')}>Save actual reading only</button>}<button type="submit" disabled={busy||!valid}>{busy?'Saving…':active?'Save average and reading':'Enable average usage'}</button></div>
    </form>}
    {success&&<p role="status">{success}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
    {!!usage.events?.length&&<details><summary>Reading history</summary><ol className={styles.history}>{usage.events.map(event=><li key={event.id}><strong>{event.action}</strong><span>{number(Number(event.reading))} {event.metric} · {new Date(event.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</span></li>)}</ol></details>}
  </section>;
}
