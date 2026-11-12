import { DesktopWorkspaceProvider } from "../../../components/DesktopWorkspace";
import { desktopWorkspace } from "../../../lib/desktop-workspace";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartsActor } from "../../../lib/parts-network-access";
import PartsClient from "../../dealer/parts/parts-client";
import AppHeader from "../../../components/AppHeader";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parts list | Aim4price", robots: { index: false, follow: false } };
export default async function Page({ params, searchParams }: { params: { listId: string }; searchParams: {desktopMembershipId?:string} }) {
  const path = "/parts/" + encodeURIComponent(params.listId);
  const actor = await getPartsActor(false, searchParams.desktopMembershipId);
  if (!actor) redirect("/auth?returnTo=" + encodeURIComponent(path));
  return <DesktopWorkspaceProvider workspace={actor.team ? desktopWorkspace(actor.team) : null}><AppHeader active="parts" /><PartsClient key={params.listId} website listId={params.listId} /></DesktopWorkspaceProvider>;
}
