import { DesktopWorkspaceProvider } from '../../components/DesktopWorkspace';
import { getDesktopScope, desktopWorkspace } from '../../lib/desktop-workspace';
import { redirect } from "next/navigation";
import { requireActivePageAccess } from "../../lib/account-access";
import { getAccountProfile } from "../../lib/account-profile";
import AssetMapClient from "./asset-map-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AssetMapPage({ searchParams }: { searchParams?: { desktopMembershipId?: string } }) {
  const desktop = await getDesktopScope(searchParams?.desktopMembershipId);
  if (desktop) {
    if (!desktop.grant.permissions.viewMap) redirect('/team/access');
    return <DesktopWorkspaceProvider workspace={desktopWorkspace(desktop)}><AssetMapClient /></DesktopWorkspaceProvider>;
  }
  const { session } = await requireActivePageAccess();

  const profile = await getAccountProfile({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });

  if (profile.accountType !== "owner") {
    redirect("/account");
  }

  return <AssetMapClient />;
}
