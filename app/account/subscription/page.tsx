import { redirect } from 'next/navigation';
import { getAnyServerSession } from '../../../lib/auth-session';
import { getAccountProfile } from '../../../lib/account-profile';

export default async function OwnerSubscriptionPage() {
  const session=await getAnyServerSession();
  if(!session?.user) redirect('/auth#login');
  const profile=await getAccountProfile(session.user);
  if(profile.accountType!=='owner' || profile.accountStatus!=='active') redirect('/account');
  if(profile.trialEndsAt) redirect('/account/owner-trial');
  redirect('/account?subscription=open');
}
