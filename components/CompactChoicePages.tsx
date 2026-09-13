'use client';

import { Children, useEffect, useRef, useState, type ReactNode } from 'react';
import styles from './CompactChoicePages.module.css';

export default function CompactChoicePages({ children, columns = 2, rowHeight = 52, reservedHeight = 260, maxRows = 9, resetKey = '' }: {
  children: ReactNode; columns?: number; rowHeight?: number; reservedHeight?: number; maxRows?: number; resetKey?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(maxRows);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const resize = () => {
      const visible = Number.parseFloat(getComputedStyle(ref.current!).getPropertyValue('--website-visible-height')) || window.innerHeight;
      setRows(Math.max(1, Math.min(maxRows, Math.floor((visible - reservedHeight) / rowHeight))));
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [maxRows, reservedHeight, rowHeight]);
  useEffect(() => { setPage(0); }, [resetKey]);
  const items = Children.toArray(children);
  const size = rows * columns;
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return <div ref={ref} className={styles.container}>
    <div className={styles.grid} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>{items.slice(current * size, (current + 1) * size)}</div>
    {pages > 1 ? <nav className={styles.pages} aria-label="More choices">
      <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Previous</button>
      <span aria-live="polite">{current + 1} / {pages}</span>
      <button type="button" disabled={current + 1 === pages} onClick={() => setPage(current + 1)}>Next</button>
    </nav> : null}
  </div>;
}
