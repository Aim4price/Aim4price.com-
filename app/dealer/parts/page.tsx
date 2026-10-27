import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPartsActor } from "../../../lib/parts-network-access";
import PartsClient from "./parts-client";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parts | Aim4price",
  robots: { index: false, follow: false },
};
export default async function PartsPage({ searchParams }: { searchParams: { list?: string } }) {
  if (searchParams.list) redirect("/dealer/parts/" + encodeURIComponent(searchParams.list));
  if (!(await getPartsActor())) redirect("/dealer/login");
  return <PartsClient />;
}
