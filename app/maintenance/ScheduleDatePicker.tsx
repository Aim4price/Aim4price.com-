'use client';

import { useRef, useState } from 'react';
import styles from './ScheduleDatePicker.module.css';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function ScheduleDatePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [text, setText] = useState(() => value ? value.split('-').reverse().join('/') : '');
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  function chooseDate(next: string) {
    setText(next.split('-').reverse().join('/'));
    input.current?.setCustomValidity('');
    onChange(next);
    dialog.current?.close();
  }
  function editDate(next: string) {
    setText(next);
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(next);
    const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
    const parsed = iso ? new Date(`${iso}T12:00:00`) : null;
    const valid = parsed && !Number.isNaN(parsed.getTime()) && dateKey(parsed) === iso;
    input.current?.setCustomValidity(valid ? '' : 'Enter a valid date as DD/MM/YYYY.');
    onChange(valid ? iso : '');
  }
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
    <>
      <label className={styles.dateLabel}>
        <span>Due date</span>
        <span className={styles.dateField}>
          <input ref={input} aria-label="Due date" type="text" inputMode="text" placeholder="DD/MM/YYYY" required maxLength={10} value={text} onChange={(event) => editDate(event.target.value)} />
          <button type="button" aria-label="Open calendar" aria-haspopup="dialog" onClick={() => { setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); dialog.current?.showModal(); }}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></svg>
          </button>
        </span>
      </label>
      <dialog ref={dialog} className={styles.dateDialog} aria-label="Choose due date" onCancel={(event) => event.stopPropagation()} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className={styles.calendar}>
        <header className={styles.dialogHeader}><h3>Choose a date</h3><button type="button" aria-label="Close calendar" onClick={() => dialog.current?.close()}>×</button></header>
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
          return <button key={key} type="button" data-date={key} aria-label={date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={value === key} aria-current={today === key ? 'date' : undefined} onClick={() => chooseDate(key)} onKeyDown={(event) => {
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
            if (delta === undefined) return;
            event.preventDefault();
            focusDate(new Date(year, monthIndex, i + 1 + delta, 12));
          }}>{i + 1}</button>;
        })}
      </div>
      <div className={styles.summary}>
        <span aria-live="polite">{selected && !Number.isNaN(selected.getTime()) ? selected.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Choose a date'}</span>
        <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); chooseDate(dateKey(now)); }}>Today</button>
      </div>
      </div>
      </dialog>
    </>
  );
}
