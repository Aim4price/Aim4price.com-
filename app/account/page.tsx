import { getAnyServerSession } from '../../lib/auth-session';
import { redirect } from 'next/navigation';
import { getAccountProfile, getAccountScanPinStatus } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import AccountClient from "./account-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const signedIn = await getAnyServerSession();
  if (signedIn?.user && (await getAccountProfile(signedIn.user)).accountType === "business") redirect("/business?details=1");
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
