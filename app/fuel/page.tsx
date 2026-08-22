import { redirect } from "next/navigation";
import { requireActivePageAccess } from "../../lib/account-access";
import { getAccountProfile } from "../../lib/account-profile";
import { normalizeInternalReturnPath, readSingleSearchParam } from "../../lib/internal-return-path";
import FuelClient from "./fuel-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FuelPageProps = {
  searchParams?: {
    assetId?: string | string[];
    add?: string | string[];
    action?: string | string[];
    returnTo?: string | string[];
  };
};

export default async function FuelPage({ searchParams }: FuelPageProps) {
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== "owner") {
    redirect("/account");
  }

  const initialAssetId = readSingleSearchParam(searchParams?.assetId).slice(0, 120);
  const initialOpenAdd = readSingleSearchParam(searchParams?.add) === '1'
    || readSingleSearchParam(searchParams?.action).toLowerCase() === 'add';
  const initialReturnTo = normalizeInternalReturnPath(searchParams?.returnTo);

  return (
    <FuelClient
      addedByLabel={session.user.name || session.user.email || "Signed-in owner account"}
      initialAssetId={initialAssetId}
      initialOpenAdd={initialOpenAdd}
      initialReturnTo={initialReturnTo}
    />
  );
}
