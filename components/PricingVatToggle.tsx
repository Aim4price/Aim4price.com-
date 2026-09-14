'use client';
import styles from './PricingVatToggle.module.css';
export default function PricingVatToggle({ included, onChange }: { included: boolean; onChange: (included: boolean) => void }) {
  return <div className={styles.toggle} role="group" aria-label="Price VAT display">
    <button type="button" aria-pressed={!included} onClick={() => onChange(false)}>Excl. VAT</button>
    <button type="button" aria-pressed={included} onClick={() => onChange(true)}>Incl. VAT</button>
  </div>;
}
