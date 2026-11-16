'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {suggestedDailyUsage,usageToday,validUsageDate,validWorkingDays} from '../../lib/average-usage-math';
import styles from './AssetAverageUsage.module.css';
type Usage={mode:string;enabled:boolean;metric:string;reading:number|null;estimated:boolean;baselineValue:number|null;baselineAt:string|null;dailyUsage:number|null;workingDays:number[];yearModel:number|null;events?:{id:string;action:string;reading:number;metric:string;created_at:string}[]};
const number=(n:number|null)=>n==null?'Not recorded':n.toLocaleString('en-ZA',{maximumFractionDigits:2});
const labels=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export default function AssetAverageUsage({assetId}:{assetId:string}) {
  const id=useId(),[usage,setUsage]=useState<Usage|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('');
  const [reading,setReading]=useState(''),[date,setDate]=useState(usageToday()),[daily,setDaily]=useState(''),[days,setDays]=useState([1,2,3,4,5]),[serviceDate,setServiceDate]=useState('');
  const [editing,setEditing]=useState(false),[correction,setCorrection]=useState(false),[setup,setSetup]=useState(false);
  const [screen,setScreen]=useState<'reading'|'usage'|'calculator'|'review'>('reading');
  const screenHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{screenHeading.current?.focus({preventScroll:true});},[screen,editing]);
  const endpoint=`/api/asset-register/${encodeURIComponent(assetId)}/average-usage`;
  function fill(data:Usage){setUsage(data);setReading('');setDate(usageToday());setDaily(String(data.dailyUsage??''));setDays(data.workingDays);setServiceDate(data.yearModel&&data.yearModel<new Date().getFullYear()?`${data.yearModel}-01-01`:'');}
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);fill(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint]);
  async function save(action:'enable'|'pause'|'confirm') {
    if(busy)return;setBusy(true);setError('');setSuccess('');
    try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reading:reading.trim()===''?null:Number(reading),readingDate:date,dailyUsage:daily.trim()===''?null:Number(daily),workingDays:days})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save average usage.');fill(data);setSetup(false);setEditing(false);setCorrection(false);setScreen('reading');setSuccess(action==='pause'?'Average usage turned off.':action==='confirm'?'Actual reading saved.':'Average usage enabled.');window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated',{detail:{assetId}}));
    } catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}
  }
  if(!usage)return <p role={error?'alert':'status'}>{error||'Loading average usage…'}</p>;
  if(!['hours','km'].includes(usage.metric))return null;
  const active=usage.mode==='average'&&usage.enabled,configured=usage.mode==='average';
  const validReading=reading.trim()!==''&&Number.isFinite(Number(reading))&&Number(reading)>=0&&Number(reading)<1e12&&validUsageDate(date);
  const valid=validReading&&daily.trim()!==''&&Number(daily)>0&&Number(daily)<=(usage.metric==='hours'?24:10000)&&validWorkingDays(days);
  const suggestion=validReading&&validUsageDate(serviceDate,date)?suggestedDailyUsage(Number(reading),serviceDate,date,days):null;
  const unit=usage.metric==='km'?'kilometres':'hours';
  const workingDays=[1,2,3,4,5,6,0].filter(day=>days.includes(day));
  const overview=active&&!editing;
  function begin(correctOnly:boolean){setCorrection(correctOnly);setScreen('reading');setReading('');setError('');setSuccess('');setEditing(true);}
  function navigate(next:typeof screen){setError('');setScreen(next);}
  const toggle=<button type="button" role="switch" aria-label="Average usage" aria-checked={active||setup} aria-describedby={!active&&setup?`${id}-pending`:undefined} className={styles.toggle} disabled={busy} onClick={()=>{if(active){void save('pause');}else{setSetup(!setup);setScreen('reading');setError('');setSuccess('');}}}><span className={styles.toggleTrack} aria-hidden="true"><span/></span><span>{busy?'Saving…':active||setup?'On':'Off'}</span></button>;
  const title=screen==='reading'?'Meter reading':screen==='usage'?'Usual usage':screen==='calculator'?'Calculate average':'Review settings';
  return <section className={styles.panel} aria-label="Average usage settings">
    {!active&&!setup?<><div className={styles.heading}><h4>Usage estimates</h4>{toggle}</div><p>Turn on to set up daily usage estimates.</p></>:overview?<>
      <div className={styles.heading}><h4>Usage estimates</h4>{toggle}</div>
      <div className={styles.summary}><div><span>{usage.estimated?'Estimated current usage':'Current meter reading'}</span><strong>{number(usage.reading)} {usage.metric}</strong></div>{usage.baselineAt&&<div><span>Last confirmed reading</span><strong>{number(usage.baselineValue)} {usage.metric}</strong><small>{new Date(usage.baselineAt).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</small></div>}</div>
      <p>{number(usage.dailyUsage)} {usage.metric} per working day · {workingDays.map(d=>labels[d].slice(0,3)).join(', ')}.</p>
      <p>Actual fuel, service and manual readings replace the estimate.</p>
      <div className={styles.actions}><button onClick={()=>begin(true)} disabled={busy}>Correct meter reading</button><button onClick={()=>begin(false)} disabled={busy}>Change average usage</button></div>
    </>:<form className={styles.form} onSubmit={e=>{e.preventDefault();if(screen==='reading'&&validReading){if(correction)void save('confirm');else navigate('usage');}else if(screen==='usage'&&valid)navigate('review');else if(screen==='review'&&valid)void save('enable');}}>
      <div className={styles.heading}><h5 ref={screenHeading} tabIndex={-1} className={styles.screenTitle}>{correction?'Correct reading':title}</h5>{toggle}</div>
      {!active&&setup&&<small id={`${id}-pending`}>Starts after you save.</small>}
      {screen==='reading'&&<>
        <p className={styles.notice}>{usage.estimated?'Current estimate':'Saved reading'}: <strong>{number(usage.reading)} {usage.metric}</strong></p>
        <div className={styles.fields}><label htmlFor={`${id}-reading`}>Actual reading ({usage.metric})<input id={`${id}-reading`} type="number" min="0" max="999999999999" step="0.01" inputMode="decimal" required value={reading} onChange={e=>setReading(e.target.value)} placeholder={usage.metric==='hours'?'For example, 14014':'For example, 90000'} disabled={busy}/></label>
        <label htmlFor={`${id}-date`}>Reading date<input id={`${id}-date`} type="date" min="1900-01-01" max={usageToday()} required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label></div>
        {configured&&!active&&<button className={styles.suggest} type="button" disabled={busy||!validReading} onClick={()=>void save('confirm')}>Save reading · stay off</button>}
      </>}
      {screen==='usage'&&<>
        <label htmlFor={`${id}-daily`}>{unit==='hours'?'Hours':'Kilometres'} per working day<input id={`${id}-daily`} type="number" min="0.0001" max={usage.metric==='hours'?24:10000} step="0.0001" inputMode="decimal" required value={daily} onChange={e=>setDaily(e.target.value)} placeholder={usage.metric==='hours'?'For example, 8':'For example, 100'} disabled={busy}/>{usage.metric==='hours'&&<small>Maximum 24 hours.</small>}</label>
        <fieldset disabled={busy}><legend>Working days</legend><div className={styles.days}>{[1,2,3,4,5,6,0].map(day=><label key={day} title={labels[day]}><input type="checkbox" aria-label={labels[day]} checked={days.includes(day)} onChange={e=>setDays(e.target.checked?[...days,day].sort():days.filter(d=>d!==day))}/>{labels[day].slice(0,3)}</label>)}</div>{!days.length&&<small>Choose at least one day.</small>}</fieldset>
        <button className={styles.suggest} type="button" disabled={busy||!days.length} onClick={()=>navigate('calculator')}>Help calculate average</button>
      </>}
      {screen==='calculator'&&<>
        <label htmlFor={`${id}-service`}>First used on<input id={`${id}-service`} type="date" min="1900-01-01" max={date} value={serviceDate} onChange={e=>setServiceDate(e.target.value)} disabled={busy}/><small>Model-year estimate. Adjust if needed.</small></label>
        <p>Total reading ÷ working days since first use. Assumes a zero starting reading; current use may differ.</p>
        {suggestion!==null&&suggestion>0&&suggestion<=(usage.metric==='hours'?24:10000)?<div className={styles.notice}>Suggested average: <strong>{number(suggestion)} {usage.metric} per working day</strong></div>:<p role="status">{suggestion!==null&&suggestion>(usage.metric==='hours'?24:10000)?'Average too high. Check the date.':'Choose an earlier date.'}</p>}
      </>}
      {screen==='review'&&<>
        <dl className={styles.review}><div><dt>Actual reading</dt><dd>{number(Number(reading))} {usage.metric} · {date.split('-').reverse().join('/')}</dd></div><div><dt>Per working day</dt><dd>{number(Number(daily))} {usage.metric}</dd></div><div><dt>Working days</dt><dd>{workingDays.map(d=>labels[d].slice(0,3)).join(', ')}</dd></div><div><dt>Per week (estimated)</dt><dd>{number(Number(daily)*days.length)} {usage.metric}</dd></div></dl>
        <p className={styles.notice}>Actual readings take priority. Authorised dealers and businesses can correct them.</p>

        {usage.mode==='tracking'&&usage.enabled&&<p className={styles.notice}>This replaces GPS-based usage estimates. Location tracking stays on.</p>}
      </>}
      <div className={styles.actions}>
        {screen==='reading'?active&&<button type="button" disabled={busy} onClick={()=>{setEditing(false);setError('');}}>Cancel</button>:<button type="button" disabled={busy} onClick={()=>navigate(screen==='usage'?'reading':'usage')}>Back</button>}
        {screen==='calculator'?<button className={styles.primary} type="button" disabled={busy||suggestion===null||suggestion<=0||suggestion>(usage.metric==='hours'?24:10000)} onClick={e=>{e.preventDefault();setDaily(String(suggestion));navigate('usage');}}>Use this average</button>:<button type="submit" disabled={busy||(screen==='reading'?!validReading:!valid)}>{busy?'Saving…':screen==='reading'?correction?'Save actual reading':'Next':screen==='usage'?'Review settings':active?'Save changes':'Enable average usage'}</button>}
      </div>
    </form>}
    {success&&<p role="status">{success}</p>}{error&&<p className={styles.error} role="alert">{error}</p>}
    {overview&&!!usage.events?.length&&<details><summary>Reading history</summary><ol className={styles.history}>{usage.events.map(event=><li key={event.id}><strong>{event.action}</strong><span>{number(Number(event.reading))} {event.metric} · {new Date(event.created_at).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})}</span></li>)}</ol></details>}
  </section>;
}
