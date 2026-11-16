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
  const [editing,setEditing]=useState(false),[correction,setCorrection]=useState(false);
  const [screen,setScreen]=useState<'reading'|'usage'|'calculator'|'review'>('reading');
  const screenHeading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{screenHeading.current?.focus();},[screen,editing]);
  const endpoint=`/api/asset-register/${encodeURIComponent(assetId)}/average-usage`;
  function fill(data:Usage){setUsage(data);setReading('');setDate(usageToday());setDaily(String(data.dailyUsage??''));setDays(data.workingDays);setServiceDate(data.yearModel&&data.yearModel<new Date().getFullYear()?`${data.yearModel}-01-01`:'');}
  useEffect(()=>{const controller=new AbortController();fetch(endpoint,{cache:'no-store',signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);fill(d);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[endpoint]);
  async function save(action:'enable'|'pause'|'confirm') {
    if(busy)return;setBusy(true);setError('');setSuccess('');
    try {const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,reading:reading.trim()===''?null:Number(reading),readingDate:date,dailyUsage:daily.trim()===''?null:Number(daily),workingDays:days})});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Could not save average usage.');fill(data);setEditing(false);setCorrection(false);setScreen('reading');setSuccess(action==='pause'?'Average usage paused.':action==='confirm'?'Actual reading saved.':'Average usage enabled.');window.dispatchEvent(new CustomEvent('aim4price:asset-register-updated',{detail:{assetId}}));
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
  const title=screen==='reading'?'Start with a real meter reading':screen==='usage'?'How much does this asset work?':screen==='calculator'?'Calculate a suggested average':'Check your settings';
  return <section className={styles.panel} aria-labelledby={`${id}-heading`}>
    <div className={styles.heading}><div><h4 id={`${id}-heading`}>Average usage</h4><p>Estimate {unit} between actual readings.</p></div><span className={styles.badge}>{active?'On':configured?'Paused':'Off'}</span></div>
    {overview?<>
      <div className={styles.summary}><div><span>{usage.estimated?'Estimated current usage':'Current meter reading'}</span><strong>{number(usage.reading)} {usage.metric}</strong></div>{usage.baselineAt&&<div><span>Last confirmed reading</span><strong>{number(usage.baselineValue)} {usage.metric}</strong><small>{new Date(usage.baselineAt).toLocaleDateString('en-ZA',{timeZone:'Africa/Johannesburg'})}</small></div>}</div>
      <p>{number(usage.dailyUsage)} {usage.metric} per working day · {workingDays.map(d=>labels[d].slice(0,3)).join(', ')}.</p>
      <p>Actual fuel, service and manual readings replace the estimate.</p>
      <div className={styles.actions}><button onClick={()=>begin(true)} disabled={busy}>Correct meter reading</button><button onClick={()=>begin(false)} disabled={busy}>Change average usage</button><button onClick={()=>void save('pause')} disabled={busy}>{busy?'Saving…':'Pause estimates'}</button></div>
    </>:<form className={styles.form} onSubmit={e=>{e.preventDefault();if(screen==='reading'&&validReading){if(correction)void save('confirm');else navigate('usage');}else if(screen==='usage'&&valid)navigate('review');else if(screen==='review'&&valid)void save('enable');}}>
      <div className={styles.intro}><h5 ref={screenHeading} tabIndex={-1}>{correction?'Correct the meter reading':title}</h5><p>{screen==='reading'?'Read the meter on the asset and enter the date you checked it.':screen==='usage'?'Enter a typical working day, then choose the days it is normally used.':screen==='calculator'?'Use the asset’s age and total reading as a starting point.':active?'Review your changes before saving.':'Nothing is switched on until you confirm below.'}</p></div>
      {screen==='reading'&&<>
        <p className={styles.notice}>{usage.estimated?'Current estimate':'Saved reading'}: <strong>{number(usage.reading)} {usage.metric}</strong>. Enter the actual meter reading below, even if it is lower.</p>
        <div className={styles.fields}><label htmlFor={`${id}-reading`}>Actual meter reading ({usage.metric})<input id={`${id}-reading`} type="number" min="0" max="999999999999" step="0.01" inputMode="decimal" required value={reading} onChange={e=>setReading(e.target.value)} placeholder={usage.metric==='hours'?'For example, 14014':'For example, 90000'} disabled={busy}/></label>
        <label htmlFor={`${id}-date`}>Date of this reading<input id={`${id}-date`} type="date" min="1900-01-01" max={usageToday()} required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label></div>
        {configured&&!active&&<button className={styles.suggest} type="button" disabled={busy||!validReading} onClick={()=>void save('confirm')}>Save reading only · keep estimates paused</button>}
      </>}
      {screen==='usage'&&<>
        <label htmlFor={`${id}-daily`}>Average {unit} on a working day<input id={`${id}-daily`} type="number" min="0.0001" max={usage.metric==='hours'?24:10000} step="0.0001" inputMode="decimal" required value={daily} onChange={e=>setDaily(e.target.value)} placeholder={usage.metric==='hours'?'For example, 8':'For example, 100'} disabled={busy}/><small>{usage.metric==='hours'?'Enter up to 24 hours per day.':'Enter the distance covered on a typical working day.'}</small></label>
        <fieldset disabled={busy}><legend>Which days is it normally used?</legend><div className={styles.days}>{[1,2,3,4,5,6,0].map(day=><label key={day}><input type="checkbox" checked={days.includes(day)} onChange={e=>setDays(e.target.checked?[...days,day].sort():days.filter(d=>d!==day))}/>{labels[day]}</label>)}</div><small>{days.length?'Estimates increase only on the selected days.':'Choose at least one working day to continue.'}</small></fieldset>
        <button className={styles.suggest} type="button" disabled={busy||!days.length} onClick={()=>navigate('calculator')}>Not sure? Help calculate my average</button>
      </>}
      {screen==='calculator'&&<>
        <label htmlFor={`${id}-service`}>When was this asset first used?<input id={`${id}-service`} type="date" min="1900-01-01" max={date} value={serviceDate} onChange={e=>setServiceDate(e.target.value)} disabled={busy}/><small>The model year supplies an approximate date. Change it if needed.</small></label>
        <p>We divide {number(Number(reading))} {usage.metric} by the selected working days since this date. This assumes the meter started at zero; current use may be different.</p>
        {suggestion!==null&&suggestion>0&&suggestion<=(usage.metric==='hours'?24:10000)?<div className={styles.notice}>Suggested average: <strong>{number(suggestion)} {usage.metric} per working day</strong></div>:<p role="status">{suggestion!==null&&suggestion>(usage.metric==='hours'?24:10000)?'This average is too high. Check the start date or enter your own average.':'Choose an earlier start date to calculate a suggestion.'}</p>}
      </>}
      {screen==='review'&&<>
        <dl className={styles.review}><div><dt>Actual reading</dt><dd>{number(Number(reading))} {usage.metric} · {date.split('-').reverse().join('/')}</dd></div><div><dt>Average working day</dt><dd>{number(Number(daily))} {usage.metric}</dd></div><div><dt>Working days</dt><dd>{workingDays.map(d=>labels[d].slice(0,3)).join(', ')}</dd></div><div><dt>Estimated weekly usage</dt><dd>{number(Number(daily)*days.length)} {usage.metric}</dd></div></dl>
        <p className={styles.notice}>Fuel, service and manual readings always take priority. Dealers and businesses with Update usage permission can correct the reading.</p>
        <p>You can change the average or pause estimates here at any time.</p>
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
