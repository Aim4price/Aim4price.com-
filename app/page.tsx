import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeHeroExperience from './home-hero-experience';
import HomeRoleSelector from './home-role-selector';
import styles from './page.module.css';
import './home-wide-static.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <div className={styles.page}>
      <AppHeader active="home" />

      <main className={styles.homeMain}>
        <HomeHeroExperience />

        <HomeRoleSelector />
      </main>
    </div>
  );
}
