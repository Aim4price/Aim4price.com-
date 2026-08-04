import { getAccountProfile, getAccountScanPinStatus } from "../../../lib/account-profile";
import { requireActivePageAccess } from "../../../lib/account-access";
import SecurityClient from "./security-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountSecurityPage() {
  const access = await requireActivePageAccess();
  const [profile, scanPinStatus] = await Promise.all([
    getAccountProfile({
      id: access.session.user.id,
      name: access.session.user.name,
      email: access.session.user.email,
    }),
    getAccountScanPinStatus(access.session.user.id),
  ]);

  return <SecurityClient initialProfile={profile} initialScanPinStatus={scanPinStatus} />;
}
