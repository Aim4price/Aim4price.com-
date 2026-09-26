import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import type { Metadata } from 'next';
import { readLeadPage, resolveLeadAccess } from '../../../lib/guest-leads';
import GuestLeadActions from '../../../components/asset-register/GuestLeadActions';
import styles from '../../../components/asset-register/GuestLead.module.css';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared asset details',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default async function AssetSharePage({ params, searchParams }: { params: { token: string }; searchParams?: { from?: string | string[] } }) {
  const lead = await readLeadPage(params.token);
  const header = <Suspense fallback={null}><AppHeader active="none" /></Suspense>;
  if (!lead) return <>{header}<SharedAssetCards share={null}/></>;
  const {share,details,reports,ownerId}=lead;
  const access=details?await resolveLeadAccess(ownerId,details.recipientEmail):'sign-in';
  return <>{header}<SharedAssetCards share={share} senderName={details?.replyName || share.senderName || ''} allowBusinessDetails request={details?<section className={styles.panel}><h2>Request from {details.replyName}</h2><p>{details.request}</p><small>For {details.recipientName||'the recipient business'}</small></section>:null} actions={details?<GuestLeadActions token={params.token} details={{...details,replyEmail:details.allowReply?details.replyEmail:'',replyPhone:details.allowReply?details.replyPhone:''}} reports={reports} access={access}/>:null}/></>;
}
