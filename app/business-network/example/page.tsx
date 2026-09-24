import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import BusinessEnquiryExample from '../../../components/business-network/BusinessEnquiryExample';
export const metadata = { title: 'Example asset enquiry', robots: { index: false, follow: false }, referrer: 'no-referrer' as const };
export default function Page({ searchParams }: { searchParams: { from?: string | string[] } }) {
  const senderName = typeof searchParams.from === 'string' ? searchParams.from.trim().slice(0, 120) : '';
  return <><Suspense fallback={null}><AppHeader active="none"/></Suspense><BusinessEnquiryExample senderName={senderName}/></>;
}
