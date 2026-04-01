import Link from 'next/link';
import styles from './AppFooter.module.css';

export default function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.brandColumn}>
          <div className={styles.brandName}>Aim4price</div>
          <p className={styles.brandText}>
            Tractors-first valuation frontend with the focus kept on a cleaner homepage, a guided valuation flow,
            and a more professional result screen.
          </p>
        </div>

        <div className={styles.linksGrid}>
          <div>
            <h3>Pages</h3>
            <Link href="/">Home</Link>
            <Link href="/valuation">Valuation</Link>
          </div>

          <div>
            <h3>Current scope</h3>
            <span>Tractors only</span>
            <span>Frontend prototype</span>
            <span>Railway ready</span>
          </div>

          <div>
            <h3>Next layer later</h3>
            <span>Database integration</span>
            <span>Real comparables</span>
            <span>Reporting modules</span>
          </div>
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.shell}>
          <span>© 2026 Aim4price. This package is intentionally focused on Home and Valuation.</span>
        </div>
      </div>
    </footer>
  );
}
