import { DesktopWorkspaceProvider } from "../../components/DesktopWorkspace";
import { desktopWorkspace } from "../../lib/desktop-workspace";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import { getPartsActor } from "../../lib/parts-network-access";
import PartsClient from "../dealer/parts/parts-client";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parts Stock | Aim4price",
  robots: { index: false, follow: false },
};
export default async function Page({ searchParams }: { searchParams: { list?: string; desktopMembershipId?:string } }) {
  if (searchParams.list) redirect("/parts/" + encodeURIComponent(searchParams.list) + (searchParams.desktopMembershipId ? "?desktopMembershipId=" + encodeURIComponent(searchParams.desktopMembershipId) : ""));
  const actor = await getPartsActor(false, searchParams.desktopMembershipId);
  if (!actor) redirect("/auth?returnTo=%2Fparts");
  return (
    <DesktopWorkspaceProvider workspace={actor.team ? desktopWorkspace(actor.team) : null}>
      <AppHeader active="parts" />
      <PartsClient website />
    </DesktopWorkspaceProvider>
  );
}
