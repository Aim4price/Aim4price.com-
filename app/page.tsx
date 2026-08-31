import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeEstimateBubbles from './home-estimate-bubbles';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" brandAlignment="working-column" />

      <section className={styles.heroSection}>
        <div className={styles.heroMedia}>
          <div className={styles.shell}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <h1 className={styles.heroTitle}>
                  <span className={styles.heroTitleLine}>
                    Digitise the assets{' '}
                    <span className={styles.heroTitleUnderline}>that matter</span>.
                  </span>
                  <span className={styles.heroTitleLine}>Manage the finer details.</span>
                </h1>

                <p className={styles.heroText}>
                  Create a living digital record for your assets, bringing its value, documents,
                  <br />
                  maintenance, fuel, costs and history to one live system.
                </p>
              </div>

              <HomeEstimateBubbles />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
