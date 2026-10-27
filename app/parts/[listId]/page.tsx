import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartsActor } from "../../../lib/parts-network-access";
import PartsClient from "../../dealer/parts/parts-client";
import AppHeader from "../../../components/AppHeader";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parts list | Aim4price", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: { listId: string } }) {
  const path = "/parts/" + encodeURIComponent(params.listId);
  if (!(await getPartsActor())) redirect("/auth?returnTo=" + encodeURIComponent(path));
  return <><AppHeader active="parts" /><PartsClient key={params.listId} website listId={params.listId} /></>;
}
