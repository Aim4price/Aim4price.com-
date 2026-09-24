import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import BusinessAcceptanceForm from '../../../components/business-network/BusinessAcceptanceForm';
export const metadata = { title: 'Join the Aim4price directory', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page({ searchParams }: { searchParams: { from?: string | string[] } }) {
  const senderName = typeof searchParams.from === 'string' ? searchParams.from.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 120) : '';
  return <><Suspense fallback={null}><AppHeader active="none"/></Suspense><BusinessAcceptanceForm senderName={senderName}/></>;
}
