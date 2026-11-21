import { isAccountingPilotSession } from '../../lib/accounting-pilot';
import { canManageTeamAccess } from '../../lib/team-access';
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

async function sharedAccountPage(user: NonNullable<Awaited<ReturnType<typeof getAnyServerSession>>>["user"], profile: Awaited<ReturnType<typeof getAccountProfile>>, canManageDesktopUsers: boolean) {
  const business = profile.accountType === 'business' ? await readBusinessAccount(user) : null;
  const businessAccount = profile.accountType === 'business' || (profile.accountType === 'dealer' && !isMiddlemanAccountSubtype(profile.accountSubtype));
  const credits = businessAccount ? await getBusinessCredits(user.id) : null;
  const subscription = credits ? { fullAccess: Boolean(credits.workspace.desktop || credits.workspace.paid_since), paidSince: credits.workspace.paid_since ? new Date(credits.workspace.paid_since).toISOString() : null, pending: Boolean(credits.workspace.upgrade_requested_at), owner: credits.workspace.role==='owner', remaining: Math.max(0,credits.balance.limit-credits.balance.used-credits.balance.held), limit:credits.balance.limit } : businessAccount ? { paidSince:null, pending:false, owner:false, remaining:null, limit:null } : undefined;
  const settings = <div className={sharedStyles.accountContent}>
    {business && <BusinessCredits data={credits} userId={user.id}/>}
    {<details id="account-details" className={`${sharedStyles.panel} ${sharedStyles.details}`} open><summary>Business details</summary><BusinessDetails businessName={profile.businessName || ''} phone={profile.phone || ''} website={business?.review.website || profile.websiteUrl || ''} evidence={business?.review.evidence || ''} email={user.email} emailVerified={user.emailVerified === true}/></details>}
  </div>;
  return <AccountClient canManageDesktopUsers={canManageDesktopUsers} initialProfile={profile} sharedAccount directoryEmailVerified={user.emailVerified === true} subscription={subscription} sharedSettings={settings} />;
}

export default async function AccountPage() {
  const signedIn = await getAnyServerSession();
  if (!signedIn?.user && await getManagedTeamActor()) redirect("/team/access");
  const canManageDesktopUsers = signedIn?.user ? await canManageTeamAccess() : false;
  if (signedIn?.user) {
    const profile = await getAccountProfile(signedIn.user);
    if (profile.accountType === 'business' || await sharingPlan(signedIn.user.id, profile.accountType) === 'free') {
      if (profile.accountStatus !== 'active') redirect('/pending-payment');
      return sharedAccountPage(signedIn.user, profile, canManageDesktopUsers);
    }
  }
  const { session } = await requireActivePageAccess();
  const profile = await getAccountProfile(session.user);
  if (session.user.id !== signedIn?.user.id && (profile.accountType === 'business' || await sharingPlan(session.user.id, profile.accountType) === 'free')) {
    if (profile.accountStatus !== 'active') redirect('/pending-payment');
    return sharedAccountPage(session.user, profile, false);
  }
  const scanPinStatus = await getAccountScanPinStatus(session.user.id);

  const fullBusiness = profile.accountType === 'dealer' && !isMiddlemanAccountSubtype(profile.accountSubtype);
  const subscription = fullBusiness ? { fullAccess:true, paidSince:null, pending:false, owner:true, remaining:0, limit:0 } : undefined;
  return <AccountClient subscription={subscription} showAccounting={profile.accountType === "owner" && isAccountingPilotSession(session)} canManageDesktopUsers={canManageDesktopUsers} initialProfile={profile} initialScanPinStatus={scanPinStatus} />;
}
