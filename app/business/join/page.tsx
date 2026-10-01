import { redirect } from 'next/navigation';
import { sharedEnquiryReturnTo } from '../../../lib/external-share-permissions';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getGuestViewer } from '../../../lib/guest-business-access';
import SharedEnquiryAccess from '../../../components/SharedEnquiryAccess';
import { sharingPlan } from '../../../lib/sharing-foundation';
import { getAccountProfile } from '../../../lib/account-profile';
import BusinessSignup from './business-signup';
export const metadata = { title: 'Free account | Aim4price' };
export const dynamic = 'force-dynamic';
export default async function JoinPage({searchParams}:{searchParams?:{returnTo?:string;mode?:string}}) {
 const returnTo=sharedEnquiryReturnTo(searchParams?.returnTo);
 const session=await getAnyServerSession();
 if(session?.user){
  const profile=await getAccountProfile(session.user);
  if(!session.user.emailVerified && await sharingPlan(session.user.id,profile.accountType)==='free')return <SharedEnquiryAccess access="verify-email" returnTo={returnTo||'/shared-enquiries'}/>;
  redirect(returnTo||'/business');
 }
 // Old guest sessions may prefill an email, but never confer account access.
 const guest=await getGuestViewer();
 return <BusinessSignup returnTo={returnTo} initialEmail={guest?.email}/>;
}
