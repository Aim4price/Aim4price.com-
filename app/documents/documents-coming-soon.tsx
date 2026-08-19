import Link from 'next/link';
import AppHeader from '../../components/AppHeader';
import styles from './page.module.css';

function ArchiveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 7.5h15v11h-15z" />
      <path d="M3.5 4.5h17v3h-17zM9 11h6" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2.5" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" />
    </svg>
  );
}

export default function DocumentsComingSoon() {
  return (
    <div className={styles.page}>
      <AppHeader active="documents" />

      <main className={`${styles.shell} ${styles.comingSoonStage}`}>
        <div className={styles.comingSoonPreview} aria-hidden="true">
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <span>Owner workspace</span>
              <h1>Document Vault</h1>
              <p>Keep important business records together—even when they do not belong to one specific asset.</p>
            </div>
            <div className={styles.heroIcon}><ArchiveIcon /></div>
          </section>

          <section className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <div className={styles.summaryHeading}><span>Total documents</span></div>
              <strong>24</strong>
              <p>Securely catalogued</p>
            </article>
            <article className={styles.summaryCard}>
              <div className={styles.summaryHeading}><span>Due within 60 days</span></div>
              <strong>3</strong>
              <p>Upcoming expiry actions</p>
            </article>
            <article className={styles.summaryCard}>
              <div className={styles.summaryHeading}><span>Linked to assets</span></div>
              <strong>12</strong>
              <p>12 kept at account level</p>
            </article>
          </section>

          <section className={styles.toolbar}>
            <div className={styles.searchBox}>
              <SearchIcon />
              <span>Search by title, file, category or linked asset</span>
            </div>
            <div className={styles.toolbarActions}>
              <span className={styles.toolbarButton}>Filters</span>
              <span className={styles.toolbarButton}>Recycle Bin</span>
              <span className={styles.uploadButton}>Upload document</span>
            </div>
          </section>

          <section className={styles.previewCategory}>
            <header>
              <div className={styles.categoryIcon}><ArchiveIcon /></div>
              <div>
                <h2>Company records</h2>
                <p>Important account-level documents</p>
              </div>
            </header>
            <div className={styles.previewRows}>
              <span />
              <span />
            </div>
          </section>
        </div>

        <section className={styles.comingSoonCard} aria-labelledby="documents-coming-soon-title">
          <div className={styles.comingSoonIcon}><LockIcon /></div>
          <div className={styles.comingSoonCopy}>
            <span>Document Vault</span>
            <h1 id="documents-coming-soon-title">Coming soon</h1>
            <p>Secure storage for important account documents, with or without a linked asset.</p>
          </div>
          <Link href="/asset-register">Back to Asset Register</Link>
        </section>
      </main>
    </div>
  );
}
