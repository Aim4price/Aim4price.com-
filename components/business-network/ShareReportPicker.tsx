'use client';
import { useState } from 'react';
import { SHARE_REPORT_TYPES, type ShareReportChoice, type ShareReportKind } from '../../lib/external-share-reports';
import styles from './BusinessListingInvite.module.css';

export default function ShareReportPicker({ value, onSave, onCancel }: { value: ShareReportChoice[]; onSave: (choices: ShareReportChoice[]) => void; onCancel: () => void }) {
  const [choices, setChoices] = useState(value);
  const [active, setActive] = useState<ShareReportKind>(value[0]?.kind || 'maintenance');
  const selected = choices.find(choice => choice.kind === active);
  const draft = selected || { kind: active, year: 'all', month: 'all', maintenanceType: 'all' };
  const update = (patch: Partial<ShareReportChoice>) => setChoices(current => [...current.filter(choice => choice.kind !== active), { ...draft, ...patch }]);
  return <>
    <p className={styles.description}>Choose reports and set a timeline for each. Only the selected assets will be included.</p>
    <div className={styles.reportLayout}>
      <div className={styles.reportChoices} aria-label="Reports to share">
        {SHARE_REPORT_TYPES.map(type => <div key={type.key} className={`${styles.reportChoice} ${active === type.key ? styles.activeReport : ''}`}>
          <input aria-label={`Share ${type.label}`} type="checkbox" checked={choices.some(choice => choice.kind === type.key)} onChange={event => { setActive(type.key); setChoices(current => event.target.checked ? [...current, {kind:type.key, year:'all', month:'all', maintenanceType:'all'}] : current.filter(choice => choice.kind !== type.key)); }}/>
          <button type="button" onClick={() => setActive(type.key)} aria-pressed={active === type.key}><strong>{type.label}</strong><small>{type.description}</small></button>
        </div>)}
      </div>
      <fieldset className={styles.timeline}>
        <legend>{SHARE_REPORT_TYPES.find(type => type.key === active)?.label} timeline</legend>
        <label>Year<select value={draft.year} onChange={event => update({year:event.target.value, month:'all'})}><option value="all">All time</option>{Array.from({length:new Date().getFullYear()-1999},(_,i)=>String(new Date().getFullYear()-i)).map(year=><option key={year}>{year}</option>)}</select></label>
        <label>Month<select value={draft.month} disabled={draft.year === 'all'} onChange={event => update({month:event.target.value})}><option value="all">All months</option>{Array.from({length:12},(_,i)=><option key={i} value={String(i+1)}>{new Date(2020,i,1).toLocaleString('en-ZA',{month:'long'})}</option>)}</select></label>
        {active === 'maintenance' && <label>Include<select value={draft.maintenanceType} onChange={event => update({maintenanceType:event.target.value})}><option value="all">All maintenance</option><option value="checked">Check-ups</option><option value="serviced">Services</option><option value="repaired">Repairs</option></select></label>}
        <p className={styles.hint}>{selected ? 'This report will be shared with the timeline above.' : 'Select this report or choose a timeline to include it.'}</p>
      </fieldset>
    </div>
    <div className={styles.footer}><button type="button" className={styles.copy} onClick={onCancel}>Cancel</button><button type="button" className={styles.primary} onClick={()=>onSave(choices)}>{choices.length ? `Use ${choices.length} ${choices.length === 1 ? 'report' : 'reports'}` : 'Continue without reports'}</button></div>
  </>;
}
