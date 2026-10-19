'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './ListPagination.module.css';

export type ListPageSize = 6 | 12 | 18 | 'all';

type Props<T extends number | 'all'> = {
  page: number;
  pageCount: number;
  pageSize?: T;
  pageSizeOptions?: readonly T[];
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: T) => void;
  label: string;
  sizeLabel?: string;
  sizeDescription?: string;
  summary?: ReactNode;
  disabled?: boolean;
  /** Server-rendered lists can preserve normal link navigation. */
  pageHrefPrefix?: string;
};

export default function ListPagination<T extends number | 'all' = ListPageSize>({
  page, pageCount, pageSize, pageSizeOptions, onPageChange, onPageSizeChange,
  label, sizeLabel = 'Show per page', sizeDescription, summary, disabled = false, pageHrefPrefix,
}: Props<T>) {
  const total = Math.max(1, pageCount);
  const current = Math.min(Math.max(1, page), total);
  const pages = total <= 7
    ? Array.from({ length: total }, (_, index) => index + 1)
    : Array.from(new Set([1, total, current - 1, current, current + 1]))
      .filter(value => value >= 1 && value <= total).sort((a, b) => a - b);
  const sizes = pageSizeOptions ?? ([6, 12, 18, 'all'] as unknown as readonly T[]);

  function pageControl(value: number, content: ReactNode, name: string, unavailable = false) {
    const selected = name.startsWith('Page ') && value === current;
    const className = `${styles.button} ${selected ? styles.selectedPage : ''}`;
    const common = { className, 'aria-label': name, 'aria-current': selected ? 'page' as const : undefined };
    if (pageHrefPrefix && !disabled && !unavailable) {
      return <Link {...common} href={`${pageHrefPrefix}${value}`}>{content}</Link>;
    }
    return <button {...common} type="button" disabled={disabled || unavailable} onClick={() => onPageChange?.(value)}>{content}</button>;
  }

  return (
    <nav className={styles.bar} aria-label={label}>
      {pageSize !== undefined && onPageSizeChange ? (
        <div className={styles.sizes} role="group" aria-label={`${label}: items per page`} title={sizeDescription}>
          <span>{sizeLabel}</span>
          <div className={styles.sizeButtons}>
            {sizes.map(size => (
              <button key={size} type="button" className={`${styles.button} ${pageSize === size ? styles.selectedSize : ''}`}
                aria-label={`Show ${size === 'all' ? 'all' : size} per page${sizeDescription ? `: ${sizeDescription}` : ''}`}
                aria-pressed={pageSize === size} disabled={disabled} onClick={() => onPageSizeChange(size)}>
                {size === 'all' ? 'All' : size}
              </button>
            ))}
          </div>
        </div>
      ) : summary ? <div className={styles.summary}>{summary}</div> : null}
      <div className={styles.navigation}>
        <div className={styles.meta} aria-live="polite">Page {current} of {total}</div>
        {total > 1 ? <div className={styles.actions}>
          {pageControl(current - 1, <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>, 'Previous page', current <= 1)}
          {pages.map((value, index) => (
            <span className={styles.pageEntry} key={value}>
              {index > 0 && value - pages[index - 1] > 1 ? <span className={styles.ellipsis} aria-hidden="true">…</span> : null}
              {pageControl(value, value, `Page ${value}`)}
            </span>
          ))}
          {pageControl(current + 1, <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>, 'Next page', current >= total)}
        </div> : null}
      </div>
    </nav>
  );
}
