import { renderAiConnectionPage } from './render-page';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'AI connections | Aim4price', robots: { index: false, follow: false } };
export default function Page({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) { return renderAiConnectionPage(searchParams); }
