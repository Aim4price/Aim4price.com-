'use client';
import styles from './ValueInclusionControl.module.css';
export default function ValueInclusionControl({ checked, onChange, disabled = false, combined = false }: {
  checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; combined?: boolean;
}) {
  return <label className={styles.control}>
    <span><strong>{combined ? 'Include in combined totals' : 'Include in register total'}</strong>
    <small className={combined ? undefined : styles.assetHelper}>{combined ? 'When off, this register keeps its own total but adds nothing to combined totals.' : 'Keep this asset in the register and choose whether its values count towards totals.'}</small></span>
    <input type="checkbox" role="switch" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} />
  </label>;
}
