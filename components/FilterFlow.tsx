'use client';

import { Children, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import styles from './FilterFlow.module.css';
import DropdownOverlay from './DropdownOverlay';

/** Shared filter dialog: keep choices in the caller so Back never loses an answer. */
export default function FilterFlow({ title, children, onClose, onClear, onApply, dialogRef }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  dialogRef?: Ref<HTMLDivElement>;
}) {
  const titleId = useId();
  const steps = Children.toArray(children);
  const [step, setStep] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const currentStep = Math.min(step, steps.length - 1);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);

  useEffect(() => { bodyRef.current?.focus(); }, [currentStep]);

  return (
    <div className={styles.overlay} data-website-overlay onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={styles.dialog} ref={(node) => {
        rootRef.current = node;
        if (typeof dialogRef === 'function') dialogRef(node);
        else if (dialogRef) (dialogRef as { current: HTMLDivElement | null }).current = node;
      }} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        event.stopPropagation();
        const controls = Array.from(rootRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === bodyRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <header className={styles.header}>
          <h2 id={titleId}>{title}</h2>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close filters">×</button>
        </header>
        <div className={styles.body} ref={bodyRef} tabIndex={-1} key={currentStep}>
          <p className={styles.progress}>Question {currentStep + 1} of {steps.length}</p>
          {steps[currentStep]}
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.clear} onClick={() => { onClear(); onClose(); }}>Clear filters</button>
          {currentStep > 0 ? <button type="button" onClick={() => setStep(currentStep - 1)}>Back</button> : null}
          <button type="button" className={styles.apply} onClick={onApply}>Apply filters</button>
          {currentStep < steps.length - 1 ? <button type="button" className={styles.next} onClick={() => setStep(currentStep + 1)}>Next</button> : null}
        </footer>
      </div>
    </div>
  );
}

export function FilterQuestion({ label, value, options, onChange, disabled = false, searchable = false, searchPlaceholder = 'Search options', noMatchesLabel = 'No matches found' }: {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  noMatchesLabel?: string;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef({ text: '', time: 0 });
  const menuId = `${id}-options`;
  const matches = options.filter((option) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  // Keep the current selection and the unrestricted option available while searching.
  const visible = options.filter((option, index) => index === 0 || option.value === value || matches.includes(option));
  const activeIndex = Math.min(active, visible.length - 1);
  const selected = options.find((option) => option.value === value) ?? options[0];
  function openMenu() {
    setActive(Math.max(0, visible.findIndex((option) => option.value === value)));
    setOpen(true);
  }
  function choose(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      const target = event.target as Node;
      if (!questionRef.current?.contains(target) && !document.getElementById(menuId)?.contains(target)) setOpen(false);
    }
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [open, menuId]);
  useEffect(() => {
    if (open) document.getElementById(`${menuId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, menuId]);
  return <div className={styles.question} ref={questionRef}>
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
    {searchable && !disabled ? <input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} placeholder={searchPlaceholder} aria-label={searchPlaceholder} /> : null}
    <button id={id} ref={triggerRef} type="button" className={styles.selectTrigger} disabled={disabled}
      role="combobox" aria-labelledby={`${id}-label`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? menuId : undefined} aria-activedescendant={open && activeIndex >= 0 ? `${menuId}-${activeIndex}` : undefined}
      onClick={() => open ? setOpen(false) : openMenu()}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); return; }
        if (event.key === 'Tab') { setOpen(false); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          if (!open) { openMenu(); return; }
          setActive(event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : Math.max(0, Math.min(visible.length - 1, activeIndex + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (open && visible[activeIndex]) choose(visible[activeIndex].value); else openMenu();
        } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const now = Date.now();
          const text = (now - typeaheadRef.current.time < 600 ? typeaheadRef.current.text : '') + event.key.toLowerCase();
          typeaheadRef.current = { text, time: now };
          const index = visible.findIndex((option) => option.label.toLowerCase().startsWith(text));
          if (index >= 0) { setActive(index); setOpen(true); }
        }
      }}>
      <span className={styles.selectedLabel}>{selected?.label ?? 'Choose an option'}</span>
      <span className={styles.chevronSlot} aria-hidden="true"><svg viewBox="0 0 24 24" className={open ? styles.chevronOpen : undefined}><path d="m6 9 6 6 6-6" /></svg></span>
    </button>
    {open && !disabled ? <DropdownOverlay id={menuId} anchorRef={triggerRef} className={styles.selectMenu} role="listbox" aria-labelledby={`${id}-label`} maxHeight={280}>
      {visible.map((option, index) => <button key={option.value} id={`${menuId}-${index}`} type="button" role="option" aria-selected={option.value === value} tabIndex={-1}
        className={`${styles.selectOption} ${index === activeIndex ? styles.optionFocused : ''}`}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option.value)}>
        <span>{option.label}</span><span className={styles.optionCheck} aria-hidden="true">{option.value === value ? '✓' : ''}</span>
      </button>)}
    </DropdownOverlay> : null}
    {query.trim() && !matches.length ? <small role="status">{noMatchesLabel}</small> : null}
    {disabled ? <small>Choose a specific option in the previous question to narrow this further, or continue with all.</small> : null}
  </div>;
}

/** Presets keep the flow simple while retaining arbitrary maintenance thresholds. */
export function FilterThresholdQuestion({ label, unit, value, presets, onChange }: {
  label: string;
  unit: string;
  value: string;
  presets: number[];
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(Boolean(value) && !presets.some((preset) => String(preset) === value));
  return <div className={styles.question}>
    <FilterQuestion label={label} value={custom ? 'custom' : value} options={[
      { value: '', label: 'Any time' },
      ...presets.map((preset) => ({ value: String(preset), label: `Within ${preset.toLocaleString('en-ZA')} ${unit}` })),
      { value: 'custom', label: 'Enter a limit' },
    ]} onChange={(next) => { setCustom(next === 'custom'); onChange(next === 'custom' ? '' : next); }} />
    {custom ? <label>Maximum {unit}<input type="number" min="0" step="1" value={value} onChange={(event) => onChange(event.target.value)} /></label> : null}
    <small>Overdue maintenance stays included. If you set several limits, any matching limit is enough.</small>
  </div>;
}
