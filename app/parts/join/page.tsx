import type { Metadata } from "next";
import JoinParts from "./join-client";
export const metadata: Metadata = {
  title: "Private invitation | Aim4price",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <JoinParts />;
}
