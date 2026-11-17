'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import styles from '../app/dealer/parts/parts.module.css';

export default function PartsTableRegion({ children }: { children: ReactNode }) {
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const header = document.querySelector('[data-header-nav-viewport]')?.closest('header');
    if (!header) return;
    const measure = () => region.current?.style.setProperty('--parts-header-offset', `${header.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return <div ref={region} className={`${styles.tableWrap} ${styles.stockTableScroll}`} tabIndex={0} role="region" aria-label="Parts results">{children}</div>;
}
