import Link from 'next/link';
import FieldManagerNavLink from '../field-manager-nav-link';
import styles from '../page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default function FieldManagerFuelPage() {
  return (
    <main className={`${styles.mobilePage} ${styles.homePage}`}>
      <section className={styles.fuelChoiceShell}>
        <header className={styles.fuelChoiceNav} aria-label="Field Manager fuel controls">
          <FieldManagerNavLink href="/field-manager" label="Back" />
          <FieldManagerNavLink href="/field-manager" label="Home" tone="home" />
        </header>

        <div className={styles.fuelChoiceContent}>
          <nav className={styles.fuelChoiceList} aria-label="Fuel source">
            <Link className={styles.fuelChoiceCard} href="/field-manager/diesel/storage" prefetch={false}>
              <span className={styles.fuelChoiceIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <ellipse cx="12" cy="5" rx="7" ry="3" />
                  <path d="M5 5v14c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
                  <path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
                </svg>
              </span>
              <span className={styles.fuelChoiceCopy}><strong>Storage tank</strong></span>
              <span className={styles.fuelChoiceArrow} aria-hidden="true">›</span>
            </Link>

            <Link className={styles.fuelChoiceCard} href="/field-manager/diesel/petrol-station" prefetch={false}>
              <span className={styles.fuelChoiceIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">
                  <path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16" />
                  <path d="M4 21h13M8 7h5M16 8h2l2 3v7a2 2 0 0 1-4 0v-4" />
                </svg>
              </span>
              <span className={styles.fuelChoiceCopy}><strong>Petrol station</strong></span>
              <span className={styles.fuelChoiceArrow} aria-hidden="true">›</span>
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
