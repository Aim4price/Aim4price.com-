'use client';

import styles from './ListPagination.module.css';

export type ListPageSize = 6 | 12 | 18 | 'all';

type Props = {
  page: number;
  pageCount: number;
  pageSize: ListPageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: ListPageSize) => void;
  label: string;
  sizeLabel?: string;
};

export default function ListPagination({
  page, pageCount, pageSize, onPageChange, onPageSizeChange, label, sizeLabel = 'Show',
}: Props) {
  const pages = Array.from(new Set([1, pageCount, page - 1, page, page + 1]))
    .filter(value => value >= 1 && value <= pageCount)
    .sort((a, b) => a - b);

  return (
    <nav className={styles.bar} aria-label={label}>
      <div className={styles.info}>
        <div className={styles.meta} aria-live="polite">Page {page} of {pageCount}</div>
        <div className={styles.sizes} role="group" aria-label={`${label}: items per page`}>
          <span>{sizeLabel}</span>
          <div className={styles.sizeButtons}>
            {([6, 12, 18, 'all'] as const).map(size => (
              <button
                key={size}
                type="button"
                className={`${styles.button} ${pageSize === size ? styles.selectedSize : ''}`}
                aria-pressed={pageSize === size}
                onClick={() => onPageSizeChange(size)}
              >
                {size === 'all' ? 'All' : size}
              </button>
            ))}
          </div>
        </div>
      </div>
      {pageCount > 1 ? (
        <div className={styles.actions}>
          <button type="button" className={styles.button} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
            Previous
          </button>
          {pages.map((value, index) => (
            <span className={styles.pageEntry} key={value}>
              {index > 0 && value - pages[index - 1] > 1 ? <span className={styles.ellipsis}>…</span> : null}
              <button
                type="button"
                className={`${styles.button} ${page === value ? styles.selectedPage : ''}`}
                aria-label={`Page ${value}`}
                aria-current={page === value ? 'page' : undefined}
                onClick={() => onPageChange(value)}
              >
                {value}
              </button>
            </span>
          ))}
          <button type="button" className={styles.button} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
            Next
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
          </button>
        </div>
      ) : null}
    </nav>
  );
}
