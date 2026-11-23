import { listActiveDealerMaintenanceLeadAccess } from '../../../lib/dealer-maintenance-tracker';
import SharedEnquiryLive from '../../../components/SharedEnquiryLive';
import SharedEnquiryLanding from '../../../components/SharedEnquiryLanding';
import { Suspense } from 'react';
import AppHeader from '../../../components/AppHeader';
import { readLeadPage, readProtectedShareSenderName } from '../../../lib/guest-leads';
import { externalLeadAccess, leadAllows } from '../../../lib/external-lead-access';
import SharedEnquiryRequest from '../../../components/asset-register/SharedEnquiryRequest';
import SharedAssetCards from '../../../components/asset-register/SharedAssetCards';
import SharedAssetPasswordGate from '../../../components/SharedAssetPasswordGate';
import { getAssetSharePasswordState } from '../../../lib/asset-share-links';
export default async function AssetShareView({ params, searchParams, inline = false }: { inline?: boolean; params: { token: string }; searchParams?: { from?: string | string[]; open?: string | string[]; asset?: string } }) {
  const header = inline ? null : <Suspense fallback={null}><AppHeader active="none" /></Suspense>;
  if (!/^[A-Za-z0-9_-]{43}$/.test(params.token)) return <>{header}<SharedAssetCards share={null}/></>;
  const passwordState = await getAssetSharePasswordState(params.token);
  if (passwordState.exists && passwordState.protected && !passwordState.unlocked) {
    const senderName = await readProtectedShareSenderName(params.token);
    return <>{header}<SharedAssetPasswordGate token={params.token} senderName={senderName}/></>;
  }
  const lead = await readLeadPage(params.token);
  if (!lead) return <>{header}<SharedAssetCards share={null}/></>;
  const {share,details,reports}=lead;
  const {access,user,business}=await externalLeadAccess(lead);
  const selected = typeof searchParams?.asset === 'string' && /^[0-9a-f-]{36}$/i.test(searchParams.asset) ? searchParams.asset : undefined;
  const returnTo=`/asset-share/${params.token}?open=1${selected ? '&asset='+selected : ''}`;
  // Standard links share the asset page. Identity checks still govern every protected action.
  const standardLink = !details || (details.accessMode === 'signed-in' &&
    !details.recipientUserId && !details.recipientEmail && !details.recipientWhatsApp && !details.recipientName);
  const guestView = !user && access === 'sign-in' && standardLink;
  const canOpen = guestView || ['owner','active','read-only'].includes(access);
  if (searchParams?.open !== '1' || !canOpen) return <>{header}<SharedEnquiryLanding returnTo={returnTo} access={guestView ? 'guest-view' : access} summary={{senderName: share.senderName || details?.replyName || '', umbrellaName: share.umbrellaName || '', assetCount: share.assets.length, assetTitles: share.umbrellaName ? [] : share.assets.map(asset => asset.title)}} prompt={searchParams?.open === '1'}/></>;
  if (selected && !share.assets.some(asset=>asset.assetId===selected)) return <>{header}<SharedAssetCards share={null}/></>;
  const tracking = inline && selected && user
    ? (await listActiveDealerMaintenanceLeadAccess({dealerUserId:user.id, leads:[{ownerUserId:lead.ownerId, assetId:selected}]}))[0]
    : undefined;
  return <>{header}<SharedEnquiryLive token={params.token} recordActivity={!guestView}/><SharedAssetCards inline={inline} canRemove={inline && Boolean(user) && access !== 'owner'} trackingAccessId={tracking?.hasMaintenanceRecords ? tracking.accessId : undefined} initialAssetId={selected} trackViews={Boolean(user && business)} shareToken={params.token} creditToken={business ? params.token : undefined} guestReturnTo={guestView ? returnTo : undefined} share={share} senderName={share.senderName || details?.replyName || ''} request={details?<SharedEnquiryRequest sender={share.senderName || details.replyName} request={details.request} recipient={details.recipientName}/>:null} enquiry={details?{token:params.token,access,reports:guestView ? [] : reports,reply:!guestView && details.allowReply?{email:details.replyEmail,phone:details.replyPhone,name:details.replyName}:undefined,permissions:{...details.permissions,reports:leadAllows(lead,'reports'),documents:leadAllows(lead,'documents'),serialNumber:leadAllows(lead,'serialNumber'),replacementPrice:leadAllows(lead,'replacementPrice')}}:undefined}/></>;
}
