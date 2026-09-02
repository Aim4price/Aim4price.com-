import { redirectAdminToAdmin } from '../lib/account-access';
import AppHeader from '../components/AppHeader';
import HomeDisplayCheck from './home-display-check';
import HomeHeroExperience from './home-hero-experience';
import HomeRoleSelector from './home-role-selector';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await redirectAdminToAdmin();

  return (
    <HomeDisplayCheck>
      <AppHeader active="home" brandAlignment="working-column" />

      <HomeHeroExperience />

      <HomeRoleSelector />
    </HomeDisplayCheck>
  );
}
