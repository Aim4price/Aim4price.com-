import AccountDirectoryListing from '../../components/AccountDirectoryListing';
import BusinessDetails from '../business/business-client';
import { readBusinessAccount } from '../../lib/business-accounts';
import sharedStyles from '../business/page.module.css';
import { sharingPlan } from '../../lib/sharing-foundation';
import { getAnyServerSession } from '../../lib/auth-session';
import { redirect } from 'next/navigation';
import { getAccountProfile, getAccountScanPinStatus } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import AccountClient from "./account-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const signedIn = await getAnyServerSession();
  if (signedIn?.user) {
    const profile = await getAccountProfile(signedIn.user);
    if (profile.accountType === 'business' || await sharingPlan(signedIn.user.id, profile.accountType) === 'free') {
      if (profile.accountStatus !== 'active') redirect('/pending-payment');
      const business = profile.accountType === 'business' ? await readBusinessAccount(signedIn.user) : null;
      const settings = <div className={sharedStyles.accountContent}>
        {business && <details id="account-details" className={`${sharedStyles.panel} ${sharedStyles.details}`} open><summary>Business details</summary><BusinessDetails businessName={profile.businessName || ''} phone={profile.phone || ''} website={business.review.website} evidence={business.review.evidence} email={signedIn.user.email} emailVerified={signedIn.user.emailVerified === true}/></details>}
        <AccountDirectoryListing name={profile.businessName || ''} phone={profile.phone || ''} emailVerified={signedIn.user.emailVerified === true}/>
      </div>;
      return <AccountClient initialProfile={profile} sharedAccount sharedSettings={settings} />;
    }
  }
  const { session } = await requireActivePageAccess();
  const [profile, scanPinStatus] = await Promise.all([
    getAccountProfile({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
    }),
    getAccountScanPinStatus(session.user.id),
  ]);

  return <AccountClient initialProfile={profile} initialScanPinStatus={scanPinStatus} />;
}
