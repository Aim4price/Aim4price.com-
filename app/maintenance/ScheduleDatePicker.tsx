'use client';
import DateInput from '../../components/DateInput';
import styles from './page.module.css';
export default function ScheduleDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <label className={styles.filterField}><span>Due date</span><DateInput aria-label="Due date" value={value} onValueChange={onChange} required /></label>;
}
