import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeHeroExperience from './home-hero-experience';
import HomeRoleSelector from './home-role-selector';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <main className={styles.page}>
      <AppHeader active="home" brandAlignment="working-column" />

      <HomeHeroExperience />

      <HomeRoleSelector />
    </main>
  );
}

