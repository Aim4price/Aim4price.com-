'use client';

import { useEffect, useRef } from 'react';
import accountStyles from '../app/account/page.module.css';
import styles from './AssetFilterDialog.module.css';
import CompactChoicePages from './CompactChoicePages';

export type FilterChoice<K extends string> = { value: K; label: string };
export type FilterGroup<K extends string> = { label: string; section: 'status' | 'details'; options: FilterChoice<K>[] };

export function replaceFilterGroup<K extends string>(current: K[], options: FilterChoice<K>[], value: K | ''): K[] {
  const remaining = current.filter((key) => !options.some((option) => option.value === key));
  return value ? [...remaining, value] : remaining;
}

export default function AssetFilterDialog<K extends string>({ groups, options, selected, sort, sortOptions, resultCount, onGroupChange, onSortChange, onClear, onClose }: {
  groups: FilterGroup<K>[];
  options: FilterChoice<K>[];
  selected: K[];
  sort: K;
  sortOptions: FilterChoice<K>[];
  resultCount: number;
  onGroupChange: (options: FilterChoice<K>[], value: K | '') => void;
  onSortChange: (value: K) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus?.focus();
  }, []);
  const activeCount = selected.length + (sort !== sortOptions[0].value ? 1 : 0);

  return (
    <div className={styles.overlay} data-website-overlay>
      <div className={styles.backdrop} onClick={onClose} aria-hidden="true" />
      <section ref={dialogRef} id="asset-register-filter-modal" className={`${styles.dialog} ${accountStyles.modalTheme}`} role="dialog" aria-modal="true" aria-labelledby="asset-register-filter-title" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select'));
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <header className={styles.header}>
          <div><h3 id="asset-register-filter-title">Filter assets</h3><p aria-live="polite">{resultCount} {resultCount === 1 ? 'asset' : 'assets'} found</p></div>
          <button type="button" className={`${accountStyles.modalCloseButton} ${accountStyles.passwordModalCloseButton}`} onClick={onClose} aria-label="Close asset filters">×</button>
        </header>
        <div className={styles.body}>
          <button type="button" className={styles.all} aria-pressed={!activeCount} onClick={onClear}>All Assets</button>
          <CompactChoicePages reservedHeight={300} rowHeight={56}>
            {options.filter((option) => option.value !== sortOptions[0].value).map((option) => {
              const group = groups.find((item) => item.options.some((choice) => choice.value === option.value));
              const active = group ? selected.includes(option.value) : sort === option.value;
              return <button type="button" className={styles.choice} key={option.value} aria-pressed={active} onClick={() => {
                if (group) onGroupChange(group.options, active ? '' : option.value);
                else onSortChange(active ? sortOptions[0].value : option.value);
              }}>{option.label}</button>;
            })}
          </CompactChoicePages>
        </div>
        <footer className={styles.footer}>
          <button type="button" className={styles.clear} onClick={onClear} disabled={!activeCount}>Clear filters</button>
          <button type="button" className={styles.done} onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}
