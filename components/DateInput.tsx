'use client';

import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import styles from './DateInput.module.css';

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function displayDate(value: string) { return value ? value.split('-').reverse().join('/') : ''; }
function parseDate(text: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return '';
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const parsed = new Date(`${iso}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && dateKey(parsed) === iso ? iso : '';
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'onChange' | 'min' | 'max'> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string;
  max?: string;
};

/** Editable DD/MM/YYYY field; all callers and form submissions receive ISO dates. */
export default function DateInput({ value, defaultValue = '', onValueChange, min, max, name, disabled, readOnly, required, className, ...props }: Props) {
  const [localValue, setLocalValue] = useState(defaultValue);
  const isoValue = value ?? localValue;
  const [text, setText] = useState(() => displayDate(isoValue));
  const emitted = useRef(isoValue);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (isoValue !== emitted.current) { setText(displayDate(isoValue)); emitted.current = isoValue; }
  }, [isoValue]);
  const withinBounds = (date: string) => (!min || date >= min) && (!max || date <= max);
  function validity(raw: string) {
    if (!raw) return '';
    const iso = parseDate(raw);
    if (!iso) return 'Enter a valid date as DD/MM/YYYY.';
    if (min && iso < min) return `Choose ${displayDate(min)} or later.`;
    if (max && iso > max) return `Choose ${displayDate(max)} or earlier.`;
    return '';
  }
  useEffect(() => { input.current?.setCustomValidity(validity(text)); }, [text, min, max]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      if (value !== undefined) return;
      setLocalValue(defaultValue); setText(displayDate(defaultValue)); emitted.current = defaultValue;
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, defaultValue]);
  function emit(next: string) {
    emitted.current = next;
    setLocalValue(next);
    onValueChange?.(next);
  }
  function chooseDate(next: string) {
    setText(displayDate(next));
    input.current?.setCustomValidity('');
    emit(next);
    dialog.current?.close();
  }
  function editDate(next: string) {
    setText(next);
    input.current?.setCustomValidity(validity(next));
    emit(validity(next) ? '' : parseDate(next));
  }
  const selected = isoValue ? new Date(`${isoValue}T12:00:00`) : null;
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
    if (!withinBounds(dateKey(date))) return;
    setMonth(new Date(date.getFullYear(), date.getMonth(), 1));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${dateKey(date)}"]`)?.focus());
  }
  return (
    <>
      <span className={styles.dateField}>
        <input {...props} ref={input} className={`${styles.input} ${className ?? ''}`} aria-label={props['aria-label']} type="text" inputMode="text" placeholder="DD/MM/YYYY" required={required} disabled={disabled} readOnly={readOnly} maxLength={10} value={text} onChange={(event) => editDate(event.target.value)} />
        {name ? <input type="hidden" name={name} value={isoValue} disabled={disabled} /> : null}
        <button type="button" disabled={disabled || readOnly} aria-label="Open calendar" aria-haspopup="dialog" onClick={() => { setMonth(new Date(initial.getFullYear(), initial.getMonth(), 1)); dialog.current?.showModal(); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></svg>
        </button>
      </span>
      {mounted ? createPortal(<dialog ref={dialog} className={styles.dateDialog} aria-label="Choose a date" onCancel={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) dialog.current?.close(); }}>
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
          return <button key={key} type="button" disabled={!withinBounds(key)} data-date={key} aria-label={date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={isoValue === key} aria-current={today === key ? 'date' : undefined} onClick={() => chooseDate(key)} onKeyDown={(event) => {
            const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
            if (delta === undefined) return;
            event.preventDefault();
            focusDate(new Date(year, monthIndex, i + 1 + delta, 12));
          }}>{i + 1}</button>;
        })}
      </div>
      <div className={styles.summary}>
        <span aria-live="polite">{selected && !Number.isNaN(selected.getTime()) ? selected.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Choose a date'}</span>
        <button type="button" disabled={!withinBounds(today)} onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); chooseDate(dateKey(now)); }}>Today</button>
      </div>
      </div>
      </dialog>, document.body) : null}
    </>
  );
}
