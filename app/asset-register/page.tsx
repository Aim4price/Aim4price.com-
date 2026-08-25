import { redirect } from "next/navigation";
import { getAccountProfile } from "../../lib/account-profile";
import { requireActivePageAccess } from "../../lib/account-access";
import AssetRegisterClient from "./asset-register-client";

export const runtime = "nodejs";

export default async function AssetRegisterPage() {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType === "finance" && profile.accountSubtype === "accountant") {
    redirect("/accountant/registers");
  }

  if (profile.accountType !== "owner" && profile.accountType !== "dealer") {
    redirect("/leads");
  }

  return <AssetRegisterClient />;
}
