'use client';

import { useId } from 'react';
import styles from './ValueInclusionControl.module.css';

export default function ValueInclusionControl({ checked, onChange, disabled = false, combined = false }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; combined?: boolean;
}) {
  const id = useId();
  const description = combined
    ? checked
      ? 'This register’s asset value and replacement value count towards your combined totals.'
      : 'This register keeps its own totals. Its values are excluded from your combined totals.'
    : 'Keep this asset in the register and choose whether its values count towards totals.';

  return (
    <label className={styles.control} data-combined={combined || undefined}>
      <span>
        <strong id={id}>{combined ? 'Include in combined totals' : 'Include in register total'}</strong>
        <small id={id + '-help'} className={styles.assetHelper}>{description}</small>
      </span>
      <input type="checkbox" role="switch" aria-labelledby={id} aria-describedby={id + '-help'}
        checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} />
    </label>
  );
}
