import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import AssetRegistersClient from "./asset-registers-client";

export const runtime = "nodejs";

export default async function AssetRegistersPage() {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== "owner" && profile.accountType !== "dealer") {
    redirect("/leads");
  }

  return (
    <AssetRegistersClient
      showCombinedRegister={profile.accountType !== "dealer"}
    />
  );
}
