'use client';
import {useState} from 'react';
import {useDesktopControls} from '../DesktopWorkspace';
import TeamModal from './TeamModal';
import styles from './team.module.css';
export default function TeamFuelEntry({tanks,assets,onSaved}:{tanks:{id:string;name:string}[];assets:{id:string;title:string}[];onSaved:()=>Promise<void>}) {
  const desktop=useDesktopControls();
  const [mode,setMode]=useState<'issue'|'stock_in'|'dip'|null>(null),[tank,setTank]=useState(''),[asset,setAsset]=useState(''),[litres,setLitres]=useState(''),[percent,setPercent]=useState(''),[activity,setActivity]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[eventId,setEventId]=useState('');
  if (!desktop.workspace || !desktop.can('recordFuelIssues') && !desktop.can('refillFuel')) return null;
  function open(next:'issue'|'stock_in'|'dip') {setMode(next);setTank('');setAsset('');setLitres('');setPercent('');setActivity('');setError('');setEventId(crypto.randomUUID());}
  async function save(e:React.FormEvent) {
    e.preventDefault();if(busy || !mode)return;setBusy(true);setError('');
    try {
      let location: {latitude?:number;longitude?:number}={};
      if(mode==='issue') {
        const position=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:15000}));
        location={latitude:position.coords.latitude,longitude:position.coords.longitude};
      }
      const response=await desktop.request(`/api/fuel/storage/${encodeURIComponent(tank)}/${mode==='issue'?'issue':'stock'}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,assetId:asset,litres:Number(litres),currentLitres:Number(litres),assetFuelPercentAfter:Number(percent),activityText:activity,clientEventId:eventId,...location})});
      const data=await response.json();if(!response.ok)throw Error(data.error || 'Could not save fuel entry.');
      setMode(null);await onSaved();
    } catch(e) {setError(e instanceof Error?e.message:'Allow location access and try again.');} finally {setBusy(false);}
  }
  return <section className={styles.card}><div className={styles.actions}>
    {desktop.can('recordFuelIssues') && <button className={styles.button} onClick={()=>open('issue')}>Record fuel issued</button>}
    {desktop.can('refillFuel') && <><button className={styles.button} onClick={()=>open('stock_in')}>Record tank refill</button><button className={styles.button} onClick={()=>open('dip')}>Record dip reading</button></>}
    </div>{mode && <TeamModal ownerStyle title={mode==='issue'?'Record fuel issued':mode==='dip'?'Record dip reading':'Record tank refill'} onClose={()=>{if(!busy)setMode(null);}} busy={busy}>
      <form onSubmit={save} className={styles.body}><div className={styles.grid}>
        <label className={styles.field}>Fuel tank<select className={styles.input} required value={tank} onChange={e=>setTank(e.target.value)}><option value="">Choose a tank</option>{tanks.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        {mode==='issue' && <label className={styles.field}>Asset<select className={styles.input} required value={asset} onChange={e=>setAsset(e.target.value)}><option value="">Choose an asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.title}</option>)}</select></label>}
        <label className={styles.field}>{mode==='dip'?'Measured tank level (litres)':'Litres'}<input className={styles.input} type="number" min={mode==='dip'?0:0.001} step="0.001" required value={litres} onChange={e=>setLitres(e.target.value)}/></label>
        {mode==='issue' && <><label className={styles.field}>Asset fuel level after filling (%)<input className={styles.input} type="number" min="0" max="100" required value={percent} onChange={e=>setPercent(e.target.value)}/></label><label className={styles.field}>Activity<input className={styles.input} required minLength={2} maxLength={120} value={activity} onChange={e=>setActivity(e.target.value)}/></label></>}
      </div>{mode==='issue' && <p>Your location is recorded with this fuel issue.</p>}{error && <p role="alert" className={styles.error}>{error}</p>}<div className={styles.actions}><button type="button" className={styles.button} disabled={busy} onClick={()=>setMode(null)}>Cancel</button><button className={styles.primary} disabled={busy}>{busy?'Saving…':'Save entry'}</button></div></form>
    </TeamModal>}</section>;
}
