import Link from 'next/link';
import styles from './AppFooter.module.css';

const year = new Date().getFullYear();

export default function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.topRow}>
          <div className={styles.brandBlock}>
            <div className={styles.brandName}>Aim4price</div>
            <p className={styles.brandText}>
              Machinery valuation, asset register, and marketplace tools in one clear workflow.
            </p>
          </div>

          <div className={styles.linksGrid}>
            <div className={styles.linkColumn}>
              <h3>Explore</h3>
              <Link href="/">Home</Link>
              <Link href="/valuation">Valuation</Link>
              <Link href="/asset-register">Asset Register</Link>
              <Link href="/marketplace">Marketplace</Link>
            </div>

            <div className={styles.linkColumn}>
              <h3>Start</h3>
              <Link href="/valuation">Free valuation</Link>
              <Link href="/asset-register">Open register</Link>
              <Link href="/marketplace">Browse marketplace</Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.shell}>
          <span>© {year} Aim4price</span>
          <span>Built for clearer machinery decisions.</span>
        </div>
      </div>
    </footer>
  );
}
