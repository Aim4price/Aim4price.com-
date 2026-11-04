'use client';
import { useEffect, useState } from 'react';
import styles from './AnnualReviewNotice.module.css';
export default function AnnualReviewNotice() {
  const [year, setYear] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function check() {
      try {
        const response = await fetch('/api/annual-review?status=1', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const value = await response.json();
        setYear(value.available ? value.year : null);
      } catch { /* A review notice must not interrupt the register. */ }
    }
    void check();
    const timer = setInterval(check, 60_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  if (!year) return null;
  return <aside className={styles.notice} aria-label="Annual asset review">
    {!dismissed && <div><strong>Your {year} asset review is ready</strong><p>Review replacement prices for the year ahead. You choose whether to make changes.</p></div>}
    <a href="/annual-review">{dismissed ? `${year} annual review` : 'Review my assets'}</a>
    {!dismissed && <button aria-label="Dismiss annual review reminder" onClick={() => setDismissed(true)}>×</button>}
  </aside>;
}
