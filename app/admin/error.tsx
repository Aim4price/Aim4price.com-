"use client";

import Link from "next/link";
import styles from "./page.module.css";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.page}>
      <section className={styles.shell}>
        <div className={styles.filterPanel} role="alert">
          <h1>This admin page could not load</h1>
          <p>Please try again. If the problem continues, return to Accounts and reopen this page.</p>
          <div className={styles.headerActions}>
            <button type="button" className={styles.clearFiltersButton} onClick={reset}>Try again</button>
            <Link href="/admin">Back to Accounts</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
