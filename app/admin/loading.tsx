import styles from './loading.module.css';

const SUMMARY_CARDS = Array.from({ length: 5 }, (_, index) => index);
const TABLE_ROWS = Array.from({ length: 5 }, (_, index) => index);

export default function AdminLoading() {
  return (
    <main className={styles.page} aria-busy="true" aria-live="polite">
      <section className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.pill}>Opening your Admin workspace</span>
            <span className={`${styles.skeleton} ${styles.title}`} />
            <span className={`${styles.skeleton} ${styles.subtitle}`} />
          </div>
          <span className={`${styles.skeleton} ${styles.manage}`} />
        </header>

        <div className={styles.cards} aria-hidden="true">
          {SUMMARY_CARDS.map((card) => (
            <span key={card} className={`${styles.skeleton} ${styles.card}`} />
          ))}
        </div>

        <section className={styles.panel} aria-hidden="true">
          <div className={styles.panelHeader}>
            <span className={`${styles.skeleton} ${styles.panelTitle}`} />
            <span className={`${styles.skeleton} ${styles.filter}`} />
          </div>
          {TABLE_ROWS.map((row) => (
            <span key={row} className={`${styles.skeleton} ${styles.row}`} />
          ))}
        </section>
        <p className={styles.status}>Loading Admin data…</p>
      </section>
    </main>
  );
}
