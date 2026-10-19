'use client';

import styles from './BudgetWarningInput.module.css';

export default function BudgetWarningInput({ value, onChange, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const parsed = Number(value);
  const current = value.trim() && Number.isFinite(parsed) ? parsed : 80;
  const adjust = (delta: number) => onChange(String(Math.max(1, Math.min(99, Math.round(current) + delta))));
  return <div className={styles.field}>
    <span className={styles.label}>Warning level</span>
    <div className={styles.control}>
      <button type="button" aria-label="Decrease warning level" disabled={disabled || current <= 1} onClick={() => adjust(-1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <div className={styles.reading}>
        <input type="number" inputMode="numeric" min="1" max="99" step="1" required
          aria-label="Warning level percentage, from 1 to 99"
          value={value} disabled={disabled} onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => onChange(event.target.value)} />
        <span aria-hidden="true">%</span>
      </div>
      <button type="button" aria-label="Increase warning level" disabled={disabled || current >= 99} onClick={() => adjust(1)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg>
      </button>
    </div>
    <small>Alert when this percentage of the budget is used. Enter 1–99%.</small>
  </div>;
}
