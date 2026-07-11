import styles from './dealer.module.css';

export default function DealerLoading() {
  return (
    <main className={styles.loadingPage} aria-live="polite" aria-busy="true">
      <div className={styles.loadingCard}>
        <span className={styles.loadingSpinner} aria-hidden="true" />
        <strong>Opening Dealer App…</strong>
      </div>
    </main>
  );
}
