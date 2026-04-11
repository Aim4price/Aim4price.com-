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
              Agricultural and industrial machinery pricing, asset register, and marketplace tools
              built for clearer decisions.
            </p>
          </div>

          <div className={styles.linksGrid}>
            <div className={styles.linkColumn}>
              <h3>Explore</h3>
              <Link href="/">Home</Link>
              <Link href="/valuation">Valuation</Link>
              <Link href="/asset-register">Asset Register</Link>
              <Link href="/marketplace">Marketplace</Link>
              <Link href="/account">Account</Link>
            </div>

            <div className={styles.linkColumn}>
              <h3>Legal</h3>
              <Link href="/privacy-policy">Privacy Policy</Link>
              <Link href="/terms-of-service">Terms of Service</Link>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.metaRow}>
        <div className={styles.shell}>
          <span>© {year} Aim4price</span>
          <span>Indicative valuations should be confirmed for formal insurance, finance, or transactional use.</span>
        </div>
      </div>
    </footer>
  );
}
