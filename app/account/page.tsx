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
      return <AccountClient initialProfile={profile} sharedAccount />;
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
