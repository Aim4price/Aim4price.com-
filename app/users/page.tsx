import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import UsersClient from "./users-client";

export const runtime = "nodejs";

export default async function UsersPage() {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType === "owner") {
    redirect("/asset-register");
  }

  return <UsersClient />;
}
