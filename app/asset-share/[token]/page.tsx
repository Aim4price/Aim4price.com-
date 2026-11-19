import SharedEnquiryLive from '../../../components/SharedEnquiryLive';
import SharedEnquiryLanding from '../../../components/SharedEnquiryLanding';
import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import type { Metadata } from 'next';
import { readLeadPage } from '../../../lib/guest-leads';
import { externalLeadAccess, leadAllows } from '../../../lib/external-lead-access';
import SharedEnquiryRequest from '../../../components/asset-register/SharedEnquiryRequest';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
import SharedAssetPasswordGate from '../../../components/SharedAssetPasswordGate';
import { getAssetSharePasswordState } from '../../../lib/asset-share-links';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Shared asset details',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer',
};
export default async function AssetSharePage({ params, searchParams }: { params: { token: string }; searchParams?: { from?: string | string[]; open?: string | string[] } }) {
  const header = <Suspense fallback={null}><AppHeader active="none" /></Suspense>;
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.token)) return <>{header}<SharedAssetCards share={null}/></>;
  const passwordState = await getAssetSharePasswordState(params.token);
  if (passwordState.exists && passwordState.protected && !passwordState.unlocked) return <><Suspense fallback={null}><AppHeader active="none" /></Suspense><SharedAssetPasswordGate token={params.token}/></>;
  const lead = await readLeadPage(params.token);
  if (!lead) return <>{header}<SharedAssetCards share={null}/></>;
  const {share,details,reports}=lead;
  const {access,user}=await externalLeadAccess(lead);
  const returnTo=`/asset-share/${params.token}?open=1`;
  // Standard links share the asset page. Identity checks still govern every protected action.
  const standardLink = !details || (details.accessMode === 'signed-in' &&
    !details.recipientUserId && !details.recipientEmail && !details.recipientWhatsApp && !details.recipientName);
  const guestView = !user && access === 'sign-in' && standardLink;
  const canOpen = guestView || ['owner','active','read-only'].includes(access);
  if (searchParams?.open !== '1' || !canOpen) return <>{header}<SharedEnquiryLanding returnTo={returnTo} access={guestView ? 'guest-view' : access} summary={{senderName: share.senderName || details?.replyName || '', umbrellaName: share.umbrellaName || '', assetCount: share.assets.length, assetTitles: share.umbrellaName ? [] : share.assets.map(asset => asset.title)}} prompt={searchParams?.open === '1'}/></>;
  return <>{header}{!guestView && <SharedEnquiryLive token={params.token}/>}<SharedAssetCards guestReturnTo={guestView ? returnTo : undefined} share={share} senderName={share.senderName || details?.replyName || ''} request={details?<SharedEnquiryRequest sender={share.senderName || details.replyName} request={details.request} recipient={details.recipientName}/>:null} enquiry={details?{token:params.token,access,reports:guestView ? [] : reports,reply:!guestView && details.allowReply?{email:details.replyEmail,phone:details.replyPhone,name:details.replyName}:undefined,permissions:{...details.permissions,reports:leadAllows(lead,'reports'),documents:leadAllows(lead,'documents'),serialNumber:leadAllows(lead,'serialNumber'),replacementPrice:leadAllows(lead,'replacementPrice')}}:undefined}/></>;
}
