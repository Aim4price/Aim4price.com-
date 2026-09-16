'use client';

import { useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
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

function CalendarSelect({ label, value, options, onChange }: {
  label: string;
  value: number;
  options: { value: number; label: string }[];
  onChange: (value: number) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const selected = menu.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
    selected?.focus();
    selected?.scrollIntoView({ block: 'nearest' });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return <div ref={root} className={styles.selectRoot} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} className={styles.selectTrigger} type="button" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); }
    }}>
      <span>{options.find((option) => option.value === value)?.label}</span>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    {open ? <div id={id} ref={menu} role="listbox" aria-label={label} className={styles.selectMenu} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); return; }
      const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'ArrowDown' ? Math.min(index + 1, buttons.length - 1) : event.key === 'ArrowUp' ? Math.max(index - 1, 0) : event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next]?.focus(); }
    }}>
      {options.map((option) => <button key={option.value} type="button" role="option" tabIndex={-1} aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}>
        <span>{option.label}</span>{option.value === value ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg> : null}
      </button>)}
    </div> : null}
  </div>;
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
          <CalendarSelect label="Month" value={monthIndex} options={Array.from({ length: 12 }, (_, i) => ({ value: i, label: new Date(2000, i, 1).toLocaleDateString('en-ZA', { month: 'long' }) }))} onChange={(value) => setMonth(new Date(year, value, 1))} />
          <CalendarSelect label="Year" value={year} options={years.map((item) => ({ value: item, label: String(item) }))} onChange={(value) => setMonth(new Date(value, monthIndex, 1))} />
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
