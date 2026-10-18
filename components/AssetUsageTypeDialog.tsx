'use client';

import { useState } from 'react';
import { createPortal } from './WebsitePortal';
import LeadActionDialog from './leads/LeadActionDialog';
import type { AssetUsageMetric } from '../lib/asset-usage';
import styles from './AssetDetailChoiceField.module.css';
import layout from './AssetUsageTypeDialog.module.css';

export const USAGE_TYPE_OPTIONS: Array<{value: AssetUsageMetric; label: string; description: string}> = [
  {value: 'hours', label: 'Hours', description: 'Use the machine hour meter.'},
  {value: 'km', label: 'Kilometers', description: 'Use the odometer reading.'},
  {value: 'percentage', label: 'Percentage', description: 'Estimate the working life already used.'},
  {value: 'not_applicable', label: 'Unknown', description: 'No usage reading is available.'},
];

export default function AssetUsageTypeDialog({value, assetTitle, onClose, onConfirm}: {
  value: AssetUsageMetric; assetTitle: string; onClose: () => void;
  onConfirm: (metric: AssetUsageMetric, reading: string) => void;
}) {
  const [pending, setPending] = useState<AssetUsageMetric | null>(null);
  const [reading, setReading] = useState('');
  const label = (metric: AssetUsageMetric) => USAGE_TYPE_OPTIONS.find(option => option.value === metric)!.label;
  const number = Number(reading.replace(/\s/g, ''));
  const valid = pending === 'not_applicable' || (reading.trim() !== '' && Number.isFinite(number) && number >= 0 && (pending !== 'percentage' || number <= 100));
  return createPortal(<LeadActionDialog title={pending ? 'Change usage type?' : 'Choose usage type'} assetTitle={assetTitle}
    className={`${styles.dialog} ${layout.dialog}`} onClose={onClose} closeLabel="Close usage type"
    footer={pending ? <div className={layout.actions}><button type="button" onClick={() => setPending(null)}>Back</button><button type="button" disabled={!valid} onClick={() => {onConfirm(pending, pending === 'not_applicable' ? '' : String(number)); onClose();}}>Confirm change</button></div> : undefined}>
    {pending ? <div className={layout.confirm}>
      <div className={layout.comparison}><div><span>Current</span><strong>{label(value)}</strong></div><div><span>Change to</span><strong>{label(pending)}</strong></div></div>
      <p>Are you sure you want to change how this asset’s usage is recorded?</p>
      {pending !== 'not_applicable' ? <label className={layout.reading}><span>{pending === 'percentage' ? 'Working life used (%)' : `Current reading (${pending === 'km' ? 'km' : 'hours'})`}</span><input autoFocus type="number" min="0" max={pending === 'percentage' ? 100 : undefined} step={pending === 'percentage' ? '0.1' : '1'} value={reading} onChange={event => setReading(event.target.value)} placeholder="Enter the new reading"/><small>Enter the correct reading. The previous number will not be converted.</small></label> : <p>The current reading will be cleared. Previous records remain in asset history.</p>}
    </div> : <div className={styles.choices}>
      {USAGE_TYPE_OPTIONS.map((option,index) => <button type="button" key={option.value} className={`${styles.choice} ${value === option.value ? styles.selected : ''}`} aria-pressed={value === option.value} onClick={() => {if(value === option.value){onClose();return;}setReading('');setPending(option.value);}}>
        <span className={styles.icon} data-tone={['teal','blue','amber','grey'][index]} aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d={option.value === 'percentage' ? 'm8 16 8-8M8 8h.01M16 16h.01' : option.value === 'not_applicable' ? 'M8 12h8' : 'M12 7v5l3 2'}/></svg></span>
        <span className={styles.copy}><strong>{option.label}</strong><small>{option.description}</small></span><span className={styles.check} aria-hidden="true">{value === option.value ? '✓' : ''}</span>
      </button>)}
    </div>}
  </LeadActionDialog>, document.body);
}
