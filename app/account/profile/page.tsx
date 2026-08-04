import { getAccountProfile } from "../../../lib/account-profile";
import { requireActivePageAccess } from "../../../lib/account-access";
import ProfileClient from "./profile-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountProfilePage() {
  const access = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: access.session.user.id,
    name: access.session.user.name,
    email: access.session.user.email,
  });

  return <ProfileClient initialProfile={profile} />;
}
