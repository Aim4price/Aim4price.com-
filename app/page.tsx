import { cookies } from 'next/headers';
import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeHeroExperience from './home-hero-experience';
import HomeRoleSelector from './home-role-selector';
import styles from './page.module.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HOME_INTRO_COOKIE = 'a4p_home_intro';

export default async function HomePage() {
  await redirectAdminToAdmin();
  const showHomeIntro = cookies().get(HOME_INTRO_COOKIE)?.value !== 'v1';

  return (
    <main className={styles.page}>
      <AppHeader active="home" brandAlignment="working-column" />

      <HomeHeroExperience showIntro={showHomeIntro} />

      <HomeRoleSelector />
    </main>
  );
}
