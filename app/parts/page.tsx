import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import { getPartsActor } from "../../lib/parts-network-access";
import PartsClient from "../dealer/parts/parts-client";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Parts | Aim4price",
  robots: { index: false, follow: false },
};
export default async function Page() {
  if (!(await getPartsActor())) redirect("/auth?returnTo=%2Fparts");
  return (
    <>
      <AppHeader active="parts" />
      <PartsClient website />
    </>
  );
}
