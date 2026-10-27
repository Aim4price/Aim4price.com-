import type { Metadata } from "next";
import AppHeader from "../../../components/AppHeader";
import JoinParts from "./join-client";
export const metadata: Metadata = {
  title: "Private invitation | Aim4price",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <><AppHeader active="parts" /><JoinParts /></>;
}
