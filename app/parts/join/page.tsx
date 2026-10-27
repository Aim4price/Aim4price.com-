import type { Metadata } from "next";
import { Suspense } from "react";
import AppHeader from "../../../components/AppHeader";
import JoinParts from "./join-client";
export const metadata: Metadata = {
  title: "Private invitation | Aim4price",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <>
      <Suspense fallback={null}>
        <AppHeader active="parts" />
      </Suspense>
      <JoinParts />
    </>
  );
}
