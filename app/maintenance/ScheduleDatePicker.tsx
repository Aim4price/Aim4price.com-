'use client';

import { useRef, useState } from 'react';
import styles from './ScheduleDatePicker.module.css';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ScheduleDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const selected = value ? new Date(`${value}T12:00:00`) : null;
  const initial = selected && !Number.isNaN(selected.getTime()) ? selected : new Date();
  const [month, setMonth] = useState(() => new Date(initial.getFullYear(), initial.getMonth(), 1));
  const grid = useRef<HTMLDivElement>(null);
  const today = dateKey(new Date());
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (month.getDay() + 6) % 7;
  const count = new Date(year, monthIndex + 1, 0).getDate();
  const years = Array.from({ length: Math.max(2100, year) - Math.min(1900, year) + 1 }, (_, i) => Math.min(1900, year) + i);

  function focusDate(date: Date) {
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${dateKey(date)}"]`)?.focus());
  }

  return (
    <div className={styles.calendar} aria-label="Choose due date">
      <div className={styles.navigation}>
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></button>
        <div className={styles.selectors}>
          <select aria-label="Month" value={monthIndex} onChange={(event) => setMonth(new Date(year, Number(event.target.value), 1))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i}>{new Date(2000, i, 1).toLocaleDateString('en-ZA', { month: 'long' })}</option>)}
          </select>
          <select aria-label="Year" value={year} onChange={(event) => setMonth(new Date(Number(event.target.value), monthIndex, 1))}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></button>
      </div>
      <div className={styles.days} ref={grid}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className={styles.weekday}>{day}</span>)}
        {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} aria-hidden="true" />)}
        {Array.from({ length: count }, (_, i) => {
          const date = new Date(year, monthIndex, i + 1, 12);
          const key = dateKey(date);
          return <button key={key} type="button" data-date={key} aria-label={date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={value === key} aria-current={today === key ? 'date' : undefined} onClick={() => onChange(key)} onKeyDown={(event) => {
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
            if (delta === undefined) return;
            event.preventDefault();
            focusDate(new Date(year, monthIndex, i + 1 + delta, 12));
          }}>{i + 1}</button>;
        })}
      </div>
      <div className={styles.summary}>
        <span aria-live="polite">{selected && !Number.isNaN(selected.getTime()) ? selected.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Choose a date'}</span>
        <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); onChange(dateKey(now)); }}>Today</button>
      </div>
    </div>
  );
}
