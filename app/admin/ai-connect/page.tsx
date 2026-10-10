import AppHeader from '../../../components/AppHeader';
import { renderAiConnectionPage } from '../../account/ai-connect/render-page';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin AI connections | Aim4price', robots: { index: false, follow: false } };
export default async function Page({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) { return <><AppHeader active="account" />{await renderAiConnectionPage(searchParams, 'admin')}</>; }
