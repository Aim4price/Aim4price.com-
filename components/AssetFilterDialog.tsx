'use client';

import { useEffect, useRef, useState } from 'react';
import accountStyles from '../app/account/page.module.css';
import styles from './AssetFilterDialog.module.css';

export type FilterChoice<K extends string> = { value: K; label: string };
export type FilterGroup<K extends string> = { label: string; section: 'status' | 'details'; options: FilterChoice<K>[] };

export function replaceFilterGroup<K extends string>(current: K[], options: FilterChoice<K>[], value: K | ''): K[] {
  const remaining = current.filter((key) => !options.some((option) => option.value === key));
  return value ? [...remaining, value] : remaining;
}

export default function AssetFilterDialog<K extends string>({ groups, selected, sort, sortOptions, resultCount, onGroupChange, onSortChange, onClear, onClose }: {
  groups: FilterGroup<K>[];
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
  const [section, setSection] = useState<'status' | 'details' | 'sort'>('status');
  const [page, setPage] = useState(0);
  const [shortScreen, setShortScreen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-height: 640px)');
    const update = () => {
      const limit = dialogRef.current ? Number.parseFloat(window.getComputedStyle(dialogRef.current).maxHeight) : Infinity;
      setShortScreen(media.matches || limit < 620);
      setPage(0);
    };
    update();
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    return () => { media.removeEventListener('change', update); window.removeEventListener('resize', update); };
  }, []);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previousFocus?.focus();
  }, []);
  const visibleGroups = groups.filter((group) => group.section === section);
  const pageSize = shortScreen ? 2 : 4;
  const pageCount = Math.max(1, Math.ceil(visibleGroups.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
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
        <nav className={styles.tabs} aria-label="Filter sections">
          {(['status', 'details', 'sort'] as const).map((tab) => {
            const count = tab === 'sort' ? Number(sort !== sortOptions[0].value) : groups.filter((group) => group.section === tab).filter((group) => group.options.some((option) => selected.includes(option.value))).length;
            return <button type="button" key={tab} aria-pressed={section === tab} onClick={() => { setSection(tab); setPage(0); }}>{tab === 'status' ? 'Status' : tab === 'details' ? 'Details' : 'Sort'}{count > 0 ? <span>{count}</span> : null}</button>;
          })}
        </nav>
        <div className={styles.body}>
          {section === 'sort' ? (
            <label className={styles.sortField}>Sort by
              <select value={sort} onChange={(event) => onSortChange(event.target.value as K)}>
                {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          ) : visibleGroups.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map((group) => {
            const value = group.options.find((option) => selected.includes(option.value))?.value ?? '';
            return <fieldset className={styles.row} key={group.label}>
              <legend>{group.label}</legend>
              <div className={styles.choices}>
                {[{ value: '' as const, label: 'All' }, ...group.options].map((option) => <button type="button" key={option.value} aria-pressed={value === option.value} onClick={() => onGroupChange(group.options, option.value)}>{option.label}</button>)}
              </div>
            </fieldset>;
          })}
        </div>
        {section !== 'sort' && pageCount > 1 ? <div className={styles.pages}><button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Previous</button><span>{currentPage + 1} / {pageCount}</span><button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage + 1 === pageCount}>Next</button></div> : null}
        <footer className={styles.footer}>
          <button type="button" className={styles.clear} onClick={onClear} disabled={!activeCount}>Clear filters</button>
          <button type="button" className={styles.done} onClick={onClose}>Done</button>
        </footer>
      </section>
    </div>
  );
}
