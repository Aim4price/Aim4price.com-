import { getAccountProfile } from '../../lib/account-profile';
import { redirect } from "next/navigation";
import { requireActivePageAccess } from "../../lib/account-access";
import AssetRegistersClient from "./asset-registers-client";

export const runtime = "nodejs";

export default async function AssetRegistersPage() {
  const { session } = await requireActivePageAccess({allowBusinessWorkspace:true});

  const profile = await getAccountProfile(session.user,{businessToolsFor:session});

  if (profile.accountType !== "owner" && profile.accountType !== "dealer") {
    redirect("/leads");
  }

  return (
    <AssetRegistersClient
      showCombinedRegister={profile.accountType !== "dealer"}
    />
  );
}
