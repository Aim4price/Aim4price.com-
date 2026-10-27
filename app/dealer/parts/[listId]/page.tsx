import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartsActor } from "../../../../lib/parts-network-access";
import PartsClient from "../parts-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parts list | Aim4price", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: { listId: string } }) {
  const path = "/dealer/parts/" + encodeURIComponent(params.listId);
  if (!(await getPartsActor())) redirect("/dealer/login");
  return <><PartsClient key={params.listId} listId={params.listId} /></>;
}
