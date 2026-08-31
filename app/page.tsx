import Image from 'next/image';
import Link from 'next/link';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeHeroVideo from './home-hero-video';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" />

      <section className={styles.heroSection}>
        <div className={styles.heroMedia}>
          <HomeHeroVideo />

          <div className={styles.heroOverlay} />

          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1 className={styles.heroTitle}>
                  <span>Digitise the assets that matter.</span>
                  <span>Manage the details.</span>
                </h1>

                <p className={styles.heroText}>
                  Create a living digital record for your assets, bringing its value, documents,
                  <br />
                  maintenance, fuel, costs and history to one live system.
                </p>

                <div className={styles.heroActions}>
                  <Link href="/valuation" className={styles.primaryCta}>
                    Get free estimate
                  </Link>
                  <Link href="/asset-register" className={styles.secondaryCta}>
                    Create Asset Register
                  </Link>
                </div>
              </div>

              <Link
                href="/about-us"
                className={styles.heroVisual}
                aria-label="About Aim4price"
              >
                <Image
                  src="/brand/aim4price-mark-white.png"
                  alt="Aim4price"
                  width={640}
                  height={640}
                  priority
                  className={styles.heroLogo}
                />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
