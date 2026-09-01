import Link from 'next/link';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeRoleSelector from './home-role-selector';
import HomeAssetPreview from './home-asset-preview';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" brandAlignment="working-column" />

      <section className={styles.heroSection} aria-labelledby="home-hero-title">
        <div className={styles.heroMedia}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1 id="home-hero-title" className={styles.heroTitle}>
                  <span className={styles.heroTitleLine}>Everything you own.</span>
                  <span className={styles.heroTitleLine}>One living record.</span>
                </h1>

                <p className={styles.heroText}>
                  Know what you have, what it is worth over time, what it costs and what needs
                  attention.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Get Free Estimate
                  </Link>
                  <a href="#choose-role" className={styles.secondaryCta}>
                    See How It Works
                  </a>
                </div>

                <p className={styles.heroSectors}>
                  <span>Agriculture</span>
                  <span>Construction</span>
                  <span>Industrial</span>
                  <span>Motor</span>
                </p>
              </div>

              <HomeAssetPreview />
            </div>
          </div>
        </div>
      </section>

      <HomeRoleSelector />
    </main>
  );
}
