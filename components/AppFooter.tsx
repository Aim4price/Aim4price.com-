import Link from 'next/link';
import styles from './AppFooter.module.css';

const year = new Date().getFullYear();

export default function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.topRow}>
          <div className={styles.brandColumn}>
            <span className={styles.kicker}>Aim4price</span>
            <div className={styles.brandName}>Cleaner machinery decisions.</div>
            <p className={styles.brandText}>
              Value equipment, keep an asset register, and move the right unit to market from one
              clearer workflow.
            </p>
          </div>

          <div className={styles.ctaRow}>
            <Link href="/valuation" className={styles.primaryCta}>
              Start valuation
            </Link>
            <Link href="/asset-register" className={styles.secondaryCta}>
              Open register
            </Link>
          </div>
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
            <h3>Workflow</h3>
            <span>Value machinery</span>
            <span>Save key assets</span>
            <span>Refresh when needed</span>
            <span>List when ready</span>
          </div>

          <div className={styles.linkColumn}>
            <h3>Current build</h3>
            <span>Front-end prototype</span>
            <span>Database-ready structure</span>
            <span>Marketplace browsing live</span>
            <span>Extra equipment types next</span>
          </div>
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.shell}>
          <span>© {year} Aim4price</span>
          <span>Built to make valuation, register, and marketplace actions easier to use.</span>
        </div>
      </div>
    </footer>
  );
}
