import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../../components/AppHeader';
import { getAnyServerSession } from '../../../lib/auth-session';
import { canViewTutorialPreview } from '../../../lib/tutorial-preview-access';
import AudienceHome from '../audience-home';
import styles from '../../page.module.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata: Metadata = {
  title: 'Aim4price home — private preview',
  robots: { index: false, follow: false, nocache: true },
};

export default async function HomePreviewPage({ params }: { params: { audience: string } }) {
  const audience = params.audience;
  if (audience !== 'dealers' && audience !== 'businesses') notFound();
  const session = await getAnyServerSession();
  if (!session?.user?.id) redirect(`/auth?returnTo=${encodeURIComponent(`/home-preview/${audience}`)}#login`);
  if (!canViewTutorialPreview(session.user)) notFound();
  return <main className={styles.page} data-home-page data-public-photo="home">
    <AppHeader active="none" brandAlignment="working-column" />
    <AudienceHome audience={audience} />
  </main>;
}
