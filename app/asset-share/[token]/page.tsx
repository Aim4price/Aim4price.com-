import { guestCreditLimit } from '../../../lib/guest-enquiry-credits';
import GuestEnquiryAccess from '../../../components/GuestEnquiryAccess';
import Link from 'next/link';
import guestStyles from '../../business/page.module.css';
import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import type { Metadata } from 'next';
import { readLeadPage } from '../../../lib/guest-leads';
import { externalLeadAccess, leadAllows } from '../../../lib/external-lead-access';
import SharedEnquiryRequest from '../../../components/asset-register/SharedEnquiryRequest';
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
  const {share,details,reports}=lead;
  const {access}=await externalLeadAccess(lead);
  const returnTo=`/asset-share/${params.token}`;
  if (details?.recipientEmail && !details.recipientUserId && ['sign-in','signup-required','wrong-recipient','suspended'].includes(access)) return <>{header}<main className={guestStyles.page}><GuestEnquiryAccess returnTo={returnTo} accessState={access} blocked={access==='signup-required'} limit={guestCreditLimit()}/></main></>;
  return <>{header}{access==='guest'&&<aside className={guestStyles.guestBanner}><strong>Guest access · {guestCreditLimit() ?? 'x'} credits</strong><span>No personal inbox, saved history or backup service. Reply through your own email.</span><Link href={`/business/join?mode=account&returnTo=${encodeURIComponent(returnTo)}`}>Create Business account</Link></aside>}<SharedAssetCards share={share} senderName={share.senderName || details?.replyName || ''} request={details?<SharedEnquiryRequest sender={share.senderName || details.replyName} request={details.request} recipient={details.recipientName}/>:null} enquiry={details?{token:params.token,access,reports,reply:details.allowReply?{email:details.replyEmail,phone:details.replyPhone,name:details.replyName}:undefined,permissions:{reports:leadAllows(lead,'reports'),documents:leadAllows(lead,'documents'),serialNumber:leadAllows(lead,'serialNumber'),replacementPrice:leadAllows(lead,'replacementPrice')}}:undefined}/></>;
}
