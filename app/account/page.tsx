import { isAccountingPilotSession } from '../../lib/accounting-pilot';
import { canManageTeamAccess } from '../../lib/team-access';
import AccountDirectoryListing from '../../components/AccountDirectoryListing';
import BusinessCredits, {getBusinessCredits} from '../../components/BusinessCredits';
import BusinessDetails from '../business/business-client';
import { readBusinessAccount } from '../../lib/business-accounts';
import sharedStyles from '../business/page.module.css';
import { sharingPlan } from '../../lib/sharing-foundation';
import { getAnyServerSession } from '../../lib/auth-session';
import { redirect } from 'next/navigation';
import { getAccountProfile, getAccountScanPinStatus } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import { getManagedTeamActor } from "../../lib/team-login";
import { isMiddlemanAccountSubtype } from '../../lib/middleman-account';
import AccountClient from "./account-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const signedIn = await getAnyServerSession();
  if (!signedIn?.user && await getManagedTeamActor()) redirect("/team/access");
  const canManageDesktopUsers = signedIn?.user ? await canManageTeamAccess() : false;
  if (signedIn?.user) {
    const profile = await getAccountProfile(signedIn.user);
    if (profile.accountType === 'business' || await sharingPlan(signedIn.user.id, profile.accountType) === 'free') {
      if (profile.accountStatus !== 'active') redirect('/pending-payment');
      const business = profile.accountType === 'business' ? await readBusinessAccount(signedIn.user) : null;
      const credits = business ? await getBusinessCredits(signedIn.user.id) : null;
      const subscription = credits ? { paidSince: credits.workspace.paid_since ? new Date(credits.workspace.paid_since).toISOString() : null, pending: Boolean(credits.workspace.upgrade_requested_at), owner: credits.workspace.role==='owner', remaining: Math.max(0,credits.balance.limit-credits.balance.used-credits.balance.held), limit:credits.balance.limit } : undefined;
      const settings = <div className={sharedStyles.accountContent}>
        {business && <BusinessCredits data={credits} userId={signedIn.user.id}/>}
        {<details id="account-details" className={`${sharedStyles.panel} ${sharedStyles.details}`} open><summary>Business details</summary><BusinessDetails businessName={profile.businessName || ''} phone={profile.phone || ''} website={business?.review.website || profile.websiteUrl || ''} evidence={business?.review.evidence || ''} email={signedIn.user.email} emailVerified={signedIn.user.emailVerified === true}/></details>}
        <AccountDirectoryListing name={profile.businessName || ''} phone={profile.phone || ''} emailVerified={signedIn.user.emailVerified === true}/>
      </div>;
      return <AccountClient canManageDesktopUsers={canManageDesktopUsers} initialProfile={profile} sharedAccount subscription={subscription} sharedSettings={settings} />;
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

  const fullBusiness = profile.accountType === 'dealer' && !isMiddlemanAccountSubtype(profile.accountSubtype);
  const subscription = fullBusiness ? { fullAccess:true, paidSince:null, pending:false, owner:true, remaining:0, limit:0 } : undefined;
  return <AccountClient subscription={subscription} showAccounting={profile.accountType === "owner" && isAccountingPilotSession(session)} canManageDesktopUsers={canManageDesktopUsers} initialProfile={profile} initialScanPinStatus={scanPinStatus} />;
}
