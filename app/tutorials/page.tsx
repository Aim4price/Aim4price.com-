import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { getAnyServerSession } from '../../lib/auth-session';
import { canViewTutorialPreview } from '../../lib/tutorial-preview-access';
import TutorialLibrary from './tutorial-library';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata: Metadata = {
  title: 'Tutorials — private preview',
  robots: { index: false, follow: false, nocache: true },
};

export default async function TutorialsPage() {
  const session = await getAnyServerSession();
  if (!session?.user?.id) redirect('/auth?returnTo=%2Ftutorials#login');
  if (!canViewTutorialPreview(session.user)) notFound();
  return <main><AppHeader active="none" /><TutorialLibrary /></main>;
}
