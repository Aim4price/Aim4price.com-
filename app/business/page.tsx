import AssetShareView from '../asset-share/[token]/AssetShareView';
import { listReceivedSharedEnquiries } from '../../lib/guest-leads';
import BusinessSharedAssets from './BusinessSharedAssets';
import { redirect } from 'next/navigation';
import AppHeader from '../../components/AppHeader';
import { sharedEnquiryReturnTo } from '../../lib/external-share-permissions';
import { getServerSession } from '../../lib/auth-session';
import { readBusinessAccount } from '../../lib/business-accounts';
import { businessWorkspaceSummary } from '../../lib/business-workspaces';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const metadata={title:'Shared Assets | Aim4price',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function BusinessPage({searchParams}:{searchParams?:{returnTo?:string;details?:string;share?:string;asset?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 const session=await getServerSession({requireActive:false});
 if(!session?.user)redirect('/business/join'+(returnTo?'?returnTo='+encodeURIComponent(returnTo):''));
 const account=await readBusinessAccount(session.user);
 if(!account)redirect('/account');
 if(searchParams?.details==='1')redirect('/account#account-details');
 const workspace=await businessWorkspaceSummary(session.user.id);
 const paused=account.profile.accountStatus!=='active'||!workspace||workspace.suspended;
 if (!paused && returnTo) redirect(returnTo);
 const verified = Boolean(session.user.emailVerified);
 const shares = paused || !verified ? [] : await listReceivedSharedEnquiries();
 const notice = paused ? 'Account access is paused. Contact Aim4price to review your access.' : !verified ? 'Verify your email in Account to view assets shared with you.' : '';
 const selectedShare = searchParams?.share && shares.find(share => share.token === searchParams.share);
 const selectedAsset = selectedShare && selectedShare.assets.find(asset => asset.id && asset.id === searchParams?.asset);
 const selection = selectedShare && selectedAsset ? {token:selectedShare.token, assetId:selectedAsset.id} : null;
 const detail = selection && <AssetShareView inline params={{token:selection.token}} searchParams={{open:'1',asset:selection.assetId}}/>;
 return <><AppHeader active="leads"/><BusinessSharedAssets freeBusiness={account.profile.accountType==='business'} shares={shares} notice={notice} {...(selection ? {selection,detail} : {})}/></>;
}
