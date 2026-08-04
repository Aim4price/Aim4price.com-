import { getAccountProfile } from "../../../lib/account-profile";
import { requireActivePageAccess } from "../../../lib/account-access";
import VisibilityClient from "./visibility-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function AccountVisibilityPage() {
  const access = await requireActivePageAccess();
  const profile = await getAccountProfile({
    id: access.session.user.id,
    name: access.session.user.name,
    email: access.session.user.email,
  });

  return <VisibilityClient initialProfile={profile} />;
}
